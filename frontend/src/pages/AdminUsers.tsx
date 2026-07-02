import React from "react";
import { Role, UserRow } from "../types";
import { apiFetch, useAuth } from "../AuthContext";
import EditRoleModal from "../components/EditRoleModal";
import ConfirmDialog from "../components/ConfirmDialog";

const ROLES: Role[] = ["System Administrator", "Asset Manager", "Asset Custodian", "Employee"];
const ROLE_FILTERS: (Role | "All")[] = ["All", ...ROLES];
const DEPARTMENTS = ["ICT", "Finance & Administration", "Legal", "Registry", "Human Resources", "Operations", "Procurement"];

type ModalMode = null | "create" | "edit";

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = React.useState<UserRow[]>([]);
  const [filter, setFilter] = React.useState<Role | "All">("All");
  const [search, setSearch] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(true);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Role change (existing)
  const [editing, setEditing] = React.useState<UserRow | null>(null);
  const [isEditOpen, setEditOpen] = React.useState(false);
  const [pendingNewRole, setPendingNewRole] = React.useState<Role | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  // Create / Edit modal
  const [modalMode, setModalMode] = React.useState<ModalMode>(null);
  const [formName, setFormName] = React.useState("");
  const [formEmail, setFormEmail] = React.useState("");
  const [formPassword, setFormPassword] = React.useState("");
  const [formRole, setFormRole] = React.useState<Role>("Employee");
  const [formDept, setFormDept] = React.useState(DEPARTMENTS[0]);
  const [formSubmitting, setFormSubmitting] = React.useState(false);

  // Deactivate/Reactivate confirm
  const [statusAction, setStatusAction] = React.useState<{ user: UserRow; action: "deactivate" | "reactivate" } | null>(null);

  const canManage = currentUser?.role === "System Administrator";

  const flash = (msg: string) => { setSuccessMsg(msg); setErrorMsg(null); setTimeout(() => setSuccessMsg(null), 4000); };
  const flashErr = (msg: string) => { setErrorMsg(msg); setSuccessMsg(null); setTimeout(() => setErrorMsg(null), 5000); };

  const fetchUsers = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch<UserRow[]>("/admin/users", {});
      setUsers(data);
    } catch { setUsers([]); }
    finally { setIsLoading(false); }
  }, []);

  React.useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // ── Role change flow ──
  const openRoleEdit = (u: UserRow) => { setEditing(u); setEditOpen(true); };
  const handleRequestConfirm = (newRole: Role) => { setPendingNewRole(newRole); setConfirmOpen(true); };
  const applyRoleChange = async () => {
    if (!editing || !pendingNewRole) return;
    try {
      const res = await apiFetch<{ message: string }>(`/admin/users/${editing.id}/role`, { method: "PUT", body: JSON.stringify({ role: pendingNewRole }) });
      flash(res.message);
      await fetchUsers();
    } catch (err: any) { flashErr(err.message || "Failed to update role"); }
    finally { setConfirmOpen(false); setEditOpen(false); setEditing(null); setPendingNewRole(null); }
  };

  // ── Create / Edit modal ──
  const openCreate = () => {
    setFormName(""); setFormEmail(""); setFormPassword(""); setFormRole("Employee"); setFormDept(DEPARTMENTS[0]);
    setModalMode("create");
  };
  const openEdit = (u: UserRow) => {
    setFormName(u.name); setFormEmail(u.email); setFormPassword(""); setFormRole(u.role); setFormDept(u.department || DEPARTMENTS[0]);
    setEditing(u);
    setModalMode("edit");
  };
  const closeForm = () => { setModalMode(null); setEditing(null); };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    try {
      if (modalMode === "create") {
        if (!formName || !formEmail || !formPassword) { flashErr("All fields are required."); return; }
        if (formPassword.length < 8) { flashErr("Password must be at least 8 characters."); return; }
        await apiFetch<UserRow>("/admin/users", {
          method: "POST",
          body: JSON.stringify({ full_name: formName, email: formEmail, password: formPassword, role: formRole, department: formDept }),
        });
        flash(`User '${formName}' created successfully.`);
      } else if (modalMode === "edit" && editing) {
        const payload: Record<string, string> = {};
        if (formName !== editing.name) payload.full_name = formName;
        if (formEmail !== editing.email) payload.email = formEmail;
        if (formRole !== editing.role) payload.role = formRole;
        if (formDept !== editing.department) payload.department = formDept;
        if (Object.keys(payload).length === 0) { flashErr("No changes detected."); return; }
        await apiFetch<UserRow>(`/admin/users/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        flash(`User '${formName}' updated successfully.`);
      }
      closeForm();
      await fetchUsers();
    } catch (err: any) { flashErr(err.message || "Operation failed."); }
    finally { setFormSubmitting(false); }
  };

  // ── Deactivate / Reactivate ──
  const confirmStatusChange = async () => {
    if (!statusAction) return;
    try {
      const endpoint = statusAction.action === "deactivate" ? "deactivate" : "reactivate";
      await apiFetch<UserRow>(`/admin/users/${statusAction.user.id}/${endpoint}`, { method: "PUT" });
      flash(`User '${statusAction.user.name}' ${statusAction.action === "deactivate" ? "deactivated" : "reactivated"} successfully.`);
      await fetchUsers();
    } catch (err: any) { flashErr(err.message || "Operation failed."); }
    finally { setStatusAction(null); }
  };

  const visible = users.filter((u) => {
    if (filter !== "All" && u.role !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.department || "").toLowerCase().includes(q);
    }
    return true;
  });

  if (isLoading) return <div className="page-loading">Loading users...</div>;

  return (
    <>
      {successMsg && <div className="alert-success">{successMsg}</div>}
      {errorMsg && <div className="alert-error">{errorMsg}</div>}

      {/* Filters */}
      <div className="filter-bar">
        <div className="filter-group">
          <input type="text" className="filter-search" placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="filter-group">
          <label htmlFor="role-filter" className="filter-label">Role</label>
          <select id="role-filter" value={filter} onChange={(e) => setFilter(e.target.value as any)} className="filter-select">
            {ROLE_FILTERS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="filter-count">{visible.length} users</div>
        {canManage && <button className="btn btn-primary btn-sm" onClick={openCreate}>+ Create User</button>}
      </div>

      {/* Table */}
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name / Email</th>
              <th>Role</th>
              <th>Department</th>
              <th>Status</th>
              {canManage && <th>Actions</th>}
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
                <td>{u.department || "—"}</td>
                <td>
                  <span className={`badge ${u.isActive ? "badge-active" : "badge-inactive"}`}>
                    {u.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                {canManage && (
                  <td>
                    <div className="action-btns">
                      <button className="btn btn-secondary btn-xs" onClick={() => openEdit(u)}>Edit</button>
                      <button className="btn btn-secondary btn-xs" onClick={() => openRoleEdit(u)}>Role</button>
                      {u.isActive ? (
                        <button className="btn btn-danger btn-xs" onClick={() => setStatusAction({ user: u, action: "deactivate" })}>Deactivate</button>
                      ) : (
                        <button className="btn btn-success btn-xs" onClick={() => setStatusAction({ user: u, action: "reactivate" })}>Reactivate</button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && <div className="page-empty">No users found.</div>}
      </div>

      {/* Role Change Modal */}
      <EditRoleModal user={editing} open={isEditOpen} onClose={() => setEditOpen(false)} onRequestConfirm={handleRequestConfirm} />
      <ConfirmDialog
        open={confirmOpen}
        title="Confirm Role Change"
        message={editing && pendingNewRole ? `Change ${editing.name}'s role from ${editing.role} to ${pendingNewRole}?` : ""}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={applyRoleChange}
      />

      {/* Deactivate/Reactivate Confirm */}
      <ConfirmDialog
        open={!!statusAction}
        title={statusAction?.action === "deactivate" ? "Deactivate User" : "Reactivate User"}
        message={statusAction ? (
          statusAction.action === "deactivate"
            ? `Are you sure you want to deactivate ${statusAction.user.name}? They will lose access but their data is preserved.`
            : `Reactivate ${statusAction.user.name}? They will regain access to the system.`
        ) : ""}
        onCancel={() => setStatusAction(null)}
        onConfirm={confirmStatusChange}
      />

      {/* Create / Edit Modal */}
      {modalMode && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal-content user-form-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">{modalMode === "create" ? "Create New User" : "Edit User"}</h2>
            <form onSubmit={submitForm}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="form-control" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Jane Nabirye" autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-control" type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="e.g. jane@ursb.go.ug" />
              </div>
              {modalMode === "create" && (
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input className="form-control" type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} placeholder="Min. 8 characters" />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Role</label>
                <select className="form-control" value={formRole} onChange={(e) => setFormRole(e.target.value as Role)}>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Department</label>
                <select className="form-control" value={formDept} onChange={(e) => setFormDept(e.target.value)}>
                  {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closeForm}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={formSubmitting}>
                  {formSubmitting ? "Saving..." : modalMode === "create" ? "Create User" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
