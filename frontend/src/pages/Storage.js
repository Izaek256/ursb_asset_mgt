import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from "react";
import { apiFetch, useAuth } from "../AuthContext";
import { ICONS } from "../utils/icons";
import Modal from "../components/Modal";
import FormInput from "../components/FormInput";
import ErrorMessage from "../components/ErrorMessage";
import SuccessBanner from "../components/common/SuccessBanner";
import EmptyState from "../components/EmptyState";
import ConfirmDialog from "../components/ConfirmDialog";
import PageHeader from "../components/PageHeader";
import Table from "../components/common/Table";
import Button from "../components/common/Button";
import FilterBar, { FilterField, filterInputCls, filterSelectCls } from "../components/common/FilterBar";
export default function Storage() {
    const { user } = useAuth();
    const [data, setData] = React.useState(null);
    const [activeAssets, setActiveAssets] = React.useState([]);
    const [users, setUsers] = React.useState([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [success, setSuccess] = React.useState(null);
    // Filters
    const [deptFilter, setDeptFilter] = React.useState("");
    const [typeFilter, setTypeFilter] = React.useState("");
    const [search, setSearch] = React.useState("");
    // Modals state
    const [assignModalAsset, setAssignModalAsset] = React.useState(null);
    const [showReturnModal, setShowReturnModal] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    // Forms
    const [assignForm, setAssignForm] = React.useState({
        assigned_to: "",
        notes: "",
    });
    const [returnForm, setReturnForm] = React.useState({
        asset_id: "",
    });
    // Action confirmations
    const [returnConfirmAsset, setReturnConfirmAsset] = React.useState(null);
    const [dirtyConfirm, setDirtyConfirm] = React.useState(null);
    const isAdminOrManager = user?.role === "System Administrator" || user?.role === "Asset Manager";
    const fetchStorageData = React.useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (deptFilter)
                params.set("department", deptFilter);
            if (typeFilter)
                params.set("asset_type", typeFilter);
            if (search)
                params.set("search", search);
            const res = await apiFetch(`/storage?${params.toString()}`, {});
            setData(res);
        }
        catch (err) {
            setError(err.message || "Failed to load storage assets.");
        }
        finally {
            setIsLoading(false);
        }
    }, [deptFilter, typeFilter, search]);
    const fetchContextData = React.useCallback(async () => {
        try {
            if (isAdminOrManager) {
                // Fetch users for assignment dropdown
                const usersData = await apiFetch("/admin/users", {});
                setUsers(usersData);
                // Fetch active assets for Return to Storage modal
                const assetsData = await apiFetch("/assets?status=Active", {});
                setActiveAssets(assetsData);
            }
        }
        catch (err) {
            console.error("Failed to load storage context data", err);
        }
    }, [isAdminOrManager]);
    React.useEffect(() => {
        fetchStorageData();
        fetchContextData();
    }, [fetchStorageData, fetchContextData]);
    // Form dirty checks
    const isAssignFormDirty = assignForm.assigned_to || assignForm.notes;
    const isReturnFormDirty = returnForm.asset_id;
    const handleCloseAssignModal = () => {
        if (isAssignFormDirty) {
            setDirtyConfirm({
                open: true,
                onConfirm: () => {
                    setAssignModalAsset(null);
                    setAssignForm({ assigned_to: "", notes: "" });
                    setDirtyConfirm(null);
                },
            });
        }
        else {
            setAssignModalAsset(null);
        }
    };
    const handleCloseReturnModal = () => {
        if (isReturnFormDirty) {
            setDirtyConfirm({
                open: true,
                onConfirm: () => {
                    setShowReturnModal(false);
                    setReturnForm({ asset_id: "" });
                    setDirtyConfirm(null);
                },
            });
        }
        else {
            setShowReturnModal(false);
        }
    };
    const handleClearFilters = () => {
        setDeptFilter("");
        setTypeFilter("");
        setSearch("");
    };
    const handleAssignSubmit = async (e) => {
        e.preventDefault();
        if (!assignModalAsset || !assignForm.assigned_to)
            return;
        setIsSubmitting(true);
        setError(null);
        try {
            await apiFetch(`/storage/${assignModalAsset.asset_id}/assign`, {
                method: "POST",
                body: JSON.stringify({
                    assigned_to: parseInt(assignForm.assigned_to, 10),
                    notes: assignForm.notes || null,
                }),
            });
            setSuccess(`Asset ${assignModalAsset.asset_name} assigned from storage.`);
            setAssignModalAsset(null);
            setAssignForm({ assigned_to: "", notes: "" });
            fetchStorageData();
            fetchContextData();
        }
        catch (err) {
            setError(err.message || "Failed to assign asset.");
        }
        finally {
            setIsSubmitting(false);
        }
    };
    const handleReturnClick = (e) => {
        e.preventDefault();
        if (!returnForm.asset_id)
            return;
        const selected = activeAssets.find(a => a.asset_id === returnForm.asset_id);
        if (selected) {
            setReturnConfirmAsset(selected);
        }
    };
    const handleReturnConfirm = async () => {
        if (!returnConfirmAsset)
            return;
        setIsSubmitting(true);
        setError(null);
        try {
            await apiFetch(`/storage/${returnConfirmAsset.asset_id}/return`, {
                method: "POST",
            });
            setSuccess(`Asset ${returnConfirmAsset.asset_name} returned to storage.`);
            setReturnConfirmAsset(null);
            setShowReturnModal(false);
            setReturnForm({ asset_id: "" });
            fetchStorageData();
            fetchContextData();
        }
        catch (err) {
            setError(err.message || "Failed to return asset to storage.");
        }
        finally {
            setIsSubmitting(false);
        }
    };
    const departments = [
        "ICT",
        "Finance & Administration",
        "Legal",
        "Registry",
        "Human Resources",
        "Operations",
        "Procurement"
    ];
    const assetTypes = [
        "ICT Equipment",
        "Furniture",
        "Vehicle",
        "Software",
        "Other"
    ];
    const columns = [
        {
            header: "Asset",
            render: (a) => (_jsxs("div", { children: [_jsx("div", { className: "font-bold text-ink text-sm", children: a.asset_name }), _jsx("div", { className: "text-[11px] text-ink-dim mt-0.5", children: a.asset_id })] })),
        },
        { header: "Type", render: (a) => a.asset_type },
        {
            header: "Serial Number",
            render: (a) => a.serial_number || "—",
        },
        {
            header: "Department",
            render: (a) => a.department || "Unassigned",
        },
        ...(isAdminOrManager
            ? [
                {
                    header: "Actions",
                    render: (a) => (_jsx(Button, { onClick: () => {
                            setAssignModalAsset(a);
                            setAssignForm({ assigned_to: "", notes: "" });
                        }, children: "Assign Asset" })),
                },
            ]
            : []),
    ];
    const statCards = data
        ? [
            { label: "Total In Storage", value: data.total, icon: ICONS.clock, bg: "bg-stat-blueChip", text: "text-stat-blueIcon" },
            { label: "Departments with Stored Assets", value: Object.keys(data.by_department).length, icon: ICONS.building, bg: "bg-stat-greenChip", text: "text-stat-greenIcon" },
            { label: "Unique Asset Types Stored", value: Object.keys(data.by_type).length, icon: ICONS.assets, bg: "bg-stat-amberChip", text: "text-stat-amberIcon" },
        ]
        : [];
    return (_jsxs("div", { className: "w-full flex flex-col gap-6 select-none font-sans", children: [success && _jsx(SuccessBanner, { message: success, onDismiss: () => setSuccess(null) }), error && _jsx(ErrorMessage, { message: error }), _jsx(PageHeader, { title: "Storage Management", subtitle: "Manage assets kept in storage and allocate them to staff", actions: isAdminOrManager && (_jsxs(Button, { onClick: () => setShowReturnModal(true), children: [_jsx(ICONS.return, { className: "w-4 h-4 mr-1.5 stroke-[2.4]" }), "Return Asset to Storage"] })) }), data && (_jsx("div", { className: "grid grid-cols-1 sm:grid-cols-3 gap-4", children: statCards.map((s) => {
                    const StatIcon = s.icon;
                    return (_jsxs("div", { className: "bg-white border border-sky-cardBorder rounded-2xl p-4 flex items-center gap-3.5 shadow-sm", children: [_jsx("span", { className: `w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${s.bg} ${s.text}`, children: _jsx(StatIcon, { className: "w-5 h-5 stroke-[2.4]" }) }), _jsxs("div", { children: [_jsx("span", { className: "block text-[10px] font-bold uppercase tracking-wider text-ink-dim", children: s.label }), _jsx("span", { className: "block text-xl font-bold text-ink mt-0.5", children: s.value.toLocaleString() })] })] }, s.label));
                }) })), _jsxs(FilterBar, { onClear: handleClearFilters, children: [_jsx(FilterField, { label: "Department", htmlFor: "dept-filter", children: _jsxs("select", { id: "dept-filter", value: deptFilter, onChange: (e) => setDeptFilter(e.target.value), className: filterSelectCls, children: [_jsx("option", { value: "", children: "All Departments" }), departments.map((d) => (_jsx("option", { value: d, children: d }, d)))] }) }), _jsx(FilterField, { label: "Asset Type", htmlFor: "type-filter", children: _jsxs("select", { id: "type-filter", value: typeFilter, onChange: (e) => setTypeFilter(e.target.value), className: filterSelectCls, children: [_jsx("option", { value: "", children: "All Asset Types" }), assetTypes.map((t) => (_jsx("option", { value: t, children: t }, t)))] }) }), _jsx(FilterField, { label: "Search", htmlFor: "storage-search", grow: true, children: _jsx("input", { id: "storage-search", type: "text", className: filterInputCls, placeholder: "Search by name or SN...", value: search, onChange: (e) => setSearch(e.target.value) }) })] }), isLoading ? (_jsx("div", { className: "flex justify-center py-16", children: _jsx("div", { className: "animate-spin rounded-full h-10 w-10 border-b-2 border-ursb" }) })) : !data || data.assets.length === 0 ? (_jsx(EmptyState, { title: "No assets in storage", description: "There are no assets currently kept in storage.", icon: _jsx(ICONS.storage, { className: "w-6 h-6 text-ink-icon stroke-[2.2]" }) })) : (_jsxs("div", { className: "grid grid-cols-1 xl:grid-cols-3 gap-6", children: [_jsx("div", { className: "xl:col-span-2", children: _jsx(Table, { data: data.assets, columns: columns, rowKey: (a) => a.asset_id, emptyMessage: "No assets in storage." }) }), _jsxs("div", { className: "flex flex-col gap-6", children: [_jsxs("div", { className: "bg-white border border-sky-cardBorder rounded-2xl p-5 shadow-sm", children: [_jsx("h3", { className: "font-bold text-sm text-ink mb-4 pb-3 border-b border-sky-page/20", children: "Breakdown by Department" }), _jsx("ul", { className: "flex flex-col gap-2.5", children: Object.entries(data.by_department).map(([dept, count]) => (_jsxs("li", { className: "flex justify-between text-sm", children: [_jsx("span", { className: "text-ink-dim", children: dept }), _jsx("span", { className: "font-bold text-ink", children: count })] }, dept))) })] }), _jsxs("div", { className: "bg-white border border-sky-cardBorder rounded-2xl p-5 shadow-sm", children: [_jsx("h3", { className: "font-bold text-sm text-ink mb-4 pb-3 border-b border-sky-page/20", children: "Breakdown by Type" }), _jsx("ul", { className: "flex flex-col gap-2.5", children: Object.entries(data.by_type).map(([type, count]) => (_jsxs("li", { className: "flex justify-between text-sm", children: [_jsx("span", { className: "text-ink-dim", children: type }), _jsx("span", { className: "font-bold text-ink", children: count })] }, type))) })] })] })] })), _jsx(Modal, { open: !!assignModalAsset, onClose: handleCloseAssignModal, title: "Assign Asset from Storage", children: _jsxs("form", { onSubmit: handleAssignSubmit, children: [_jsx(FormInput, { type: "text", label: "Asset", value: assignModalAsset ? `${assignModalAsset.asset_name} (${assignModalAsset.asset_id})` : "", onChange: () => { }, disabled: true }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "assign-storage-user", className: "form-label", children: "Assign To User *" }), _jsxs("select", { id: "assign-storage-user", className: "form-control", value: assignForm.assigned_to, onChange: (e) => setAssignForm({ ...assignForm, assigned_to: e.target.value }), required: true, children: [_jsx("option", { value: "", children: "Select a user..." }), users.filter(u => u.isActive).map(u => (_jsxs("option", { value: u.id, children: [u.name, " (", u.role, ")"] }, u.id)))] })] }), _jsx(FormInput, { type: "textarea", label: "Notes", value: assignForm.notes, onChange: (val) => setAssignForm({ ...assignForm, notes: val }), placeholder: "Add assignment details or comments..." }), _jsxs("div", { className: "modal-footer", children: [_jsx(Button, { type: "button", variant: "ghost", onClick: handleCloseAssignModal, children: "Cancel" }), _jsx(Button, { type: "submit", isLoading: isSubmitting, disabled: isSubmitting || !assignForm.assigned_to, children: "Assign Asset" })] })] }) }), _jsx(Modal, { open: showReturnModal, onClose: handleCloseReturnModal, title: "Return Asset to Storage", children: _jsxs("form", { onSubmit: handleReturnClick, children: [_jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "return-asset-select", className: "form-label", children: "Select Active Assigned Asset *" }), _jsxs("select", { id: "return-asset-select", className: "form-control", value: returnForm.asset_id, onChange: (e) => setReturnForm({ asset_id: e.target.value }), required: true, children: [_jsx("option", { value: "", children: "Select an active asset to return..." }), activeAssets.map(a => (_jsxs("option", { value: a.asset_id, children: [a.asset_name, " (", a.asset_id, ")"] }, a.asset_id)))] })] }), _jsxs("div", { className: "modal-footer", children: [_jsx(Button, { type: "button", variant: "ghost", onClick: handleCloseReturnModal, children: "Cancel" }), _jsx(Button, { type: "submit", isLoading: isSubmitting, disabled: isSubmitting || !returnForm.asset_id, children: "Return Asset" })] })] }) }), _jsx(ConfirmDialog, { open: !!dirtyConfirm?.open, title: "Unsaved changes", message: "You have unsaved changes. Are you sure you want to close? Your changes will be lost.", onCancel: () => setDirtyConfirm(null), onConfirm: () => {
                    if (dirtyConfirm?.onConfirm)
                        dirtyConfirm.onConfirm();
                } }), _jsx(ConfirmDialog, { open: !!returnConfirmAsset, title: "Confirm Return to Storage", message: `Are you sure you want to return asset "${returnConfirmAsset?.asset_name}" (${returnConfirmAsset?.asset_id}) back to storage? This will end its current custody assignment.`, onCancel: () => setReturnConfirmAsset(null), onConfirm: handleReturnConfirm })] }));
}
