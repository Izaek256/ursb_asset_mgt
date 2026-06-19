import React from "react";
import { UserRow, Role } from "../types";
import EditRoleModal from "../components/EditRoleModal";
import ConfirmDialog from "../components/ConfirmDialog";

const ROLE_FILTERS: (Role | "All")[] = ["All", "System Administrator", "Asset Manager", "Asset Custodian", "Employee"];

const getBadgeClass = (status: string): string => {
  if (status === "Active") return "badge-active";
  if (status === "Inactive") return "badge-inactive";
  return "badge";
};

export default function AdminUsers() {
  const [users, setUsers] = React.useState<UserRow[]>([]);
  const [filter, setFilter] = React.useState<Role | "All">("All");

  const [editing, setEditing] = React.useState<UserRow | null>(null);
  const [isEditOpen, setEditOpen] = React.useState(false);
  const [pendingNewRole, setPendingNewRole] = React.useState<Role | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  React.useEffect(() => {
    // Fetch users list. Replace endpoint as needed.
    fetch("/api/admin/users")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch");
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

  const openEdit = (u: UserRow) => {
    setEditing(u);
    setEditOpen(true);
  };

  const handleRequestConfirm = (newRole: Role) => {
    setPendingNewRole(newRole);
    setConfirmOpen(true);
  };

  const applyChange = async () => {
    if (!editing || !pendingNewRole) return;

    try {
      const res = await fetch(`/api/admin/users/${editing.id}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: pendingNewRole }),
      });

      if (!res.ok) throw new Error("update failed");

      // optimistic update
      setUsers((prev) => prev.map((u) => (u.id === editing.id ? { ...u, role: pendingNewRole } : u)));
    } catch (err) {
      console.error(err);
    } finally {
      setConfirmOpen(false);
      setEditOpen(false);
      setEditing(null);
      setPendingNewRole(null);
    }
  };

  const visible = users.filter((u) => filter === "All" || u.role === filter);

  return (
    <>
      <div className="filter-bar">
        <div>
          <label htmlFor="role-filter" className="filter-label">
            Filter by Role
          </label>
          <select
            id="role-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="filter-select"
          >
            {ROLE_FILTERS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-count">Showing {visible.length} users</div>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name / Email</th>
              <th>Current Role</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((u) => (
              <tr key={u.id}>
                <td>
                  <div style={{ fontWeight: 500 }}>{u.name}</div>
                  <div className="text-small text-muted">{u.email}</div>
                </td>
                <td>{u.role}</td>
                <td>
                  <span className={`badge ${getBadgeClass(u.isActive ? "Active" : "Inactive")}`}>
                    {u.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td>
                  <button className="btn btn-primary" onClick={() => openEdit(u)}>
                    Change Role
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {visible.length === 0 && (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--color-muted)" }}>
            No users found with the selected filter.
          </div>
        )}
      </div>

      <EditRoleModal
        user={editing}
        open={isEditOpen}
        onClose={() => setEditOpen(false)}
        onRequestConfirm={handleRequestConfirm}
      />

      <ConfirmDialog
        open={confirmOpen}
        title="Confirm Role Change"
        message={
          editing && pendingNewRole
            ? `Are you sure you want to change ${editing.name}'s role from ${editing.role} to ${pendingNewRole}? This will immediately alter their system permissions.`
            : ""
        }
        onCancel={() => setConfirmOpen(false)}
        onConfirm={applyChange}
      />
    </>
  );
}
