import React from "react";
import { apiFetch, useAuth } from "../AuthContext";
import { Assignment, UserRow } from "../types";
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
  const isCustodian = user?.role === "Asset Custodian";
  const isEmployee = user?.role === "Employee";

  const fetchAssignments = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const endpoint = isEmployee ? `/assignments?user_id=${user?.user_id}` : "/assignments";
      const data = await apiFetch<{ assignments: Assignment[]; total: number }>(endpoint, {});
      setAssignments(data.assignments);
    } catch (err: any) {
      setError(err.message || "Failed to load assignments.");
    } finally {
      setIsLoading(false);
    }
  }, [isEmployee, user]);

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

  const handleAccept = async (id: number) => {
    setError(null);
    setSuccess(null);
    try {
      await apiFetch(`/assignments/${id}/accept`, { method: "POST" });
      setSuccess("Assignment accepted successfully.");
      fetchAssignments();
    } catch (err: any) {
      setError(err.message || "Failed to accept assignment.");
    }
  };

  const handleDecline = async (id: number) => {
    setError(null);
    setSuccess(null);
    try {
      await apiFetch(`/assignments/${id}/decline`, { method: "POST" });
      setSuccess("Assignment declined successfully.");
      fetchAssignments();
    } catch (err: any) {
      setError(err.message || "Failed to decline assignment.");
    }
  };

  const handleConfirmHandover = async (id: number) => {
    setError(null);
    setSuccess(null);
    try {
      await apiFetch(`/assignments/${id}/confirm-handover`, { method: "POST" });
      setSuccess("Handover confirmed successfully. Asset is now assigned.");
      fetchAssignments();
    } catch (err: any) {
      setError(err.message || "Failed to confirm handover.");
    }
  };

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

  const handleFieldChange = (field: string, val: string) => {
    setForm((prev) => {
      const next = { ...prev, [field]: val };
      // Validate expected return date is after assignment date
      if (field === "assignment_date" || field === "return_date") {
        if (next.assignment_date && next.return_date) {
          const assign = new Date(next.assignment_date);
          const ret = new Date(next.return_date);
          if (ret < assign) {
            setFormErrors({ return_date: "Expected return date cannot be before assignment date." });
          } else {
            setFormErrors({ return_date: "" });
          }
        } else {
          setFormErrors({ return_date: "" });
        }
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.asset_id || !form.assigned_to) {
      setError("Please fill in all required fields.");
      return;
    }
    if (formErrors.return_date) return;

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
          expected_return_date: form.return_date || null,
          notes: form.notes,
        }),
      });
      setSuccess("Asset successfully assigned.");
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
      setError(err.message || "Failed to create assignment.");
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
    setSuccess(`Asset "${returnConfirm.asset_name}" return initiated successfully.`);
    setReturnConfirm(null);
    fetchAssignments();
  } catch (err: any) {
    setError(err.message || "Failed to initiate return.");
  }
};

  const columns: Column<Assignment>[] = [
    {
      header: "Asset",
      render: (a) => (
        <div>
          <div className="font-bold text-ink text-sm">{a.asset_name}</div>
          <div className="text-[11px] text-ink-dim mt-0.5">{a.asset_id}</div>
        </div>
      ),
    },
    {
      header: "Assigned To",
      render: (a) => <span className="font-semibold">{a.assigned_to_name}</span>,
    },
    {
      header: "Assigned By",
      render: (a) => a.assigned_by_name || "—",
    },
    {
      header: "Assignment Date",
      render: (a) => {
        const d = a.assignment_date || a.assigned_date;
        return d ? new Date(d).toLocaleDateString() : "—";
      },
    },
    {
      header: "Return Date",
      render: (a) =>
        a.return_date ? new Date(a.return_date).toLocaleDateString() : "—",
    },
    {
      header: "Status",
      render: (a) => <StatusBadge status={a.status} />,
    },
    
    {
      header: "Actions",
      render: (a) => (
        <div className="flex gap-2 select-none">
          {isEmployee && a.status === "Pending Acceptance" && (
            <>
              <Button variant="success" className="!py-1.5 !px-3 text-xs" onClick={() => handleAccept(a.assignment_id)}>
                Accept
              </Button>
              <Button variant="danger-outline" className="!py-1.5 !px-3 text-xs" onClick={() => handleDecline(a.assignment_id)}>
                Decline
              </Button>
            </>
          )}
          {isCustodian && a.status === "Accepted" && (
            <Button variant="primary" className="!py-1.5 !px-3 text-xs" onClick={() => handleConfirmHandover(a.assignment_id)}>
              Confirm Handover
            </Button>
          )}
          {isAdminOrManager && a.status === "Active" && (
            <Button variant="outline" className="!py-1.5 !px-3 text-xs" onClick={() => setReturnConfirm(a)}>
              Return Asset
            </Button>
          )}
          {/*
            Employee Return Asset button — renders only when ALL of:
            1. Current user is an Employee (not admin or manager)
            2. Current user is the assigned_to user on this assignment
            3. Assignment status is Active
          */}
          {user?.role === "Employee" &&
            String(a.assigned_to) === String(user?.user_id) &&
            a.status === "Active" && (
            <Button
              variant="outline"
              onClick={() => setReturnConfirm(a)}
            >
              Return Asset
            </Button>
          )}
        </div>
      ),
    },
  ];

  const assetOptions = assets.filter(a => a.status === "Available").map(a => ({
    value: a.asset_id,
    label: `${a.asset_name} (${a.asset_id})`,
  }));

  const userOptions = users.filter(u => u.isActive).map(u => ({
    value: String(u.id),
    label: `${u.name} (${u.role})`,
  }));

  return (
    <div className="w-full flex flex-col gap-6 select-none font-sans">
      {success && <SuccessBanner message={success} onDismiss={() => setSuccess(null)} />}
      {error && <ErrorMessage message={error} />}

      <PageHeader
        title="Asset Assignments"
        subtitle="Track custody of assets allocated to employees"
        actions={
          isAdminOrManager && (
            <Button onClick={() => setShowAssignModal(true)}>
              <ICONS.plus className="w-4 h-4 mr-1.5 stroke-[2.4]" />
              Assign Asset
            </Button>
          )
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-ursb" />
        </div>
      ) : assignments.length === 0 ? (
        <EmptyState
          title="No assignments found"
          description="There are no custody assignments recorded."
          icon={<ICONS.assignments className="w-6 h-6 text-ink-icon stroke-[2.2]" />}
        />
      ) : (
        <Table
          data={assignments}
          columns={columns}
          rowKey={(a) => a.assignment_id}
          emptyMessage="No assignments found."
        />
      )}

      {/* Assign Asset Modal */}
      <Modal open={showAssignModal} onClose={handleCloseModal} title="Assign Asset">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormInput
            type="select"
            variant="light"
            label="Asset *"
            value={form.asset_id}
            onChange={(val) => handleFieldChange("asset_id", val)}
            options={[{ value: "", label: "Select an asset..." }, ...assetOptions]}
            required
          />

          <FormInput
            type="select"
            variant="light"
            label="Assign To User *"
            value={form.assigned_to}
            onChange={(val) => handleFieldChange("assigned_to", val)}
            options={[{ value: "", label: "Select a user..." }, ...userOptions]}
            required
          />

          <FormInput 
            type="date"
            variant="light"
            label="Assignment Date *"
            value={form.assignment_date}
            onChange={(val) => handleFieldChange("assignment_date", val)}
            required
          />

          <FormInput 
            type="date"
            variant="light"
            label="Expected Return Date (Optional)"
            value={form.return_date}
            onChange={(val) => handleFieldChange("return_date", val)}
            error={formErrors.return_date}
          />

          <FormInput 
            type="textarea"
            variant="light"
            label="Notes"
            value={form.notes}
            onChange={(val) => handleFieldChange("notes", val)}
            placeholder="Add assignment details or comments..."
          />

          <div className="flex justify-end gap-2.5 border-t border-sky-page/20 pt-4 mt-2">
            <Button type="button" variant="danger-outline" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={isSubmitting}
              disabled={isSubmitting || !!formErrors.return_date || !form.asset_id || !form.assigned_to}
            >
              Assign Asset
            </Button>
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
    </div>
  );
}

