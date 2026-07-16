import React, { Fragment } from "react";
import { Tab } from "@headlessui/react";
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
  const [historyAssignments, setHistoryAssignments] = React.useState<Assignment[]>([]);
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
    custodian_id: "",
    assignment_date: new Date().toISOString().substring(0, 10),
    return_date: "",
    notes: "",
  });

  const [formErrors, setFormErrors] = React.useState({
    return_date: "",
  });

  // Action confirmations
  const [dirtyConfirm, setDirtyConfirm] = React.useState<{ open: boolean; onConfirm: () => void } | null>(null);
  const [rejectReturnConfirm, setRejectReturnConfirm] = React.useState<{ open: boolean; assignment: Assignment | null; reason: string }>({ open: false, assignment: null, reason: "" });

  const isAdminOrManager = user?.role === "Asset Manager" || user?.role === "SUPER_SYSTEM_ADMINISTRATOR" || user?.role === "ASSET_MANAGER";
  const isCustodian = user?.role === "Asset Custodian" || user?.role === "ASSET_CUSTODIAN";
  const isEmployee = user?.role === "Employee" || user?.role === "EMPLOYEE";

  const fetchAssignments = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Main tab: Show Active and Pending Acceptance assignments
      let activeAssignments: Assignment[] = [];
      let pendingAssignments: Assignment[] = [];
      
      if (isEmployee || isCustodian) {
        // Fetch Active assignments
        const activeEndpoint = `/assignments?user_id=${user?.user_id}&status=Active`;
        const activeData = await apiFetch<{ assignments: Assignment[]; total: number }>(activeEndpoint, {});
        activeAssignments = activeData.assignments;
        
        // Fetch Pending Acceptance assignments
        const pendingEndpoint = `/assignments?user_id=${user?.user_id}&status=Pending Acceptance`;
        const pendingData = await apiFetch<{ assignments: Assignment[]; total: number }>(pendingEndpoint, {});
        pendingAssignments = pendingData.assignments;
      } else {
        // Admin/Manager view
        const activeEndpoint = `/assignments?status=Active`;
        const activeData = await apiFetch<{ assignments: Assignment[]; total: number }>(activeEndpoint, {});
        activeAssignments = activeData.assignments;
        
        const pendingEndpoint = `/assignments?status=Pending Acceptance`;
        const pendingData = await apiFetch<{ assignments: Assignment[]; total: number }>(pendingEndpoint, {});
        pendingAssignments = pendingData.assignments;
      }
      
      // Combine without duplicates
      const allAssignments = [...activeAssignments, ...pendingAssignments];
      const uniqueAssignments = allAssignments.filter((assignment, index, self) =>
        index === self.findIndex(a => a.assignment_id === assignment.assignment_id)
      );
      setAssignments(uniqueAssignments);
      
      // History tab: Show Returned assignments
      const historyEndpoint = isEmployee
        ? `/assignments?user_id=${user?.user_id}&status=Returned`
        : `/assignments?status=Returned`;
      const historyData = await apiFetch<{ assignments: Assignment[]; total: number }>(historyEndpoint, {});
      setHistoryAssignments(historyData.assignments);
    } catch (err: any) {
      setError(err.message || "Failed to load assignments.");
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

  const handleOpenAssignModal = () => {
    fetchAssetsAndUsers(); // Refresh assets to get current status
    setShowAssignModal(true);
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
          custodian_id: form.custodian_id ? parseInt(form.custodian_id, 10) : null,
          assignment_date: form.assignment_date,
          return_date: form.return_date || null,
          expected_return_date: form.return_date || null,
          notes: form.notes,
        }),
      });
      setSuccess("Asset successfully assigned. Custodian will need to accept the assignment.");
      setShowAssignModal(false);
      setForm({
        asset_id: "",
        assigned_to: "",
        custodian_id: "",
        assignment_date: new Date().toISOString().substring(0, 10),
        return_date: "",
        notes: "",
      });
      fetchAssignments();
    } catch (err: any) {
      // Provide more specific error message for asset status issues
      if (err.message && err.message.includes("Available status")) {
        setError("Asset is not available for assignment. It may be assigned, under maintenance, or in another status.");
      } else {
        setError(err.message || "Failed to create assignment.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestReturn = async (id: number) => {
    setError(null);
    setSuccess(null);
    try {
      await apiFetch(`/assignments/${id}/request-return`, { method: "POST" });
      setSuccess("Asset return requested successfully.");
      fetchAssignments();
    } catch (err: any) {
      setError(err.message || "Failed to request return.");
    }
  };

  const handleApproveReturn = async (id: number) => {
    setError(null);
    setSuccess(null);
    try {
      await apiFetch(`/assignments/${id}/approve-return`, { method: "POST" });
      setSuccess("Return approved successfully.");
      fetchAssignments();
    } catch (err: any) {
      setError(err.message || "Failed to approve return.");
    }
  };

  const handleRejectReturn = async (id: number) => {
    setRejectReturnConfirm({ open: true, assignment: assignments.find(a => a.assignment_id === id) || null, reason: "" });
  };

  const confirmRejectReturn = async () => {
    if (!rejectReturnConfirm.assignment) return;
    if (!rejectReturnConfirm.reason.trim()) {
      setError("Please provide a reason for rejecting the return request.");
      return;
    }
    
    setError(null);
    setSuccess(null);
    try {
      await apiFetch(`/assignments/${rejectReturnConfirm.assignment.assignment_id}/reject-return`, {
        method: "POST",
        body: JSON.stringify({ reason: rejectReturnConfirm.reason }),
      });
      setSuccess("Return rejected successfully.");
      setRejectReturnConfirm({ open: false, assignment: null, reason: "" });
      fetchAssignments();
    } catch (err: any) {
      setError(err.message || "Failed to reject return.");
    }
  };

  const handleConfirmAssetReturn = async (id: number) => {
    setError(null);
    setSuccess(null);
    try {
      await apiFetch(`/assignments/${id}/confirm-return`, { method: "POST" });
      setSuccess("Asset return confirmed successfully. Asset is now available.");
      fetchAssignments();
    } catch (err: any) {
      setError(err.message || "Failed to confirm return.");
    }
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
          {isCustodian && a.status === "Active" && (
            <Button variant="danger-inverse" className="!py-1.5 !px-3 text-xs" onClick={() => handleRequestReturn(a.assignment_id)}>
              Request Asset Return
            </Button>
          )}
          {isEmployee && a.status === "Return Requested" && String(a.assigned_to) === String(user?.user_id) && (
            <>
              <Button variant="success" className="!py-1.5 !px-3 text-xs" onClick={() => handleApproveReturn(a.assignment_id)}>
                Approve
              </Button>
              <Button variant="danger-outline" className="!py-1.5 !px-3 text-xs" onClick={() => handleRejectReturn(a.assignment_id)}>
                Reject
              </Button>
            </>
          )}
          {isCustodian && a.status === "Return Approved" && (
            <Button variant="primary" className="!py-1.5 !px-3 text-xs" onClick={() => handleConfirmAssetReturn(a.assignment_id)}>
              Confirm Return
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

  const custodianOptions = users.filter(u => u.isActive && (u.role === "Asset Custodian" || u.role === "ASSET_CUSTODIAN")).map(u => ({
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
              <Table
                data={assignments}
                columns={columns}
                rowKey={(a) => a.assignment_id}
                emptyMessage="No assignments found."
              />
            )}
          </Tab.Panel>

          <Tab.Panel>
            {isLoading ? (
              <div className="flex justify-center py-16">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-ursb" />
              </div>
            ) : historyAssignments.length === 0 ? (
              <EmptyState
                title="No history found"
                description="There are no returned assignments in the history."
                icon={<ICONS.assignments className="w-6 h-6 text-ink-icon stroke-[2.2]" />}
              />
            ) : (
              <Table
                data={historyAssignments}
                columns={historyColumns}
                rowKey={(a) => a.assignment_id}
                emptyMessage="No history found."
              />
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
    </div>
  );
}

