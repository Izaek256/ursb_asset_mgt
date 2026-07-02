import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from "react";
import { apiFetch, useAuth } from "../AuthContext";
import { ICONS } from "../utils/icons";
import Modal from "../components/Modal";
import FormInput from "../components/common/FormInput";
import StatusBadge from "../components/common/badges/StatusBadge";
import ErrorMessage from "../components/ErrorMessage";
import SuccessBanner from "../components/common/SuccessBanner";
import EmptyState from "../components/EmptyState";
import ConfirmDialog from "../components/ConfirmDialog";
import PageHeader from "../components/PageHeader";
import Table from "../components/common/Table";
import Button from "../components/common/Button";
export default function Maintenance() {
    const { user } = useAuth();
    const [records, setRecords] = React.useState([]);
    const [upcoming, setUpcoming] = React.useState([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [success, setSuccess] = React.useState(null);
    // Warning banner state
    const [showUpcomingBanner, setShowUpcomingBanner] = React.useState(true);
    // Modals state
    const [showLogModal, setShowLogModal] = React.useState(false);
    const [showScheduleModal, setShowScheduleModal] = React.useState(false);
    const [selectedRecord, setSelectedRecord] = React.useState(null);
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
    const [completeConfirm, setCompleteConfirm] = React.useState(null);
    const [dirtyConfirm, setDirtyConfirm] = React.useState(null);
    const isAdminOrManager = user?.role === "System Administrator" || user?.role === "Asset Manager";
    const fetchMaintenanceData = React.useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const recordsRes = await apiFetch("/maintenance", {});
            const upcomingRes = await apiFetch("/maintenance/upcoming", {});
            setRecords(recordsRes.records);
            setUpcoming(upcomingRes.records);
        }
        catch (err) {
            setError(err.message || "Failed to load maintenance records.");
        }
        finally {
            setIsLoading(false);
        }
    }, []);
    React.useEffect(() => {
        fetchMaintenanceData();
    }, [fetchMaintenanceData]);
    // Dirty Form Checks
    const isLogFormDirty = logForm.asset_id ||
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
        }
        else {
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
        }
        else {
            setShowScheduleModal(false);
        }
    };
    const handleLogFieldChange = (field, val) => {
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
                    }
                    else {
                        errors.service_date = "";
                    }
                }
            }
            if (field === "cost") {
                if (val) {
                    const costVal = parseFloat(val);
                    if (isNaN(costVal) || costVal < 0) {
                        errors.cost = "Cost must be a positive number.";
                    }
                    else {
                        errors.cost = "";
                    }
                }
                else {
                    errors.cost = "";
                }
            }
            if (field === "next_service_date" || field === "service_date") {
                if (next.service_date && next.next_service_date) {
                    const service = new Date(next.service_date);
                    const nextSrv = new Date(next.next_service_date);
                    if (nextSrv <= service) {
                        errors.next_service_date = "Next service date must be after the service date.";
                    }
                    else {
                        errors.next_service_date = "";
                    }
                }
                else {
                    errors.next_service_date = "";
                }
            }
            setLogErrors(errors);
            return next;
        });
    };
    const handleScheduleFieldChange = (val) => {
        setScheduleForm({ next_service_date: val });
        if (val && selectedRecord) {
            const service = new Date(selectedRecord.service_date);
            const nextSrv = new Date(val);
            if (nextSrv <= service) {
                setScheduleError("Next service date must be after the last service date.");
            }
            else {
                setScheduleError("");
            }
        }
        else {
            setScheduleError("");
        }
    };
    const handleLogSubmit = async (e) => {
        e.preventDefault();
        if (!logForm.asset_id || !logForm.service_provider || !logForm.description) {
            setLogErrors((prev) => ({ ...prev, general: "Please fill in all required fields." }));
            return;
        }
        if (logErrors.service_date || logErrors.cost || logErrors.next_service_date)
            return;
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
            setSuccess("Maintenance record logged successfully.");
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
        }
        catch (err) {
            setLogErrors((prev) => ({ ...prev, general: err.message || "Failed to log maintenance record." }));
        }
        finally {
            setIsSubmitting(false);
        }
    };
    const handleScheduleClick = (rec) => {
        setSelectedRecord(rec);
        setScheduleForm({ next_service_date: rec.next_service_date || "" });
        setShowScheduleModal(true);
    };
    const handleScheduleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedRecord || !scheduleForm.next_service_date || scheduleError)
            return;
        setIsSubmitting(true);
        setScheduleError("");
        try {
            await apiFetch(`/maintenance/${selectedRecord.maintenance_id}/schedule`, {
                method: "PUT",
                body: JSON.stringify({
                    next_service_date: scheduleForm.next_service_date,
                }),
            });
            setSuccess(`Next service date updated for asset "${selectedRecord.asset_id}".`);
            setShowScheduleModal(false);
            setSelectedRecord(null);
            fetchMaintenanceData();
        }
        catch (err) {
            setScheduleError(err.message || "Failed to schedule next maintenance.");
        }
        finally {
            setIsSubmitting(false);
        }
    };
    const handleCompleteConfirm = async () => {
        if (!completeConfirm)
            return;
        setError(null);
        try {
            await apiFetch(`/maintenance/${completeConfirm.maintenance_id}/complete`, {
                method: "PUT",
            });
            setSuccess(`Maintenance completed. Asset "${completeConfirm.asset_id}" is now Active.`);
            setCompleteConfirm(null);
            fetchMaintenanceData();
        }
        catch (err) {
            setError(err.message || "Failed to mark maintenance as complete.");
        }
    };
    const columns = [
        {
            header: "Asset",
            render: (r) => (_jsxs("div", { children: [_jsx("div", { className: "font-bold text-ink text-sm", children: r.asset_name || "Asset" }), _jsx("div", { className: "text-[11px] text-ink-dim mt-0.5", children: r.asset_id })] })),
        },
        {
            header: "Service Date",
            render: (r) => new Date(r.service_date).toLocaleDateString(),
        },
        {
            header: "Provider",
            render: (r) => _jsx("span", { className: "font-semibold", children: r.service_provider }),
        },
        {
            header: "Type",
            render: (r) => r.maintenance_type || "—",
        },
        {
            header: "Description",
            render: (r) => _jsx("span", { className: "block max-w-xs truncate", title: r.description, children: r.description }),
        },
        {
            header: "Cost",
            render: (r) => (r.cost ? `UGX ${r.cost.toLocaleString()}` : "—"),
        },
        {
            header: "Next Service",
            render: (r) => (r.next_service_date ? new Date(r.next_service_date).toLocaleDateString() : "—"),
        },
        {
            header: "Status",
            render: (r) => _jsx(StatusBadge, { status: r.asset_status || "—" }),
        },
        {
            header: "Actions",
            render: (r) => (_jsxs("div", { className: "flex flex-wrap gap-1.5 select-none", children: [isAdminOrManager && r.asset_status === "Under Maintenance" && (_jsx(Button, { variant: "outline", onClick: () => setCompleteConfirm(r), children: "Mark Complete" })), isAdminOrManager && (_jsx(Button, { variant: "outline", onClick: () => handleScheduleClick(r), children: "Schedule Next" }))] })),
        },
    ];
    return (_jsxs("div", { className: "w-full flex flex-col gap-6 select-none font-sans", children: [success && _jsx(SuccessBanner, { message: success, onDismiss: () => setSuccess(null) }), error && _jsx(ErrorMessage, { message: error }), showUpcomingBanner && upcoming.length > 0 && (_jsxs("div", { className: "bg-badge-amberBg border border-badge-amberText/16 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm", children: [_jsxs("p", { className: "flex items-center gap-2.5 font-bold text-ink text-sm", children: [_jsx(ICONS.alertCircle, { className: "w-5 h-5 text-badge-amberText stroke-[2.2]" }), upcoming.length, " asset(s) due for scheduled maintenance within 30 days"] }), _jsx(Button, { variant: "outline", onClick: () => setShowUpcomingBanner(false), children: "Dismiss" })] })), _jsx(PageHeader, { title: "Asset Maintenance", subtitle: "Track maintenance history, schedule service runs, and log repairs", actions: isAdminOrManager && (_jsxs(Button, { onClick: () => setShowLogModal(true), children: [_jsx(ICONS.plus, { className: "w-4 h-4 mr-1.5 stroke-[2.4]" }), "Log Maintenance"] })) }), isLoading ? (_jsx("div", { className: "flex justify-center py-16", children: _jsx("div", { className: "animate-spin rounded-full h-10 w-10 border-b-2 border-ursb" }) })) : records.length === 0 ? (_jsx(EmptyState, { title: "No maintenance history", description: "There are no maintenance records logged in the system.", icon: _jsx(ICONS.maintenance, { className: "w-6 h-6 text-ink-icon stroke-[2.2]" }) })) : (_jsx(Table, { data: records, columns: columns, rowKey: (r) => r.maintenance_id, emptyMessage: "No maintenance records found." })), _jsx(Modal, { open: showLogModal, onClose: handleCloseLogModal, title: "Log Maintenance Record", children: _jsxs("form", { onSubmit: handleLogSubmit, className: "flex flex-col gap-4", children: [logErrors.general && _jsx(ErrorMessage, { message: logErrors.general }), _jsx(FormInput, { type: "text", variant: "light", label: "Asset ID *", value: logForm.asset_id, onChange: (val) => handleLogFieldChange("asset_id", val), required: true, placeholder: "e.g. URSB-1234ABCD" }), _jsx(FormInput, { type: "date", variant: "light", label: "Service Date *", value: logForm.service_date, onChange: (val) => handleLogFieldChange("service_date", val), required: true, error: logErrors.service_date }), _jsx(FormInput, { type: "text", variant: "light", label: "Service Provider *", value: logForm.service_provider, onChange: (val) => handleLogFieldChange("service_provider", val), required: true, placeholder: "e.g. Dell Support, Toyota Service" }), _jsx(FormInput, { type: "text", variant: "light", label: "Maintenance Type", value: logForm.maintenance_type, onChange: (val) => handleLogFieldChange("maintenance_type", val), placeholder: "e.g. Preventive, Corrective, Inspection" }), _jsx(FormInput, { type: "textarea", variant: "light", label: "Description *", value: logForm.description, onChange: (val) => handleLogFieldChange("description", val), required: true, placeholder: "Describe the maintenance performed or issues resolved..." }), _jsx(FormInput, { type: "number", variant: "light", label: "Cost (UGX, Optional)", value: logForm.cost, onChange: (val) => handleLogFieldChange("cost", val), placeholder: "e.g. 150000", error: logErrors.cost }), _jsx(FormInput, { type: "date", variant: "light", label: "Next Service Date (Optional)", value: logForm.next_service_date, onChange: (val) => handleLogFieldChange("next_service_date", val), error: logErrors.next_service_date }), _jsxs("div", { className: "flex justify-end gap-2.5 border-t border-sky-page/20 pt-4 mt-2", children: [_jsx(Button, { type: "button", variant: "ghost", onClick: handleCloseLogModal, children: "Cancel" }), _jsx(Button, { type: "submit", isLoading: isSubmitting, disabled: isSubmitting ||
                                        !!logErrors.service_date ||
                                        !!logErrors.cost ||
                                        !!logErrors.next_service_date ||
                                        !logForm.asset_id ||
                                        !logForm.service_provider ||
                                        !logForm.description, children: "Log Record" })] })] }) }), _jsx(Modal, { open: showScheduleModal, onClose: handleCloseScheduleModal, title: "Schedule Next Maintenance", children: _jsxs("form", { onSubmit: handleScheduleSubmit, className: "flex flex-col gap-4", children: [_jsx(FormInput, { type: "date", variant: "light", label: "Next Service Date *", value: scheduleForm.next_service_date, onChange: handleScheduleFieldChange, required: true, error: scheduleError }), _jsxs("div", { className: "flex justify-end gap-2.5 border-t border-sky-page/20 pt-4 mt-2", children: [_jsx(Button, { type: "button", variant: "ghost", onClick: handleCloseScheduleModal, children: "Cancel" }), _jsx(Button, { type: "submit", isLoading: isSubmitting, disabled: isSubmitting || !!scheduleError || !scheduleForm.next_service_date, children: "Schedule Maintenance" })] })] }) }), _jsx(ConfirmDialog, { open: !!dirtyConfirm?.open, title: "Unsaved changes", message: "You have unsaved changes. Are you sure you want to close? Your changes will be lost.", onCancel: () => setDirtyConfirm(null), onConfirm: () => {
                    if (dirtyConfirm?.onConfirm)
                        dirtyConfirm.onConfirm();
                } }), _jsx(ConfirmDialog, { open: !!completeConfirm, title: "Mark maintenance complete?", message: "Are you sure maintenance is complete? The asset will return to Active status.", onCancel: () => setCompleteConfirm(null), onConfirm: handleCompleteConfirm })] }));
}
