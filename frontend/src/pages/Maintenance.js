import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
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
    return (_jsxs(_Fragment, { children: [success && _jsx(SuccessBanner, { message: success, onDismiss: () => setSuccess(null) }), error && _jsx(ErrorMessage, { message: error }), showUpcomingBanner && upcoming.length > 0 && (_jsxs("div", { className: "alert-warning", style: { marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [_jsxs("p", { style: { display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 600 }, children: [ICONS.alert, " ", upcoming.length, " asset(s) due for maintenance within 30 days"] }), _jsx("button", { className: "btn btn-secondary btn-sm", onClick: () => setShowUpcomingBanner(false), children: "Dismiss" })] })), _jsx(PageHeader, { title: "Asset Maintenance", subtitle: "Track maintenance history, schedule service runs, and log repairs", actions: isAdminOrManager && (_jsxs("button", { className: "btn btn-primary", onClick: () => setShowLogModal(true), children: [ICONS.add, " Log Maintenance"] })) }), isLoading ? (_jsx("div", { className: "page-loading", style: { display: "flex", justifyContent: "center", padding: "3rem" }, children: _jsx(LoadingSpinner, { size: "lg" }) })) : records.length === 0 ? (_jsx(EmptyState, { title: "No maintenance history", description: "There are no maintenance recordslogged in the system.", icon: "\uD83D\uDD27" })) : (_jsx("div", { className: "card", children: _jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Asset" }), _jsx("th", { children: "Service Date" }), _jsx("th", { children: "Service Provider" }), _jsx("th", { children: "Maintenance Type" }), _jsx("th", { children: "Description" }), _jsx("th", { children: "Cost" }), _jsx("th", { children: "Next Service Date" }), _jsx("th", { children: "Recorded By" }), _jsx("th", { children: "Asset Status" }), isAdminOrManager && _jsx("th", { children: "Actions" })] }) }), _jsx("tbody", { children: records.map((r) => {
                                const isUpcoming = isNextServiceWarning(r.next_service_date);
                                return (_jsxs("tr", { children: [_jsx("td", { children: _jsxs("div", { children: [_jsx("div", { className: "user-name", children: r.asset_name || "Asset" }), _jsx("div", { className: "text-small text-muted", children: r.asset_id })] }) }), _jsx("td", { children: new Date(r.service_date).toLocaleDateString() }), _jsx("td", { children: r.service_provider }), _jsx("td", { children: r.maintenance_type || "Preventive" }), _jsx("td", { className: "text-small", title: r.description, style: { maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: r.description }), _jsx("td", { children: r.cost ? `UGX ${r.cost.toLocaleString()}` : "-" }), _jsx("td", { children: _jsxs("div", { style: { display: "flex", alignItems: "center", gap: "0.25rem" }, children: [r.next_service_date ? new Date(r.next_service_date).toLocaleDateString() : "-", isUpcoming && (_jsx("span", { title: "Due within 30 days", style: { color: "var(--color-orange)", fontSize: "1.1rem" }, children: "\u26A0\uFE0F" }))] }) }), _jsx("td", { children: r.recorded_by_name }), _jsx("td", { children: _jsx(StatusBadge, { status: r.asset_status || "Active" }) }), isAdminOrManager && (_jsx("td", { children: _jsxs("div", { style: { display: "flex", gap: "0.25rem" }, children: [r.asset_status === "Under Maintenance" && (_jsx("button", { className: "btn btn-secondary btn-sm", onClick: () => setCompleteConfirm(r), children: "Mark Complete" })), (!r.next_service_date || new Date(r.next_service_date) <= new Date()) && (_jsx("button", { className: "btn btn-secondary btn-sm", onClick: () => {
                                                            setSelectedRecord(r);
                                                            setScheduleForm({ next_service_date: "" });
                                                            setShowScheduleModal(true);
                                                        }, children: "Schedule Next" }))] }) }))] }, r.maintenance_id));
                            }) })] }) })), _jsx(Modal, { open: showLogModal, onClose: handleCloseLogModal, title: "Log Maintenance Record", children: _jsxs("form", { onSubmit: handleLogSubmit, children: [logErrors.general && _jsx(ErrorMessage, { message: logErrors.general }), _jsx(FormInput, { type: "text", label: "Asset ID *", value: logForm.asset_id, onChange: (val) => handleLogFieldChange("asset_id", val), required: true, placeholder: "e.g. URSB-1234ABCD" }), _jsx(FormInput, { type: "date", label: "Service Date *", value: logForm.service_date, onChange: (val) => handleLogFieldChange("service_date", val), required: true, error: logErrors.service_date }), _jsx(FormInput, { type: "text", label: "Service Provider *", value: logForm.service_provider, onChange: (val) => handleLogFieldChange("service_provider", val), required: true, placeholder: "e.g. Dell Support, Toyota Service" }), _jsx(FormInput, { type: "text", label: "Maintenance Type", value: logForm.maintenance_type, onChange: (val) => handleLogFieldChange("maintenance_type", val), placeholder: "e.g. Preventive, Corrective, Inspection" }), _jsx(FormInput, { type: "textarea", label: "Description *", value: logForm.description, onChange: (val) => handleLogFieldChange("description", val), required: true, placeholder: "Describe the maintenance performed or issues resolved..." }), _jsx(FormInput, { type: "number", label: "Cost (UGX, Optional)", value: logForm.cost, onChange: (val) => handleLogFieldChange("cost", val), placeholder: "e.g. 150000", error: logErrors.cost }), _jsx(FormInput, { type: "date", label: "Next Service Date (Optional)", value: logForm.next_service_date, onChange: (val) => handleLogFieldChange("next_service_date", val), error: logErrors.next_service_date }), _jsxs("div", { className: "modal-footer", children: [_jsx("button", { type: "button", className: "btn btn-secondary", onClick: handleCloseLogModal, children: "Cancel" }), _jsx("button", { type: "submit", className: "btn btn-primary", disabled: isSubmitting ||
                                        !!logErrors.service_date ||
                                        !!logErrors.cost ||
                                        !!logErrors.next_service_date ||
                                        !logForm.asset_id ||
                                        !logForm.service_provider ||
                                        !logForm.description, children: isSubmitting ? _jsx(LoadingSpinner, { size: "sm" }) : "Log Record" })] })] }) }), _jsx(Modal, { open: showScheduleModal, onClose: handleCloseScheduleModal, title: "Schedule Next Maintenance", children: _jsxs("form", { onSubmit: handleScheduleSubmit, children: [_jsx(FormInput, { type: "date", label: "Next Service Date *", value: scheduleForm.next_service_date, onChange: handleScheduleFieldChange, required: true, error: scheduleError }), _jsxs("div", { className: "modal-footer", children: [_jsx("button", { type: "button", className: "btn btn-secondary", onClick: handleCloseScheduleModal, children: "Cancel" }), _jsx("button", { type: "submit", className: "btn btn-primary", disabled: isSubmitting || !!scheduleError || !scheduleForm.next_service_date, children: isSubmitting ? _jsx(LoadingSpinner, { size: "sm" }) : "Schedule Maintenance" })] })] }) }), _jsx(ConfirmDialog, { open: !!dirtyConfirm?.open, title: "Unsaved changes", message: "You have unsaved changes. Are you sure you want to close? Your changes will be lost.", onCancel: () => setDirtyConfirm(null), onConfirm: () => {
                    if (dirtyConfirm?.onConfirm)
                        dirtyConfirm.onConfirm();
                } }), _jsx(ConfirmDialog, { open: !!completeConfirm, title: "Mark maintenance complete?", message: "Are you sure maintenance is complete? The asset will return to Active status.", onCancel: () => setCompleteConfirm(null), onConfirm: handleCompleteConfirm })] }));
}
