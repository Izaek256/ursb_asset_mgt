import React from "react";
import { apiFetch, useAuth } from "../AuthContext";
import { Transfer, TransferListResponse, StorageAsset, UserRow } from "../types";
import Modal from "../components/Modal";
import FormInput from "../components/common/FormInput";
import ConfirmDialog from "../components/ConfirmDialog";
import ErrorMessage from "../components/ErrorMessage";
import Table, { Column } from "../components/common/Table";
import PageHeader from "../components/PageHeader";
import Button from "../components/common/Button";
import FilterBar, { FilterField, filterInputCls, filterSelectCls } from "../components/common/FilterBar";
import StatusBadge from "../components/common/badges/StatusBadge";
import EmptyState from "../components/EmptyState";
import { ICONS } from "../utils/icons";

export default function Transfers() {
  const { user } = useAuth();
  const [transfers, setTransfers] = React.useState<Transfer[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [assetIdFilter, setAssetIdFilter] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"All" | "Acknowledged" | "Pending">("All");

  // Create Transfer modal state
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [createForm, setCreateForm] = React.useState({
    asset_id: "",
    to_user_id: "",
    transfer_date: new Date().toISOString().split("T")[0],
    reason: "",
  });
  const [formDirty, setFormDirty] = React.useState(false);
  const [isCreating, setIsCreating] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);

  // Dropdown data state
  const [assets, setAssets] = React.useState<StorageAsset[]>([]);
  const [users, setUsers] = React.useState<UserRow[]>([]);

  // Acknowledge dialog state
  const [acknowledgeDialog, setAcknowledgeDialog] = React.useState<{ open: boolean; transferId: number | null }>({
    open: false,
    transferId: null,
  });

  // Handle ?openModal=true on mount
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("openModal") === "true") {
      setShowCreateModal(true);
    }
  }, []);

  React.useEffect(() => {
    fetchTransfers();
  }, []);

  // Fetch assets and users when modal opens
  React.useEffect(() => {
    if (showCreateModal && assets.length === 0) {
      const loadDropdownData = async () => {
        try {
          const [assetsData, usersData] = await Promise.all([
            apiFetch<StorageAsset[]>("/assets"),
            apiFetch<UserRow[]>("/admin/users"),
          ]);
          setAssets(assetsData || []);
          setUsers(usersData || []);
        } catch (err: any) {
          console.error("Failed to load dropdown data:", err);
        }
      };
      loadDropdownData();
    }
  }, [showCreateModal, assets.length]);

  const handleClearFilters = () => {
    setAssetIdFilter("");
    setStatusFilter("All");
  };

  const fetchTransfers = async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch<TransferListResponse | Transfer[]>("/transfers");
      if (Array.isArray(data)) {
        setTransfers(data);
      } else if (data && Array.isArray(data.transfers)) {
        setTransfers(data.transfers);
      } else {
        setTransfers([]);
      }
    } catch (err: any) {
      (window as any).toast?.error("Failed to load transfers", err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateFieldChange = (field: string, val: string) => {
    setCreateForm((prev) => ({ ...prev, [field]: val }));
    setFormDirty(true);
  };

  const handleCreateModalClose = () => {
    if (formDirty) {
      setAcknowledgeDialog({ open: true, transferId: null });
    } else {
      setShowCreateModal(false);
      setCreateError(null);
    }
  };

  const handleConfirmCloseWithoutSaving = () => {
    setShowCreateModal(false);
    setCreateForm({
      asset_id: "",
      to_user_id: "",
      transfer_date: new Date().toISOString().split("T")[0],
      reason: "",
    });
    setFormDirty(false);
    setCreateError(null);
    setAcknowledgeDialog({ open: false, transferId: null });
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.asset_id || !createForm.to_user_id) {
      setCreateError("Please select both an asset and target user.");
      return;
    }
    if (createForm.reason.trim().length < 10) {
      setCreateError("Reason must be at least 10 characters long.");
      return;
    }

    setIsCreating(true);
    setCreateError(null);
    try {
      await apiFetch("/transfers", {
        method: "POST",
        body: JSON.stringify({
          asset_id: createForm.asset_id,
          to_user_id: parseInt(createForm.to_user_id, 10),
          transfer_date: createForm.transfer_date,
          reason: createForm.reason,
        }),
      });
      (window as any).toast?.success("Transfer Created", "Transfer record created successfully.");
      setShowCreateModal(false);
      setCreateForm({
        asset_id: "",
        to_user_id: "",
        transfer_date: new Date().toISOString().split("T")[0],
        reason: "",
      });
      setFormDirty(false);
      fetchTransfers();
    } catch (err: any) {
      setCreateError(err.message || "Failed to initiate transfer.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleAcknowledgeClick = (transferId: number) => {
    setAcknowledgeDialog({ open: true, transferId });
  };

  const handleAcknowledgeConfirm = async () => {
    if (acknowledgeDialog.transferId === null) return;
    try {
      await apiFetch(`/transfers/${acknowledgeDialog.transferId}/acknowledge`, {
        method: "PUT",
      });
      (window as any).toast?.success("Transfer Acknowledged", "Custody updated successfully.");
      setAcknowledgeDialog({ open: false, transferId: null });
      fetchTransfers();
    } catch (err: any) {
      (window as any).toast?.error("Acknowledge Failed", err.message || "Failed to acknowledge transfer.");
      setAcknowledgeDialog({ open: false, transferId: null });
    }
  };

  // Filter transfers list
  const displayedTransfers = transfers.filter((t) => {
    const matchesAsset =
      !assetIdFilter.trim() ||
      t.asset_id.toLowerCase().includes(assetIdFilter.toLowerCase()) ||
      t.asset_name.toLowerCase().includes(assetIdFilter.toLowerCase());
    const matchesStatus =
      statusFilter === "All" ||
      (statusFilter === "Acknowledged" && t.acknowledged_at !== null) ||
      (statusFilter === "Pending" && t.acknowledged_at === null);
    return matchesAsset && matchesStatus;
  });

  const canCreateTransfer =
    user?.role === "System Administrator" ||
    user?.role === "Asset Manager" ||
    user?.role === "Asset Custodian";

  const columns: Column<Transfer>[] = [
    {
      header: "Asset",
      render: (t) => (
        <div>
          <div className="font-bold text-ink text-sm">{t.asset_name}</div>
          <div className="text-[11px] text-ink-dim mt-0.5">{t.asset_id}</div>
        </div>
      ),
    },
    { header: "From", render: (t) => t.from_user_name || "—" },
    { header: "To", render: (t) => t.to_user_name },
    {
      header: "Transfer Date",
      render: (t) => new Date(t.transfer_date).toLocaleDateString(),
    },
    { header: "Reason", render: (t) => t.reason },
    { header: "Authorised By", render: (t) => t.authorised_by_name || "—" },
    {
      header: "Acknowledged",
      render: (t) =>
        t.acknowledged_at ? (
          <span className="text-xs text-ink-dim">{new Date(t.acknowledged_at).toLocaleString()}</span>
        ) : (
          <StatusBadge status="Pending" />
        ),
    },
    {
      header: "Actions",
      render: (t) =>
        t.acknowledged_at === null &&
        (t.to_user_id === parseInt(user?.user_id || "0", 10) || user?.role === "System Administrator") ? (
          <div className="flex select-none">
            <Button variant="outline" onClick={() => handleAcknowledgeClick(t.transfer_id)}>
              Acknowledge
            </Button>
          </div>
        ) : null,
    },
  ];

  const assetOptions = assets.map((asset) => ({
    value: asset.asset_id,
    label: `${asset.asset_name} - ${asset.serial_number} (${asset.asset_type})`,
  }));

  const userOptions = users.map((u) => ({
    value: String(u.id),
    label: `${u.name} (${u.email}) - ${u.role}`,
  }));

  return (
    <div className="w-full flex flex-col gap-6 select-none font-sans">
      <PageHeader
        title="Asset Transfers"
        subtitle="Custody change history between employees"
        actions={
          canCreateTransfer && (
            <Button onClick={() => setShowCreateModal(true)}>
              <ICONS.plus className="w-4 h-4 mr-1.5 stroke-[2.4]" />
              Create Transfer
            </Button>
          )
        }
      />

      <FilterBar
        count={{ value: displayedTransfers.length, label: "transfers" }}
        onClear={handleClearFilters}
      >
        <FilterField label="Asset ID" htmlFor="asset-id-filter">
          <input
            id="asset-id-filter"
            type="text"
            className={filterInputCls}
            placeholder="Filter by Asset ID..."
            value={assetIdFilter}
            onChange={(e) => setAssetIdFilter(e.target.value)}
          />
        </FilterField>
        <FilterField label="Status" htmlFor="status-filter">
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "All" | "Acknowledged" | "Pending")}
            className={filterSelectCls}
          >
            <option value="All">All</option>
            <option value="Acknowledged">Acknowledged</option>
            <option value="Pending">Pending</option>
          </select>
        </FilterField>
      </FilterBar>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-ursb" />
        </div>
      ) : displayedTransfers.length === 0 ? (
        <EmptyState
          title="No transfers found"
          description="There are no transfer history records found matching your filters."
          icon={<ICONS.transfers className="w-6 h-6 text-ink-icon stroke-[2.2]" />}
        />
      ) : (
        <Table
          data={displayedTransfers}
          columns={columns}
          rowKey={(t) => t.transfer_id}
          emptyMessage="No transfers found."
        />
      )}

      {/* Create Transfer Modal */}
      <Modal open={showCreateModal} onClose={handleCreateModalClose} title="Create Transfer">
        <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
          {createError && <ErrorMessage message={createError} />}
          
          <FormInput
            type="select"
            variant="light"
            label="Asset"
            value={createForm.asset_id}
            onChange={(val) => handleCreateFieldChange("asset_id", val)}
            options={[{ value: "", label: "Select an asset..." }, ...assetOptions]}
            helper="Select the asset to transfer"
            required
          />

          <FormInput
            type="select"
            variant="light"
            label="To User"
            value={createForm.to_user_id}
            onChange={(val) => handleCreateFieldChange("to_user_id", val)}
            options={[{ value: "", label: "Select a user..." }, ...userOptions]}
            helper="Select the user receiving the asset"
            required
          />

          <FormInput
            type="date"
            variant="light"
            label="Transfer Date"
            value={createForm.transfer_date}
            onChange={(val) => handleCreateFieldChange("transfer_date", val)}
          />

          <FormInput
            type="textarea"
            variant="light"
            label="Reason"
            value={createForm.reason}
            onChange={(val) => handleCreateFieldChange("reason", val)}
            helper="Provide a reason for this transfer"
            required
            characterCount={{ current: createForm.reason.length, min: 10 }}
          />

          <div className="flex justify-end gap-2.5 border-t border-sky-page/20 pt-4 mt-2">
            <Button type="button" variant="danger-outline" onClick={handleCreateModalClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={isCreating}
              disabled={isCreating || createForm.reason.trim().length < 10}
            >
              Create Transfer
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirm Dialog for dirty form close */}
      <ConfirmDialog
        open={acknowledgeDialog.open && acknowledgeDialog.transferId === null}
        title="Close without saving?"
        message="Your changes will be lost."
        onCancel={() => setAcknowledgeDialog({ open: false, transferId: null })}
        onConfirm={handleConfirmCloseWithoutSaving}
      />

      {/* Confirm Dialog for acknowledge */}
      <ConfirmDialog
        open={acknowledgeDialog.open && acknowledgeDialog.transferId !== null}
        title="Acknowledge Transfer"
        message="Confirm you have received custody of this asset. This cannot be undone."
        onCancel={() => setAcknowledgeDialog({ open: false, transferId: null })}
        onConfirm={handleAcknowledgeConfirm}
      />
    </div>
  );
}
