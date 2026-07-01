import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React from "react";
import { apiFetch, useAuth } from "../AuthContext";
import { ICONS } from "../utils/icons";
import StatCard from "../components/StatCard";
import Modal from "../components/Modal";
import FormInput from "../components/FormInput";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import SuccessBanner from "../components/SuccessBanner";
import EmptyState from "../components/EmptyState";
import ConfirmDialog from "../components/ConfirmDialog";
import PageHeader from "../components/PageHeader";
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
    return (_jsxs(_Fragment, { children: [success && _jsx(SuccessBanner, { message: success, onDismiss: () => setSuccess(null) }), error && _jsx(ErrorMessage, { message: error }), _jsx(PageHeader, { title: "Storage Management", subtitle: "Manage assets kept in storage and allocate them to staff", actions: isAdminOrManager && (_jsxs("button", { className: "btn btn-secondary", onClick: () => setShowReturnModal(true), children: [ICONS.return, " Return Asset to Storage"] })) }), data && (_jsxs("div", { className: "dash-stats", style: { marginBottom: "1.5rem" }, children: [_jsx(StatCard, { label: "Total In Storage", value: data.total, icon: "\uD83C\uDFEA", color: "#185FA5" }), _jsx(StatCard, { label: "Departments with Stored Assets", value: Object.keys(data.by_department).length, icon: "\uD83C\uDFE2", color: "#0d9488" }), _jsx(StatCard, { label: "Unique Asset Types Stored", value: Object.keys(data.by_type).length, icon: "\uD83D\uDCE6", color: "#8b5cf6" })] })), _jsxs("div", { className: "filter-bar", children: [_jsxs("div", { className: "filter-group", children: [_jsx("label", { htmlFor: "dept-filter", className: "filter-label", children: "Department" }), _jsxs("select", { id: "dept-filter", value: deptFilter, onChange: (e) => setDeptFilter(e.target.value), className: "filter-select", children: [_jsx("option", { value: "", children: "All Departments" }), departments.map(d => (_jsx("option", { value: d, children: d }, d)))] })] }), _jsxs("div", { className: "filter-group", children: [_jsx("label", { htmlFor: "type-filter", className: "filter-label", children: "Asset Type" }), _jsxs("select", { id: "type-filter", value: typeFilter, onChange: (e) => setTypeFilter(e.target.value), className: "filter-select", children: [_jsx("option", { value: "", children: "All Asset Types" }), assetTypes.map(t => (_jsx("option", { value: t, children: t }, t)))] })] }), _jsxs("div", { className: "filter-group", children: [_jsx("label", { htmlFor: "storage-search", className: "filter-label", children: "Search" }), _jsx("input", { id: "storage-search", type: "text", className: "filter-search", placeholder: "Search by name or SN...", value: search, onChange: (e) => setSearch(e.target.value) })] }), _jsx("button", { className: "btn btn-secondary btn-sm", onClick: handleClearFilters, children: "Clear Filters" })] }), isLoading ? (_jsx("div", { className: "page-loading", style: { display: "flex", justifyContent: "center", padding: "3rem" }, children: _jsx(LoadingSpinner, { size: "lg" }) })) : !data || data.assets.length === 0 ? (_jsx(EmptyState, { title: "No assets in storage", description: "There are no assets currently kept in storage.", icon: "\uD83C\uDFEA" })) : (_jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 300px", gap: "1.5rem" }, children: [_jsx("div", { className: "card", children: _jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Asset" }), _jsx("th", { children: "Type" }), _jsx("th", { children: "Serial Number" }), _jsx("th", { children: "Department" }), isAdminOrManager && _jsx("th", { children: "Actions" })] }) }), _jsx("tbody", { children: data.assets.map((a) => (_jsxs("tr", { children: [_jsx("td", { children: _jsxs("div", { children: [_jsx("div", { className: "user-name", children: a.asset_name }), _jsx("div", { className: "text-small text-muted", children: a.asset_id })] }) }), _jsx("td", { children: a.asset_type }), _jsx("td", { children: a.serial_number || "-" }), _jsx("td", { children: a.department || "Unassigned" }), isAdminOrManager && (_jsx("td", { children: _jsx("button", { className: "btn btn-primary btn-sm", onClick: () => {
                                                        setAssignModalAsset(a);
                                                        setAssignForm({ assigned_to: "", notes: "" });
                                                    }, children: "Assign Asset" }) }))] }, a.asset_id))) })] }) }), _jsxs("div", { style: { display: "flex", flexDirection: "column", gap: "1.5rem" }, children: [_jsxs("div", { className: "card", style: { padding: "1.25rem" }, children: [_jsx("h3", { style: { fontSize: "1.1rem", fontWeight: 600, marginBottom: "1rem", color: "var(--color-primary)" }, children: "Breakdown by Department" }), _jsx("ul", { style: { listStyle: "none", display: "flex", flexDirection: "column", gap: "0.5rem" }, children: Object.entries(data.by_department).map(([dept, count]) => (_jsxs("li", { style: { display: "flex", justifyContent: "space-between", fontSize: "0.9rem" }, children: [_jsx("span", { className: "text-muted", children: dept }), _jsx("span", { style: { fontWeight: 600 }, children: count })] }, dept))) })] }), _jsxs("div", { className: "card", style: { padding: "1.25rem" }, children: [_jsx("h3", { style: { fontSize: "1.1rem", fontWeight: 600, marginBottom: "1rem", color: "var(--color-primary)" }, children: "Breakdown by Type" }), _jsx("ul", { style: { listStyle: "none", display: "flex", flexDirection: "column", gap: "0.5rem" }, children: Object.entries(data.by_type).map(([type, count]) => (_jsxs("li", { style: { display: "flex", justifyContent: "space-between", fontSize: "0.9rem" }, children: [_jsx("span", { className: "text-muted", children: type }), _jsx("span", { style: { fontWeight: 600 }, children: count })] }, type))) })] })] })] })), _jsx(Modal, { open: !!assignModalAsset, onClose: handleCloseAssignModal, title: "Assign Asset from Storage", children: _jsxs("form", { onSubmit: handleAssignSubmit, children: [_jsx(FormInput, { type: "text", label: "Asset", value: assignModalAsset ? `${assignModalAsset.asset_name} (${assignModalAsset.asset_id})` : "", onChange: () => { }, disabled: true }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "assign-storage-user", className: "form-label", children: "Assign To User *" }), _jsxs("select", { id: "assign-storage-user", className: "form-control", value: assignForm.assigned_to, onChange: (e) => setAssignForm({ ...assignForm, assigned_to: e.target.value }), required: true, children: [_jsx("option", { value: "", children: "Select a user..." }), users.filter(u => u.isActive).map(u => (_jsxs("option", { value: u.id, children: [u.name, " (", u.role, ")"] }, u.id)))] })] }), _jsx(FormInput, { type: "textarea", label: "Notes", value: assignForm.notes, onChange: (val) => setAssignForm({ ...assignForm, notes: val }), placeholder: "Add assignment details or comments..." }), _jsxs("div", { className: "modal-footer", children: [_jsx("button", { type: "button", className: "btn btn-secondary", onClick: handleCloseAssignModal, children: "Cancel" }), _jsx("button", { type: "submit", className: "btn btn-primary", disabled: isSubmitting || !assignForm.assigned_to, children: isSubmitting ? _jsx(LoadingSpinner, { size: "sm" }) : "Assign Asset" })] })] }) }), _jsx(Modal, { open: showReturnModal, onClose: handleCloseReturnModal, title: "Return Asset to Storage", children: _jsxs("form", { onSubmit: handleReturnClick, children: [_jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "return-asset-select", className: "form-label", children: "Select Active Assigned Asset *" }), _jsxs("select", { id: "return-asset-select", className: "form-control", value: returnForm.asset_id, onChange: (e) => setReturnForm({ asset_id: e.target.value }), required: true, children: [_jsx("option", { value: "", children: "Select an active asset to return..." }), activeAssets.map(a => (_jsxs("option", { value: a.asset_id, children: [a.asset_name, " (", a.asset_id, ")"] }, a.asset_id)))] })] }), _jsxs("div", { className: "modal-footer", children: [_jsx("button", { type: "button", className: "btn btn-secondary", onClick: handleCloseReturnModal, children: "Cancel" }), _jsx("button", { type: "submit", className: "btn btn-primary", disabled: isSubmitting || !returnForm.asset_id, children: "Return Asset" })] })] }) }), _jsx(ConfirmDialog, { open: !!dirtyConfirm?.open, title: "Unsaved changes", message: "You have unsaved changes. Are you sure you want to close? Your changes will be lost.", onCancel: () => setDirtyConfirm(null), onConfirm: () => {
                    if (dirtyConfirm?.onConfirm)
                        dirtyConfirm.onConfirm();
                } }), _jsx(ConfirmDialog, { open: !!returnConfirmAsset, title: "Confirm Return to Storage", message: `Are you sure you want to return asset "${returnConfirmAsset?.asset_name}" (${returnConfirmAsset?.asset_id}) back to storage? This will end its current custody assignment.`, onCancel: () => setReturnConfirmAsset(null), onConfirm: handleReturnConfirm })] }));
}
