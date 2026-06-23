import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React from "react";
import { apiFetch, useAuth } from "../AuthContext";
import EditRoleModal from "../components/EditRoleModal";
import ConfirmDialog from "../components/ConfirmDialog";
const ROLES = ["System Administrator", "Asset Manager", "Asset Custodian", "Employee"];
const ROLE_FILTERS = ["All", ...ROLES];
const DEPARTMENTS = ["ICT", "Finance & Administration", "Legal", "Registry", "Human Resources", "Operations", "Procurement"];
export default function AdminUsers() {
    const { token, user: currentUser } = useAuth();
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
            const data = await apiFetch("/admin/users", {}, token);
            setUsers(data);
        }
        catch {
            setUsers([]);
        }
        finally {
            setIsLoading(false);
        }
    }, [token]);
    React.useEffect(() => { fetchUsers(); }, [fetchUsers]);
    // ── Role change flow ──
    const openRoleEdit = (u) => { setEditing(u); setEditOpen(true); };
    const handleRequestConfirm = (newRole) => { setPendingNewRole(newRole); setConfirmOpen(true); };
    const applyRoleChange = async () => {
        if (!editing || !pendingNewRole)
            return;
        try {
            const res = await apiFetch(`/admin/users/${editing.id}/role`, { method: "PUT", body: JSON.stringify({ role: pendingNewRole }) }, token);
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
                }, token);
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
                }, token);
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
            await apiFetch(`/admin/users/${statusAction.user.id}/${endpoint}`, { method: "PUT" }, token);
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
    if (isLoading)
        return _jsx("div", { className: "page-loading", children: "Loading users..." });
    return (_jsxs(_Fragment, { children: [successMsg && _jsx("div", { className: "alert-success", children: successMsg }), errorMsg && _jsx("div", { className: "alert-error", children: errorMsg }), _jsxs("div", { className: "filter-bar", children: [_jsx("div", { className: "filter-group", children: _jsx("input", { type: "text", className: "filter-search", placeholder: "Search users...", value: search, onChange: (e) => setSearch(e.target.value) }) }), _jsxs("div", { className: "filter-group", children: [_jsx("label", { htmlFor: "role-filter", className: "filter-label", children: "Role" }), _jsx("select", { id: "role-filter", value: filter, onChange: (e) => setFilter(e.target.value), className: "filter-select", children: ROLE_FILTERS.map((r) => _jsx("option", { value: r, children: r }, r)) })] }), _jsxs("div", { className: "filter-count", children: [visible.length, " users"] }), canManage && _jsx("button", { className: "btn btn-primary btn-sm", onClick: openCreate, children: "+ Create User" })] }), _jsxs("div", { className: "card", children: [_jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Name / Email" }), _jsx("th", { children: "Role" }), _jsx("th", { children: "Department" }), _jsx("th", { children: "Status" }), canManage && _jsx("th", { children: "Actions" })] }) }), _jsx("tbody", { children: visible.map((u) => (_jsxs("tr", { children: [_jsxs("td", { children: [_jsx("div", { className: "user-name", children: u.name }), _jsx("div", { className: "text-small text-muted", children: u.email })] }), _jsx("td", { children: u.role }), _jsx("td", { children: u.department || "—" }), _jsx("td", { children: _jsx("span", { className: `badge ${u.isActive ? "badge-active" : "badge-inactive"}`, children: u.isActive ? "Active" : "Inactive" }) }), canManage && (_jsx("td", { children: _jsxs("div", { className: "action-btns", children: [_jsx("button", { className: "btn btn-secondary btn-xs", onClick: () => openEdit(u), children: "Edit" }), _jsx("button", { className: "btn btn-secondary btn-xs", onClick: () => openRoleEdit(u), children: "Role" }), u.isActive ? (_jsx("button", { className: "btn btn-danger btn-xs", onClick: () => setStatusAction({ user: u, action: "deactivate" }), children: "Deactivate" })) : (_jsx("button", { className: "btn btn-success btn-xs", onClick: () => setStatusAction({ user: u, action: "reactivate" }), children: "Reactivate" }))] }) }))] }, u.id))) })] }), visible.length === 0 && _jsx("div", { className: "page-empty", children: "No users found." })] }), _jsx(EditRoleModal, { user: editing, open: isEditOpen, onClose: () => setEditOpen(false), onRequestConfirm: handleRequestConfirm }), _jsx(ConfirmDialog, { open: confirmOpen, title: "Confirm Role Change", message: editing && pendingNewRole ? `Change ${editing.name}'s role from ${editing.role} to ${pendingNewRole}?` : "", onCancel: () => setConfirmOpen(false), onConfirm: applyRoleChange }), _jsx(ConfirmDialog, { open: !!statusAction, title: statusAction?.action === "deactivate" ? "Deactivate User" : "Reactivate User", message: statusAction ? (statusAction.action === "deactivate"
                    ? `Are you sure you want to deactivate ${statusAction.user.name}? They will lose access but their data is preserved.`
                    : `Reactivate ${statusAction.user.name}? They will regain access to the system.`) : "", onCancel: () => setStatusAction(null), onConfirm: confirmStatusChange }), modalMode && (_jsx("div", { className: "modal-overlay", onClick: closeForm, children: _jsxs("div", { className: "modal-content user-form-modal", onClick: (e) => e.stopPropagation(), children: [_jsx("h2", { className: "modal-title", children: modalMode === "create" ? "Create New User" : "Edit User" }), _jsxs("form", { onSubmit: submitForm, children: [_jsxs("div", { className: "form-group", children: [_jsx("label", { className: "form-label", children: "Full Name" }), _jsx("input", { className: "form-control", value: formName, onChange: (e) => setFormName(e.target.value), placeholder: "e.g. Jane Nabirye", autoFocus: true })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { className: "form-label", children: "Email" }), _jsx("input", { className: "form-control", type: "email", value: formEmail, onChange: (e) => setFormEmail(e.target.value), placeholder: "e.g. jane@ursb.go.ug" })] }), modalMode === "create" && (_jsxs("div", { className: "form-group", children: [_jsx("label", { className: "form-label", children: "Password" }), _jsx("input", { className: "form-control", type: "password", value: formPassword, onChange: (e) => setFormPassword(e.target.value), placeholder: "Min. 8 characters" })] })), _jsxs("div", { className: "form-group", children: [_jsx("label", { className: "form-label", children: "Role" }), _jsx("select", { className: "form-control", value: formRole, onChange: (e) => setFormRole(e.target.value), children: ROLES.map((r) => _jsx("option", { value: r, children: r }, r)) })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { className: "form-label", children: "Department" }), _jsx("select", { className: "form-control", value: formDept, onChange: (e) => setFormDept(e.target.value), children: DEPARTMENTS.map((d) => _jsx("option", { value: d, children: d }, d)) })] }), _jsxs("div", { className: "modal-actions", children: [_jsx("button", { type: "button", className: "btn btn-secondary", onClick: closeForm, children: "Cancel" }), _jsx("button", { type: "submit", className: "btn btn-primary", disabled: formSubmitting, children: formSubmitting ? "Saving..." : modalMode === "create" ? "Create User" : "Save Changes" })] })] })] }) }))] }));
}
