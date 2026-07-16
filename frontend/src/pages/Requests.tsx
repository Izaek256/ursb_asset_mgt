import React, { Fragment } from "react";
import { Tab } from "@headlessui/react";
import { apiFetch, useAuth } from "../AuthContext";
import { AssetRequest, UserRow } from "../types";
import { ICONS } from "../utils/icons";
import Modal from "../components/Modal";
import FormInput from "../components/common/FormInput";
import StatusBadge from "../components/common/badges/StatusBadge";
import ErrorMessage from "../components/ErrorMessage";
import SuccessBanner from "../components/common/SuccessBanner";
import EmptyState from "../components/EmptyState";
import ConfirmDialog from "../components/ConfirmDialog";
import PageHeader from "../components/PageHeader";
import Table, { Column } from "../components/common/Table";
import Button from "../components/common/Button";
import FilterBar, { FilterField, filterInputCls, filterSelectCls } from "../components/common/FilterBar";

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
  const [historyRequests, setHistoryRequests] = React.useState<AssetRequest[]>([]);
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
  const [showHandoverConfirm, setShowHandoverConfirm] = React.useState<AssetRequest | null>(null);
  const [showCustodianCancelConfirm, setShowCustodianCancelConfirm] = React.useState<AssetRequest | null>(null);
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

  const canManageRequests = user?.role === "SUPER_SYSTEM_ADMINISTRATOR" || user?.role === "ASSET_MANAGER" || user?.role === "Asset Manager";
  const isCustodian = user?.role === "ASSET_CUSTODIAN" || user?.role === "Asset Custodian";

  const fetchRequests = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ requests: AssetRequest[]; total: number }>("/requests", {});
      // Filter for active requests in main tab (Pending, Approved, Assigned, ReadyForPickup - until pickup confirmed)
      setRequests(data.requests.filter(r => 
        ["Pending", "Approved", "Assigned", "ReadyForPickup"].includes(r.status)
      ));
      // History tab shows requests after pickup confirmation or are completed/cancelled
      setHistoryRequests(data.requests.filter(r => 
        ["PickedUp", "Completed", "Rejected", "Cancelled"].includes(r.status)
      ));
    } catch (err: any) {
      setError(err.message || "Failed to load requests.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchAssetsAndUsers = React.useCallback(async () => {
    try {
      const assetsData = await apiFetch<AssetOption[]>("/assets?for_request=true", {});
      setAssets(assetsData);
      
      if (canManageRequests) {
        const usersData = await apiFetch<UserRow[]>("/admin/users", {});
        setUsers(usersData);
      }
    } catch (err) {
      console.error("Failed to load assets/users context", err);
    }
  }, [canManageRequests]);

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
      const typeAssets = assets.filter(a => a.asset_type === req.asset_type && a.status === "Available");
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

  const handleHandOverClick = (req: AssetRequest) => {
    setShowHandoverConfirm(req);
  };

  const handleHandOverConfirm = async () => {
    if (!showHandoverConfirm) return;
    setError(null);
    try {
      await apiFetch(`/requests/${showHandoverConfirm.request_id}/handover`, { method: "PUT" });
      setSuccess(`Asset handed over for request #${showHandoverConfirm.request_id}. Requester has been notified.`);
      setShowHandoverConfirm(null);
      fetchRequests();
    } catch (err: any) {
      setError(err.message || "Failed to hand over asset.");
    }
  };

  const handleCustodianCancelClick = (req: AssetRequest) => {
    setShowCustodianCancelConfirm(req);
  };

  const handleCustodianCancelConfirm = async () => {
    if (!showCustodianCancelConfirm) return;
    setError(null);
    try {
      await apiFetch(`/requests/${showCustodianCancelConfirm.request_id}/custodian-cancel`, { method: "PUT" });
      setSuccess(`Request #${showCustodianCancelConfirm.request_id} cancelled. Asset returned to available.`);
      setShowCustodianCancelConfirm(null);
      fetchRequests();
    } catch (err: any) {
      setError(err.message || "Failed to cancel request.");
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

  // Client-side filtering for history tab
  const filteredHistoryRequests = historyRequests.filter(r => {
    const matchesStatus = statusFilter === "All" || r.status === statusFilter;
    const matchesRequestedBy = !requestedBySearch.trim() || 
      (r.requested_by_name && r.requested_by_name.toLowerCase().includes(requestedBySearch.toLowerCase()));
    return matchesStatus && matchesRequestedBy;
  });

  const renderActions = (r: AssetRequest) => (
    <div className="flex flex-wrap gap-1.5 select-none">
      {(user?.role === "Employee" || user?.role === "EMPLOYEE") && r.status === "Pending" && (
        <Button variant="danger-outline" onClick={() => handleCancelClick(r)}>Cancel</Button>
      )}
      {(user?.role === "Employee" || user?.role === "EMPLOYEE") && r.status === "ReadyForPickup" && (
        <Button variant="outline" onClick={() => handlePickupClick(r)}>Confirm Pickup</Button>
      )}
      {isCustodian && r.assigned_to === parseInt(user.user_id) && r.status === "Assigned" && (
        <>
          <Button onClick={() => handleHandOverClick(r)}>Hand Over</Button>
          <Button variant="danger-outline" onClick={() => handleCustodianCancelClick(r)}>Cancel</Button>
        </>
      )}
      {canManageRequests && r.status === "Pending" && (
        <>
          <Button onClick={() => handleApproveClick(r)}>Approve</Button>
          <Button variant="danger-outline" onClick={() => handleRejectClick(r)}>Reject</Button>
        </>
      )}
      {canManageRequests && r.status === "Approved" && (
        <Button variant="outline" onClick={() => handleAssignClick(r)}>Assign</Button>
      )}
      {canManageRequests && r.status === "PickedUp" && (
        <Button onClick={() => setCompleteConfirm(r)}>Complete</Button>
      )}
    </div>
  );

  const columns: Column<AssetRequest>[] = [
    {
      header: "Request ID",
      render: (r) => <span className="font-bold text-ursb">#{r.request_id}</span>,
    },
    {
      header: "Asset / Type",
      render: (r) =>
        r.asset_id ? (
          <div>
            <div className="font-bold text-ink text-sm">{r.asset_name || "Asset"}</div>
            <div className="text-[11px] text-ink-dim mt-0.5">{r.asset_id}</div>
          </div>
        ) : (
          <span className="text-ink font-semibold">{r.asset_type}</span>
        ),
    },
    {
      header: "Requested By",
      render: (r) => (
        <div>
          <div className="font-semibold">{r.requested_by_name || "Unknown"}</div>
          <div className="text-[11px] text-ink-dim mt-0.5">ID: {r.requested_by}</div>
        </div>
      ),
    },
    {
      header: "Priority",
      render: (r) => <StatusBadge status={r.priority} />,
    },
    {
      header: "Status",
      render: (r) => (
        <div className="flex items-center gap-2">
          <StatusBadge status={r.status} />
        </div>
      ),
    },
    {
      header: "Required By",
      render: (r) => (r.required_by_date ? new Date(r.required_by_date).toLocaleDateString() : "—"),
    },
    {
      header: "Requested Date",
      render: (r) => new Date(r.requested_date).toLocaleDateString(),
    },
    {
      header: "Actions",
      render: (r) => renderActions(r),
    },
  ];

  const assetOptions = assets.filter(a => a.status === "Available").map(a => ({
    value: a.asset_id,
    label: `${a.asset_name} (${a.asset_id})`,
  }));

  const assetTypeOptions = [
    { value: "ICT Equipment", label: "ICT Equipment" },
    { value: "Furniture", label: "Furniture" },
    { value: "Vehicle", label: "Vehicle" },
    { value: "Software", label: "Software" },
    { value: "Other", label: "Other" },
  ];

  const priorityOptions = [
    { value: "Low", label: "Low" },
    { value: "Normal", label: "Normal" },
    { value: "High", label: "High" },
    { value: "Urgent", label: "Urgent" },
  ];

  const approveAssetOptions = assets
    .filter(a => a.asset_type === selectedRequest?.asset_type && a.status === "Available")
    .map(a => ({
      value: a.asset_id,
      label: `${a.asset_name} (${a.asset_id}) - SN: ${a.serial_number}`,
    }));

  const custodianOptions = users
    .filter(u => u.isActive && (u.role === "Asset Custodian" || u.role === "ASSET_CUSTODIAN"))
    .map(u => ({
      value: String(u.id),
      label: `${u.name} (${u.role})`,
    }));

  return (
    <div className="w-full flex flex-col gap-6 select-none font-sans">
      {success && <SuccessBanner message={success} onDismiss={() => setSuccess(null)} />}
      {error && <ErrorMessage message={error} />}

      <PageHeader
        title={canManageRequests || isCustodian ? "Asset Requests" : "My Asset Requests"}
        subtitle={
          canManageRequests || isCustodian
            ? "Review and manage employee asset requests"
            : "Submit and track your asset requests"
        }
        actions={
          <Button onClick={() => setShowSubmitModal(true)}>
            <ICONS.plus className="w-4 h-4 mr-1.5 stroke-[2.4]" />
            Submit Request
          </Button>
        }
      />

      {/* Tab Navigation */}
      <Tab.Group>
        <Tab.List className="flex flex-wrap gap-1.5 p-1.5 bg-white border border-sky-cardBorder rounded-xl w-fit">
          {["Pending Requests", "History"].map((tab) => (
            <Tab key={tab} as={Fragment}>
              {({ selected, ...tabProps }) => (
                <Button
                  {...tabProps}
                  type="button"
                  variant={selected ? "primary" : "ghost"}
                  className={selected ? "outline-none" : "shadow-none border-transparent bg-transparent !text-[#6a94d4] hover:bg-[#f9f8f6] outline-none"}
                  style={{ outline: "none", boxShadow: "none", WebkitTapHighlightColor: "transparent" }}
                >
                  {tab}
                </Button>
              )}
            </Tab>
          ))}
        </Tab.List>

        <Tab.Panels className="mt-2">
          <Tab.Panel>
            {isLoading ? (
              <div className="flex justify-center py-16">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-ursb" />
              </div>
            ) : requests.length === 0 ? (
              <EmptyState
                title="No pending requests found"
                description="There are no pending requests at this time."
                icon={<ICONS.requests className="w-6 h-6 text-ink-icon stroke-[2.2]" />}
              />
            ) : (
              <Table
                data={requests}
                columns={columns}
                rowKey={(r) => r.request_id}
                emptyMessage="No requests found."
              />
            )}
          </Tab.Panel>

          <Tab.Panel>
            {canManageRequests && (
              <FilterBar
                count={{ value: filteredHistoryRequests.length, label: "requests" }}
                onClear={handleClearFilters}
              >
                <FilterField label="Status" htmlFor="status-filter">
                  <select
                    id="status-filter"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className={filterSelectCls}
                  >
                    <option value="All">All Statuses</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Assigned">Assigned</option>
                    <option value="ReadyForPickup">Ready for Pickup</option>
                    <option value="PickedUp">Picked Up</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </FilterField>
                <FilterField label="Requested By" htmlFor="requested-by-filter">
                  <input
                    id="requested-by-filter"
                    type="text"
                    className={filterInputCls}
                    placeholder="Search by requester..."
                    value={requestedBySearch}
                    onChange={(e) => setRequestedBySearch(e.target.value)}
                  />
                </FilterField>
              </FilterBar>
            )}

            {isLoading ? (
              <div className="flex justify-center py-16">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-ursb" />
              </div>
            ) : filteredHistoryRequests.length === 0 ? (
              <EmptyState
                title="No history found"
                description="There are no confirmed or completed requests in the history."
                icon={<ICONS.requests className="w-6 h-6 text-ink-icon stroke-[2.2]" />}
              />
            ) : (
              <Table
                data={filteredHistoryRequests}
                columns={columns}
                rowKey={(r) => r.request_id}
                emptyMessage="No history found."
              />
            )}
          </Tab.Panel>
        </Tab.Panels>
      </Tab.Group>

      {/* Submit Request Modal */}
      <Modal open={showSubmitModal} onClose={handleCloseSubmitModal} title="Submit Asset Request">
        <form onSubmit={handleSubmitRequest} className="flex flex-col gap-4">
          <FormInput
            type="select"
            variant="light"
            label="Specific Asset (Optional)"
            value={submitForm.asset_id}
            onChange={(val) => setSubmitForm({ ...submitForm, asset_id: val })}
            options={[{ value: "", label: "Select an asset (optional)..." }, ...assetOptions]}
            searchable
          />

          <FormInput
            type="select"
            variant="light"
            label="Asset Type (Required if no asset chosen)"
            value={submitForm.asset_type}
            onChange={(val) => setSubmitForm({ ...submitForm, asset_type: val })}
            options={[{ value: "", label: "Select an asset type..." }, ...assetTypeOptions]}
          />

          <FormInput 
            type="textarea"
            variant="light"
            label="Reason for Request"
            value={submitForm.reason}
            onChange={(val) => setSubmitForm({ ...submitForm, reason: val })}
            required
            placeholder="Please detail why you need this asset (minimum 10 characters)..."
            characterCount={{ current: submitForm.reason.length, min: 10 }}
          />

          <FormInput
            type="select"
            variant="light"
            label="Priority"
            value={submitForm.priority}
            onChange={(val) => setSubmitForm({ ...submitForm, priority: val })}
            options={priorityOptions}
          />

          <FormInput 
            type="date"
            variant="light"
            label="Required By Date (Optional)"
            value={submitForm.required_by_date}
            onChange={(val) => setSubmitForm({ ...submitForm, required_by_date: val })}
          />

          <div className="flex justify-end gap-2.5 border-t border-sky-page/20 pt-4 mt-2">
            <Button type="button" variant="danger-outline" onClick={handleCloseSubmitModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={isSubmitting}
              disabled={isSubmitting || submitForm.reason.length < 10 || (!submitForm.asset_id && !submitForm.asset_type)}
            >
              Submit Request
            </Button>
          </div>
        </form>
      </Modal>

      {/* Approve Modal */}
      <Modal open={showApproveModal} onClose={() => setShowApproveModal(false)} title="Approve Request">
        <form onSubmit={handleApproveSubmit} className="flex flex-col gap-4">
          <p className="text-xs text-ink-dim/80 mb-2 leading-relaxed">
            Confirm approval for request <b className="text-ursb">#{selectedRequest?.request_id}</b> submitted by <b className="text-ink">{selectedRequest?.requested_by_name}</b>.
          </p>

          {!selectedRequest?.asset_id && (
            <FormInput
              type="select"
              variant="light"
              label="Select Asset to Assign"
              value={approveForm.assigned_asset_id}
              onChange={(val) => setApproveForm({ assigned_asset_id: val })}
              options={[{ value: "", label: "Select an asset to fulfill this request..." }, ...approveAssetOptions]}
              required
              searchable
            />
          )}

          <div className="flex justify-end gap-2.5 border-t border-sky-page/20 pt-4 mt-2">
            <Button type="button" variant="ghost" onClick={() => setShowApproveModal(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={isSubmitting}
              disabled={isSubmitting || (!selectedRequest?.asset_id && !approveForm.assigned_asset_id)}
            >
              Approve Request
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reject Modal */}
      <Modal open={showRejectModal} onClose={handleCloseRejectModal} title="Reject Request">
        <form onSubmit={handleRejectSubmit} className="flex flex-col gap-4">
          <FormInput 
            type="textarea"
            variant="light"
            label="Rejection Reason / Notes"
            value={rejectForm.notes}
            onChange={(val) => setRejectForm({ notes: val })}
            required
            placeholder="Please provide details for the rejection..."
          />

          <div className="flex justify-end gap-2.5 border-t border-sky-page/20 pt-4 mt-2">
            <Button type="button" variant="danger-outline" onClick={handleCloseRejectModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger-outline"
              isLoading={isSubmitting}
              disabled={isSubmitting || !rejectForm.notes.trim()}
            >
              Reject Request
            </Button>
          </div>
        </form>
      </Modal>

      {/* Assign Modal */}
      <Modal open={showAssignModal} onClose={handleCloseAssignModal} title="Assign Asset Custody">
        <form onSubmit={handleAssignSubmit} className="flex flex-col gap-4">
          <FormInput 
            type="text"
            variant="light"
            label="Asset ID"
            value={assignForm.asset_id}
            onChange={() => {}}
            disabled
          />

          <FormInput
            type="select"
            variant="light"
            label="Assign Custodian (Defaults to you)"
            value={assignForm.custodian_id}
            onChange={(val) => setAssignForm({ ...assignForm, custodian_id: val })}
            options={[{ value: "", label: "Select custodian user..." }, ...custodianOptions]}
          />

          <div className="flex justify-end gap-2.5 border-t border-sky-page/20 pt-4 mt-2">
            <Button type="button" variant="danger-outline" onClick={handleCloseAssignModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={isSubmitting}
              disabled={isSubmitting || !assignForm.asset_id}
            >
              Confirm Assignment
            </Button>
          </div>
        </form>
      </Modal>

      {/* Hand Over Confirmation Modal */}
      {showHandoverConfirm && (
        <Modal
          open={!!showHandoverConfirm}
          onClose={() => setShowHandoverConfirm(null)}
          title="Confirm Hand Over"
        >
          <div className="flex flex-col gap-4">
            <p className="text-sm text-ink">
              Are you sure you want to hand over the asset <strong>{showHandoverConfirm.asset_name || showHandoverConfirm.asset_type}</strong> to the requester?
            </p>
            <p className="text-xs text-ink-dim">
              This will change the asset status to "Pending Pickup" and notify the requester that the asset is ready for collection.
            </p>
            <div className="flex justify-end gap-2.5 border-t border-sky-page/20 pt-4 mt-2">
              <Button variant="danger-outline" onClick={() => setShowHandoverConfirm(null)}>
                Cancel
              </Button>
              <Button onClick={handleHandOverConfirm}>
                Confirm Hand Over
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Custodian Cancel Confirmation Modal */}
      {showCustodianCancelConfirm && (
        <Modal
          open={!!showCustodianCancelConfirm}
          onClose={() => setShowCustodianCancelConfirm(null)}
          title="Cancel Request"
        >
          <div className="flex flex-col gap-4">
            <p className="text-sm text-ink">
              Are you sure you want to cancel this request for <strong>{showCustodianCancelConfirm.asset_name || showCustodianCancelConfirm.asset_type}</strong>?
            </p>
            <p className="text-xs text-ink-dim">
              This will return the asset to "Available" status and notify the requester that their request has been cancelled.
            </p>
            <div className="flex justify-end gap-2.5 border-t border-sky-page/20 pt-4 mt-2">
              <Button variant="outline" onClick={() => setShowCustodianCancelConfirm(null)}>
                No, Keep Request
              </Button>
              <Button variant="danger-outline" onClick={handleCustodianCancelConfirm}>
                Yes, Cancel Request
              </Button>
            </div>
          </div>
        </Modal>
      )}

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
    </div>
  );
}

