import React from "react";
import { apiFetch, useAuth } from "../AuthContext";
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
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

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
    setError(null);
    try {
      const recordsRes = await apiFetch<{ records: MaintenanceRecordResponse[]; total: number }>("/maintenance", {});
      const upcomingRes = await apiFetch<{ records: MaintenanceRecordResponse[]; total: number }>("/maintenance/upcoming", {});
      
      setRecords(recordsRes.records);
      setUpcoming(upcomingRes.records);
    } catch (err: any) {
      setError(err.message || "Failed to load maintenance records.");
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

  const isScheduleFormDirty = scheduleForm.next_service_date;

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

  // Form input change handlers
  const handleLogFieldChange = (field: string, value: string) => {
    const nextForm = { ...logForm, [field]: value };
    setLogForm(nextForm);

    const nextErrors = { ...logErrors, general: "" };

    // Validation
    const today = new Date().toISOString().substring(0, 10);
    
    if (field === "service_date") {
      if (value > today) {
        nextErrors.service_date = "Service date cannot be in the future";
      } else {
        nextErrors.service_date = "";
      }
      
      // Re-validate next_service_date relative to service_date
      if (nextForm.next_service_date && value && nextForm.next_service_date <= value) {
        nextErrors.next_service_date = "Next service date must be after service date";
      } else if (nextForm.next_service_date && nextForm.next_service_date <= today) {
        nextErrors.next_service_date = "Next service date must be in the future";
      } else {
        nextErrors.next_service_date = "";
      }
    }

    if (field === "cost") {
      const parsedCost = parseFloat(value);
      if (value && (isNaN(parsedCost) || parsedCost <= 0)) {
        nextErrors.cost = "Cost must be a positive value";
      } else {
        nextErrors.cost = "";
      }
    }

    if (field === "next_service_date") {
      if (value) {
        if (value <= today) {
          nextErrors.next_service_date = "Next service date must be in the future";
        } else if (nextForm.service_date && value <= nextForm.service_date) {
          nextErrors.next_service_date = "Next service date must be after service date";
        } else {
          nextErrors.next_service_date = "";
        }
      } else {
        nextErrors.next_service_date = "";
      }
    }

    setLogErrors(nextErrors);
  };

  const handleScheduleFieldChange = (value: string) => {
    setScheduleForm({ next_service_date: value });

    const today = new Date().toISOString().substring(0, 10);
    if (value && value <= today) {
      setScheduleError("Next service date must be in the future");
    } else {
      setScheduleError("");
    }
  };

  // Submission Handlers
  const handleLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      logErrors.service_date || 
      logErrors.cost || 
      logErrors.next_service_date ||
      !logForm.asset_id ||
      !logForm.service_date ||
      !logForm.service_provider ||
      !logForm.description
    ) {
      return;
    }

    setIsSubmitting(true);
    setLogErrors(prev => ({ ...prev, general: "" }));
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

      setSuccess("Maintenance record logged. Asset status set to Under Maintenance.");
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
      setLogErrors(prev => ({ ...prev, general: err.message || "Failed to log maintenance." }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord || scheduleError || !scheduleForm.next_service_date) return;
    
    setIsSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/maintenance/${selectedRecord.maintenance_id}/schedule`, {
        method: "PATCH",
        body: JSON.stringify({ next_service_date: scheduleForm.next_service_date }),
      });

      setSuccess("Next maintenance scheduled.");
      setShowScheduleModal(false);
      setSelectedRecord(null);
      setScheduleForm({ next_service_date: "" });
      fetchMaintenanceData();
    } catch (err: any) {
      setError(err.message || "Failed to schedule next maintenance.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteConfirm = async () => {
    if (!completeConfirm) return;
    setError(null);
    try {
      await apiFetch(`/maintenance/${completeConfirm.maintenance_id}/complete`, {
        method: "PATCH",
      });

      setSuccess(`Maintenance complete. Asset ${completeConfirm.asset_name || completeConfirm.asset_id} is now Active.`);
      setCompleteConfirm(null);
      fetchMaintenanceData();
    } catch (err: any) {
      setError(err.message || "Failed to complete maintenance.");
    }
  };

  const isNextServiceWarning = (nextDateStr: string | null) => {
    if (!nextDateStr) return false;
    const nextDate = new Date(nextDateStr);
    const today = new Date();
    const diffTime = nextDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 30;
  };

  return (
    <>
      {success && <SuccessBanner message={success} onDismiss={() => setSuccess(null)} />}
      {error && <ErrorMessage message={error} />}

      {/* Upcoming Alert Banner */}
      {showUpcomingBanner && upcoming.length > 0 && (
        <div className="alert-warning" style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 600 }}>
            {ICONS.alert} {upcoming.length} asset(s) due for maintenance within 30 days
          </p>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowUpcomingBanner(false)}>
            Dismiss
          </button>
        </div>
      )}

      <PageHeader 
        title="Asset Maintenance"
        subtitle="Track maintenance history, schedule service runs, and log repairs"
        actions={
          isAdminOrManager && (
            <button className="btn btn-primary" onClick={() => setShowLogModal(true)}>
              {ICONS.add} Log Maintenance
            </button>
          )
        }
      />

      {isLoading ? (
        <div className="page-loading" style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
          <LoadingSpinner size="lg" />
        </div>
      ) : records.length === 0 ? (
        <EmptyState title="No maintenance history" description="There are no maintenance recordslogged in the system." icon="🔧" />
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th>Service Date</th>
                <th>Service Provider</th>
                <th>Maintenance Type</th>
                <th>Description</th>
                <th>Cost</th>
                <th>Next Service Date</th>
                <th>Recorded By</th>
                <th>Asset Status</th>
                {isAdminOrManager && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {records.map((r) => {
                const isUpcoming = isNextServiceWarning(r.next_service_date);
                return (
                  <tr key={r.maintenance_id}>
                    <td>
                      <div>
                        <div className="user-name">{r.asset_name || "Asset"}</div>
                        <div className="text-small text-muted">{r.asset_id}</div>
                      </div>
                    </td>
                    <td>{new Date(r.service_date).toLocaleDateString()}</td>
                    <td>{r.service_provider}</td>
                    <td>{r.maintenance_type || "Preventive"}</td>
                    <td className="text-small" title={r.description} style={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.description}
                    </td>
                    <td>{r.cost ? `UGX ${r.cost.toLocaleString()}` : "-"}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                        {r.next_service_date ? new Date(r.next_service_date).toLocaleDateString() : "-"}
                        {isUpcoming && (
                          // Highlight upcoming service dates to help managers prioritise
                          <span title="Due within 30 days" style={{ color: "var(--color-orange)", fontSize: "1.1rem" }}>⚠️</span>
                        )}
                      </div>
                    </td>
                    <td>{r.recorded_by_name}</td>
                    <td>
                      <StatusBadge status={r.asset_status || "Active"} />
                    </td>
                    {isAdminOrManager && (
                      <td>
                        <div style={{ display: "flex", gap: "0.25rem" }}>
                          {r.asset_status === "Under Maintenance" && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => setCompleteConfirm(r)}
                            >
                              Mark Complete
                            </button>
                          )}
                          {(!r.next_service_date || new Date(r.next_service_date) <= new Date()) && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                setSelectedRecord(r);
                                setScheduleForm({ next_service_date: "" });
                                setShowScheduleModal(true);
                              }}
                            >
                              Schedule Next
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Log Maintenance Modal */}
      <Modal open={showLogModal} onClose={handleCloseLogModal} title="Log Maintenance Record">
        <form onSubmit={handleLogSubmit}>
          {logErrors.general && <ErrorMessage message={logErrors.general} />}

          <FormInput 
            type="text"
            label="Asset ID *"
            value={logForm.asset_id}
            onChange={(val) => handleLogFieldChange("asset_id", val)}
            required
            placeholder="e.g. URSB-1234ABCD"
          />

          <FormInput 
            type="date"
            label="Service Date *"
            value={logForm.service_date}
            onChange={(val) => handleLogFieldChange("service_date", val)}
            required
            error={logErrors.service_date}
          />

          <FormInput 
            type="text"
            label="Service Provider *"
            value={logForm.service_provider}
            onChange={(val) => handleLogFieldChange("service_provider", val)}
            required
            placeholder="e.g. Dell Support, Toyota Service"
          />

          <FormInput 
            type="text"
            label="Maintenance Type"
            value={logForm.maintenance_type}
            onChange={(val) => handleLogFieldChange("maintenance_type", val)}
            placeholder="e.g. Preventive, Corrective, Inspection"
          />

          <FormInput 
            type="textarea"
            label="Description *"
            value={logForm.description}
            onChange={(val) => handleLogFieldChange("description", val)}
            required
            placeholder="Describe the maintenance performed or issues resolved..."
          />

          <FormInput 
            type="number"
            label="Cost (UGX, Optional)"
            value={logForm.cost}
            onChange={(val) => handleLogFieldChange("cost", val)}
            placeholder="e.g. 150000"
            error={logErrors.cost}
          />

          <FormInput 
            type="date"
            label="Next Service Date (Optional)"
            value={logForm.next_service_date}
            onChange={(val) => handleLogFieldChange("next_service_date", val)}
            error={logErrors.next_service_date}
          />

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={handleCloseLogModal}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
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
              {isSubmitting ? <LoadingSpinner size="sm" /> : "Log Record"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Schedule Next Maintenance Modal */}
      <Modal open={showScheduleModal} onClose={handleCloseScheduleModal} title="Schedule Next Maintenance">
        <form onSubmit={handleScheduleSubmit}>
          <FormInput 
            type="date"
            label="Next Service Date *"
            value={scheduleForm.next_service_date}
            onChange={handleScheduleFieldChange}
            required
            error={scheduleError}
          />

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={handleCloseScheduleModal}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || !!scheduleError || !scheduleForm.next_service_date}
            >
              {isSubmitting ? <LoadingSpinner size="sm" /> : "Schedule Maintenance"}
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
        title="Mark maintenance complete?"
        message="Are you sure maintenance is complete? The asset will return to Active status."
        onCancel={() => setCompleteConfirm(null)}
        onConfirm={handleCompleteConfirm}
      />
    </>
  );
}
