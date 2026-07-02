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
export default function Assignments() {
    const { user } = useAuth();
    const [assignments, setAssignments] = React.useState([]);
    const [assets, setAssets] = React.useState([]);
    const [users, setUsers] = React.useState([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [success, setSuccess] = React.useState(null);
    // Modal & form states
    const [showAssignModal, setShowAssignModal] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [form, setForm] = React.useState({
        asset_id: "",
        assigned_to: "",
        assignment_date: new Date().toISOString().substring(0, 10),
        return_date: "",
        notes: "",
    });
    const [formErrors, setFormErrors] = React.useState({
        return_date: "",
    });
    // Action confirmations
    const [returnConfirm, setReturnConfirm] = React.useState(null);
    const [dirtyConfirm, setDirtyConfirm] = React.useState(null);
    const isAdminOrManager = user?.role === "System Administrator" || user?.role === "Asset Manager";
    const fetchAssignments = React.useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await apiFetch("/assignments", {});
            setAssignments(data.assignments);
        }
        catch (err) {
            setError(err.message || "Failed to load assignments.");
        }
        finally {
            setIsLoading(false);
        }
    }, []);
    const fetchAssetsAndUsers = React.useCallback(async () => {
        try {
            const assetsData = await apiFetch("/assets", {});
            setAssets(assetsData);
            const usersData = await apiFetch("/admin/users", {});
            setUsers(usersData);
        }
        catch (err) {
            console.error("Failed to load options.", err);
        }
    }, []);
    React.useEffect(() => {
        fetchAssignments();
        if (isAdminOrManager) {
            fetchAssetsAndUsers();
        }
    }, [fetchAssignments, fetchAssetsAndUsers, isAdminOrManager]);
    // Form dirty checks
    const isFormDirty = form.asset_id || form.assigned_to || form.notes || form.return_date;
    const handleCloseModal = () => {
        if (isFormDirty) {
            setDirtyConfirm({
                open: true,
                onConfirm: () => {
                    setShowAssignModal(false);
                    setForm({
                        asset_id: "",
                        assigned_to: "",
                        assignment_date: new Date().toISOString().substring(0, 10),
                        return_date: "",
                        notes: "",
                    });
                    setFormErrors({ return_date: "" });
                    setDirtyConfirm(null);
                },
            });
        }
        else {
            setShowAssignModal(false);
        }
    };
    const handleFieldChange = (field, val) => {
        setForm((prev) => {
            const next = { ...prev, [field]: val };
            // Validate expected return date is after assignment date
            if (field === "assignment_date" || field === "return_date") {
                if (next.assignment_date && next.return_date) {
                    const assign = new Date(next.assignment_date);
                    const ret = new Date(next.return_date);
                    if (ret < assign) {
                        setFormErrors({ return_date: "Expected return date cannot be before assignment date." });
                    }
                    else {
                        setFormErrors({ return_date: "" });
                    }
                }
                else {
                    setFormErrors({ return_date: "" });
                }
            }
            return next;
        });
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.asset_id || !form.assigned_to) {
            setError("Please fill in all required fields.");
            return;
        }
        if (formErrors.return_date)
            return;
        setIsSubmitting(true);
        setError(null);
        try {
            await apiFetch("/assignments", {
                method: "POST",
                body: JSON.stringify({
                    asset_id: form.asset_id,
                    assigned_to: parseInt(form.assigned_to, 10),
                    assignment_date: form.assignment_date,
                    expected_return_date: form.return_date || null,
                    notes: form.notes,
                }),
            });
            setSuccess("Asset successfully assigned.");
            setShowAssignModal(false);
            setForm({
                asset_id: "",
                assigned_to: "",
                assignment_date: new Date().toISOString().substring(0, 10),
                return_date: "",
                notes: "",
            });
            fetchAssignments();
        }
        catch (err) {
            setError(err.message || "Failed to create assignment.");
        }
        finally {
            setIsSubmitting(false);
        }
    };
    const handleReturnConfirm = async () => {
        if (!returnConfirm)
            return;
        setError(null);
        try {
            await apiFetch(`/assignments/${returnConfirm.assignment_id}/return`, {
                method: "PUT",
            });
            setSuccess(`Asset "${returnConfirm.asset_name}" returned successfully.`);
            setReturnConfirm(null);
            fetchAssignments();
        }
        catch (err) {
            setError(err.message || "Failed to return asset.");
        }
    };
    const columns = [
        {
            header: "Asset",
            render: (a) => (_jsxs("div", { children: [_jsx("div", { className: "font-bold text-ink text-sm", children: a.asset_name }), _jsx("div", { className: "text-[11px] text-ink-dim mt-0.5", children: a.asset_id })] })),
        },
        {
            header: "Assigned To",
            render: (a) => _jsx("span", { className: "font-semibold", children: a.assigned_to_name }),
        },
        {
            header: "Assigned By",
            render: (a) => a.assigned_by_name || "—",
        },
        {
            header: "Assignment Date",
            render: (a) => a.assigned_date ? new Date(a.assigned_date).toLocaleDateString() : "—",
        },
        {
            header: "Return Date",
            render: (a) => a.return_date ? new Date(a.return_date).toLocaleDateString() : "—",
        },
        {
            header: "Status",
            render: (a) => _jsx(StatusBadge, { status: a.status }),
        },
        {
            header: "Actions",
            render: (a) => (_jsx("div", { className: "flex select-none", children: isAdminOrManager && a.status !== "Returned" && (_jsx(Button, { variant: "outline", onClick: () => setReturnConfirm(a), children: "Return Asset" })) })),
        },
    ];
    const assetOptions = assets.filter(a => a.status === "Active").map(a => ({
        value: a.asset_id,
        label: `${a.asset_name} (${a.asset_id})`,
    }));
    const userOptions = users.filter(u => u.isActive).map(u => ({
        value: String(u.id),
        label: `${u.name} (${u.role})`,
    }));
    return (_jsxs("div", { className: "w-full flex flex-col gap-6 select-none font-sans", children: [success && _jsx(SuccessBanner, { message: success, onDismiss: () => setSuccess(null) }), error && _jsx(ErrorMessage, { message: error }), _jsx(PageHeader, { title: "Asset Assignments", subtitle: "Track custody of assets allocated to employees", actions: isAdminOrManager && (_jsxs(Button, { onClick: () => setShowAssignModal(true), children: [_jsx(ICONS.plus, { className: "w-4 h-4 mr-1.5 stroke-[2.4]" }), "Assign Asset"] })) }), isLoading ? (_jsx("div", { className: "flex justify-center py-16", children: _jsx("div", { className: "animate-spin rounded-full h-10 w-10 border-b-2 border-ursb" }) })) : assignments.length === 0 ? (_jsx(EmptyState, { title: "No assignments found", description: "There are no custody assignments recorded.", icon: _jsx(ICONS.assignments, { className: "w-6 h-6 text-ink-icon stroke-[2.2]" }) })) : (_jsx(Table, { data: assignments, columns: columns, rowKey: (a) => a.assignment_id, emptyMessage: "No assignments found." })), _jsx(Modal, { open: showAssignModal, onClose: handleCloseModal, title: "Assign Asset", children: _jsxs("form", { onSubmit: handleSubmit, className: "flex flex-col gap-4", children: [_jsx(FormInput, { type: "select", variant: "light", label: "Asset *", value: form.asset_id, onChange: (val) => handleFieldChange("asset_id", val), options: [{ value: "", label: "Select an asset..." }, ...assetOptions], required: true }), _jsx(FormInput, { type: "select", variant: "light", label: "Assign To User *", value: form.assigned_to, onChange: (val) => handleFieldChange("assigned_to", val), options: [{ value: "", label: "Select a user..." }, ...userOptions], required: true }), _jsx(FormInput, { type: "date", variant: "light", label: "Assignment Date *", value: form.assignment_date, onChange: (val) => handleFieldChange("assignment_date", val), required: true }), _jsx(FormInput, { type: "date", variant: "light", label: "Expected Return Date (Optional)", value: form.return_date, onChange: (val) => handleFieldChange("return_date", val), error: formErrors.return_date }), _jsx(FormInput, { type: "textarea", variant: "light", label: "Notes", value: form.notes, onChange: (val) => handleFieldChange("notes", val), placeholder: "Add assignment details or comments..." }), _jsxs("div", { className: "flex justify-end gap-2.5 border-t border-sky-page/20 pt-4 mt-2", children: [_jsx(Button, { type: "button", variant: "ghost", onClick: handleCloseModal, children: "Cancel" }), _jsx(Button, { type: "submit", isLoading: isSubmitting, disabled: isSubmitting || !!formErrors.return_date || !form.asset_id || !form.assigned_to, children: "Assign Asset" })] })] }) }), _jsx(ConfirmDialog, { open: !!dirtyConfirm?.open, title: "Unsaved changes", message: "You have unsaved changes. Are you sure you want to close? Your changes will be lost.", onCancel: () => setDirtyConfirm(null), onConfirm: () => {
                    if (dirtyConfirm?.onConfirm)
                        dirtyConfirm.onConfirm();
                } }), _jsx(ConfirmDialog, { open: !!returnConfirm, title: "Confirm Asset Return", message: `Are you sure you want to mark the assignment for "${returnConfirm?.asset_name}" as returned? This will release custody of the asset.`, onCancel: () => setReturnConfirm(null), onConfirm: handleReturnConfirm })] }));
}
