import React from "react";
import { Role, UserRow } from "../types";
import { apiFetch, useAuth } from "../AuthContext";
import EditRoleModal from "../components/EditRoleModal";
import ConfirmDialog from "../components/ConfirmDialog";

const ROLE_FILTERS: (Role | "All")[] = [
  "All", "System Administrator", "Asset Manager", "Asset Custodian", "Employee",
];

export default function AdminUsers() {
  const { token, user: currentUser } = useAuth();
  const [users, setUsers] = React.useState<UserRow[]>([]);
  const [filter, setFilter] = React.useState<Role | "All">("All");
  const [isLoading, setIsLoading] = React.useState(true);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  const [editing, setEditing] = React.useState<UserRow | null>(null);
  const [isEditOpen, setEditOpen] = React.useState(false);
  const [pendingNewRole, setPendingNewRole] = React.useState<Role | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  // Only System Administrator can change roles
  const canChangeRole = currentUser?.role === "System Administrator";

  const fetchUsers = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch<UserRow[]>("/admin/users", {}, token);
      setUsers(data);
    } catch {
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  React.useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const openEdit = (u: UserRow) => {
    if (!canChangeRole) return;
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
      const res = await apiFetch<{ message: string }>(
        `/admin/users/${editing.id}/role`,
        { method: "PUT", body: JSON.stringify({ role: pendingNewRole }) },
        token
      );

      setSuccessMsg(res.message);
      await fetchUsers();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || "Failed to update role");
    } finally {
      setConfirmOpen(false);
      setEditOpen(false);
      setEditing(null);
      setPendingNewRole(null);
    }
  };

  const visible = users.filter((u) => filter === "All" || u.role === filter);

  if (isLoading) {
    return (
      <div className="page-loading">
        Loading users...
      </div>
    );
  }

  return (
    <>
      {successMsg && <div className="alert-success">{successMsg}</div>}

      <div className="filter-bar">
        <div>
          <label htmlFor="role-filter" className="filter-label">Filter by Role</label>
          <select
            id="role-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="filter-select"
          >
            {ROLE_FILTERS.map((r) => (
              <option key={r} value={r}>{r}</option>
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
              <th>Department</th>
              <th>Status</th>
              {canChangeRole && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {visible.map((u) => (
              <tr key={u.id}>
                <td>
                  <div className="user-name">{u.name}</div>
                  <div className="text-small text-muted">{u.email}</div>
                </td>
                <td>{u.role}</td>
                <td>{(u as any).department ?? "—"}</td>
                <td>
                  <span className={`badge ${u.isActive ? "badge-active" : "badge-inactive"}`}>
                    {u.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                {canChangeRole && (
                  <td>
                    <button className="btn btn-primary" onClick={() => openEdit(u)}>
                      Change Role
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {visible.length === 0 && (
          <div className="page-empty">
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
