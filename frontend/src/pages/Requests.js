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
    const priorityBadgeColor = (priority) => {
        switch (priority) {
            case "Urgent": return "badge-rejected"; // Red
            case "High": return "badge-warning"; // Orange
            case "Normal": return "badge-info"; // Blue
            case "Low": return "badge-inactive"; // Gray
            default: return "";
        }
    };
    return (_jsxs(_Fragment, { children: [success && _jsx(SuccessBanner, { message: success, onDismiss: () => setSuccess(null) }), error && _jsx(ErrorMessage, { message: error }), _jsx(PageHeader, { title: isAdminOrManager ? "Asset Requests" : "My Asset Requests", subtitle: isAdminOrManager ? "Review and manage employee asset requests" : "Submit and track your asset requests", actions: _jsxs("button", { className: "btn btn-primary", onClick: () => setShowSubmitModal(true), children: [ICONS.add, " Submit Request"] }) }), isAdminOrManager && (_jsxs("div", { className: "filter-bar", children: [_jsxs("div", { className: "filter-group", children: [_jsx("label", { htmlFor: "status-filter", className: "filter-label", children: "Status" }), _jsxs("select", { id: "status-filter", value: statusFilter, onChange: (e) => setStatusFilter(e.target.value), className: "filter-select", children: [_jsx("option", { value: "All", children: "All Statuses" }), _jsx("option", { value: "Pending", children: "Pending" }), _jsx("option", { value: "Approved", children: "Approved" }), _jsx("option", { value: "Rejected", children: "Rejected" }), _jsx("option", { value: "Assigned", children: "Assigned" }), _jsx("option", { value: "PickedUp", children: "Picked Up" }), _jsx("option", { value: "Completed", children: "Completed" }), _jsx("option", { value: "Cancelled", children: "Cancelled" })] })] }), _jsxs("div", { className: "filter-group", children: [_jsx("label", { htmlFor: "requested-by-filter", className: "filter-label", children: "Requested By" }), _jsx("input", { id: "requested-by-filter", type: "text", className: "filter-search", placeholder: "Search by requester...", value: requestedBySearch, onChange: (e) => setRequestedBySearch(e.target.value) })] }), _jsx("button", { className: "btn btn-secondary btn-sm", onClick: handleClearFilters, children: "Clear Filters" }), _jsxs("div", { className: "filter-count", children: [filteredRequests.length, " requests"] })] })), isLoading ? (_jsx("div", { className: "page-loading", style: { display: "flex", justifyContent: "center", padding: "3rem" }, children: _jsx(LoadingSpinner, { size: "lg" }) })) : filteredRequests.length === 0 ? (_jsx(EmptyState, { title: "No requests found", description: "There are no requests matching your criteria.", icon: "\uD83D\uDCCB" })) : (_jsx("div", { className: "card", children: _jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Request ID" }), _jsx("th", { children: "Asset / Type" }), _jsx("th", { children: "Requested By" }), _jsx("th", { children: "Priority" }), _jsx("th", { children: "Status" }), _jsx("th", { children: "Required By" }), _jsx("th", { children: "Requested Date" }), _jsx("th", { children: "Actions" })] }) }), _jsx("tbody", { children: filteredRequests.map((r) => (_jsxs("tr", { children: [_jsxs("td", { children: ["#", r.request_id] }), _jsx("td", { children: r.asset_id ? (_jsxs("div", { children: [_jsx("div", { className: "user-name", children: r.asset_name || "Asset" }), _jsx("div", { className: "text-small text-muted", children: r.asset_id })] })) : (_jsx("span", { className: "text-muted", children: r.asset_type })) }), _jsx("td", { children: r.requested_by_name || `User ID: ${r.requested_by}` }), _jsx("td", { children: _jsx("span", { className: `badge ${priorityBadgeColor(r.priority)}`, children: r.priority }) }), _jsx("td", { children: _jsx(StatusBadge, { status: r.status }) }), _jsx("td", { children: r.required_by_date ? new Date(r.required_by_date).toLocaleDateString() : "-" }), _jsx("td", { children: new Date(r.requested_date).toLocaleDateString() }), _jsx("td", { children: _jsxs("div", { style: { display: "flex", gap: "0.25rem" }, children: [user?.role === "Employee" && r.status === "Pending" && (_jsx("button", { className: "btn btn-danger btn-sm", onClick: () => handleCancelClick(r), children: "Cancel" })), user?.role === "Employee" && r.status === "Assigned" && (_jsx("button", { className: "btn btn-secondary btn-sm", onClick: () => handlePickupClick(r), children: "\uD83E\uDD1D Confirm Pickup" })), isAdminOrManager && r.status === "Pending" && (_jsxs(_Fragment, { children: [_jsx("button", { className: "btn btn-primary btn-sm", onClick: () => handleApproveClick(r), children: "Approve" }), _jsx("button", { className: "btn btn-danger btn-sm", onClick: () => handleRejectClick(r), children: "Reject" })] })), isAdminOrManager && r.status === "Approved" && (_jsx("button", { className: "btn btn-secondary btn-sm", onClick: () => handleAssignClick(r), children: "Assign" })), isAdminOrManager && r.status === "PickedUp" && (_jsx("button", { className: "btn btn-primary btn-sm", onClick: () => setCompleteConfirm(r), children: "Complete" }))] }) })] }, r.request_id))) })] }) })), _jsx(Modal, { open: showSubmitModal, onClose: handleCloseSubmitModal, title: "Submit Asset Request", children: _jsxs("form", { onSubmit: handleSubmitRequest, children: [_jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "submit-asset-id", className: "form-label", children: "Specific Asset (Optional)" }), _jsxs("select", { id: "submit-asset-id", className: "form-control", value: submitForm.asset_id, onChange: (e) => setSubmitForm({ ...submitForm, asset_id: e.target.value }), children: [_jsx("option", { value: "", children: "Select an asset (if requesting a specific one)..." }), assets.filter(a => a.status === "Active").map(a => (_jsxs("option", { value: a.asset_id, children: [a.asset_name, " (", a.asset_id, ")"] }, a.asset_id)))] })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "submit-asset-type", className: "form-label", children: "Asset Type (Required if no asset chosen)" }), _jsxs("select", { id: "submit-asset-type", className: "form-control", value: submitForm.asset_type, onChange: (e) => setSubmitForm({ ...submitForm, asset_type: e.target.value }), children: [_jsx("option", { value: "", children: "Select an asset type..." }), _jsx("option", { value: "ICT Equipment", children: "ICT Equipment" }), _jsx("option", { value: "Furniture", children: "Furniture" }), _jsx("option", { value: "Vehicle", children: "Vehicle" }), _jsx("option", { value: "Software", children: "Software" }), _jsx("option", { value: "Other", children: "Other" })] })] }), _jsx(FormInput, { type: "textarea", label: "Reason for Request", value: submitForm.reason, onChange: (val) => setSubmitForm({ ...submitForm, reason: val }), required: true, placeholder: "Please detail why you need this asset (minimum 10 characters)...", characterCount: { current: submitForm.reason.length, min: 10 } }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "submit-priority", className: "form-label", children: "Priority" }), _jsxs("select", { id: "submit-priority", className: "form-control", value: submitForm.priority, onChange: (e) => setSubmitForm({ ...submitForm, priority: e.target.value }), children: [_jsx("option", { value: "Low", children: "Low" }), _jsx("option", { value: "Normal", children: "Normal" }), _jsx("option", { value: "High", children: "High" }), _jsx("option", { value: "Urgent", children: "Urgent" })] })] }), _jsx(FormInput, { type: "date", label: "Required By Date (Optional)", value: submitForm.required_by_date, onChange: (val) => setSubmitForm({ ...submitForm, required_by_date: val }) }), _jsxs("div", { className: "modal-footer", children: [_jsx("button", { type: "button", className: "btn btn-secondary", onClick: handleCloseSubmitModal, children: "Cancel" }), _jsx("button", { type: "submit", className: "btn btn-primary", disabled: isSubmitting || submitForm.reason.length < 10 || (!submitForm.asset_id && !submitForm.asset_type), children: isSubmitting ? _jsx(LoadingSpinner, { size: "sm" }) : "Submit Request" })] })] }) }), _jsx(Modal, { open: showApproveModal, onClose: () => setShowApproveModal(false), title: "Approve Request", children: _jsxs("form", { onSubmit: handleApproveSubmit, children: [_jsxs("p", { className: "text-small text-muted", style: { marginBottom: "1rem" }, children: ["Confirm approval for request #", selectedRequest?.request_id, " submitted by ", selectedRequest?.requested_by_name, "."] }), !selectedRequest?.asset_id && (_jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "approve-asset-id", className: "form-label", children: "Select Asset to Assign" }), _jsxs("select", { id: "approve-asset-id", className: "form-control", value: approveForm.assigned_asset_id, onChange: (e) => setApproveForm({ assigned_asset_id: e.target.value }), required: true, children: [_jsx("option", { value: "", children: "Select an asset to fulfill this request..." }), assets
                                            .filter(a => a.asset_type === selectedRequest?.asset_type && a.status === "Active")
                                            .map(a => (_jsxs("option", { value: a.asset_id, children: [a.asset_name, " (", a.asset_id, ") - SN: ", a.serial_number] }, a.asset_id)))] })] })), _jsxs("div", { className: "modal-footer", children: [_jsx("button", { type: "button", className: "btn btn-secondary", onClick: () => setShowApproveModal(false), children: "Cancel" }), _jsx("button", { type: "submit", className: "btn btn-primary", disabled: isSubmitting || (!selectedRequest?.asset_id && !approveForm.assigned_asset_id), children: isSubmitting ? _jsx(LoadingSpinner, { size: "sm" }) : "Approve Request" })] })] }) }), _jsx(Modal, { open: showRejectModal, onClose: handleCloseRejectModal, title: "Reject Request", children: _jsxs("form", { onSubmit: handleRejectSubmit, children: [_jsx(FormInput, { type: "textarea", label: "Rejection Reason / Notes", value: rejectForm.notes, onChange: (val) => setRejectForm({ notes: val }), required: true, placeholder: "Please provide details for the rejection..." }), _jsxs("div", { className: "modal-footer", children: [_jsx("button", { type: "button", className: "btn btn-secondary", onClick: handleCloseRejectModal, children: "Cancel" }), _jsx("button", { type: "submit", className: "btn btn-danger", disabled: isSubmitting || !rejectForm.notes.trim(), children: isSubmitting ? _jsx(LoadingSpinner, { size: "sm" }) : "Reject Request" })] })] }) }), _jsx(Modal, { open: showAssignModal, onClose: handleCloseAssignModal, title: "Assign Asset Custody", children: _jsxs("form", { onSubmit: handleAssignSubmit, children: [_jsx(FormInput, { type: "text", label: "Asset ID", value: assignForm.asset_id, onChange: (val) => setAssignForm({ ...assignForm, asset_id: val }), disabled: true }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "assign-custodian", className: "form-label", children: "Assign Custodian (Defaults to you)" }), _jsxs("select", { id: "assign-custodian", className: "form-control", value: assignForm.custodian_id, onChange: (e) => setAssignForm({ ...assignForm, custodian_id: e.target.value }), children: [_jsx("option", { value: "", children: "Select custodian user..." }), users.filter(u => u.isActive).map(u => (_jsxs("option", { value: u.id, children: [u.name, " (", u.role, ")"] }, u.id)))] })] }), _jsxs("div", { className: "modal-footer", children: [_jsx("button", { type: "button", className: "btn btn-secondary", onClick: handleCloseAssignModal, children: "Cancel" }), _jsx("button", { type: "submit", className: "btn btn-primary", disabled: isSubmitting || !assignForm.asset_id, children: isSubmitting ? _jsx(LoadingSpinner, { size: "sm" }) : "Confirm Assignment" })] })] }) }), _jsx(ConfirmDialog, { open: !!dirtyConfirm?.open, title: "Unsaved changes", message: "You have unsaved changes. Are you sure you want to close? Your changes will be lost.", onCancel: () => setDirtyConfirm(null), onConfirm: () => {
                    if (dirtyConfirm?.onConfirm)
                        dirtyConfirm.onConfirm();
                } }), _jsx(ConfirmDialog, { open: !!completeConfirm, title: "Mark request complete?", message: "This will mark the request as Completed. The asset has been successfully handed over.", onCancel: () => setCompleteConfirm(null), onConfirm: handleCompleteConfirm })] }));
}
