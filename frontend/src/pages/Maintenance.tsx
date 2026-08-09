import React from "react";
import { apiFetch, useAuth } from "../AuthContext";
import { ICONS } from "../utils/icons";
import { fmtDateTime, fmtDate } from "../utils/formatDate";
import Modal from "../components/Modal";
import FormInput from "../components/common/FormInput";
import StatusBadge from "../components/common/badges/StatusBadge";
import ErrorMessage from "../components/ErrorMessage";
import EmptyState from "../components/EmptyState";
import ConfirmDialog from "../components/ConfirmDialog";
import PageHeader from "../components/PageHeader";
import Table, { Column } from "../components/common/Table";
import Button from "../components/common/Button";
import { SkeletonCard } from "../components/common/LoadingSkeleton";

interface MaintenanceRecordResponse {
  maintenance_id: number;
  asset_id: string;
  asset_name: string | null;
  asset_status: string | null;
  service_date: string;
  service_provider: string;
  description: string;
  cost: number | null;
  next_service_date: string | null;
  recorded_by: number;
  recorded_by_name: string;
  maintenance_type?: string;
}

export default function Maintenance() {
  const { user } = useAuth();
  const [records, setRecords] = React.useState<MaintenanceRecordResponse[]>([]);
  const [upcoming, setUpcoming] = React.useState<MaintenanceRecordResponse[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Warning banner state
  const [showUpcomingBanner, setShowUpcomingBanner] = React.useState(true);

  // Modals state
  const [showLogModal, setShowLogModal] = React.useState(false);
  const [showScheduleModal, setShowScheduleModal] = React.useState(false);
  const [selectedRecord, setSelectedRecord] = React.useState<MaintenanceRecordResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Log Form State
  const [logForm, setLogForm] = React.useState({
    asset_id: "",
    service_date: new Date().toISOString().substring(0, 10),
    service_provider: "",
    maintenance_type: "",
    description: "",
    cost: "",
    next_service_date: "",
  });

  const [logErrors, setLogErrors] = React.useState({
    service_date: "",
    cost: "",
    next_service_date: "",
    general: "",
  });

  // Schedule Form State
  const [scheduleForm, setScheduleForm] = React.useState({
    next_service_date: "",
  });

  const [scheduleError, setScheduleError] = React.useState("");

  // Action confirmations
  const [completeConfirm, setCompleteConfirm] = React.useState<MaintenanceRecordResponse | null>(null);
  const [dirtyConfirm, setDirtyConfirm] = React.useState<{ open: boolean; onConfirm: () => void } | null>(null);

  const isAdminOrManager = user?.role === "System Administrator" || user?.role === "Asset Manager";

  const fetchMaintenanceData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const recordsRes = await apiFetch<{ records: MaintenanceRecordResponse[]; total: number }>("/maintenance", {});
      const upcomingRes = await apiFetch<{ records: MaintenanceRecordResponse[]; total: number }>("/maintenance/upcoming", {});
      setRecords(recordsRes.records);
      setUpcoming(upcomingRes.records);
    } catch (err: any) {
      (window as any).toast?.error("Failed to load maintenance records", err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchMaintenanceData();
  }, [fetchMaintenanceData]);

  // Dirty Form Checks
  const isLogFormDirty = 
    logForm.asset_id || 
    logForm.service_provider || 
    logForm.maintenance_type || 
    logForm.description || 
    logForm.cost || 
    logForm.next_service_date;

  const isScheduleFormDirty = !!scheduleForm.next_service_date;

  const handleCloseLogModal = () => {
    if (isLogFormDirty) {
      setDirtyConfirm({
        open: true,
        onConfirm: () => {
          setShowLogModal(false);
          setLogForm({
            asset_id: "",
            service_date: new Date().toISOString().substring(0, 10),
            service_provider: "",
            maintenance_type: "",
            description: "",
            cost: "",
            next_service_date: "",
          });
          setLogErrors({ service_date: "", cost: "", next_service_date: "", general: "" });
          setDirtyConfirm(null);
        },
      });
    } else {
      setShowLogModal(false);
    }
  };

  const handleCloseScheduleModal = () => {
    if (isScheduleFormDirty) {
      setDirtyConfirm({
        open: true,
        onConfirm: () => {
          setShowScheduleModal(false);
          setScheduleForm({ next_service_date: "" });
          setScheduleError("");
          setDirtyConfirm(null);
        },
      });
    } else {
      setShowScheduleModal(false);
    }
  };

  const handleLogFieldChange = (field: string, val: string) => {
    setLogForm((prev) => {
      const next = { ...prev, [field]: val };
      
      // Validation Logic
      const errors = { ...logErrors, general: "" };
      
      if (field === "service_date") {
        if (val) {
          const service = new Date(val);
          const today = new Date();
          if (service > today) {
            errors.service_date = "Service date cannot be in the future.";
          } else {
            errors.service_date = "";
          }
        }
      }

      if (field === "cost") {
        if (val) {
          const costVal = parseFloat(val);
          if (isNaN(costVal) || costVal < 0) {
            errors.cost = "Cost must be a positive number.";
          } else {
            errors.cost = "";
          }
        } else {
          errors.cost = "";
        }
      }

      if (field === "next_service_date" || field === "service_date") {
        if (next.service_date && next.next_service_date) {
          const service = new Date(next.service_date);
          const nextSrv = new Date(next.next_service_date);
          if (nextSrv <= service) {
            errors.next_service_date = "Next service date must be after the service date.";
          } else {
            errors.next_service_date = "";
          }
        } else {
          errors.next_service_date = "";
        }
      }

      setLogErrors(errors);
      return next;
    });
  };

  const handleScheduleFieldChange = (val: string) => {
    setScheduleForm({ next_service_date: val });
    if (val && selectedRecord) {
      const service = new Date(selectedRecord.service_date);
      const nextSrv = new Date(val);
      if (nextSrv <= service) {
        setScheduleError("Next service date must be after the last service date.");
      } else {
        setScheduleError("");
      }
    } else {
      setScheduleError("");
    }
  };

  const handleLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logForm.asset_id || !logForm.service_provider || !logForm.description) {
      setLogErrors((prev) => ({ ...prev, general: "Please fill in all required fields." }));
      return;
    }
    if (logErrors.service_date || logErrors.cost || logErrors.next_service_date) return;

    setIsSubmitting(true);
    setLogErrors((prev) => ({ ...prev, general: "" }));
    try {
      await apiFetch("/maintenance", {
        method: "POST",
        body: JSON.stringify({
          asset_id: logForm.asset_id,
          service_date: logForm.service_date,
          service_provider: logForm.service_provider,
          maintenance_type: logForm.maintenance_type || null,
          description: logForm.description,
          cost: logForm.cost ? parseFloat(logForm.cost) : null,
          next_service_date: logForm.next_service_date || null,
        }),
      });
      (window as any).toast?.success("Maintenance Logged", "Maintenance record logged successfully.");
      setShowLogModal(false);
      setLogForm({
        asset_id: "",
        service_date: new Date().toISOString().substring(0, 10),
        service_provider: "",
        maintenance_type: "",
        description: "",
        cost: "",
        next_service_date: "",
      });
      fetchMaintenanceData();
    } catch (err: any) {
      setLogErrors((prev) => ({ ...prev, general: err.message || "Failed to log maintenance record." }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleScheduleClick = (rec: MaintenanceRecordResponse) => {
    setSelectedRecord(rec);
    setScheduleForm({ next_service_date: rec.next_service_date || "" });
    setShowScheduleModal(true);
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord || !scheduleForm.next_service_date || scheduleError) return;

    setIsSubmitting(true);
    setScheduleError("");
    try {
      await apiFetch(`/maintenance/${selectedRecord.maintenance_id}/schedule`, {
        method: "PUT",
        body: JSON.stringify({
          next_service_date: scheduleForm.next_service_date,
        }),
      });
      (window as any).toast?.success("Schedule Updated", `Next service date updated for asset "${selectedRecord.asset_id}".`);
      setShowScheduleModal(false);
      setSelectedRecord(null);
      fetchMaintenanceData();
    } catch (err: any) {
      setScheduleError(err.message || "Failed to schedule next maintenance.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteConfirm = async () => {
    if (!completeConfirm) return;
    try {
      await apiFetch(`/maintenance/${completeConfirm.maintenance_id}/complete`, {
        method: "PUT",
      });
      (window as any).toast?.success("Maintenance Complete", `Asset "${completeConfirm.asset_id}" is now Active.`);
      setCompleteConfirm(null);
      fetchMaintenanceData();
    } catch (err: any) {
      (window as any).toast?.error("Action Failed", err.message || "Failed to mark maintenance as complete.");
    }
  };

  const columns: Column<MaintenanceRecordResponse>[] = [
    {
      header: "Asset",
      render: (r) => (
        <div>
          <div className="font-bold text-ink text-sm">{r.asset_name || "Asset"}</div>
          <div className="text-[11px] text-ink-dim mt-0.5">{r.asset_id}</div>
        </div>
      ),
    },
    {
      header: "Service Date",
      render: (r) => <span className="text-xs">{fmtDateTime(r.service_date)}</span>,
    },
    {
      header: "Provider",
      render: (r) => <span className="font-semibold">{r.service_provider}</span>,
    },
    {
      header: "Type",
      render: (r) => r.maintenance_type || "—",
    },
    {
      header: "Description",
      render: (r) => <span className="block whitespace-normal break-words min-w-[200px] text-xs leading-relaxed" title={r.description}>{r.description}</span>,
    },
    {
      header: "Next Service",
      render: (r) => <span className="text-xs">{fmtDate(r.next_service_date)}</span>,
    },
    {
      header: "Status",
      render: (r) => <StatusBadge status={r.asset_status || "—"} />,
    },
    {
      header: "Actions",
      render: (r) => (
        <div className="flex flex-wrap gap-1.5 select-none">
          {isAdminOrManager && r.asset_status === "Under Maintenance" && (
            <Button variant="outline" onClick={() => setCompleteConfirm(r)}>
              Mark Complete
            </Button>
          )}
          {isAdminOrManager && (
            <Button variant="outline" onClick={() => handleScheduleClick(r)}>
              Schedule Next
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="w-full flex flex-col gap-6 select-none font-sans">
      {/* Upcoming maintenance alert */}
      {showUpcomingBanner && upcoming.length > 0 && (
        <div className="bg-badge-amberBg border border-badge-amberText/16 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
          <p className="flex items-center gap-2.5 font-bold text-ink text-sm">
            <ICONS.alertCircle className="w-5 h-5 text-badge-amberText stroke-[2.2]" />
            {upcoming.length} asset(s) due for scheduled maintenance within 30 days
          </p>
          <Button variant="outline" onClick={() => setShowUpcomingBanner(false)}>
            Dismiss
          </Button>
        </div>
      )}

      <PageHeader
        title="Asset Maintenance"
        subtitle="Track maintenance history, schedule service runs, and log repairs"
        actions={
          isAdminOrManager && (
            <Button onClick={() => setShowLogModal(true)}>
              <ICONS.plus className="w-4 h-4 mr-1.5 stroke-[2.4]" />
              Log Maintenance
            </Button>
          )
        }
      />

      {isLoading ? (
        <SkeletonCard className="h-96" />
      ) : records.length === 0 ? (
        <EmptyState
          title="No maintenance history"
          description="There are no maintenance records logged in the system."
          icon={<ICONS.maintenance className="w-6 h-6 text-ink-icon stroke-[2.2]" />}
        />
      ) : (
        <Table
          data={records}
          columns={columns}
          rowKey={(r) => r.maintenance_id}
          emptyMessage="No maintenance records found."
        />
      )}

      {/* Log Maintenance Modal */}
      <Modal open={showLogModal} onClose={handleCloseLogModal} title="Log Maintenance Record">
        <form onSubmit={handleLogSubmit} className="flex flex-col gap-4">
          {logErrors.general && <ErrorMessage message={logErrors.general} />}

          <FormInput 
            type="text"
            variant="light"
            label="Asset ID *"
            value={logForm.asset_id}
            onChange={(val) => handleLogFieldChange("asset_id", val)}
            required
            placeholder="e.g. URSB-1234ABCD"
          />

          <FormInput 
            type="date"
            variant="light"
            label="Service Date *"
            value={logForm.service_date}
            onChange={(val) => handleLogFieldChange("service_date", val)}
            required
            error={logErrors.service_date}
          />

          <FormInput 
            type="text"
            variant="light"
            label="Service Provider *"
            value={logForm.service_provider}
            onChange={(val) => handleLogFieldChange("service_provider", val)}
            required
            placeholder="e.g. Dell Support, Toyota Service"
          />

          <FormInput 
            type="text"
            variant="light"
            label="Maintenance Type"
            value={logForm.maintenance_type}
            onChange={(val) => handleLogFieldChange("maintenance_type", val)}
            placeholder="e.g. Preventive, Corrective, Inspection"
          />

          <FormInput 
            type="textarea"
            variant="light"
            label="Description *"
            value={logForm.description}
            onChange={(val) => handleLogFieldChange("description", val)}
            required
            placeholder="Describe the maintenance performed or issues resolved..."
          />

          <FormInput 
            type="number"
            variant="light"
            label="Cost (UGX, Optional)"
            value={logForm.cost}
            onChange={(val) => handleLogFieldChange("cost", val)}
            placeholder="e.g. 150000"
            error={logErrors.cost}
          />

          <FormInput 
            type="date"
            variant="light"
            label="Next Service Date (Optional)"
            value={logForm.next_service_date}
            onChange={(val) => handleLogFieldChange("next_service_date", val)}
            error={logErrors.next_service_date}
          />

          <div className="flex justify-end gap-2.5 border-t border-sky-page/20 pt-4 mt-2">
            <Button type="button" variant="danger-outline" onClick={handleCloseLogModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={isSubmitting}
              disabled={
                isSubmitting ||
                !!logErrors.service_date ||
                !!logErrors.cost ||
                !!logErrors.next_service_date ||
                !logForm.asset_id ||
                !logForm.service_provider ||
                !logForm.description
              }
            >
              Log Record
            </Button>
          </div>
        </form>
      </Modal>

      {/* Schedule Next Maintenance Modal */}
      <Modal open={showScheduleModal} onClose={handleCloseScheduleModal} title="Schedule Next Maintenance">
        <form onSubmit={handleScheduleSubmit} className="flex flex-col gap-4">
          <FormInput 
            type="date"
            variant="light"
            label="Next Service Date *"
            value={scheduleForm.next_service_date}
            onChange={handleScheduleFieldChange}
            required
            error={scheduleError}
          />

          <div className="flex justify-end gap-2.5 border-t border-sky-page/20 pt-4 mt-2">
            <Button type="button" variant="danger-outline" onClick={handleCloseScheduleModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={isSubmitting}
              disabled={isSubmitting || !!scheduleError || !scheduleForm.next_service_date}
            >
              Schedule Maintenance
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

      {/* Complete Confirmation Dialog */}
      <ConfirmDialog 
        open={!!completeConfirm}
        title="Mark maintenance complete?"
        message="Are you sure maintenance is complete? The asset will return to Active status."
        onCancel={() => setCompleteConfirm(null)}
        onConfirm={handleCompleteConfirm}
      />
    </div>
  );
}

