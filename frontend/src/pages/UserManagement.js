import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from "react";
import { apiFetch, useAuth } from "../AuthContext";
import EditRoleModal from "../components/EditRoleModal";
import ConfirmDialog from "../components/ConfirmDialog";
import Table from "../components/common/Table";
import Button from "../components/common/Button";
import PageHeader from "../components/PageHeader";
import FilterBar, { FilterField, filterInputCls, filterSelectCls } from "../components/common/FilterBar";
import StatusBadge from "../components/common/badges/StatusBadge";
import RoleBadge from "../components/common/badges/RoleBadge";
import SuccessBanner from "../components/common/SuccessBanner";
import ErrorMessage from "../components/ErrorMessage";
const ROLES = ["System Administrator", "Asset Manager", "Asset Custodian", "Employee"];
const ROLE_FILTERS = ["All", ...ROLES];
const DEPARTMENTS = ["ICT", "Finance & Administration", "Legal", "Registry", "Human Resources", "Operations", "Procurement"];
export default function UserManagement() {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = React.useState([]);
    const [filter, setFilter] = React.useState("All");
    const [search, setSearch] = React.useState("");
    const [isLoading, setIsLoading] = React.useState(true);
    const [successMsg, setSuccessMsg] = React.useState(null);
    const [errorMsg, setErrorMsg] = React.useState(null);
    // Role change (existing)
    const [editing, setEditing] = React.useState(null);
    const [isEditOpen, setEditOpen] = React.useState(false);
    const [pendingNewRole, setPendingNewRole] = React.useState(null);
    const [confirmOpen, setConfirmOpen] = React.useState(false);
    // Create / Edit modal
    const [modalMode, setModalMode] = React.useState(null);
    const [formName, setFormName] = React.useState("");
    const [formEmail, setFormEmail] = React.useState("");
    const [formPassword, setFormPassword] = React.useState("");
    const [formRole, setFormRole] = React.useState("Employee");
    const [formDept, setFormDept] = React.useState(DEPARTMENTS[0]);
    const [formSubmitting, setFormSubmitting] = React.useState(false);
    // Deactivate/Reactivate confirm
    const [statusAction, setStatusAction] = React.useState(null);
    const canManage = currentUser?.role === "System Administrator";
    const flash = (msg) => { setSuccessMsg(msg); setErrorMsg(null); setTimeout(() => setSuccessMsg(null), 4000); };
    const flashErr = (msg) => { setErrorMsg(msg); setSuccessMsg(null); setTimeout(() => setErrorMsg(null), 5000); };
    const fetchUsers = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await apiFetch("/admin/users", {});
            setUsers(data);
        }
        catch {
            setUsers([]);
        }
        finally {
            setIsLoading(false);
        }
    }, []);
    React.useEffect(() => { fetchUsers(); }, [fetchUsers]);
    // ── Role change flow ──
    const openRoleEdit = (u) => { setEditing(u); setEditOpen(true); };
    const handleRequestConfirm = (newRole) => { setPendingNewRole(newRole); setConfirmOpen(true); };
    const applyRoleChange = async () => {
        if (!editing || !pendingNewRole)
            return;
        try {
            const res = await apiFetch(`/admin/users/${editing.id}/role`, { method: "PUT", body: JSON.stringify({ role: pendingNewRole }) });
            flash(res.message);
            await fetchUsers();
        }
        catch (err) {
            flashErr(err.message || "Failed to update role");
        }
        finally {
            setConfirmOpen(false);
            setEditOpen(false);
            setEditing(null);
            setPendingNewRole(null);
        }
    };
    // ── Create / Edit modal ──
    const openCreate = () => {
        setFormName("");
        setFormEmail("");
        setFormPassword("");
        setFormRole("Employee");
        setFormDept(DEPARTMENTS[0]);
        setModalMode("create");
    };
    const openEdit = (u) => {
        setFormName(u.name);
        setFormEmail(u.email);
        setFormPassword("");
        setFormRole(u.role);
        setFormDept(u.department || DEPARTMENTS[0]);
        setEditing(u);
        setModalMode("edit");
    };
    const closeForm = () => { setModalMode(null); setEditing(null); };
    const submitForm = async (e) => {
        e.preventDefault();
        setFormSubmitting(true);
        try {
            if (modalMode === "create") {
                if (!formName || !formEmail || !formPassword) {
                    flashErr("All fields are required.");
                    return;
                }
                if (formPassword.length < 8) {
                    flashErr("Password must be at least 8 characters.");
                    return;
                }
                await apiFetch("/admin/users", {
                    method: "POST",
                    body: JSON.stringify({ full_name: formName, email: formEmail, password: formPassword, role: formRole, department: formDept }),
                });
                flash(`User '${formName}' created successfully.`);
            }
            else if (modalMode === "edit" && editing) {
                const payload = {};
                if (formName !== editing.name)
                    payload.full_name = formName;
                if (formEmail !== editing.email)
                    payload.email = formEmail;
                if (formRole !== editing.role)
                    payload.role = formRole;
                if (formDept !== editing.department)
                    payload.department = formDept;
                if (Object.keys(payload).length === 0) {
                    flashErr("No changes detected.");
                    return;
                }
                await apiFetch(`/admin/users/${editing.id}`, {
                    method: "PUT",
                    body: JSON.stringify(payload),
                });
                flash(`User '${formName}' updated successfully.`);
            }
            closeForm();
            await fetchUsers();
        }
        catch (err) {
            flashErr(err.message || "Operation failed.");
        }
        finally {
            setFormSubmitting(false);
        }
    };
    // ── Deactivate / Reactivate ──
    const confirmStatusChange = async () => {
        if (!statusAction)
            return;
        try {
            const endpoint = statusAction.action === "deactivate" ? "deactivate" : "reactivate";
            await apiFetch(`/admin/users/${statusAction.user.id}/${endpoint}`, { method: "PUT" });
            flash(`User '${statusAction.user.name}' ${statusAction.action === "deactivate" ? "deactivated" : "reactivated"} successfully.`);
            await fetchUsers();
        }
        catch (err) {
            flashErr(err.message || "Operation failed.");
        }
        finally {
            setStatusAction(null);
        }
    };
    const visible = users.filter((u) => {
        if (filter !== "All" && u.role !== filter)
            return false;
        if (search) {
            const q = search.toLowerCase();
            return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.department || "").toLowerCase().includes(q);
        }
        return true;
    });
    if (isLoading) {
        return (_jsx("div", { className: "flex justify-center py-20", children: _jsx("div", { className: "animate-spin rounded-full h-10 w-10 border-b-2 border-ursb" }) }));
    }
    const columns = [
        {
            header: "Name / Email",
            render: (u) => (_jsxs("div", { children: [_jsx("div", { className: "font-bold text-ink text-sm", children: u.name }), _jsx("div", { className: "text-[11px] text-ink-dim mt-0.5", children: u.email })] })),
        },
        {
            header: "Role",
            render: (u) => _jsx(RoleBadge, { role: u.role }),
        },
        {
            header: "Department",
            render: (u) => u.department || "—",
        },
        {
            header: "Status",
            render: (u) => _jsx(StatusBadge, { status: u.isActive ? "Active" : "Deactivated" }),
        },
        ...(canManage
            ? [
                {
                    header: "Actions",
                    render: (u) => (_jsxs("div", { className: "flex flex-wrap gap-1.5", children: [_jsx(Button, { variant: "outline", onClick: () => openEdit(u), children: "Edit" }), _jsx(Button, { variant: "outline", onClick: () => openRoleEdit(u), children: "Role" }), u.isActive ? (_jsx(Button, { variant: "danger-outline", onClick: () => setStatusAction({ user: u, action: "deactivate" }), children: "Deactivate" })) : (_jsx(Button, { onClick: () => setStatusAction({ user: u, action: "reactivate" }), children: "Reactivate" }))] })),
                },
            ]
            : []),
    ];
    return (_jsxs("div", { className: "w-full flex flex-col gap-6 select-none font-sans", children: [successMsg && _jsx(SuccessBanner, { message: successMsg, onDismiss: () => setSuccessMsg(null) }), errorMsg && _jsx(ErrorMessage, { message: errorMsg }), _jsx(PageHeader, { title: "User Management", subtitle: "Manage staff accounts, roles, and access", actions: canManage && _jsx(Button, { onClick: openCreate, children: "+ Create User" }) }), _jsxs(FilterBar, { count: { value: visible.length, label: "users" }, children: [_jsx(FilterField, { className: "flex-1 min-w-[200px]", children: _jsx("input", { type: "text", className: filterInputCls, placeholder: "Search users...", value: search, onChange: (e) => setSearch(e.target.value) }) }), _jsx(FilterField, { label: "Role", htmlFor: "role-filter", children: _jsx("select", { id: "role-filter", value: filter, onChange: (e) => setFilter(e.target.value), className: filterSelectCls, children: ROLE_FILTERS.map((r) => (_jsx("option", { value: r, children: r }, r))) }) })] }), _jsx(Table, { data: visible, columns: columns, rowKey: (u) => u.id, emptyMessage: "No users found." }), _jsx(EditRoleModal, { user: editing, open: isEditOpen, onClose: () => setEditOpen(false), onRequestConfirm: handleRequestConfirm }), _jsx(ConfirmDialog, { open: confirmOpen, title: "Confirm Role Change", message: editing && pendingNewRole ? `Change ${editing.name}'s role from ${editing.role} to ${pendingNewRole}?` : "", onCancel: () => setConfirmOpen(false), onConfirm: applyRoleChange }), _jsx(ConfirmDialog, { open: !!statusAction, title: statusAction?.action === "deactivate" ? "Deactivate User" : "Reactivate User", message: statusAction ? (statusAction.action === "deactivate"
                    ? `Are you sure you want to deactivate ${statusAction.user.name}? They will lose access but their data is preserved.`
                    : `Reactivate ${statusAction.user.name}? They will regain access to the system.`) : "", onCancel: () => setStatusAction(null), onConfirm: confirmStatusChange }), modalMode && (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-navy-deep/40 backdrop-blur-sm p-4", onClick: closeForm, children: _jsxs("div", { className: "bg-white border border-sky-cardBorder rounded-2xl p-6 w-full max-w-md shadow-xl", onClick: (e) => e.stopPropagation(), children: [_jsx("h2", { className: "font-bold text-lg text-ink mb-5", children: modalMode === "create" ? "Create New User" : "Edit User" }), _jsxs("form", { onSubmit: submitForm, className: "flex flex-col gap-4", children: [_jsxs("div", { className: "flex flex-col gap-1.5", children: [_jsx("label", { className: "text-[10px] font-bold uppercase tracking-wider text-ink-dim", children: "Full Name" }), _jsx("input", { className: filterInputCls, value: formName, onChange: (e) => setFormName(e.target.value), placeholder: "e.g. Jane Nabirye", autoFocus: true })] }), _jsxs("div", { className: "flex flex-col gap-1.5", children: [_jsx("label", { className: "text-[10px] font-bold uppercase tracking-wider text-ink-dim", children: "Email" }), _jsx("input", { className: filterInputCls, type: "email", value: formEmail, onChange: (e) => setFormEmail(e.target.value), placeholder: "e.g. jane@ursb.go.ug" })] }), modalMode === "create" && (_jsxs("div", { className: "flex flex-col gap-1.5", children: [_jsx("label", { className: "text-[10px] font-bold uppercase tracking-wider text-ink-dim", children: "Password" }), _jsx("input", { className: filterInputCls, type: "password", value: formPassword, onChange: (e) => setFormPassword(e.target.value), placeholder: "Min. 8 characters" })] })), _jsxs("div", { className: "flex flex-col gap-1.5", children: [_jsx("label", { className: "text-[10px] font-bold uppercase tracking-wider text-ink-dim", children: "Role" }), _jsx("select", { className: filterSelectCls, value: formRole, onChange: (e) => setFormRole(e.target.value), children: ROLES.map((r) => _jsx("option", { value: r, children: r }, r)) })] }), _jsxs("div", { className: "flex flex-col gap-1.5", children: [_jsx("label", { className: "text-[10px] font-bold uppercase tracking-wider text-ink-dim", children: "Department" }), _jsx("select", { className: filterSelectCls, value: formDept, onChange: (e) => setFormDept(e.target.value), children: DEPARTMENTS.map((d) => _jsx("option", { value: d, children: d }, d)) })] }), _jsxs("div", { className: "flex justify-end gap-2 pt-2", children: [_jsx(Button, { variant: "ghost", type: "button", onClick: closeForm, children: "Cancel" }), _jsx(Button, { type: "submit", isLoading: formSubmitting, children: modalMode === "create" ? "Create User" : "Save Changes" })] })] })] }) }))] }));
}
