import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from "react";
import { apiFetch, useAuth } from "../AuthContext";
import Modal from "../components/Modal";
import FormInput from "../components/common/FormInput";
import ConfirmDialog from "../components/ConfirmDialog";
import ErrorMessage from "../components/ErrorMessage";
import SuccessBanner from "../components/common/SuccessBanner";
import Table from "../components/common/Table";
import PageHeader from "../components/PageHeader";
import Button from "../components/common/Button";
import FilterBar, { FilterField, filterInputCls, filterSelectCls } from "../components/common/FilterBar";
import StatusBadge from "../components/common/badges/StatusBadge";
import EmptyState from "../components/EmptyState";
import { ICONS } from "../utils/icons";
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
            if (Array.isArray(data)) {
                setTransfers(data);
            }
            else if (data && Array.isArray(data.transfers)) {
                setTransfers(data.transfers);
            }
            else {
                setTransfers([]);
            }
        }
        catch (err) {
            setError(err.message || "Failed to load transfers.");
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleCreateFieldChange = (field, val) => {
        setCreateForm((prev) => ({ ...prev, [field]: val }));
        setFormDirty(true);
    };
    const handleCreateModalClose = () => {
        if (formDirty) {
            setAcknowledgeDialog({ open: true, transferId: null });
        }
        else {
            setShowCreateModal(false);
            setCreateError(null);
        }
    };
    const handleConfirmCloseWithoutSaving = () => {
        setShowCreateModal(false);
        setCreateForm({
            asset_id: "",
            to_user_id: "",
            transfer_date: new Date().toISOString().split("T")[0],
            reason: "",
        });
        setFormDirty(false);
        setCreateError(null);
        setAcknowledgeDialog({ open: false, transferId: null });
    };
    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        if (!createForm.asset_id || !createForm.to_user_id) {
            setCreateError("Please select both an asset and target user.");
            return;
        }
        if (createForm.reason.trim().length < 10) {
            setCreateError("Reason must be at least 10 characters long.");
            return;
        }
        setIsCreating(true);
        setCreateError(null);
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
            setSuccessMessage("Transfer record created successfully.");
            setShowCreateModal(false);
            setCreateForm({
                asset_id: "",
                to_user_id: "",
                transfer_date: new Date().toISOString().split("T")[0],
                reason: "",
            });
            setFormDirty(false);
            fetchTransfers();
        }
        catch (err) {
            setCreateError(err.message || "Failed to initiate transfer.");
        }
        finally {
            setIsCreating(false);
        }
    };
    const handleAcknowledgeClick = (transferId) => {
        setAcknowledgeDialog({ open: true, transferId });
    };
    const handleAcknowledgeConfirm = async () => {
        if (acknowledgeDialog.transferId === null)
            return;
        setError(null);
        try {
            await apiFetch(`/transfers/${acknowledgeDialog.transferId}/acknowledge`, {
                method: "PUT",
            });
            setSuccessMessage("Transfer acknowledged. Custody updated successfully.");
            setAcknowledgeDialog({ open: false, transferId: null });
            fetchTransfers();
        }
        catch (err) {
            setError(err.message || "Failed to acknowledge transfer.");
            setAcknowledgeDialog({ open: false, transferId: null });
        }
    };
    // Filter transfers list
    const displayedTransfers = transfers.filter((t) => {
        const matchesAsset = !assetIdFilter.trim() ||
            t.asset_id.toLowerCase().includes(assetIdFilter.toLowerCase()) ||
            t.asset_name.toLowerCase().includes(assetIdFilter.toLowerCase());
        const matchesStatus = statusFilter === "All" ||
            (statusFilter === "Acknowledged" && t.acknowledged_at !== null) ||
            (statusFilter === "Pending" && t.acknowledged_at === null);
        return matchesAsset && matchesStatus;
    });
    const canCreateTransfer = user?.role === "System Administrator" ||
        user?.role === "Asset Manager" ||
        user?.role === "Asset Custodian";
    const columns = [
        {
            header: "Asset",
            render: (t) => (_jsxs("div", { children: [_jsx("div", { className: "font-bold text-ink text-sm", children: t.asset_name }), _jsx("div", { className: "text-[11px] text-ink-dim mt-0.5", children: t.asset_id })] })),
        },
        { header: "From", render: (t) => t.from_user_name || "—" },
        { header: "To", render: (t) => t.to_user_name },
        {
            header: "Transfer Date",
            render: (t) => new Date(t.transfer_date).toLocaleDateString(),
        },
        { header: "Reason", render: (t) => t.reason },
        { header: "Authorised By", render: (t) => t.authorised_by_name || "—" },
        {
            header: "Acknowledged",
            render: (t) => t.acknowledged_at ? (_jsx("span", { className: "text-xs text-ink-dim", children: new Date(t.acknowledged_at).toLocaleString() })) : (_jsx(StatusBadge, { status: "Pending" })),
        },
        {
            header: "Actions",
            render: (t) => t.acknowledged_at === null &&
                (t.to_user_id === parseInt(user?.user_id || "0", 10) || user?.role === "System Administrator") ? (_jsx("div", { className: "flex select-none", children: _jsx(Button, { variant: "outline", onClick: () => handleAcknowledgeClick(t.transfer_id), children: "Acknowledge" }) })) : null,
        },
    ];
    const assetOptions = assets.map((asset) => ({
        value: asset.asset_id,
        label: `${asset.asset_name} - ${asset.serial_number} (${asset.asset_type})`,
    }));
    const userOptions = users.map((u) => ({
        value: String(u.id),
        label: `${u.name} (${u.email}) - ${u.role}`,
    }));
    return (_jsxs("div", { className: "w-full flex flex-col gap-6 select-none font-sans", children: [successMessage && _jsx(SuccessBanner, { message: successMessage, onDismiss: () => setSuccessMessage(null) }), error && _jsx(ErrorMessage, { message: error, onRetry: fetchTransfers }), _jsx(PageHeader, { title: "Asset Transfers", subtitle: "Custody change history between employees", actions: canCreateTransfer && (_jsxs(Button, { onClick: () => setShowCreateModal(true), children: [_jsx(ICONS.plus, { className: "w-4 h-4 mr-1.5 stroke-[2.4]" }), "Create Transfer"] })) }), _jsxs(FilterBar, { count: { value: displayedTransfers.length, label: "transfers" }, onClear: handleClearFilters, children: [_jsx(FilterField, { label: "Asset ID", htmlFor: "asset-id-filter", children: _jsx("input", { id: "asset-id-filter", type: "text", className: filterInputCls, placeholder: "Filter by Asset ID...", value: assetIdFilter, onChange: (e) => setAssetIdFilter(e.target.value) }) }), _jsx(FilterField, { label: "Status", htmlFor: "status-filter", children: _jsxs("select", { id: "status-filter", value: statusFilter, onChange: (e) => setStatusFilter(e.target.value), className: filterSelectCls, children: [_jsx("option", { value: "All", children: "All" }), _jsx("option", { value: "Acknowledged", children: "Acknowledged" }), _jsx("option", { value: "Pending", children: "Pending" })] }) })] }), isLoading ? (_jsx("div", { className: "flex justify-center py-16", children: _jsx("div", { className: "animate-spin rounded-full h-10 w-10 border-b-2 border-ursb" }) })) : displayedTransfers.length === 0 ? (_jsx(EmptyState, { title: "No transfers found", description: "There are no transfer history records found matching your filters.", icon: _jsx(ICONS.transfers, { className: "w-6 h-6 text-ink-icon stroke-[2.2]" }) })) : (_jsx(Table, { data: displayedTransfers, columns: columns, rowKey: (t) => t.transfer_id, emptyMessage: "No transfers found." })), _jsx(Modal, { open: showCreateModal, onClose: handleCreateModalClose, title: "Create Transfer", children: _jsxs("form", { onSubmit: handleCreateSubmit, className: "flex flex-col gap-4", children: [createError && _jsx(ErrorMessage, { message: createError }), _jsx(FormInput, { type: "select", variant: "light", label: "Asset", value: createForm.asset_id, onChange: (val) => handleCreateFieldChange("asset_id", val), options: [{ value: "", label: "Select an asset..." }, ...assetOptions], helper: "Select the asset to transfer", required: true }), _jsx(FormInput, { type: "select", variant: "light", label: "To User", value: createForm.to_user_id, onChange: (val) => handleCreateFieldChange("to_user_id", val), options: [{ value: "", label: "Select a user..." }, ...userOptions], helper: "Select the user receiving the asset", required: true }), _jsx(FormInput, { type: "date", variant: "light", label: "Transfer Date", value: createForm.transfer_date, onChange: (val) => handleCreateFieldChange("transfer_date", val) }), _jsx(FormInput, { type: "textarea", variant: "light", label: "Reason", value: createForm.reason, onChange: (val) => handleCreateFieldChange("reason", val), helper: "Provide a reason for this transfer", required: true, characterCount: { current: createForm.reason.length, min: 10 } }), _jsxs("div", { className: "flex justify-end gap-2.5 border-t border-sky-page/20 pt-4 mt-2", children: [_jsx(Button, { type: "button", variant: "ghost", onClick: handleCreateModalClose, children: "Cancel" }), _jsx(Button, { type: "submit", isLoading: isCreating, disabled: isCreating || createForm.reason.trim().length < 10, children: "Create Transfer" })] })] }) }), _jsx(ConfirmDialog, { open: acknowledgeDialog.open && acknowledgeDialog.transferId === null, title: "Close without saving?", message: "Your changes will be lost.", onCancel: () => setAcknowledgeDialog({ open: false, transferId: null }), onConfirm: handleConfirmCloseWithoutSaving }), _jsx(ConfirmDialog, { open: acknowledgeDialog.open && acknowledgeDialog.transferId !== null, title: "Acknowledge Transfer", message: "Confirm you have received custody of this asset. This cannot be undone.", onCancel: () => setAcknowledgeDialog({ open: false, transferId: null }), onConfirm: handleAcknowledgeConfirm })] }));
}
