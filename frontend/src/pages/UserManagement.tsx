import React from "react";
import { Role, UserRow } from "../types";
import { apiFetch, useAuth } from "../AuthContext";
import EditRoleModal from "../components/EditRoleModal";
import ConfirmDialog from "../components/ConfirmDialog";
import Table, { Column } from "../components/common/Table";
import Button from "../components/common/Button";
import PageHeader from "../components/PageHeader";
import FilterBar, { FilterField, filterInputCls, filterSelectCls } from "../components/common/FilterBar";
import StatusBadge from "../components/common/badges/StatusBadge";
import RoleBadge from "../components/common/badges/RoleBadge";
import SuccessBanner from "../components/common/SuccessBanner";
import ErrorMessage from "../components/ErrorMessage";
import Modal from "../components/Modal";

const ROLE_FILTER_OPTIONS: { label: string; value: Role | "All" }[] = [
  { label: "All",                        value: "All" },
  { label: "Super System Administrator", value: "SUPER_SYSTEM_ADMINISTRATOR" },
  { label: "System Administrator",       value: "SYSTEM_ADMINISTRATOR" },
  { label: "Asset Manager",              value: "ASSET_MANAGER" },
  { label: "Asset Custodian",            value: "ASSET_CUSTODIAN" },
  { label: "Employee",                   value: "EMPLOYEE" },
];



export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = React.useState<UserRow[]>([]);
  const [filter, setFilter] = React.useState<Role | "All">("All");
  const [search, setSearch] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(true);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);
  const pageSize = 50;


  // Role change (existing)
  const [editing, setEditing] = React.useState<UserRow | null>(null);
  const [isEditOpen, setEditOpen] = React.useState(false);
  const [pendingNewRole, setPendingNewRole] = React.useState<Role | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  // Deactivate/Reactivate confirm
  const [statusAction, setStatusAction] = React.useState<{ user: UserRow; action: "deactivate" | "reactivate" } | null>(null);

  // Edit user
  const [editUser, setEditUser] = React.useState<UserRow | null>(null);
  const [editForm, setEditForm] = React.useState({ full_name: "", email: "", department: "" });
  const [isEditUserOpen, setEditUserOpen] = React.useState(false);
  const [isSavingEdit, setIsSavingEdit] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);

  const openEditUser = (u: UserRow) => {
    setEditUser(u);
    setEditForm({ full_name: u.name, email: u.email, department: u.department || "" });
    setEditError(null);
    setEditUserOpen(true);
  };

  const saveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setIsSavingEdit(true);
    setEditError(null);
    try {
      await apiFetch(`/admin/users/${editUser.id}`, {
        method: "PUT",
        body: JSON.stringify({
          full_name: editForm.full_name,
          email: editForm.email,
          department: editForm.department,
        }),
      });
      flash(`User '${editForm.full_name}' updated successfully.`);
      setEditUserOpen(false);
      setEditUser(null);
      await fetchUsers();
    } catch (err: any) {
      setEditError(err.message || "Failed to update user.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const canManage = 
    currentUser?.role === "SYSTEM_ADMINISTRATOR" || 
    currentUser?.role === "SUPER_SYSTEM_ADMINISTRATOR" ||
    currentUser?.role === "System Administrator" ||
    currentUser?.role === "Super System Administrator";

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

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-ursb" />
      </div>
    );
  }

  const columns: Column<UserRow>[] = [
    {
      header: "Name / Email",
      render: (u) => (
        <div>
          <div className="font-bold text-ink text-sm">{u.name}</div>
          <div className="text-[11px] text-ink-dim mt-0.5">{u.email}</div>
        </div>
      ),
    },
    {
      header: "Role",
      render: (u) => <RoleBadge role={u.role} />,
    },
    {
      header: "Department",
      render: (u) => u.department || "—",
    },
    {
      header: "Status",
      render: (u) => <StatusBadge status={u.isActive ? "Active" : "Deactivated"} />,
    },
    ...(canManage
      ? [
          {
            header: "Actions",
            render: (u: UserRow) => (
              <div className="flex flex-wrap gap-1.5">
                <Button variant="outline" onClick={() => openEditUser(u)}>Edit</Button>
                <Button variant="outline" onClick={() => openRoleEdit(u)}>Role</Button>
                {u.isActive ? (
                  <Button variant="danger-outline" onClick={() => setStatusAction({ user: u, action: "deactivate" })}>
                    Deactivate
                  </Button>
                ) : (
                  <Button onClick={() => setStatusAction({ user: u, action: "reactivate" })}>
                    Reactivate
                  </Button>
                )}
              </div>
            ),
          } as Column<UserRow>,
        ]
      : []),
  ];

  return (
    <div className="w-full flex flex-col gap-6 select-none font-sans">
      {successMsg && <SuccessBanner message={successMsg} onDismiss={() => setSuccessMsg(null)} />}
      {errorMsg && <ErrorMessage message={errorMsg} />}

      <PageHeader
        title="User Management"
        subtitle="Manage staff accounts, roles, and access"
      />

      <FilterBar count={{ value: visible.length, label: "users" }}>
        <FilterField className="flex-1 min-w-[200px]">
          <input
            type="text"
            className={filterInputCls}
            placeholder="Search users..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </FilterField>
        <FilterField label="Role" htmlFor="role-filter">
          <select
            id="role-filter"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as Role | "All");
              setPage(1);
            }}
            className={filterSelectCls}
          >
            {ROLE_FILTER_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </FilterField>
      </FilterBar>

      {(() => {
        const totalPages = Math.ceil(visible.length / pageSize);
        const paginatedUsers = visible.slice((page - 1) * pageSize, page * pageSize);
        return (
          <>
            <Table
              data={paginatedUsers}
              columns={columns}
              rowKey={(u) => u.id}
              emptyMessage="No users found."
            />
            {totalPages > 1 && (
              <div className="flex justify-between items-center mt-4 pt-4 border-t border-sky-page/30">
                <div className="text-sm text-ink-dim font-sans">
                  Page {page} of {totalPages} ({visible.length} total users)
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        );
      })()}

      {/* Edit User Modal */}
      <Modal open={isEditUserOpen} onClose={() => setEditUserOpen(false)} title="Edit User">
        <form onSubmit={saveEditUser} className="flex flex-col gap-5 font-sans select-none min-w-[360px] px-1 pb-1">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-full-name" className="text-[10px] font-bold uppercase tracking-wider text-ink-dim">Full Name</label>
            <input
              id="edit-full-name"
              type="text"
              className={filterInputCls}
              value={editForm.full_name}
              onChange={(e) => setEditForm(f => ({ ...f, full_name: e.target.value }))}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-email" className="text-[10px] font-bold uppercase tracking-wider text-ink-dim">Email</label>
            <input
              id="edit-email"
              type="email"
              className={filterInputCls}
              value={editForm.email}
              onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-department" className="text-[10px] font-bold uppercase tracking-wider text-ink-dim">Department</label>
            <input
              id="edit-department"
              type="text"
              className={filterInputCls}
              value={editForm.department}
              onChange={(e) => setEditForm(f => ({ ...f, department: e.target.value }))}
            />
          </div>
          {editError && <ErrorMessage message={editError} />}
          <div className="flex justify-end gap-2 pt-2 border-t border-sky-page/50">
            <Button type="button" variant="ghost" onClick={() => setEditUserOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={isSavingEdit}>Save Changes</Button>
          </div>
        </form>
      </Modal>

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
    </div>
  );
}
