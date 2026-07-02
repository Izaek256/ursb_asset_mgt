import React from "react";
import { apiFetch, useAuth } from "../AuthContext";
import { AssetRequest, UserRow } from "../types";
import { ICONS } from "../utils/icons";
import Modal from "../components/Modal";
import FormInput from "../components/FormInput";
import StatusBadge from "../components/StatusBadge";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import SuccessBanner from "../components/SuccessBanner";
import EmptyState from "../components/EmptyState";
import ConfirmDialog from "../components/ConfirmDialog";
import PageHeader from "../components/PageHeader";

interface AssetOption {
  asset_id: string;
  asset_name: string;
  asset_type: string;
  serial_number: string;
  status: string;
}

export default function Requests() {
  const { user } = useAuth();
  const [requests, setRequests] = React.useState<AssetRequest[]>([]);
  const [assets, setAssets] = React.useState<AssetOption[]>([]);
  const [users, setUsers] = React.useState<UserRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  // Filters (Admin/Manager only)
  const [statusFilter, setStatusFilter] = React.useState("All");
  const [requestedBySearch, setRequestedBySearch] = React.useState("");

  // Modals state
  const [showSubmitModal, setShowSubmitModal] = React.useState(false);
  const [showApproveModal, setShowApproveModal] = React.useState(false);
  const [showRejectModal, setShowRejectModal] = React.useState(false);
  const [showAssignModal, setShowAssignModal] = React.useState(false);
  const [selectedRequest, setSelectedRequest] = React.useState<AssetRequest | null>(null);

  // Form states
  const [submitForm, setSubmitForm] = React.useState({
    asset_id: "",
    asset_type: "",
    reason: "",
    priority: "Normal",
    required_by_date: "",
  });

  const [approveForm, setApproveForm] = React.useState({
    assigned_asset_id: "",
  });

  const [rejectForm, setRejectForm] = React.useState({
    notes: "",
  });

  const [assignForm, setAssignForm] = React.useState({
    asset_id: "",
    custodian_id: "",
  });

  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Dirty close dialogs
  const [dirtyConfirm, setDirtyConfirm] = React.useState<{ open: boolean; onConfirm: () => void } | null>(null);
  // Complete request confirmation
  const [completeConfirm, setCompleteConfirm] = React.useState<AssetRequest | null>(null);

  const isAdminOrManager = user?.role === "System Administrator" || user?.role === "Asset Manager";

  const fetchRequests = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ requests: AssetRequest[]; total: number }>("/requests", {});
      setRequests(data.requests);
    } catch (err: any) {
      setError(err.message || "Failed to load requests.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchAssetsAndUsers = React.useCallback(async () => {
    try {
      const assetsData = await apiFetch<AssetOption[]>("/assets", {});
      setAssets(assetsData);
      
      if (isAdminOrManager) {
        const usersData = await apiFetch<UserRow[]>("/admin/users", {});
        setUsers(usersData);
      }
    } catch (err) {
      console.error("Failed to load assets/users context", err);
    }
  }, [isAdminOrManager]);

  React.useEffect(() => {
    fetchRequests();
    fetchAssetsAndUsers();
  }, [fetchRequests, fetchAssetsAndUsers]);

  // Form dirty checks
  const isSubmitFormDirty = submitForm.asset_id || submitForm.asset_type || submitForm.reason || submitForm.required_by_date;
  const isRejectFormDirty = rejectForm.notes.trim().length > 0;
  const isAssignFormDirty = assignForm.custodian_id !== "";

  const handleCloseSubmitModal = () => {
    if (isSubmitFormDirty) {
      setDirtyConfirm({
        open: true,
        onConfirm: () => {
          setShowSubmitModal(false);
          setSubmitForm({ asset_id: "", asset_type: "", reason: "", priority: "Normal", required_by_date: "" });
          setDirtyConfirm(null);
        },
      });
    } else {
      setShowSubmitModal(false);
    }
  };

  const handleCloseRejectModal = () => {
    if (isRejectFormDirty) {
      setDirtyConfirm({
        open: true,
        onConfirm: () => {
          setShowRejectModal(false);
          setRejectForm({ notes: "" });
          setDirtyConfirm(null);
        },
      });
    } else {
      setShowRejectModal(false);
    }
  };

  const handleCloseAssignModal = () => {
    if (isAssignFormDirty) {
      setDirtyConfirm({
        open: true,
        onConfirm: () => {
          setShowAssignModal(false);
          setAssignForm({ asset_id: "", custodian_id: "" });
          setDirtyConfirm(null);
        },
      });
    } else {
      setShowAssignModal(false);
    }
  };

  // Handlers
  const handleClearFilters = () => {
    setStatusFilter("All");
    setRequestedBySearch("");
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submitForm.asset_id && !submitForm.asset_type) {
      setError("Please specify either a specific Asset or an Asset Type.");
      return;
    }
    if (submitForm.reason.length < 10) {
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await apiFetch("/requests", {
        method: "POST",
        body: JSON.stringify({
          asset_id: submitForm.asset_id || null,
          asset_type: submitForm.asset_type || null,
          reason: submitForm.reason,
          priority: submitForm.priority,
          required_by_date: submitForm.required_by_date || null,
        }),
      });
      setSuccess("Asset request submitted successfully.");
      setShowSubmitModal(false);
      setSubmitForm({ asset_id: "", asset_type: "", reason: "", priority: "Normal", required_by_date: "" });
      fetchRequests();
    } catch (err: any) {
      setError(err.message || "Failed to submit request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveClick = (req: AssetRequest) => {
    setSelectedRequest(req);
    // If request does not have an asset_id, we need to assign one of the requested type
    if (!req.asset_id) {
      const typeAssets = assets.filter(a => a.asset_type === req.asset_type && a.status === "Active");
      setApproveForm({
        assigned_asset_id: typeAssets[0]?.asset_id || "",
      });
    } else {
      setApproveForm({ assigned_asset_id: "" });
    }
    setShowApproveModal(true);
  };

  const handleApproveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;
    if (!selectedRequest.asset_id && !approveForm.assigned_asset_id) {
      setError("Please select an asset to assign for this request.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/requests/${selectedRequest.request_id}/approve`, {
        method: "PUT",
        body: JSON.stringify({
          assigned_asset_id: approveForm.assigned_asset_id || null,
        }),
      });
      setSuccess(`Request #${selectedRequest.request_id} has been approved.`);
      setShowApproveModal(false);
      setSelectedRequest(null);
      fetchRequests();
    } catch (err: any) {
      setError(err.message || "Failed to approve request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectClick = (req: AssetRequest) => {
    setSelectedRequest(req);
    setRejectForm({ notes: "" });
    setShowRejectModal(true);
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest || !rejectForm.notes.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/requests/${selectedRequest.request_id}/reject`, {
        method: "PUT",
        body: JSON.stringify({ notes: rejectForm.notes }),
      });
      setSuccess(`Request #${selectedRequest.request_id} has been rejected.`);
      setShowRejectModal(false);
      setSelectedRequest(null);
      fetchRequests();
    } catch (err: any) {
      setError(err.message || "Failed to reject request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssignClick = (req: AssetRequest) => {
    setSelectedRequest(req);
    setAssignForm({
      asset_id: req.asset_id || "",
      custodian_id: "",
    });
    setShowAssignModal(true);
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest || !assignForm.asset_id) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/requests/${selectedRequest.request_id}/assign`, {
        method: "PUT",
        body: JSON.stringify({
          asset_id: assignForm.asset_id,
          custodian_id: assignForm.custodian_id ? parseInt(assignForm.custodian_id, 10) : null,
        }),
      });
      setSuccess(`Request #${selectedRequest.request_id} assigned successfully.`);
      setShowAssignModal(false);
      setSelectedRequest(null);
      fetchRequests();
    } catch (err: any) {
      setError(err.message || "Failed to assign request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelClick = async (req: AssetRequest) => {
    setError(null);
    try {
      await apiFetch(`/requests/${req.request_id}/cancel`, { method: "PUT" });
      setSuccess(`Request #${req.request_id} cancelled.`);
      fetchRequests();
    } catch (err: any) {
      setError(err.message || "Failed to cancel request.");
    }
  };

  const handlePickupClick = async (req: AssetRequest) => {
    setError(null);
    try {
      await apiFetch(`/requests/${req.request_id}/pickup`, { method: "PUT" });
      setSuccess(`Pickup confirmed for request #${req.request_id}.`);
      fetchRequests();
    } catch (err: any) {
      setError(err.message || "Failed to confirm pickup.");
    }
  };

  const handleCompleteConfirm = async () => {
    if (!completeConfirm) return;
    setError(null);
    try {
      await apiFetch(`/requests/${completeConfirm.request_id}/complete`, { method: "PUT" });
      setSuccess(`Request #${completeConfirm.request_id} marked as completed.`);
      setCompleteConfirm(null);
      fetchRequests();
    } catch (err: any) {
      setError(err.message || "Failed to complete request.");
    }
  };

  // Client-side filtering
  const filteredRequests = requests.filter(r => {
    const matchesStatus = statusFilter === "All" || r.status === statusFilter;
    const matchesRequestedBy = !requestedBySearch.trim() || 
      (r.requested_by_name && r.requested_by_name.toLowerCase().includes(requestedBySearch.toLowerCase()));
    return matchesStatus && matchesRequestedBy;
  });

  const priorityBadgeColor = (priority: string) => {
    switch (priority) {
      case "Urgent": return "badge-rejected"; // Red
      case "High": return "badge-warning"; // Orange
      case "Normal": return "badge-info"; // Blue
      case "Low": return "badge-inactive"; // Gray
      default: return "";
    }
  };

  return (
    <>
      {success && <SuccessBanner message={success} onDismiss={() => setSuccess(null)} />}
      {error && <ErrorMessage message={error} />}

      <PageHeader 
        title={isAdminOrManager ? "Asset Requests" : "My Asset Requests"}
        subtitle={isAdminOrManager ? "Review and manage employee asset requests" : "Submit and track your asset requests"}
        actions={
          <button className="btn btn-primary" onClick={() => setShowSubmitModal(true)}>
            {ICONS.add} Submit Request
          </button>
        }
      />

      {isAdminOrManager && (
        <div className="filter-bar">
          <div className="filter-group">
            <label htmlFor="status-filter" className="filter-label">Status</label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="filter-select"
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="Assigned">Assigned</option>
              <option value="PickedUp">Picked Up</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
          <div className="filter-group">
            <label htmlFor="requested-by-filter" className="filter-label">Requested By</label>
            <input
              id="requested-by-filter"
              type="text"
              className="filter-search"
              placeholder="Search by requester..."
              value={requestedBySearch}
              onChange={(e) => setRequestedBySearch(e.target.value)}
            />
          </div>
          <button className="btn btn-secondary btn-sm" onClick={handleClearFilters}>
            Clear Filters
          </button>
          <div className="filter-count">{filteredRequests.length} requests</div>
        </div>
      )}

      {isLoading ? (
        <div className="page-loading" style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
          <LoadingSpinner size="lg" />
        </div>
      ) : filteredRequests.length === 0 ? (
        <EmptyState title="No requests found" description="There are no requests matching your criteria." icon="📋" />
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Request ID</th>
                <th>Asset / Type</th>
                <th>Requested By</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Required By</th>
                <th>Requested Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((r) => (
                <tr key={r.request_id}>
                  <td>#{r.request_id}</td>
                  <td>
                    {r.asset_id ? (
                      <div>
                        <div className="user-name">{r.asset_name || "Asset"}</div>
                        <div className="text-small text-muted">{r.asset_id}</div>
                      </div>
                    ) : (
                      <span className="text-muted">{r.asset_type}</span>
                    )}
                  </td>
                  <td>{r.requested_by_name || `User ID: ${r.requested_by}`}</td>
                  <td>
                    <span className={`badge ${priorityBadgeColor(r.priority)}`}>
                      {r.priority}
                    </span>
                  </td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                  <td>{r.required_by_date ? new Date(r.required_by_date).toLocaleDateString() : "-"}</td>
                  <td>{new Date(r.requested_date).toLocaleDateString()}</td>
                  <td>
                    <div style={{ display: "flex", gap: "0.25rem" }}>
                      {/* Employee Actions */}
                      {user?.role === "Employee" && r.status === "Pending" && (
                        <button className="btn btn-danger btn-sm" onClick={() => handleCancelClick(r)}>
                          Cancel
                        </button>
                      )}
                      {user?.role === "Employee" && r.status === "Assigned" && (
                        <button className="btn btn-secondary btn-sm" onClick={() => handlePickupClick(r)}>
                          🤝 Confirm Pickup
                        </button>
                      )}

                      {/* Admin/Manager Actions */}
                      {isAdminOrManager && r.status === "Pending" && (
                        <>
                          <button className="btn btn-primary btn-sm" onClick={() => handleApproveClick(r)}>
                            Approve
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleRejectClick(r)}>
                            Reject
                          </button>
                        </>
                      )}
                      {isAdminOrManager && r.status === "Approved" && (
                        <button className="btn btn-secondary btn-sm" onClick={() => handleAssignClick(r)}>
                          Assign
                        </button>
                      )}
                      {isAdminOrManager && r.status === "PickedUp" && (
                        <button className="btn btn-primary btn-sm" onClick={() => setCompleteConfirm(r)}>
                          Complete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Submit Request Modal */}
      <Modal open={showSubmitModal} onClose={handleCloseSubmitModal} title="Submit Asset Request">
        <form onSubmit={handleSubmitRequest}>
          <div className="form-group">
            <label htmlFor="submit-asset-id" className="form-label">Specific Asset (Optional)</label>
            <select
              id="submit-asset-id"
              className="form-control"
              value={submitForm.asset_id}
              onChange={(e) => setSubmitForm({ ...submitForm, asset_id: e.target.value })}
            >
              <option value="">Select an asset (if requesting a specific one)...</option>
              {assets.filter(a => a.status === "Active").map(a => (
                <option key={a.asset_id} value={a.asset_id}>
                  {a.asset_name} ({a.asset_id})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="submit-asset-type" className="form-label">Asset Type (Required if no asset chosen)</label>
            <select
              id="submit-asset-type"
              className="form-control"
              value={submitForm.asset_type}
              onChange={(e) => setSubmitForm({ ...submitForm, asset_type: e.target.value })}
            >
              <option value="">Select an asset type...</option>
              <option value="ICT Equipment">ICT Equipment</option>
              <option value="Furniture">Furniture</option>
              <option value="Vehicle">Vehicle</option>
              <option value="Software">Software</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <FormInput 
            type="textarea"
            label="Reason for Request"
            value={submitForm.reason}
            onChange={(val) => setSubmitForm({ ...submitForm, reason: val })}
            required
            placeholder="Please detail why you need this asset (minimum 10 characters)..."
            characterCount={{ current: submitForm.reason.length, min: 10 }}
          />

          <div className="form-group">
            <label htmlFor="submit-priority" className="form-label">Priority</label>
            <select
              id="submit-priority"
              className="form-control"
              value={submitForm.priority}
              onChange={(e) => setSubmitForm({ ...submitForm, priority: e.target.value })}
            >
              <option value="Low">Low</option>
              <option value="Normal">Normal</option>
              <option value="High">High</option>
              <option value="Urgent">Urgent</option>
            </select>
          </div>

          <FormInput 
            type="date"
            label="Required By Date (Optional)"
            value={submitForm.required_by_date}
            onChange={(val) => setSubmitForm({ ...submitForm, required_by_date: val })}
          />

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={handleCloseSubmitModal}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || submitForm.reason.length < 10 || (!submitForm.asset_id && !submitForm.asset_type)}
            >
              {isSubmitting ? <LoadingSpinner size="sm" /> : "Submit Request"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Approve Modal */}
      <Modal open={showApproveModal} onClose={() => setShowApproveModal(false)} title="Approve Request">
        <form onSubmit={handleApproveSubmit}>
          <p className="text-small text-muted" style={{ marginBottom: "1rem" }}>
            Confirm approval for request #{selectedRequest?.request_id} submitted by {selectedRequest?.requested_by_name}.
          </p>

          {!selectedRequest?.asset_id && (
            <div className="form-group">
              <label htmlFor="approve-asset-id" className="form-label">Select Asset to Assign</label>
              <select
                id="approve-asset-id"
                className="form-control"
                value={approveForm.assigned_asset_id}
                onChange={(e) => setApproveForm({ assigned_asset_id: e.target.value })}
                required
              >
                <option value="">Select an asset to fulfill this request...</option>
                {assets
                  .filter(a => a.asset_type === selectedRequest?.asset_type && a.status === "Active")
                  .map(a => (
                    <option key={a.asset_id} value={a.asset_id}>
                      {a.asset_name} ({a.asset_id}) - SN: {a.serial_number}
                    </option>
                  ))}
              </select>
            </div>
          )}

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setShowApproveModal(false)}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || (!selectedRequest?.asset_id && !approveForm.assigned_asset_id)}
            >
              {isSubmitting ? <LoadingSpinner size="sm" /> : "Approve Request"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Reject Modal */}
      <Modal open={showRejectModal} onClose={handleCloseRejectModal} title="Reject Request">
        <form onSubmit={handleRejectSubmit}>
          <FormInput 
            type="textarea"
            label="Rejection Reason / Notes"
            value={rejectForm.notes}
            onChange={(val) => setRejectForm({ notes: val })}
            required
            placeholder="Please provide details for the rejection..."
          />

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={handleCloseRejectModal}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-danger"
              disabled={isSubmitting || !rejectForm.notes.trim()}
            >
              {isSubmitting ? <LoadingSpinner size="sm" /> : "Reject Request"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Assign Modal */}
      <Modal open={showAssignModal} onClose={handleCloseAssignModal} title="Assign Asset Custody">
        <form onSubmit={handleAssignSubmit}>
          <FormInput 
            type="text"
            label="Asset ID"
            value={assignForm.asset_id}
            onChange={(val) => setAssignForm({ ...assignForm, asset_id: val })}
            disabled
          />

          <div className="form-group">
            <label htmlFor="assign-custodian" className="form-label">Assign Custodian (Defaults to you)</label>
            <select
              id="assign-custodian"
              className="form-control"
              value={assignForm.custodian_id}
              onChange={(e) => setAssignForm({ ...assignForm, custodian_id: e.target.value })}
            >
              <option value="">Select custodian user...</option>
              {users.filter(u => u.isActive).map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={handleCloseAssignModal}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || !assignForm.asset_id}
            >
              {isSubmitting ? <LoadingSpinner size="sm" /> : "Confirm Assignment"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Dirty Form Close Dialog */}
      <ConfirmDialog 
        open={!!dirtyConfirm?.open}
        title="Unsaved changes"
        message="You have unsaved changes. Are you sure you want to close? Your changes will be lost."
        onCancel={() => setDirtyConfirm(null)}
        onConfirm={() => {
          if (dirtyConfirm?.onConfirm) dirtyConfirm.onConfirm();
        }}
      />

      {/* Complete Confirmation Dialog */}
      <ConfirmDialog 
        open={!!completeConfirm}
        title="Mark request complete?"
        message="This will mark the request as Completed. The asset has been successfully handed over."
        onCancel={() => setCompleteConfirm(null)}
        onConfirm={handleCompleteConfirm}
      />
    </>
  );
}
