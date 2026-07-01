import React from "react";
import { apiFetch, useAuth } from "../AuthContext";
import { Assignment, UserRow } from "../types";
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

export default function Assignments() {
  const { user } = useAuth();
  const [assignments, setAssignments] = React.useState<Assignment[]>([]);
  const [assets, setAssets] = React.useState<AssetOption[]>([]);
  const [users, setUsers] = React.useState<UserRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  // Modal & form states
  const [showAssignModal, setShowAssignModal] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [form, setForm] = React.useState({
    asset_id: "",
    assigned_to: "",
    assignment_date: new Date().toISOString().substring(0, 10),
    return_date: "",
    notes: "",
  });

  const [formErrors, setFormErrors] = React.useState({
    return_date: "",
  });

  // Action confirmations
  const [returnConfirm, setReturnConfirm] = React.useState<Assignment | null>(null);
  const [dirtyConfirm, setDirtyConfirm] = React.useState<{ open: boolean; onConfirm: () => void } | null>(null);

  const isAdminOrManager = user?.role === "System Administrator" || user?.role === "Asset Manager";

  const fetchAssignments = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ assignments: Assignment[]; total: number }>("/assignments", {});
      setAssignments(data.assignments);
    } catch (err: any) {
      setError(err.message || "Failed to load assignments.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchAssetsAndUsers = React.useCallback(async () => {
    try {
      const assetsData = await apiFetch<AssetOption[]>("/assets", {});
      setAssets(assetsData);
      
      const usersData = await apiFetch<UserRow[]>("/admin/users", {});
      setUsers(usersData);
    } catch (err) {
      console.error("Failed to load options.", err);
    }
  }, []);

  React.useEffect(() => {
    fetchAssignments();
    if (isAdminOrManager) {
      fetchAssetsAndUsers();
    }
  }, [fetchAssignments, fetchAssetsAndUsers, isAdminOrManager]);

  // Form dirty checks
  const isFormDirty = form.asset_id || form.assigned_to || form.notes || form.return_date;

  const handleCloseModal = () => {
    if (isFormDirty) {
      setDirtyConfirm({
        open: true,
        onConfirm: () => {
          setShowAssignModal(false);
          setForm({
            asset_id: "",
            assigned_to: "",
            assignment_date: new Date().toISOString().substring(0, 10),
            return_date: "",
            notes: "",
          });
          setFormErrors({ return_date: "" });
          setDirtyConfirm(null);
        },
      });
    } else {
      setShowAssignModal(false);
    }
  };

  const handleFieldChange = (field: string, value: string) => {
    const nextForm = { ...form, [field]: value };
    setForm(nextForm);

    // Validate return date must be after assignment date
    if (field === "return_date" || field === "assignment_date") {
      if (nextForm.return_date && nextForm.assignment_date) {
        const assignD = new Date(nextForm.assignment_date);
        const returnD = new Date(nextForm.return_date);
        if (returnD <= assignD) {
          setFormErrors({ ...formErrors, return_date: "Return date must be after assignment date" });
        } else {
          setFormErrors({ ...formErrors, return_date: "" });
        }
      } else {
        setFormErrors({ ...formErrors, return_date: "" });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formErrors.return_date || !form.asset_id || !form.assigned_to) {
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await apiFetch("/assignments", {
        method: "POST",
        body: JSON.stringify({
          asset_id: form.asset_id,
          assigned_to: parseInt(form.assigned_to, 10),
          assignment_date: form.assignment_date,
          return_date: form.return_date || null,
          notes: form.notes || null,
        }),
      });
      setSuccess("Asset assigned successfully.");
      setShowAssignModal(false);
      setForm({
        asset_id: "",
        assigned_to: "",
        assignment_date: new Date().toISOString().substring(0, 10),
        return_date: "",
        notes: "",
      });
      fetchAssignments();
    } catch (err: any) {
      setError(err.message || "Failed to assign asset.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReturnConfirm = async () => {
    if (!returnConfirm) return;
    setError(null);
    try {
      await apiFetch(`/assignments/${returnConfirm.assignment_id}/return`, {
        method: "POST",
      });
      setSuccess(`Asset ${returnConfirm.asset_name} returned successfully.`);
      setReturnConfirm(null);
      fetchAssignments();
    } catch (err: any) {
      setError(err.message || "Failed to return asset.");
    }
  };

  return (
    <>
      {success && <SuccessBanner message={success} onDismiss={() => setSuccess(null)} />}
      {error && <ErrorMessage message={error} />}

      <PageHeader 
        title="Asset Assignments"
        subtitle="Track custody of assets allocated to employees"
        actions={
          isAdminOrManager && (
            <button className="btn btn-primary" onClick={() => setShowAssignModal(true)}>
              {ICONS.add} Assign Asset
            </button>
          )
        }
      />

      {isLoading ? (
        <div className="page-loading" style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
          <LoadingSpinner size="lg" />
        </div>
      ) : assignments.length === 0 ? (
        <EmptyState title="No assignments found" description="There are no custody assignments recorded." icon="🔑" />
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th>Assigned To</th>
                <th>Assigned By</th>
                <th>Assignment Date</th>
                <th>Return Date</th>
                <th>Status</th>
                {isAdminOrManager && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.assignment_id}>
                  <td>
                    <div>
                      <div className="user-name">{a.asset_name || "Asset"}</div>
                      <div className="text-small text-muted">{a.asset_id}</div>
                    </div>
                  </td>
                  <td>{a.assigned_to_name || `User ID: ${a.assigned_to}`}</td>
                  <td>{a.assigned_by_name || `User ID: ${a.assigned_by}`}</td>
                  <td>{new Date(a.assigned_date).toLocaleDateString()}</td>
                  <td>{a.return_date ? new Date(a.return_date).toLocaleDateString() : "-"}</td>
                  <td>
                    <StatusBadge status={a.status} />
                  </td>
                  {isAdminOrManager && (
                    <td>
                      {a.status === "Active" && (
                        <button 
                          className="btn btn-secondary btn-sm"
                          onClick={() => setReturnConfirm(a)}
                        >
                          🤝 Return Asset
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Assign Asset Modal */}
      <Modal open={showAssignModal} onClose={handleCloseModal} title="Assign Asset">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="assign-asset-id" className="form-label">Asset *</label>
            <select
              id="assign-asset-id"
              className="form-control"
              value={form.asset_id}
              onChange={(e) => handleFieldChange("asset_id", e.target.value)}
              required
            >
              <option value="">Select an asset...</option>
              {assets.filter(a => a.status === "Active").map(a => (
                <option key={a.asset_id} value={a.asset_id}>
                  {a.asset_name} ({a.asset_id})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="assign-user" className="form-label">Assign To User *</label>
            <select
              id="assign-user"
              className="form-control"
              value={form.assigned_to}
              onChange={(e) => handleFieldChange("assigned_to", e.target.value)}
              required
            >
              <option value="">Select a user...</option>
              {users.filter(u => u.isActive).map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          </div>

          <FormInput 
            type="date"
            label="Assignment Date *"
            value={form.assignment_date}
            onChange={(val) => handleFieldChange("assignment_date", val)}
            required
          />

          <FormInput 
            type="date"
            label="Expected Return Date (Optional)"
            value={form.return_date}
            onChange={(val) => handleFieldChange("return_date", val)}
            error={formErrors.return_date}
          />

          <FormInput 
            type="textarea"
            label="Notes"
            value={form.notes}
            onChange={(val) => handleFieldChange("notes", val)}
            placeholder="Add assignment details or comments..."
          />

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || !!formErrors.return_date || !form.asset_id || !form.assigned_to}
            >
              {isSubmitting ? <LoadingSpinner size="sm" /> : "Assign Asset"}
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

      {/* Return Asset Confirm Dialog */}
      <ConfirmDialog 
        open={!!returnConfirm}
        title="Confirm Asset Return"
        message={`Are you sure you want to mark the assignment for "${returnConfirm?.asset_name}" as returned? This will release custody of the asset.`}
        onCancel={() => setReturnConfirm(null)}
        onConfirm={handleReturnConfirm}
      />
    </>
  );
}
