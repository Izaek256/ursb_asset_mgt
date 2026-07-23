import React, { Fragment } from "react";
import { Tab } from "@headlessui/react";
import { apiFetch, useAuth } from "../AuthContext";
import { Assignment, UserRow } from "../types";
import { ICONS } from "../utils/icons";
import Modal from "../components/Modal";
import FormInput from "../components/common/FormInput";
import StatusBadge from "../components/common/badges/StatusBadge";
import EmptyState from "../components/EmptyState";
import ConfirmDialog from "../components/ConfirmDialog";
import PageHeader from "../components/PageHeader";
import Table, { Column } from "../components/common/Table";
import Button from "../components/common/Button";
import { fmtDateTime, fmtDate } from "../utils/formatDate";

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
  const [historyAssignments, setHistoryAssignments] = React.useState<Assignment[]>([]);
  const [assets, setAssets] = React.useState<AssetOption[]>([]);
  const [users, setUsers] = React.useState<UserRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Modal & form states
  const [showAssignModal, setShowAssignModal] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [form, setForm] = React.useState({
    asset_id: "",
    assigned_to: "",
    custodian_id: "",
    assignment_date: new Date().toISOString().slice(0, 10),
    return_date: "",
    notes: "",
  });

  const [formErrors, setFormErrors] = React.useState({
    return_date: "",
  });

  // Action confirmations
  const [dirtyConfirm, setDirtyConfirm] = React.useState<{ open: boolean; onConfirm: () => void } | null>(null);
  const [rejectReturnConfirm, setRejectReturnConfirm] = React.useState<{ open: boolean; assignment: Assignment | null; reason: string }>({ open: false, assignment: null, reason: "" });
  const [cancelAssignConfirm, setCancelAssignConfirm] = React.useState<Assignment | null>(null);

  const isAdminOrManager = user?.role === "Asset Manager" || user?.role === "SUPER_SYSTEM_ADMINISTRATOR" || user?.role === "ASSET_MANAGER";
  const isCustodian = user?.role === "Asset Custodian" || user?.role === "ASSET_CUSTODIAN";
  const isEmployee = user?.role === "Employee" || user?.role === "EMPLOYEE";

  const fetchAssignments = React.useCallback(async () => {
    setIsLoading(true);
    try {
      // Active tab: all in-flight statuses (Active, Pending Acceptance, Accepted,
      // Return Requested, Return Approved) in one call
      const activeEndpoint = isEmployee || isCustodian
        ? `/assignments?tab=active`
        : `/assignments?tab=active`;
      const activeData = await apiFetch<{ assignments: Assignment[]; total: number }>(activeEndpoint, {});
      setAssignments(activeData.assignments);

      // History tab: terminal statuses (Returned, Declined, Return Rejected) in one call
      const historyEndpoint = `/assignments?tab=history`;
      const historyData = await apiFetch<{ assignments: Assignment[]; total: number }>(historyEndpoint, {});
      setHistoryAssignments(historyData.assignments);
    } catch (err: any) {
      (window as any).toast?.error("Failed to load assignments", err.message);
    } finally {
      setIsLoading(false);
    }
  }, [isEmployee, isCustodian, user]);

  const fetchAssetsAndUsers = React.useCallback(async () => {
    try {
      const assetsData = await apiFetch<AssetOption[]>("/assets?status=Available", {});
      setAssets(assetsData);
      
      const usersData = await apiFetch<UserRow[]>("/admin/users", {});
      setUsers(usersData);
    } catch (err) {
      console.error("Failed to load options.", err);
    }
  }, []);

  const handleAccept = async (id: number) => {
    try {
      await apiFetch(`/assignments/${id}/accept`, { method: "POST" });
      (window as any).toast?.success("Assignment Accepted", "Assignment accepted successfully.");
      fetchAssignments();
    } catch (err: any) {
      (window as any).toast?.error("Accept Failed", err.message || "Failed to accept assignment.");
    }
  };

  const handleOpenAssignModal = () => {
    fetchAssetsAndUsers(); // Refresh assets to get current status
    setShowAssignModal(true);
  };

  const handleDecline = async (id: number) => {
    try {
      await apiFetch(`/assignments/${id}/decline`, { method: "POST" });
      (window as any).toast?.success("Assignment Declined", "Assignment declined successfully.");
      fetchAssignments();
    } catch (err: any) {
      (window as any).toast?.error("Decline Failed", err.message || "Failed to decline assignment.");
    }
  };

  const handleConfirmHandover = async (id: number) => {
    try {
      await apiFetch(`/assignments/${id}/confirm-handover`, { method: "POST" });
      (window as any).toast?.success("Handover Confirmed", "Employee has been notified the asset is ready.");
      fetchAssignments();
    } catch (err: any) {
      (window as any).toast?.error("Handover Failed", err.message || "Failed to confirm handover.");
    }
  };

  const handleConfirmReceipt = async (id: number) => {
    try {
      await apiFetch(`/assignments/${id}/confirm-receipt`, { method: "POST" });
      (window as any).toast?.success("Receipt Confirmed", "The asset is now fully active in your custody.");
      fetchAssignments();
    } catch (err: any) {
      (window as any).toast?.error("Confirm Failed", err.message || "Failed to confirm receipt.");
    }
  };

  const handleCancelAssignment = async (id: number) => {
    try {
      await apiFetch(`/assignments/${id}`, { method: "DELETE" });
      (window as any).toast?.success("Assignment Cancelled", "Asset returned to Available.");
      fetchAssignments();
    } catch (err: any) {
      (window as any).toast?.error("Cancel Failed", err.message || "Failed to cancel assignment.");
    }
    setCancelAssignConfirm(null);
  };

  React.useEffect(() => {
    fetchAssignments();
    if (isAdminOrManager) {
      fetchAssetsAndUsers();
    }
  }, [fetchAssignments, fetchAssetsAndUsers, isAdminOrManager]);

  // Form dirty checks
  const isFormDirty = form.asset_id || form.assigned_to || form.custodian_id || form.notes || form.return_date;

  const handleCloseModal = () => {
    if (isFormDirty) {
      setDirtyConfirm({
        open: true,
        onConfirm: () => {
          setShowAssignModal(false);
          setForm({
            asset_id: "",
            assigned_to: "",
            custodian_id: "",
            assignment_date: new Date().toISOString().slice(0, 10),
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
      (window as any).toast?.error("Validation Error", "Please fill in all required fields.");
      return;
    }
    if (formErrors.return_date) return;

    setIsSubmitting(true);
    try {
      // Send only date, backend will capture current time
      await apiFetch("/assignments", {
        method: "POST",
        body: JSON.stringify({
          asset_id: form.asset_id,
          assigned_to: form.assigned_to,
          custodian_id: form.custodian_id || null,
          assignment_date: form.assignment_date,
          return_date: form.return_date || null,
          expected_return_date: form.return_date || null,
          notes: form.notes,
        }),
      });
      (window as any).toast?.success("Asset Assigned", "Custodian will need to accept the assignment.");
      setShowAssignModal(false);
      setForm({
        asset_id: "",
        assigned_to: "",
        custodian_id: "",
        assignment_date: new Date().toISOString().slice(0, 10),
        return_date: "",
        notes: "",
      });
      fetchAssignments();
    } catch (err: any) {
      if (err.message && err.message.includes("Available status")) {
        (window as any).toast?.error("Assignment Failed", "Asset is not available. It may be assigned, under maintenance, or in another status.");
      } else {
        (window as any).toast?.error("Assignment Failed", err.message || "Failed to create assignment.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestReturn = async (id: number) => {
    try {
      await apiFetch(`/assignments/${id}/request-return`, { method: "POST" });
      (window as any).toast?.success("Return Requested", "Asset return requested successfully.");
      fetchAssignments();
    } catch (err: any) {
      (window as any).toast?.error("Request Failed", err.message || "Failed to request return.");
    }
  };

  const handleApproveReturn = async (id: number) => {
    try {
      await apiFetch(`/assignments/${id}/approve-return`, { method: "POST" });
      (window as any).toast?.success("Return Approved", "Return approved successfully.");
      fetchAssignments();
    } catch (err: any) {
      (window as any).toast?.error("Approve Failed", err.message || "Failed to approve return.");
    }
  };

  const handleRejectReturn = async (id: number) => {
    setRejectReturnConfirm({ open: true, assignment: assignments.find(a => a.assignment_id === id) || null, reason: "" });
  };

  const confirmRejectReturn = async () => {
    if (!rejectReturnConfirm.assignment) return;
    if (!rejectReturnConfirm.reason.trim()) {
      (window as any).toast?.error("Validation Error", "Please provide a reason for rejecting the return request.");
      return;
    }
    try {
      await apiFetch(`/assignments/${rejectReturnConfirm.assignment.assignment_id}/reject-return`, {
        method: "POST",
        body: JSON.stringify({ reason: rejectReturnConfirm.reason }),
      });
      (window as any).toast?.success("Return Rejected", "Return rejected successfully.");
      setRejectReturnConfirm({ open: false, assignment: null, reason: "" });
      fetchAssignments();
    } catch (err: any) {
      (window as any).toast?.error("Reject Failed", err.message || "Failed to reject return.");
    }
  };

  const handleConfirmAssetReturn = async (id: number) => {
    try {
      await apiFetch(`/assignments/${id}/confirm-return`, { method: "POST" });
      (window as any).toast?.success("Return Confirmed", "Asset is now available and assignment is closed.");
      fetchAssignments();
    } catch (err: any) {
      (window as any).toast?.error("Confirm Failed", err.message || "Failed to confirm return.");
    }
  };

  // ── Export helpers ───────────────────────────────────────────────────────────
  const exportToCSV = (rows: Assignment[], filename: string) => {
    const headers = ["Assignment ID", "Asset ID", "Asset Name", "Assigned To", "Assigned By", "Assignment Date", "Return Date", "Status", "Acknowledged", "Notes"];
    const csvRows = rows.map((a) => [
      a.assignment_id,
      a.asset_id,
      a.asset_name || "",
      a.assigned_to_name || a.assigned_to,
      a.assigned_by_name || a.assigned_by,
      a.assignment_date || a.assigned_date || "",
      a.return_date || "",
      a.status,
      a.acknowledged_at ? fmtDateTime(a.acknowledged_at) : "",
      (a.notes || "").replace(/,/g, ";"),
    ]);
    const content = [headers, ...csvRows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const historyColumns: Column<Assignment>[] = [
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
        return <span className="text-xs">{fmtDateTime(d)}</span>;
      },
    },
    {
      header: "Return Date",
      render: (a) => <span className="text-xs">{fmtDate(a.return_date)}</span>,
    },
    {
      header: "Status",
      render: (a) => <StatusBadge status={a.status} />,
    },
    {
      header: "Rejection Reason",
      render: (a) => a.return_rejection_reason || "—",
    },
  ];

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
        return <span className="text-xs">{fmtDateTime(d)}</span>;
      },
    },
    {
      header: "Return Date",
      render: (a) => <span className="text-xs">{fmtDate(a.return_date)}</span>,
    },
    {
      header: "Status",
      render: (a) => <StatusBadge status={a.status} />,
    },
    {
      header: "Actions",
      render: (a) => {
        // Employee: accept/decline pending assignments
        if (isEmployee && a.status === "Pending Acceptance" && String(a.assigned_to) === String(user?.user_id)) {
          return (
            <div className="flex gap-2 select-none">
              <Button variant="success" className="!py-1.5 !px-3 text-xs" onClick={() => handleAccept(a.assignment_id)}>
                Accept
              </Button>
              <Button variant="danger-outline" className="!py-1.5 !px-3 text-xs" onClick={() => handleDecline(a.assignment_id)}>
                Decline
              </Button>
            </div>
          );
        }
        // Employee: confirm receipt after custodian handover (Active but not yet acknowledged)
        if (isEmployee && a.status === "Active" && !a.acknowledged_at && String(a.assigned_to) === String(user?.user_id)) {
          return (
            <Button variant="success" className="!py-1.5 !px-3 text-xs" onClick={() => handleConfirmReceipt(a.assignment_id)}>
              Confirm Receipt
            </Button>
          );
        }
        // Employee: approve/reject return requests
        if (isEmployee && a.status === "Return Requested" && String(a.assigned_to) === String(user?.user_id)) {
          return (
            <div className="flex gap-2 select-none">
              <Button variant="success" className="!py-1.5 !px-3 text-xs" onClick={() => handleApproveReturn(a.assignment_id)}>
                Approve Return
              </Button>
              <Button variant="danger-outline" className="!py-1.5 !px-3 text-xs" onClick={() => handleRejectReturn(a.assignment_id)}>
                Reject Return
              </Button>
            </div>
          );
        }
        // Custodian: confirm handover after employee accepts
        if (isCustodian && a.status === "Accepted") {
          return (
            <Button variant="primary" className="!py-1.5 !px-3 text-xs" onClick={() => handleConfirmHandover(a.assignment_id)}>
              Confirm Handover
            </Button>
          );
        }
        // Custodian: request asset return from an active assignment
        if (isCustodian && a.status === "Active") {
          return (
            <Button variant="danger-inverse" className="!py-1.5 !px-3 text-xs" onClick={() => handleRequestReturn(a.assignment_id)}>
              Request Return
            </Button>
          );
        }
        // Custodian: confirm return after employee approves
        if (isCustodian && a.status === "Return Approved") {
          return (
            <Button variant="primary" className="!py-1.5 !px-3 text-xs" onClick={() => handleConfirmAssetReturn(a.assignment_id)}>
              Confirm Return
            </Button>
          );
        }
        // Admin/Manager: cancel assignments that haven't been handed over yet
        if (isAdminOrManager && (a.status === "Pending Acceptance" || a.status === "Accepted")) {
          return (
            <Button variant="danger-outline" className="!py-1.5 !px-3 text-xs" onClick={() => setCancelAssignConfirm(a)}>
              Cancel Assignment
            </Button>
          );
        }
        return <span className="text-xs text-ink-dim">—</span>;
      },
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

  const custodianOptions = users.filter(u => u.isActive && (u.role === "Asset Custodian" || u.role === "ASSET_CUSTODIAN")).map(u => ({
    value: String(u.id),
    label: `${u.name} (${u.role})`,
  }));

  return (
    <div className="w-full flex flex-col gap-6 select-none font-sans">
      <PageHeader
        title="Asset Assignments"
        subtitle="Track custody of assets allocated to employees"
        actions={
          isAdminOrManager && (
            <Button onClick={handleOpenAssignModal}>
              <ICONS.plus className="w-4 h-4 mr-1.5 stroke-[2.4]" />
              Assign Asset
            </Button>
          )
        }
      />

      {/* Tab Navigation */}
      <Tab.Group>
        <Tab.List className="flex flex-wrap gap-1.5 p-1.5 bg-white border border-sky-cardBorder rounded-xl w-fit">
          {["Active Assignments", "History"].map((tab) => (
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
          {/* Active Assignments Tab */}
          <Tab.Panel>
            {isLoading ? (
              <div className="flex justify-center py-16">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-ursb" />
              </div>
            ) : assignments.length === 0 ? (
              <EmptyState
                title="No active assignments found"
                description="There are no active custody assignments recorded."
                icon={<ICONS.assignments className="w-6 h-6 text-ink-icon stroke-[2.2]" />}
              />
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-dim font-medium">
                    {assignments.length} assignment{assignments.length !== 1 ? "s" : ""}
                  </span>
                  <Button
                    variant="outline"
                    className="!py-1.5 !px-3 text-xs"
                    onClick={() => exportToCSV(assignments, `active-assignments-${new Date().toISOString().slice(0, 10)}.csv`)}
                  >
                    <ICONS.download className="w-3.5 h-3.5 mr-1.5 stroke-[2.2]" />
                    Export CSV
                  </Button>
                </div>
                <Table
                  data={assignments}
                  columns={columns}
                  rowKey={(a) => a.assignment_id}
                  emptyMessage="No assignments found."
                  pageSize={50}
                />
              </div>
            )}
          </Tab.Panel>

          {/* History Tab */}
          <Tab.Panel>
            {isLoading ? (
              <div className="flex justify-center py-16">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-ursb" />
              </div>
            ) : historyAssignments.length === 0 ? (
              <EmptyState
                title="No history found"
                description="There are no closed assignments in the history yet."
                icon={<ICONS.assignments className="w-6 h-6 text-ink-icon stroke-[2.2]" />}
              />
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-dim font-medium">
                    {historyAssignments.length} record{historyAssignments.length !== 1 ? "s" : ""}
                  </span>
                  <Button
                    variant="outline"
                    className="!py-1.5 !px-3 text-xs"
                    onClick={() => exportToCSV(historyAssignments, `assignment-history-${new Date().toISOString().slice(0, 10)}.csv`)}
                  >
                    <ICONS.download className="w-3.5 h-3.5 mr-1.5 stroke-[2.2]" />
                    Export CSV
                  </Button>
                </div>
                <Table
                  data={historyAssignments}
                  columns={historyColumns}
                  rowKey={(a) => a.assignment_id}
                  emptyMessage="No history found."
                  pageSize={50}
                />
              </div>
            )}
          </Tab.Panel>
        </Tab.Panels>
      </Tab.Group>

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
            searchable
          />

          <FormInput
            type="select"
            variant="light"
            label="Assign To User (Final Recipient) *"
            value={form.assigned_to}
            onChange={(val) => handleFieldChange("assigned_to", val)}
            options={[{ value: "", label: "Select a user..." }, ...userOptions]}
            required
            searchable
          />

          <FormInput
            type="select"
            variant="light"
            label="Assign to Custodian (Optional - defaults to you)"
            value={form.custodian_id}
            onChange={(val) => handleFieldChange("custodian_id", val)}
            options={[{ value: "", label: "Select a custodian..." }, ...custodianOptions]}
            searchable
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

      {/* Reject Return Reason Modal */}
      <Modal 
        open={rejectReturnConfirm.open} 
        onClose={() => setRejectReturnConfirm({ open: false, assignment: null, reason: "" })}
        title="Reject Return Request"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink-dim">
            Please provide a reason for rejecting the return request for asset "{rejectReturnConfirm.assignment?.asset_name}". This reason will be visible to the custodian and asset manager.
          </p>
          <FormInput
            type="textarea"
            variant="light"
            label="Rejection Reason *"
            value={rejectReturnConfirm.reason}
            onChange={(val) => setRejectReturnConfirm(prev => ({ ...prev, reason: val }))}
            placeholder="Explain why you cannot return this asset at this time..."
            required
          />
          <div className="flex justify-end gap-2.5 border-t border-sky-page/20 pt-4 mt-2">
            <Button 
              variant="danger-outline" 
              onClick={() => setRejectReturnConfirm({ open: false, assignment: null, reason: "" })}
            >
              Cancel
            </Button>
            <Button
              variant="danger-inverse"
              onClick={confirmRejectReturn}
              disabled={!rejectReturnConfirm.reason.trim()}
            >
              Reject Return
            </Button>
          </div>
        </div>
      </Modal>

      {/* Cancel Assignment Confirm Dialog */}
      <ConfirmDialog
        open={!!cancelAssignConfirm}
        title="Cancel assignment?"
        message={`This will cancel the pending assignment for "${cancelAssignConfirm?.asset_name}" and return the asset to Available status. The employee will be notified.`}
        onCancel={() => setCancelAssignConfirm(null)}
        onConfirm={() => cancelAssignConfirm && handleCancelAssignment(cancelAssignConfirm.assignment_id)}
      />
    </div>
  );
}

