import React from "react";
import { apiFetch, useAuth } from "../AuthContext";
import { StorageAsset, StorageListResponse, UserRow } from "../types";
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

interface ActiveAssetOption {
  asset_id: string;
  asset_name: string;
  asset_type: string;
  serial_number: string;
  status: string;
}

export default function Storage() {
  const { user } = useAuth();
  const [data, setData] = React.useState<StorageListResponse | null>(null);
  const [activeAssets, setActiveAssets] = React.useState<ActiveAssetOption[]>([]);
  const [users, setUsers] = React.useState<UserRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  // Filters
  const [deptFilter, setDeptFilter] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("");
  const [search, setSearch] = React.useState("");

  // Modals state
  const [assignModalAsset, setAssignModalAsset] = React.useState<StorageAsset | null>(null);
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
  const [returnConfirmAsset, setReturnConfirmAsset] = React.useState<ActiveAssetOption | null>(null);
  const [dirtyConfirm, setDirtyConfirm] = React.useState<{ open: boolean; onConfirm: () => void } | null>(null);

  const isAdminOrManager = user?.role === "System Administrator" || user?.role === "Asset Manager";

  const fetchStorageData = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (deptFilter) params.set("department", deptFilter);
      if (typeFilter) params.set("asset_type", typeFilter);
      if (search) params.set("search", search);

      const res = await apiFetch<StorageListResponse>(`/storage?${params.toString()}`, {});
      setData(res);
    } catch (err: any) {
      setError(err.message || "Failed to load storage assets.");
    } finally {
      setIsLoading(false);
    }
  }, [deptFilter, typeFilter, search]);

  const fetchContextData = React.useCallback(async () => {
    try {
      if (isAdminOrManager) {
        // Fetch users for assignment dropdown
        const usersData = await apiFetch<UserRow[]>("/admin/users", {});
        setUsers(usersData);

        // Fetch active assets for Return to Storage modal
        const assetsData = await apiFetch<ActiveAssetOption[]>("/assets?status=Active", {});
        setActiveAssets(assetsData);
      }
    } catch (err) {
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
    } else {
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
    } else {
      setShowReturnModal(false);
    }
  };

  const handleClearFilters = () => {
    setDeptFilter("");
    setTypeFilter("");
    setSearch("");
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignModalAsset || !assignForm.assigned_to) return;
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
    } catch (err: any) {
      setError(err.message || "Failed to assign asset.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReturnClick = (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnForm.asset_id) return;
    const selected = activeAssets.find(a => a.asset_id === returnForm.asset_id);
    if (selected) {
      setReturnConfirmAsset(selected);
    }
  };

  const handleReturnConfirm = async () => {
    if (!returnConfirmAsset) return;
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
    } catch (err: any) {
      setError(err.message || "Failed to return asset to storage.");
    } finally {
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

  return (
    <>
      {success && <SuccessBanner message={success} onDismiss={() => setSuccess(null)} />}
      {error && <ErrorMessage message={error} />}

      <PageHeader 
        title="Storage Management"
        subtitle="Manage assets kept in storage and allocate them to staff"
        actions={
          isAdminOrManager && (
            <button className="btn btn-secondary" onClick={() => setShowReturnModal(true)}>
              {ICONS.return} Return Asset to Storage
            </button>
          )
        }
      />

      {data && (
        <div className="dash-stats" style={{ marginBottom: "1.5rem" }}>
          <StatCard label="Total In Storage" value={data.total} icon="🏪" color="#185FA5" />
          <StatCard label="Departments with Stored Assets" value={Object.keys(data.by_department).length} icon="🏢" color="#0d9488" />
          <StatCard label="Unique Asset Types Stored" value={Object.keys(data.by_type).length} icon="📦" color="#8b5cf6" />
        </div>
      )}

      <div className="filter-bar">
        <div className="filter-group">
          <label htmlFor="dept-filter" className="filter-label">Department</label>
          <select
            id="dept-filter"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="filter-select"
          >
            <option value="">All Departments</option>
            {departments.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="type-filter" className="filter-label">Asset Type</label>
          <select
            id="type-filter"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="filter-select"
          >
            <option value="">All Asset Types</option>
            {assetTypes.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="storage-search" className="filter-label">Search</label>
          <input
            id="storage-search"
            type="text"
            className="filter-search"
            placeholder="Search by name or SN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <button className="btn btn-secondary btn-sm" onClick={handleClearFilters}>
          Clear Filters
        </button>
      </div>

      {isLoading ? (
        <div className="page-loading" style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
          <LoadingSpinner size="lg" />
        </div>
      ) : !data || data.assets.length === 0 ? (
        <EmptyState title="No assets in storage" description="There are no assets currently kept in storage." icon="🏪" />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "1.5rem" }}>
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Type</th>
                  <th>Serial Number</th>
                  <th>Department</th>
                  {isAdminOrManager && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {data.assets.map((a) => (
                  <tr key={a.asset_id}>
                    <td>
                      <div>
                        <div className="user-name">{a.asset_name}</div>
                        <div className="text-small text-muted">{a.asset_id}</div>
                      </div>
                    </td>
                    <td>{a.asset_type}</td>
                    <td>{a.serial_number || "-"}</td>
                    <td>{a.department || "Unassigned"}</td>
                    {isAdminOrManager && (
                      <td>
                        <button 
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            setAssignModalAsset(a);
                            setAssignForm({ assigned_to: "", notes: "" });
                          }}
                        >
                          Assign Asset
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div className="card" style={{ padding: "1.25rem" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "1rem", color: "var(--color-primary)" }}>Breakdown by Department</h3>
              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {Object.entries(data.by_department).map(([dept, count]) => (
                  <li key={dept} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem" }}>
                    <span className="text-muted">{dept}</span>
                    <span style={{ fontWeight: 600 }}>{count}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="card" style={{ padding: "1.25rem" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "1rem", color: "var(--color-primary)" }}>Breakdown by Type</h3>
              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {Object.entries(data.by_type).map(([type, count]) => (
                  <li key={type} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem" }}>
                    <span className="text-muted">{type}</span>
                    <span style={{ fontWeight: 600 }}>{count}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Assign from Storage Modal */}
      <Modal open={!!assignModalAsset} onClose={handleCloseAssignModal} title="Assign Asset from Storage">
        <form onSubmit={handleAssignSubmit}>
          <FormInput 
            type="text"
            label="Asset"
            value={assignModalAsset ? `${assignModalAsset.asset_name} (${assignModalAsset.asset_id})` : ""}
            onChange={() => {}}
            disabled
          />

          <div className="form-group">
            <label htmlFor="assign-storage-user" className="form-label">Assign To User *</label>
            <select
              id="assign-storage-user"
              className="form-control"
              value={assignForm.assigned_to}
              onChange={(e) => setAssignForm({ ...assignForm, assigned_to: e.target.value })}
              required
            >
              <option value="">Select a user...</option>
              {users.filter(u => u.isActive).map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          </div>

          <FormInput 
            type="textarea"
            label="Notes"
            value={assignForm.notes}
            onChange={(val) => setAssignForm({ ...assignForm, notes: val })}
            placeholder="Add assignment details or comments..."
          />

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={handleCloseAssignModal}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || !assignForm.assigned_to}
            >
              {isSubmitting ? <LoadingSpinner size="sm" /> : "Assign Asset"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Return to Storage Modal */}
      <Modal open={showReturnModal} onClose={handleCloseReturnModal} title="Return Asset to Storage">
        <form onSubmit={handleReturnClick}>
          <div className="form-group">
            <label htmlFor="return-asset-select" className="form-label">Select Active Assigned Asset *</label>
            <select
              id="return-asset-select"
              className="form-control"
              value={returnForm.asset_id}
              onChange={(e) => setReturnForm({ asset_id: e.target.value })}
              required
            >
              <option value="">Select an active asset to return...</option>
              {activeAssets.map(a => (
                <option key={a.asset_id} value={a.asset_id}>
                  {a.asset_name} ({a.asset_id})
                </option>
              ))}
            </select>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={handleCloseReturnModal}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || !returnForm.asset_id}
            >
              Return Asset
            </button>
          </div>
        </form>
      </Modal>

      {/* Dirty Form Close Dialog */}
      <ConfirmDialog 
        open={!!dirtyConfirm?.open}
        title="Unsaved changes"
        message="You have unsaved changes. Are you sure you want to close? Your changes will be lost."
        onCancel={() => setDirtyConfirm(null)}
        onConfirm={() => {
          if (dirtyConfirm?.onConfirm) dirtyConfirm.onConfirm();
        }}
      />

      {/* Return Confirm Dialog */}
      <ConfirmDialog 
        open={!!returnConfirmAsset}
        title="Confirm Return to Storage"
        message={`Are you sure you want to return asset "${returnConfirmAsset?.asset_name}" (${returnConfirmAsset?.asset_id}) back to storage? This will end its current custody assignment.`}
        onCancel={() => setReturnConfirmAsset(null)}
        onConfirm={handleReturnConfirm}
      />
    </>
  );
}
