import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from "react";
import { apiFetch, useAuth } from "../AuthContext";
import { ICONS } from "../utils/icons";
import Modal from "../components/Modal";
import FormInput from "../components/FormInput";
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
    // Form input change handlers
    const handleLogFieldChange = (field, value) => {
        const nextForm = { ...logForm, [field]: value };
        setLogForm(nextForm);
        const nextErrors = { ...logErrors, general: "" };
        // Validation
        const today = new Date().toISOString().substring(0, 10);
        if (field === "service_date") {
            if (value > today) {
                nextErrors.service_date = "Service date cannot be in the future";
            }
            else {
                nextErrors.service_date = "";
            }
            // Re-validate next_service_date relative to service_date
            if (nextForm.next_service_date && value && nextForm.next_service_date <= value) {
                nextErrors.next_service_date = "Next service date must be after service date";
            }
            else if (nextForm.next_service_date && nextForm.next_service_date <= today) {
                nextErrors.next_service_date = "Next service date must be in the future";
            }
            else {
                nextErrors.next_service_date = "";
            }
        }
        if (field === "cost") {
            const parsedCost = parseFloat(value);
            if (value && (isNaN(parsedCost) || parsedCost <= 0)) {
                nextErrors.cost = "Cost must be a positive value";
            }
            else {
                nextErrors.cost = "";
            }
        }
        if (field === "next_service_date") {
            if (value) {
                if (value <= today) {
                    nextErrors.next_service_date = "Next service date must be in the future";
                }
                else if (nextForm.service_date && value <= nextForm.service_date) {
                    nextErrors.next_service_date = "Next service date must be after service date";
                }
                else {
                    nextErrors.next_service_date = "";
                }
            }
            else {
                nextErrors.next_service_date = "";
            }
        }
        setLogErrors(nextErrors);
    };
    const handleScheduleFieldChange = (value) => {
        setScheduleForm({ next_service_date: value });
        const today = new Date().toISOString().substring(0, 10);
        if (value && value <= today) {
            setScheduleError("Next service date must be in the future");
        }
        else {
            setScheduleError("");
        }
    };
    // Submission Handlers
    const handleLogSubmit = async (e) => {
        e.preventDefault();
        if (logErrors.service_date ||
            logErrors.cost ||
            logErrors.next_service_date ||
            !logForm.asset_id ||
            !logForm.service_date ||
            !logForm.service_provider ||
            !logForm.description) {
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
        }
        catch (err) {
            setLogErrors(prev => ({ ...prev, general: err.message || "Failed to log maintenance." }));
        }
        finally {
            setIsSubmitting(false);
        }
    };
    const handleScheduleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedRecord || scheduleError || !scheduleForm.next_service_date)
            return;
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
        }
        catch (err) {
            setError(err.message || "Failed to schedule next maintenance.");
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
                method: "PATCH",
            });
            setSuccess(`Maintenance complete. Asset ${completeConfirm.asset_name || completeConfirm.asset_id} is now Active.`);
            setCompleteConfirm(null);
            fetchMaintenanceData();
        }
        catch (err) {
            setError(err.message || "Failed to complete maintenance.");
        }
    };
    const isNextServiceWarning = (nextDateStr) => {
        if (!nextDateStr)
            return false;
        const nextDate = new Date(nextDateStr);
        const today = new Date();
        const diffTime = nextDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 30;
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
        { header: "Service Provider", render: (r) => r.service_provider },
        {
            header: "Maintenance Type",
            render: (r) => r.maintenance_type || "Preventive",
        },
        {
            header: "Description",
            render: (r) => (_jsx("span", { className: "text-xs text-ink-dim block max-w-[200px] truncate", title: r.description, children: r.description })),
        },
        {
            header: "Cost",
            render: (r) => (r.cost ? `UGX ${r.cost.toLocaleString()}` : "—"),
        },
        {
            header: "Next Service Date",
            render: (r) => {
                const isUpcoming = isNextServiceWarning(r.next_service_date);
                return (_jsxs("div", { className: "flex items-center gap-1", children: [r.next_service_date ? new Date(r.next_service_date).toLocaleDateString() : "—", isUpcoming && (_jsx("span", { title: "Due within 30 days", children: _jsx(ICONS.alert, { className: "w-4 h-4 text-badge-amberText shrink-0" }) }))] }));
            },
        },
        { header: "Recorded By", render: (r) => r.recorded_by_name },
        {
            header: "Asset Status",
            render: (r) => _jsx(StatusBadge, { status: r.asset_status || "Active" }),
        },
        ...(isAdminOrManager
            ? [
                {
                    header: "Actions",
                    render: (r) => (_jsxs("div", { className: "flex flex-wrap gap-1.5", children: [r.asset_status === "Under Maintenance" && (_jsx(Button, { variant: "outline", onClick: () => setCompleteConfirm(r), children: "Mark Complete" })), (!r.next_service_date || new Date(r.next_service_date) <= new Date()) && (_jsx(Button, { variant: "outline", onClick: () => {
                                    setSelectedRecord(r);
                                    setScheduleForm({ next_service_date: "" });
                                    setShowScheduleModal(true);
                                }, children: "Schedule Next" }))] })),
                },
            ]
            : []),
    ];
    return (_jsxs("div", { className: "w-full flex flex-col gap-6 select-none font-sans", children: [success && _jsx(SuccessBanner, { message: success, onDismiss: () => setSuccess(null) }), error && _jsx(ErrorMessage, { message: error }), showUpcomingBanner && upcoming.length > 0 && (_jsxs("div", { className: "bg-badge-amberBg border border-badge-amberText/16 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm", children: [_jsxs("p", { className: "flex items-center gap-2 font-bold text-ink text-sm", children: [_jsx(ICONS.alert, { className: "w-5 h-5 text-badge-amberText stroke-[2.2]" }), upcoming.length, " asset(s) due for maintenance within 30 days"] }), _jsx(Button, { variant: "outline", onClick: () => setShowUpcomingBanner(false), children: "Dismiss" })] })), _jsx(PageHeader, { title: "Asset Maintenance", subtitle: "Track maintenance history, schedule service runs, and log repairs", actions: isAdminOrManager && (_jsxs(Button, { onClick: () => setShowLogModal(true), children: [_jsx(ICONS.add, { className: "w-4 h-4 mr-1.5 stroke-[2.4]" }), "Log Maintenance"] })) }), isLoading ? (_jsx("div", { className: "flex justify-center py-16", children: _jsx("div", { className: "animate-spin rounded-full h-10 w-10 border-b-2 border-ursb" }) })) : records.length === 0 ? (_jsx(EmptyState, { title: "No maintenance history", description: "There are no maintenance records logged in the system.", icon: _jsx(ICONS.maintenance, { className: "w-6 h-6 text-ink-icon stroke-[2.2]" }) })) : (_jsx(Table, { data: records, columns: columns, rowKey: (r) => r.maintenance_id, emptyMessage: "No maintenance records found." })), _jsx(Modal, { open: showLogModal, onClose: handleCloseLogModal, title: "Log Maintenance Record", children: _jsxs("form", { onSubmit: handleLogSubmit, children: [logErrors.general && _jsx(ErrorMessage, { message: logErrors.general }), _jsx(FormInput, { type: "text", label: "Asset ID *", value: logForm.asset_id, onChange: (val) => handleLogFieldChange("asset_id", val), required: true, placeholder: "e.g. URSB-1234ABCD" }), _jsx(FormInput, { type: "date", label: "Service Date *", value: logForm.service_date, onChange: (val) => handleLogFieldChange("service_date", val), required: true, error: logErrors.service_date }), _jsx(FormInput, { type: "text", label: "Service Provider *", value: logForm.service_provider, onChange: (val) => handleLogFieldChange("service_provider", val), required: true, placeholder: "e.g. Dell Support, Toyota Service" }), _jsx(FormInput, { type: "text", label: "Maintenance Type", value: logForm.maintenance_type, onChange: (val) => handleLogFieldChange("maintenance_type", val), placeholder: "e.g. Preventive, Corrective, Inspection" }), _jsx(FormInput, { type: "textarea", label: "Description *", value: logForm.description, onChange: (val) => handleLogFieldChange("description", val), required: true, placeholder: "Describe the maintenance performed or issues resolved..." }), _jsx(FormInput, { type: "number", label: "Cost (UGX, Optional)", value: logForm.cost, onChange: (val) => handleLogFieldChange("cost", val), placeholder: "e.g. 150000", error: logErrors.cost }), _jsx(FormInput, { type: "date", label: "Next Service Date (Optional)", value: logForm.next_service_date, onChange: (val) => handleLogFieldChange("next_service_date", val), error: logErrors.next_service_date }), _jsxs("div", { className: "modal-footer", children: [_jsx(Button, { type: "button", variant: "ghost", onClick: handleCloseLogModal, children: "Cancel" }), _jsx(Button, { type: "submit", isLoading: isSubmitting, disabled: isSubmitting ||
                                        !!logErrors.service_date ||
                                        !!logErrors.cost ||
                                        !!logErrors.next_service_date ||
                                        !logForm.asset_id ||
                                        !logForm.service_provider ||
                                        !logForm.description, children: "Log Record" })] })] }) }), _jsx(Modal, { open: showScheduleModal, onClose: handleCloseScheduleModal, title: "Schedule Next Maintenance", children: _jsxs("form", { onSubmit: handleScheduleSubmit, children: [_jsx(FormInput, { type: "date", label: "Next Service Date *", value: scheduleForm.next_service_date, onChange: handleScheduleFieldChange, required: true, error: scheduleError }), _jsxs("div", { className: "modal-footer", children: [_jsx(Button, { type: "button", variant: "ghost", onClick: handleCloseScheduleModal, children: "Cancel" }), _jsx(Button, { type: "submit", isLoading: isSubmitting, disabled: isSubmitting || !!scheduleError || !scheduleForm.next_service_date, children: "Schedule Maintenance" })] })] }) }), _jsx(ConfirmDialog, { open: !!dirtyConfirm?.open, title: "Unsaved changes", message: "You have unsaved changes. Are you sure you want to close? Your changes will be lost.", onCancel: () => setDirtyConfirm(null), onConfirm: () => {
                    if (dirtyConfirm?.onConfirm)
                        dirtyConfirm.onConfirm();
                } }), _jsx(ConfirmDialog, { open: !!completeConfirm, title: "Mark maintenance complete?", message: "Are you sure maintenance is complete? The asset will return to Active status.", onCancel: () => setCompleteConfirm(null), onConfirm: handleCompleteConfirm })] }));
}
