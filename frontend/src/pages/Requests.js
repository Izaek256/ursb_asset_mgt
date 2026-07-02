import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
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
import FilterBar, { FilterField, filterInputCls, filterSelectCls } from "../components/common/FilterBar";
export default function Requests() {
    const { user } = useAuth();
    const [requests, setRequests] = React.useState([]);
    const [assets, setAssets] = React.useState([]);
    const [users, setUsers] = React.useState([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [success, setSuccess] = React.useState(null);
    // Filters (Admin/Manager only)
    const [statusFilter, setStatusFilter] = React.useState("All");
    const [requestedBySearch, setRequestedBySearch] = React.useState("");
    // Modals state
    const [showSubmitModal, setShowSubmitModal] = React.useState(false);
    const [showApproveModal, setShowApproveModal] = React.useState(false);
    const [showRejectModal, setShowRejectModal] = React.useState(false);
    const [showAssignModal, setShowAssignModal] = React.useState(false);
    const [selectedRequest, setSelectedRequest] = React.useState(null);
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
    const [dirtyConfirm, setDirtyConfirm] = React.useState(null);
    // Complete request confirmation
    const [completeConfirm, setCompleteConfirm] = React.useState(null);
    const isAdminOrManager = user?.role === "System Administrator" || user?.role === "Asset Manager";
    const fetchRequests = React.useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await apiFetch("/requests", {});
            setRequests(data.requests);
        }
        catch (err) {
            setError(err.message || "Failed to load requests.");
        }
        finally {
            setIsLoading(false);
        }
    }, []);
    const fetchAssetsAndUsers = React.useCallback(async () => {
        try {
            const assetsData = await apiFetch("/assets", {});
            setAssets(assetsData);
            if (isAdminOrManager) {
                const usersData = await apiFetch("/admin/users", {});
                setUsers(usersData);
            }
        }
        catch (err) {
            console.error("Failed to load assets/users context", err);
        }
    }, [isAdminOrManager]);
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
        }
        else {
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
        }
        else {
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
        }
        else {
            setShowAssignModal(false);
        }
    };
    // Handlers
    const handleClearFilters = () => {
        setStatusFilter("All");
        setRequestedBySearch("");
    };
    const handleSubmitRequest = async (e) => {
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
        }
        catch (err) {
            setError(err.message || "Failed to submit request.");
        }
        finally {
            setIsSubmitting(false);
        }
    };
    const handleApproveClick = (req) => {
        setSelectedRequest(req);
        // If request does not have an asset_id, we need to assign one of the requested type
        if (!req.asset_id) {
            const typeAssets = assets.filter(a => a.asset_type === req.asset_type && a.status === "Active");
            setApproveForm({
                assigned_asset_id: typeAssets[0]?.asset_id || "",
            });
        }
        else {
            setApproveForm({ assigned_asset_id: "" });
        }
        setShowApproveModal(true);
    };
    const handleApproveSubmit = async (e) => {
        e.preventDefault();
        if (!selectedRequest)
            return;
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
        }
        catch (err) {
            setError(err.message || "Failed to approve request.");
        }
        finally {
            setIsSubmitting(false);
        }
    };
    const handleRejectClick = (req) => {
        setSelectedRequest(req);
        setRejectForm({ notes: "" });
        setShowRejectModal(true);
    };
    const handleRejectSubmit = async (e) => {
        e.preventDefault();
        if (!selectedRequest || !rejectForm.notes.trim())
            return;
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
        }
        catch (err) {
            setError(err.message || "Failed to reject request.");
        }
        finally {
            setIsSubmitting(false);
        }
    };
    const handleAssignClick = (req) => {
        setSelectedRequest(req);
        setAssignForm({
            asset_id: req.asset_id || "",
            custodian_id: "",
        });
        setShowAssignModal(true);
    };
    const handleAssignSubmit = async (e) => {
        e.preventDefault();
        if (!selectedRequest || !assignForm.asset_id)
            return;
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
        }
        catch (err) {
            setError(err.message || "Failed to assign request.");
        }
        finally {
            setIsSubmitting(false);
        }
    };
    const handleCancelClick = async (req) => {
        setError(null);
        try {
            await apiFetch(`/requests/${req.request_id}/cancel`, { method: "PUT" });
            setSuccess(`Request #${req.request_id} cancelled.`);
            fetchRequests();
        }
        catch (err) {
            setError(err.message || "Failed to cancel request.");
        }
    };
    const handlePickupClick = async (req) => {
        setError(null);
        try {
            await apiFetch(`/requests/${req.request_id}/pickup`, { method: "PUT" });
            setSuccess(`Pickup confirmed for request #${req.request_id}.`);
            fetchRequests();
        }
        catch (err) {
            setError(err.message || "Failed to confirm pickup.");
        }
    };
    const handleCompleteConfirm = async () => {
        if (!completeConfirm)
            return;
        setError(null);
        try {
            await apiFetch(`/requests/${completeConfirm.request_id}/complete`, { method: "PUT" });
            setSuccess(`Request #${completeConfirm.request_id} marked as completed.`);
            setCompleteConfirm(null);
            fetchRequests();
        }
        catch (err) {
            setError(err.message || "Failed to complete request.");
        }
    };
    // Client-side filtering
    const filteredRequests = requests.filter(r => {
        const matchesStatus = statusFilter === "All" || r.status === statusFilter;
        const matchesRequestedBy = !requestedBySearch.trim() ||
            (r.requested_by_name && r.requested_by_name.toLowerCase().includes(requestedBySearch.toLowerCase()));
        return matchesStatus && matchesRequestedBy;
    });
    const renderActions = (r) => (_jsxs("div", { className: "flex flex-wrap gap-1.5 select-none", children: [user?.role === "Employee" && r.status === "Pending" && (_jsx(Button, { variant: "danger-outline", onClick: () => handleCancelClick(r), children: "Cancel" })), user?.role === "Employee" && r.status === "Assigned" && (_jsx(Button, { variant: "outline", onClick: () => handlePickupClick(r), children: "Confirm Pickup" })), isAdminOrManager && r.status === "Pending" && (_jsxs(_Fragment, { children: [_jsx(Button, { onClick: () => handleApproveClick(r), children: "Approve" }), _jsx(Button, { variant: "danger-outline", onClick: () => handleRejectClick(r), children: "Reject" })] })), isAdminOrManager && r.status === "Approved" && (_jsx(Button, { variant: "outline", onClick: () => handleAssignClick(r), children: "Assign" })), isAdminOrManager && r.status === "PickedUp" && (_jsx(Button, { onClick: () => setCompleteConfirm(r), children: "Complete" }))] }));
    const columns = [
        {
            header: "Request ID",
            render: (r) => _jsxs("span", { className: "font-bold text-ursb", children: ["#", r.request_id] }),
        },
        {
            header: "Asset / Type",
            render: (r) => r.asset_id ? (_jsxs("div", { children: [_jsx("div", { className: "font-bold text-ink text-sm", children: r.asset_name || "Asset" }), _jsx("div", { className: "text-[11px] text-ink-dim mt-0.5", children: r.asset_id })] })) : (_jsx("span", { className: "text-ink font-semibold", children: r.asset_type })),
        },
        {
            header: "Requested By",
            render: (r) => _jsx("span", { className: "font-semibold", children: r.requested_by_name || `User ID: ${r.requested_by}` }),
        },
        {
            header: "Priority",
            render: (r) => _jsx(StatusBadge, { status: r.priority }),
        },
        {
            header: "Status",
            render: (r) => _jsx(StatusBadge, { status: r.status }),
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
    const assetOptions = assets.filter(a => a.status === "Active").map(a => ({
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
        .filter(a => a.asset_type === selectedRequest?.asset_type && a.status === "Active")
        .map(a => ({
        value: a.asset_id,
        label: `${a.asset_name} (${a.asset_id}) - SN: ${a.serial_number}`,
    }));
    const custodianOptions = users.filter(u => u.isActive).map(u => ({
        value: String(u.id),
        label: `${u.name} (${u.role})`,
    }));
    return (_jsxs("div", { className: "w-full flex flex-col gap-6 select-none font-sans", children: [success && _jsx(SuccessBanner, { message: success, onDismiss: () => setSuccess(null) }), error && _jsx(ErrorMessage, { message: error }), _jsx(PageHeader, { title: isAdminOrManager ? "Asset Requests" : "My Asset Requests", subtitle: isAdminOrManager
                    ? "Review and manage employee asset requests"
                    : "Submit and track your asset requests", actions: _jsxs(Button, { onClick: () => setShowSubmitModal(true), children: [_jsx(ICONS.plus, { className: "w-4 h-4 mr-1.5 stroke-[2.4]" }), "Submit Request"] }) }), isAdminOrManager && (_jsxs(FilterBar, { count: { value: filteredRequests.length, label: "requests" }, onClear: handleClearFilters, children: [_jsx(FilterField, { label: "Status", htmlFor: "status-filter", children: _jsxs("select", { id: "status-filter", value: statusFilter, onChange: (e) => setStatusFilter(e.target.value), className: filterSelectCls, children: [_jsx("option", { value: "All", children: "All Statuses" }), _jsx("option", { value: "Pending", children: "Pending" }), _jsx("option", { value: "Approved", children: "Approved" }), _jsx("option", { value: "Rejected", children: "Rejected" }), _jsx("option", { value: "Assigned", children: "Assigned" }), _jsx("option", { value: "PickedUp", children: "Picked Up" }), _jsx("option", { value: "Completed", children: "Completed" }), _jsx("option", { value: "Cancelled", children: "Cancelled" })] }) }), _jsx(FilterField, { label: "Requested By", htmlFor: "requested-by-filter", children: _jsx("input", { id: "requested-by-filter", type: "text", className: filterInputCls, placeholder: "Search by requester...", value: requestedBySearch, onChange: (e) => setRequestedBySearch(e.target.value) }) })] })), isLoading ? (_jsx("div", { className: "flex justify-center py-16", children: _jsx("div", { className: "animate-spin rounded-full h-10 w-10 border-b-2 border-ursb" }) })) : filteredRequests.length === 0 ? (_jsx(EmptyState, { title: "No requests found", description: "There are no requests matching your criteria.", icon: _jsx(ICONS.requests, { className: "w-6 h-6 text-ink-icon stroke-[2.2]" }) })) : (_jsx(Table, { data: filteredRequests, columns: columns, rowKey: (r) => r.request_id, emptyMessage: "No requests found." })), _jsx(Modal, { open: showSubmitModal, onClose: handleCloseSubmitModal, title: "Submit Asset Request", children: _jsxs("form", { onSubmit: handleSubmitRequest, className: "flex flex-col gap-4", children: [_jsx(FormInput, { type: "select", variant: "light", label: "Specific Asset (Optional)", value: submitForm.asset_id, onChange: (val) => setSubmitForm({ ...submitForm, asset_id: val }), options: [{ value: "", label: "Select an asset (optional)..." }, ...assetOptions] }), _jsx(FormInput, { type: "select", variant: "light", label: "Asset Type (Required if no asset chosen)", value: submitForm.asset_type, onChange: (val) => setSubmitForm({ ...submitForm, asset_type: val }), options: [{ value: "", label: "Select an asset type..." }, ...assetTypeOptions] }), _jsx(FormInput, { type: "textarea", variant: "light", label: "Reason for Request", value: submitForm.reason, onChange: (val) => setSubmitForm({ ...submitForm, reason: val }), required: true, placeholder: "Please detail why you need this asset (minimum 10 characters)...", characterCount: { current: submitForm.reason.length, min: 10 } }), _jsx(FormInput, { type: "select", variant: "light", label: "Priority", value: submitForm.priority, onChange: (val) => setSubmitForm({ ...submitForm, priority: val }), options: priorityOptions }), _jsx(FormInput, { type: "date", variant: "light", label: "Required By Date (Optional)", value: submitForm.required_by_date, onChange: (val) => setSubmitForm({ ...submitForm, required_by_date: val }) }), _jsxs("div", { className: "flex justify-end gap-2.5 border-t border-sky-page/20 pt-4 mt-2", children: [_jsx(Button, { type: "button", variant: "ghost", onClick: handleCloseSubmitModal, children: "Cancel" }), _jsx(Button, { type: "submit", isLoading: isSubmitting, disabled: isSubmitting || submitForm.reason.length < 10 || (!submitForm.asset_id && !submitForm.asset_type), children: "Submit Request" })] })] }) }), _jsx(Modal, { open: showApproveModal, onClose: () => setShowApproveModal(false), title: "Approve Request", children: _jsxs("form", { onSubmit: handleApproveSubmit, className: "flex flex-col gap-4", children: [_jsxs("p", { className: "text-xs text-ink-dim/80 mb-2 leading-relaxed", children: ["Confirm approval for request ", _jsxs("b", { className: "text-ursb", children: ["#", selectedRequest?.request_id] }), " submitted by ", _jsx("b", { className: "text-ink", children: selectedRequest?.requested_by_name }), "."] }), !selectedRequest?.asset_id && (_jsx(FormInput, { type: "select", variant: "light", label: "Select Asset to Assign", value: approveForm.assigned_asset_id, onChange: (val) => setApproveForm({ assigned_asset_id: val }), options: [{ value: "", label: "Select an asset to fulfill this request..." }, ...approveAssetOptions], required: true })), _jsxs("div", { className: "flex justify-end gap-2.5 border-t border-sky-page/20 pt-4 mt-2", children: [_jsx(Button, { type: "button", variant: "ghost", onClick: () => setShowApproveModal(false), children: "Cancel" }), _jsx(Button, { type: "submit", isLoading: isSubmitting, disabled: isSubmitting || (!selectedRequest?.asset_id && !approveForm.assigned_asset_id), children: "Approve Request" })] })] }) }), _jsx(Modal, { open: showRejectModal, onClose: handleCloseRejectModal, title: "Reject Request", children: _jsxs("form", { onSubmit: handleRejectSubmit, className: "flex flex-col gap-4", children: [_jsx(FormInput, { type: "textarea", variant: "light", label: "Rejection Reason / Notes", value: rejectForm.notes, onChange: (val) => setRejectForm({ notes: val }), required: true, placeholder: "Please provide details for the rejection..." }), _jsxs("div", { className: "flex justify-end gap-2.5 border-t border-sky-page/20 pt-4 mt-2", children: [_jsx(Button, { type: "button", variant: "ghost", onClick: handleCloseRejectModal, children: "Cancel" }), _jsx(Button, { type: "submit", variant: "danger-outline", isLoading: isSubmitting, disabled: isSubmitting || !rejectForm.notes.trim(), children: "Reject Request" })] })] }) }), _jsx(Modal, { open: showAssignModal, onClose: handleCloseAssignModal, title: "Assign Asset Custody", children: _jsxs("form", { onSubmit: handleAssignSubmit, className: "flex flex-col gap-4", children: [_jsx(FormInput, { type: "text", variant: "light", label: "Asset ID", value: assignForm.asset_id, onChange: () => { }, disabled: true }), _jsx(FormInput, { type: "select", variant: "light", label: "Assign Custodian (Defaults to you)", value: assignForm.custodian_id, onChange: (val) => setAssignForm({ ...assignForm, custodian_id: val }), options: [{ value: "", label: "Select custodian user..." }, ...custodianOptions] }), _jsxs("div", { className: "flex justify-end gap-2.5 border-t border-sky-page/20 pt-4 mt-2", children: [_jsx(Button, { type: "button", variant: "ghost", onClick: handleCloseAssignModal, children: "Cancel" }), _jsx(Button, { type: "submit", isLoading: isSubmitting, disabled: isSubmitting || !assignForm.asset_id, children: "Confirm Assignment" })] })] }) }), _jsx(ConfirmDialog, { open: !!dirtyConfirm?.open, title: "Unsaved changes", message: "You have unsaved changes. Are you sure you want to close? Your changes will be lost.", onCancel: () => setDirtyConfirm(null), onConfirm: () => {
                    if (dirtyConfirm?.onConfirm)
                        dirtyConfirm.onConfirm();
                } }), _jsx(ConfirmDialog, { open: !!completeConfirm, title: "Mark request complete?", message: "This will mark the request as Completed. The asset has been successfully handed over.", onCancel: () => setCompleteConfirm(null), onConfirm: handleCompleteConfirm })] }));
}
