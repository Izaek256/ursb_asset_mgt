import React from "react";
import { apiFetch, useAuth } from "../AuthContext";
import { StorageAsset, StorageListResponse, UserRow } from "../types";
import { ICONS } from "../utils/icons";
import Modal from "../components/Modal";
import FormInput from "../components/common/FormInput";
import EmptyState from "../components/EmptyState";
import ConfirmDialog from "../components/ConfirmDialog";
import PageHeader from "../components/PageHeader";
import Table, { Column } from "../components/common/Table";
import Button from "../components/common/Button";
import FilterBar, { FilterField, filterInputCls, filterSelectCls } from "../components/common/FilterBar";
import { SkeletonCard } from "../components/common/LoadingSkeleton";

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

  // Filters
  const [deptFilter, setDeptFilter] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("");
  const [search, setSearch] = React.useState("");

  // Pagination
  const PAGE_SIZE = 6;
  const [currentPage, setCurrentPage] = React.useState(1);

  // Modals state
  const [confirmReturnAssignment, setConfirmReturnAssignment] = React.useState<{assignment_id: number; asset_name: string; employee_name: string} | null>(null);
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
    try {
      const params = new URLSearchParams();
      if (deptFilter) params.set("department", deptFilter);
      if (typeFilter) params.set("asset_type", typeFilter);
      if (search) params.set("search", search);

      const res = await apiFetch<StorageListResponse>(`/storage?${params.toString()}`, {});
      setData(res);
    } catch (err: any) {
      (window as any).toast?.error("Failed to load storage", err.message);
    } finally {
      setIsLoading(false);
    }
  }, [deptFilter, typeFilter, search]);

  // Reset to first page whenever filters/data change
  React.useEffect(() => {
    setCurrentPage(1);
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

  const handleAssignClick = (asset: StorageAsset) => {
    setAssignModalAsset(asset);
    setAssignForm({ assigned_to: "", notes: "" });
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignModalAsset || !assignForm.assigned_to) return;
    setIsSubmitting(true);
    try {
      await apiFetch(`/storage/${assignModalAsset.asset_id}/assign`, {
        method: "POST",
        body: JSON.stringify({
          assigned_to: parseInt(assignForm.assigned_to, 10),
          notes: assignForm.notes,
        }),
      });
      (window as any).toast?.success("Asset Assigned", `"${assignModalAsset.asset_name}" assigned successfully.`);
      setAssignModalAsset(null);
      setAssignForm({ assigned_to: "", notes: "" });
      fetchStorageData();
    } catch (err: any) {
      (window as any).toast?.error("Assign Failed", err.message || "Failed to assign asset.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReturnClick = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnForm.asset_id) return;
    const asset = activeAssets.find(a => a.asset_id === returnForm.asset_id);
    if (asset) {
      setReturnConfirmAsset(asset);
    }
  };

  const handleReturnConfirm = async () => {
    if (!returnConfirmAsset) return;
    setIsSubmitting(true);
    try {
      await apiFetch(`/storage/return`, {
        method: "POST",
        body: JSON.stringify({
          asset_id: returnConfirmAsset.asset_id,
        }),
      });
      (window as any).toast?.success("Returned to Storage", `"${returnConfirmAsset.asset_name}" successfully returned to storage.`);
      setShowReturnModal(false);
      setReturnConfirmAsset(null);
      setReturnForm({ asset_id: "" });
      fetchStorageData();
      fetchContextData();
    } catch (err: any) {
      (window as any).toast?.error("Return Failed", err.message || "Failed to return asset to storage.");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleConfirmReturn = async () => {
    if (!confirmReturnAssignment) return;
    setIsSubmitting(true);
    try {
      await apiFetch(`/assignments/${confirmReturnAssignment.assignment_id}/confirm-return`, {
        method: "POST",
      });
      (window as any).toast?.success("Return Confirmed", `Return confirmed for "${confirmReturnAssignment.asset_name}".`);
      setConfirmReturnAssignment(null);
      fetchStorageData();
    } catch (err: any) {
      (window as any).toast?.error("Confirm Failed", err.message || "Failed to confirm return.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: Column<StorageAsset>[] = [
    {
      header: "Asset",
      render: (a) => (
        <div>
          <div className="font-bold text-ink text-sm">{a.asset_name}</div>
          <div className="text-[11px] text-ink-dim mt-0.5">{a.asset_id}</div>
        </div>
      ),
    },
    {
      header: "Type",
      render: (a) => <span className="font-semibold">{a.asset_type}</span>,
    },
    {
      header: "Serial Number",
      render: (a) => <span className="text-xs text-ink-dim">{a.serial_number}</span>,
    },
    {
      header: "Department",
      render: (a) => a.department || "—",
    },
    
    {
      header: "Actions",
      render: (a) => (
        <div className="flex select-none gap-2">
          {isAdminOrManager && (
            <Button variant="outline" onClick={() => handleAssignClick(a)}>
              Assign Asset
            </Button>
          )}
          {/*
            Confirm Return button — renders only when ALL of:
            1. Current user is an Asset Custodian
            2. Asset status is Returned (employee has initiated return, awaiting physical confirmation)
            Displays employee name and asset name so Custodian can match to physical item
          */}
          {user?.role === "Asset Custodian" && a.status === "Returned" && (
            <Button
              variant="success"
              onClick={() => setConfirmReturnAssignment({
                assignment_id: a.current_assignment_id ?? 0,
                asset_name: a.asset_name,
                employee_name: a.current_custodian_name || "Unknown",
              })}
            >
              Confirm Return
            </Button>
          )}
        </div>
      ),
    },
  ];

  // Helper arrays for filters
  const departments = ["ICT", "Administration", "Finance", "Legal"];
  const assetTypes = ["ICT Equipment", "Furniture", "Vehicle", "Software", "Other"];

  // Mapping options for dropdown selects
  const userOptions = users.filter(u => u.isActive).map(u => ({
    value: String(u.id),
    label: `${u.name} (${u.role})`,
  }));

  const activeAssetOptions = activeAssets.map(a => ({
    value: a.asset_id,
    label: `${a.asset_name} (${a.asset_id})`,
  }));

  // Pagination helpers
  const allAssets = data?.assets ?? [];
  const totalPages = Math.max(1, Math.ceil(allAssets.length / PAGE_SIZE));
  const paginatedAssets = allAssets.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="w-full flex flex-col gap-6 select-none font-sans">
      <PageHeader
        title="Storage Management"
        subtitle="Manage assets kept in storage and allocate them to staff"
        actions={
          isAdminOrManager && (
            <Button onClick={() => setShowReturnModal(true)}>
              <ICONS.chevronLeft className="w-4 h-4 mr-1.5 stroke-[2.4] rotate-90" />
              Return Asset to Storage
            </Button>
          )
        }
      />

      {/* Mini Stats Card Row */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4.5">
          <div className="bg-white border border-sky-cardBorder rounded-2xl p-4 flex items-center gap-3.5 shadow-sm hover:shadow-md transition-all">
            <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-stat-blueChip text-stat-blueIcon">
              <ICONS.clock className="w-5 h-5 stroke-[2.4]" />
            </span>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-ink-dim">
                Total in Storage
              </span>
              <span className="block text-xl font-bold text-ink mt-0.5">
                {data.assets.length}
              </span>
            </div>
          </div>

          <div className="bg-white border border-sky-cardBorder rounded-2xl p-4 flex items-center gap-3.5 shadow-sm hover:shadow-md transition-all">
            <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-stat-greenChip text-stat-greenIcon">
              <ICONS.building className="w-5 h-5 stroke-[2.4]" />
            </span>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-ink-dim">
                Departments with Stored Assets
              </span>
              <span className="block text-xl font-bold text-ink mt-0.5">
                {Object.keys(data.by_department).length}
              </span>
            </div>
          </div>

          <div className="bg-white border border-sky-cardBorder rounded-2xl p-4 flex items-center gap-3.5 shadow-sm hover:shadow-md transition-all">
            <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-stat-amberChip text-stat-amberIcon">
              <ICONS.assets className="w-5 h-5 stroke-[2.4]" />
            </span>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-ink-dim">
                Unique Asset Types Stored
              </span>
              <span className="block text-xl font-bold text-ink mt-0.5">
                {Object.keys(data.by_type).length}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Filter Bar with Search growing */}
      <FilterBar>
        <FilterField label="Department" htmlFor="dept-filter">
          <select
            id="dept-filter"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className={filterSelectCls}
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Asset Type" htmlFor="type-filter">
          <select
            id="type-filter"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className={filterSelectCls}
          >
            <option value="">All Asset Types</option>
            {assetTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Search" htmlFor="storage-search" grow>
          <input
            id="storage-search"
            type="text"
            className={filterInputCls}
            placeholder="Search by name or SN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </FilterField>
        {(deptFilter || typeFilter || search) && (
          <Button variant="outline" onClick={() => { setDeptFilter(""); setTypeFilter(""); setSearch(""); }}>
            Clear Filters
          </Button>
        )}
      </FilterBar>

      {isLoading ? (
        <SkeletonCard className="h-96" />
      ) : !data || data.assets.length === 0 ? (
        <EmptyState
          title="No assets in storage"
          description="There are no assets currently kept in storage."
          icon={<ICONS.storage className="w-6 h-6 text-ink-icon stroke-[2.2]" />}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col gap-4">
            <Table
              data={paginatedAssets}
              columns={columns}
              rowKey={(a) => a.asset_id}
              emptyMessage="No assets in storage."
            />

            {/* Pagination controls */}
            {allAssets.length > PAGE_SIZE && (
              <div className="flex items-center justify-between gap-3 p-4 bg-white border border-sky-cardBorder rounded-2xl shadow-sm">
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <span className="text-sm font-semibold text-ink-dim">
                  Page {currentPage} of {totalPages}
                  <span className="ml-2 text-[11px] font-normal text-ink-dim/70">({allAssets.length} total)</span>
                </span>
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-6">
            <div className="bg-white border border-sky-cardBorder rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <h3 className="font-bold text-sm text-ink mb-4 pb-3 border-b border-sky-page/20">
                Breakdown by Department
              </h3>
              <ul className="flex flex-col gap-2.5">
                {Object.entries(data.by_department).map(([dept, count]) => (
                  <li key={dept} className="flex justify-between text-xs font-semibold">
                    <span className="text-ink-dim">{dept}</span>
                    <span className="font-bold text-ink">{count}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white border border-sky-cardBorder rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <h3 className="font-bold text-sm text-ink mb-4 pb-3 border-b border-sky-page/20">
                Breakdown by Type
              </h3>
              <ul className="flex flex-col gap-2.5">
                {Object.entries(data.by_type).map(([type, count]) => (
                  <li key={type} className="flex justify-between text-xs font-semibold">
                    <span className="text-ink-dim">{type}</span>
                    <span className="font-bold text-ink">{count}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Assign from Storage Modal */}
      <Modal open={!!assignModalAsset} onClose={handleCloseAssignModal} title="Assign Asset from Storage">
        <form onSubmit={handleAssignSubmit} className="flex flex-col gap-4">
          <FormInput 
            type="text"
            variant="light"
            label="Asset"
            value={assignModalAsset ? `${assignModalAsset.asset_name} (${assignModalAsset.asset_id})` : ""}
            onChange={() => {}}
            disabled
          />

          <FormInput
            type="select"
            variant="light"
            label="Assign To User *"
            value={assignForm.assigned_to}
            onChange={(val) => setAssignForm({ ...assignForm, assigned_to: val })}
            options={[{ value: "", label: "Select a user..." }, ...userOptions]}
            required
          />

          <FormInput 
            type="textarea"
            variant="light"
            label="Notes"
            value={assignForm.notes}
            onChange={(val) => setAssignForm({ ...assignForm, notes: val })}
            placeholder="Add assignment details or comments..."
          />

          <div className="flex justify-end gap-2.5 border-t border-sky-page/20 pt-4 mt-2">
            <Button type="button" variant="danger-outline" onClick={handleCloseAssignModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={isSubmitting}
              disabled={isSubmitting || !assignForm.assigned_to}
            >
              Assign Asset
            </Button>
          </div>
        </form>
      </Modal>

      {/* Return to Storage Modal */}
      <Modal open={showReturnModal} onClose={handleCloseReturnModal} title="Return Asset to Storage">
        <form onSubmit={handleReturnClick} className="flex flex-col gap-4">
          <FormInput
            type="select"
            variant="light"
            label="Select Active Assigned Asset *"
            value={returnForm.asset_id}
            onChange={(val) => setReturnForm({ asset_id: val })}
            options={[{ value: "", label: "Select an active asset to return..." }, ...activeAssetOptions]}
            required
          />

          <div className="flex justify-end gap-2.5 border-t border-sky-page/20 pt-4 mt-2">
            <Button type="button" variant="danger-outline" onClick={handleCloseReturnModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={isSubmitting}
              disabled={isSubmitting || !returnForm.asset_id}
            >
              Return Asset
            </Button>
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

      {/* Confirm Return Dialog — Custodian confirms physical receipt */}
      <ConfirmDialog
        open={!!confirmReturnAssignment}
        title="Confirm Asset Return"
        message={`Confirm physical receipt of "${confirmReturnAssignment?.asset_name}" from ${confirmReturnAssignment?.employee_name}? This will mark the asset as Available.`}
        onCancel={() => setConfirmReturnAssignment(null)}
        onConfirm={handleConfirmReturn}
      />
    </div>
  );
}

