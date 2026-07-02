import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React from "react";
import { apiFetch, useAuth } from "../AuthContext";
import Modal from "../components/Modal";
import FormInput from "../components/FormInput";
import ConfirmDialog from "../components/ConfirmDialog";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import SuccessBanner from "../components/SuccessBanner";
export default function Transfers() {
    const { user } = useAuth();
    const [transfers, setTransfers] = React.useState([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [successMessage, setSuccessMessage] = React.useState(null);
    const [assetIdFilter, setAssetIdFilter] = React.useState("");
    const [statusFilter, setStatusFilter] = React.useState("All");
    // Create Transfer modal state
    const [showCreateModal, setShowCreateModal] = React.useState(false);
    const [createForm, setCreateForm] = React.useState({
        asset_id: "",
        to_user_id: "",
        transfer_date: new Date().toISOString().split("T")[0],
        reason: "",
    });
    const [formDirty, setFormDirty] = React.useState(false);
    const [isCreating, setIsCreating] = React.useState(false);
    const [createError, setCreateError] = React.useState(null);
    // Dropdown data state
    const [assets, setAssets] = React.useState([]);
    const [users, setUsers] = React.useState([]);
    // Acknowledge dialog state
    const [acknowledgeDialog, setAcknowledgeDialog] = React.useState({
        open: false,
        transferId: null,
    });
    // Handle ?openModal=true on mount
    React.useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get("openModal") === "true") {
            setShowCreateModal(true);
        }
    }, []);
    React.useEffect(() => {
        fetchTransfers();
    }, []);
    // Fetch assets and users when modal opens
    React.useEffect(() => {
        if (showCreateModal && assets.length === 0) {
            const loadDropdownData = async () => {
                try {
                    const [assetsData, usersData] = await Promise.all([
                        apiFetch("/assets"),
                        apiFetch("/admin/users"),
                    ]);
                    console.log("Assets API response:", assetsData);
                    console.log("Users API response:", usersData);
                    setAssets(assetsData || []);
                    setUsers(usersData || []);
                }
                catch (err) {
                    console.error("Failed to load dropdown data:", err);
                }
            };
            loadDropdownData();
        }
    }, [showCreateModal, assets.length]);
    const handleClearFilters = () => {
        setAssetIdFilter("");
        setStatusFilter("All");
    };
    const fetchTransfers = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await apiFetch("/transfers");
            console.log("API Response:", data);
            // Handle both array response and object with transfers property
            const transfersArray = Array.isArray(data) ? data : (data.transfers || []);
            console.log("Transfers array:", transfersArray);
            setTransfers(transfersArray);
        }
        catch (err) {
            console.error("API Error:", err);
            setError(err.message || "Failed to load");
        }
        finally {
            setIsLoading(false);
        }
    };
    // Create Transfer form handlers
    const handleCreateFieldChange = (field, value) => {
        setCreateForm((prev) => ({ ...prev, [field]: value }));
        setFormDirty(true);
    };
    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        setCreateError(null);
        setIsCreating(true);
        try {
            await apiFetch("/transfers", {
                method: "POST",
                body: JSON.stringify({
                    asset_id: createForm.asset_id,
                    to_user_id: parseInt(createForm.to_user_id, 10),
                    transfer_date: createForm.transfer_date,
                    reason: createForm.reason,
                }),
            });
            setShowCreateModal(false);
            setCreateForm({
                asset_id: "",
                to_user_id: "",
                transfer_date: new Date().toISOString().split("T")[0],
                reason: "",
            });
            setFormDirty(false);
            setSuccessMessage("Transfer created. The receiving user can acknowledge it from their transfers view.");
            setTimeout(() => setSuccessMessage(null), 5000);
            fetchTransfers();
        }
        catch (err) {
            setCreateError(err.message || "Failed to create transfer");
        }
        finally {
            setIsCreating(false);
        }
    };
    const handleCreateModalClose = () => {
        if (formDirty) {
            setAcknowledgeDialog({ open: true, transferId: null });
        }
        else {
            setShowCreateModal(false);
            setCreateForm({
                asset_id: "",
                to_user_id: "",
                transfer_date: new Date().toISOString().split("T")[0],
                reason: "",
            });
            setFormDirty(false);
            setCreateError(null);
        }
    };
    const handleConfirmCloseWithoutSaving = () => {
        setAcknowledgeDialog({ open: false, transferId: null });
        setShowCreateModal(false);
        setCreateForm({
            asset_id: "",
            to_user_id: "",
            transfer_date: new Date().toISOString().split("T")[0],
            reason: "",
        });
        setFormDirty(false);
        setCreateError(null);
    };
    // Acknowledge handlers
    const handleAcknowledgeClick = (transferId) => {
        setAcknowledgeDialog({ open: true, transferId });
    };
    const handleAcknowledgeConfirm = async () => {
        if (!acknowledgeDialog.transferId)
            return;
        try {
            await apiFetch(`/transfers/${acknowledgeDialog.transferId}/acknowledge`, {
                method: "PUT",
            });
            setAcknowledgeDialog({ open: false, transferId: null });
            setSuccessMessage("Transfer acknowledged.");
            setTimeout(() => setSuccessMessage(null), 5000);
            fetchTransfers();
        }
        catch (err) {
            // Error handling - could show error in dialog
        }
    };
    // Role check for Create Transfer button
    const canCreateTransfer = user?.role === "Asset Manager" || user?.role === "System Administrator";
    // Filter transfers for display
    const displayedTransfers = transfers.filter((t) => {
        const matchesAssetId = assetIdFilter === "" || t.asset_id.toLowerCase().includes(assetIdFilter.toLowerCase());
        const matchesStatus = statusFilter === "All" ||
            (statusFilter === "Acknowledged" && t.acknowledged_at !== null) ||
            (statusFilter === "Pending" && t.acknowledged_at === null);
        return matchesAssetId && matchesStatus;
    });
    if (isLoading)
        return _jsx("div", { className: "page-loading", children: "Loading transfers..." });
    if (error)
        return _jsxs("div", { className: "alert-error", children: ["Error: ", error] });
    return (_jsxs(_Fragment, { children: [successMessage && _jsx(SuccessBanner, { message: successMessage, onDismiss: () => setSuccessMessage(null) }), _jsxs("div", { className: "filter-bar", children: [_jsxs("div", { className: "filter-group", children: [_jsx("label", { htmlFor: "asset-id-filter", className: "filter-label", children: "Asset ID" }), _jsx("input", { id: "asset-id-filter", type: "text", className: "filter-search", placeholder: "Filter by Asset ID...", value: assetIdFilter, onChange: (e) => setAssetIdFilter(e.target.value) })] }), _jsxs("div", { className: "filter-group", children: [_jsx("label", { htmlFor: "status-filter", className: "filter-label", children: "Status" }), _jsxs("select", { id: "status-filter", value: statusFilter, onChange: (e) => setStatusFilter(e.target.value), className: "filter-select", children: [_jsx("option", { value: "All", children: "All" }), _jsx("option", { value: "Acknowledged", children: "Acknowledged" }), _jsx("option", { value: "Pending", children: "Pending" })] })] }), _jsx("button", { className: "btn btn-secondary btn-sm", onClick: handleClearFilters, children: "Clear Filters" }), _jsxs("div", { className: "filter-count", children: [displayedTransfers.length, " transfers"] }), canCreateTransfer && (_jsx("button", { className: "btn btn-primary", onClick: () => setShowCreateModal(true), children: "\u2795 Create Transfer" }))] }), error && _jsx(ErrorMessage, { message: error, onRetry: fetchTransfers }), !error && (_jsxs("div", { className: "card", children: [_jsxs("div", { className: "card-header", children: [_jsx("h2", { className: "card-title", children: "Asset Transfers" }), _jsx("div", { className: "text-small text-muted", children: "Custody change history" })] }), _jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Asset" }), _jsx("th", { children: "From" }), _jsx("th", { children: "To" }), _jsx("th", { children: "Transfer Date" }), _jsx("th", { children: "Reason" }), _jsx("th", { children: "Authorised By" }), _jsx("th", { children: "Acknowledged" }), _jsx("th", { children: "Actions" })] }) }), _jsx("tbody", { children: displayedTransfers.map((t) => (_jsxs("tr", { children: [_jsxs("td", { children: [_jsx("div", { className: "user-name", children: t.asset_name }), _jsx("div", { className: "text-small text-muted", children: t.asset_serial })] }), _jsx("td", { children: t.from_user_name }), _jsx("td", { children: t.to_user_name }), _jsx("td", { className: "text-small", children: new Date(t.transfer_date).toLocaleDateString() }), _jsx("td", { className: "text-small", title: t.reason, children: t.reason.length > 60 ? `${t.reason.substring(0, 60)}...` : t.reason }), _jsx("td", { children: t.authorised_by_name }), _jsx("td", { children: t.acknowledged_at ? (_jsx("span", { className: "text-small", children: new Date(t.acknowledged_at).toLocaleString() })) : (_jsx("span", { className: "badge badge-warning", children: "Pending" })) }), _jsx("td", { children: t.acknowledged_at === null &&
                                                (t.to_user_id === parseInt(user?.user_id || "0", 10) || user?.role === "System Administrator") && (_jsx("button", { className: "btn btn-secondary btn-sm", onClick: () => handleAcknowledgeClick(t.transfer_id), title: "Acknowledge transfer", children: "\uD83E\uDD1D Acknowledge" })) })] }, t.transfer_id))) })] }), displayedTransfers.length === 0 && _jsx("div", { className: "page-empty", children: "No transfers found" })] })), _jsx(Modal, { open: showCreateModal, onClose: handleCreateModalClose, title: "Create Transfer", children: _jsxs("form", { onSubmit: handleCreateSubmit, children: [createError && _jsx(ErrorMessage, { message: createError }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "asset_id", className: "form-label", children: "Asset" }), _jsxs("select", { id: "asset_id", className: "form-control", value: createForm.asset_id, onChange: (e) => handleCreateFieldChange("asset_id", e.target.value), required: true, children: [_jsx("option", { value: "", children: "Select an asset..." }), assets.map((asset) => (_jsxs("option", { value: asset.asset_id, children: [asset.asset_name, " - ", asset.serial_number, " (", asset.asset_type, ")"] }, asset.asset_id)))] }), _jsx("small", { className: "form-helper", children: "Select the asset to transfer" })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "to_user_id", className: "form-label", children: "To User" }), _jsxs("select", { id: "to_user_id", className: "form-control", value: createForm.to_user_id, onChange: (e) => handleCreateFieldChange("to_user_id", e.target.value), required: true, children: [_jsx("option", { value: "", children: "Select a user..." }), users.map((u) => (_jsxs("option", { value: u.id, children: [u.name, " (", u.email, ") - ", u.role] }, u.id)))] }), _jsx("small", { className: "form-helper", children: "Select the user receiving the asset" })] }), _jsx(FormInput, { type: "date", label: "Transfer Date", value: createForm.transfer_date, onChange: (v) => handleCreateFieldChange("transfer_date", v) }), _jsx(FormInput, { type: "textarea", label: "Reason", value: createForm.reason, onChange: (v) => handleCreateFieldChange("reason", v), helper: "Provide a reason for this transfer", required: true, characterCount: { current: createForm.reason.length, min: 10 } }), _jsxs("div", { className: "modal-footer", children: [_jsx("button", { type: "button", className: "btn btn-secondary", onClick: handleCreateModalClose, children: "Cancel" }), _jsx("button", { type: "submit", className: "btn btn-primary", disabled: isCreating || createForm.reason.trim().length < 10, children: isCreating ? _jsx(LoadingSpinner, { size: "sm" }) : "Create Transfer" })] })] }) }), _jsx(ConfirmDialog, { open: acknowledgeDialog.open && acknowledgeDialog.transferId === null, title: "Close without saving?", message: "Your changes will be lost.", onCancel: () => setAcknowledgeDialog({ open: false, transferId: null }), onConfirm: handleConfirmCloseWithoutSaving }), _jsx(ConfirmDialog, { open: acknowledgeDialog.open && acknowledgeDialog.transferId !== null, title: "Acknowledge Transfer", message: "Confirm you have received custody of this asset. This cannot be undone.", onCancel: () => setAcknowledgeDialog({ open: false, transferId: null }), onConfirm: handleAcknowledgeConfirm })] }));
}
