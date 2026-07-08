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

const ROLES: Role[] = ["System Administrator", "Asset Manager", "Asset Custodian", "Employee"];
const ROLE_FILTERS: (Role | "All")[] = ["All", ...ROLES];
const DEPARTMENTS = ["ICT", "Finance & Administration", "Legal", "Registry", "Human Resources", "Operations", "Procurement"];


export default function UserManagement() {
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
            onChange={(e) => setSearch(e.target.value)}
          />
        </FilterField>
        <FilterField label="Role" htmlFor="role-filter">
          <select
            id="role-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value as Role | "All")}
            className={filterSelectCls}
          >
            {ROLE_FILTERS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </FilterField>
      </FilterBar>

      <Table
        data={visible}
        columns={columns}
        rowKey={(u) => u.id}
        emptyMessage="No users found."
      />

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
