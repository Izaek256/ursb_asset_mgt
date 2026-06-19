import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React from "react";
import EditRoleModal from "../components/EditRoleModal";
import ConfirmDialog from "../components/ConfirmDialog";
const ROLE_FILTERS = ["All", "System Administrator", "Asset Manager", "Asset Custodian", "Employee"];
const getBadgeClass = (status) => {
    if (status === "Active")
        return "badge-active";
    if (status === "Inactive")
        return "badge-inactive";
    return "badge";
};
export default function AdminUsers() {
    const [users, setUsers] = React.useState([]);
    const [filter, setFilter] = React.useState("All");
    const [editing, setEditing] = React.useState(null);
    const [isEditOpen, setEditOpen] = React.useState(false);
    const [pendingNewRole, setPendingNewRole] = React.useState(null);
    const [confirmOpen, setConfirmOpen] = React.useState(false);
    React.useEffect(() => {
        // Fetch users list. Replace endpoint as needed.
        fetch("/api/admin/users")
            .then((r) => {
            if (!r.ok)
                throw new Error("Failed to fetch");
            return r.json();
        })
            .then((data) => setUsers(data))
            .catch(() => {
            // Fallback: sample data if backend not available
            setUsers([
                { id: "1", name: "Alice Johnson", email: "alice@example.com", role: "System Administrator", isActive: true },
                { id: "2", name: "Bob Smith", email: "bob@example.com", role: "Employee", isActive: true },
                { id: "3", name: "Clara Zhou", email: "clara@example.com", role: "Asset Manager", isActive: false },
                { id: "4", name: "David Lee", email: "david@example.com", role: "Asset Custodian", isActive: true },
                { id: "5", name: "Emma Davis", email: "emma@example.com", role: "Asset Manager", isActive: true },
            ]);
        });
    }, []);
    const openEdit = (u) => {
        setEditing(u);
        setEditOpen(true);
    };
    const handleRequestConfirm = (newRole) => {
        setPendingNewRole(newRole);
        setConfirmOpen(true);
    };
    const applyChange = async () => {
        if (!editing || !pendingNewRole)
            return;
        try {
            const res = await fetch(`/api/admin/users/${editing.id}/role`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role: pendingNewRole }),
            });
            if (!res.ok)
                throw new Error("update failed");
            // optimistic update
            setUsers((prev) => prev.map((u) => (u.id === editing.id ? { ...u, role: pendingNewRole } : u)));
        }
        catch (err) {
            console.error(err);
        }
        finally {
            setConfirmOpen(false);
            setEditOpen(false);
            setEditing(null);
            setPendingNewRole(null);
        }
    };
    const visible = users.filter((u) => filter === "All" || u.role === filter);
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "filter-bar", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "role-filter", className: "filter-label", children: "Filter by Role" }), _jsx("select", { id: "role-filter", value: filter, onChange: (e) => setFilter(e.target.value), className: "filter-select", children: ROLE_FILTERS.map((r) => (_jsx("option", { value: r, children: r }, r))) })] }), _jsxs("div", { className: "filter-count", children: ["Showing ", visible.length, " users"] })] }), _jsxs("div", { className: "card", children: [_jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Name / Email" }), _jsx("th", { children: "Current Role" }), _jsx("th", { children: "Status" }), _jsx("th", { children: "Actions" })] }) }), _jsx("tbody", { children: visible.map((u) => (_jsxs("tr", { children: [_jsxs("td", { children: [_jsx("div", { style: { fontWeight: 500 }, children: u.name }), _jsx("div", { className: "text-small text-muted", children: u.email })] }), _jsx("td", { children: u.role }), _jsx("td", { children: _jsx("span", { className: `badge ${getBadgeClass(u.isActive ? "Active" : "Inactive")}`, children: u.isActive ? "Active" : "Inactive" }) }), _jsx("td", { children: _jsx("button", { className: "btn btn-primary", onClick: () => openEdit(u), children: "Change Role" }) })] }, u.id))) })] }), visible.length === 0 && (_jsx("div", { style: { padding: "2rem", textAlign: "center", color: "var(--color-muted)" }, children: "No users found with the selected filter." }))] }), _jsx(EditRoleModal, { user: editing, open: isEditOpen, onClose: () => setEditOpen(false), onRequestConfirm: handleRequestConfirm }), _jsx(ConfirmDialog, { open: confirmOpen, title: "Confirm Role Change", message: editing && pendingNewRole
                    ? `Are you sure you want to change ${editing.name}'s role from ${editing.role} to ${pendingNewRole}? This will immediately alter their system permissions.`
                    : "", onCancel: () => setConfirmOpen(false), onConfirm: applyChange })] }));
}
