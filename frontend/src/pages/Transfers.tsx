import React from "react";
import { apiFetch, useAuth } from "../AuthContext";
import { Transfer, TransferListResponse, StorageAsset, UserRow } from "../types";
import Modal from "../components/Modal";
import FormInput from "../components/FormInput";
import ConfirmDialog from "../components/ConfirmDialog";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import SuccessBanner from "../components/SuccessBanner";

export default function Transfers() {
  const { user } = useAuth();
  const [transfers, setTransfers] = React.useState<Transfer[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
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
  const [isLoadingDropdowns, setIsLoadingDropdowns] = React.useState(false);

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

  // Handle ?openModal=true in URL
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("openModal") === "true") {
      // When Create Transfer modal is implemented, open it here
      // For now, this is a placeholder for future functionality
      console.log("Create Transfer modal would open here");
    }
  }, []);

  React.useEffect(() => {
    fetchTransfers();
  }, []);

  // Fetch assets and users when modal opens
  React.useEffect(() => {
    if (showCreateModal && assets.length === 0) {
      const loadDropdownData = async () => {
        setIsLoadingDropdowns(true);
        try {
          const [assetsData, usersData] = await Promise.all([
            apiFetch<StorageAsset[]>("/assets"),
            apiFetch<UserRow[]>("/admin/users"),
          ]);
          console.log("Assets API response:", assetsData);
          console.log("Users API response:", usersData);
          setAssets(assetsData || []);
          setUsers(usersData || []);
        } catch (err: any) {
          console.error("Failed to load dropdown data:", err);
        } finally {
          setIsLoadingDropdowns(false);
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
    setError(null);
    try {
      const data = await apiFetch<TransferListResponse | Transfer[]>("/transfers");
      console.log("API Response:", data);
      // Handle both array response and object with transfers property
      const transfersArray = Array.isArray(data) ? data : (data.transfers || []);
      console.log("Transfers array:", transfersArray);
      setTransfers(transfersArray);
    } catch (err: any) {
      console.error("API Error:", err);
      setError(err.message || "Failed to load");
    } finally {
      setIsLoading(false);
    }
  };

  // Create Transfer form handlers
  const handleCreateFieldChange = (field: string, value: string) => {
    setCreateForm((prev) => ({ ...prev, [field]: value }));
    setFormDirty(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setIsCreating(true);

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

      setShowCreateModal(false);
      setCreateForm({
        asset_id: "",
        to_user_id: "",
        transfer_date: new Date().toISOString().split("T")[0],
        reason: "",
      });
      setFormDirty(false);
      setSuccessMessage("Transfer created. The receiving user can acknowledge it from their transfers view.");
      setTimeout(() => setSuccessMessage(null), 5000);
      fetchTransfers();
    } catch (err: any) {
      setCreateError(err.message || "Failed to create transfer");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateModalClose = () => {
    if (formDirty) {
      setAcknowledgeDialog({ open: true, transferId: null });
    } else {
      setShowCreateModal(false);
      setCreateForm({
        asset_id: "",
        to_user_id: "",
        transfer_date: new Date().toISOString().split("T")[0],
        reason: "",
      });
      setFormDirty(false);
      setCreateError(null);
    }
  };

  const handleConfirmCloseWithoutSaving = () => {
    setAcknowledgeDialog({ open: false, transferId: null });
    setShowCreateModal(false);
    setCreateForm({
      asset_id: "",
      to_user_id: "",
      transfer_date: new Date().toISOString().split("T")[0],
      reason: "",
    });
    setFormDirty(false);
    setCreateError(null);
  };

  // Acknowledge handlers
  const handleAcknowledgeClick = (transferId: number) => {
    setAcknowledgeDialog({ open: true, transferId });
  };

  const handleAcknowledgeConfirm = async () => {
    if (!acknowledgeDialog.transferId) return;

    try {
      await apiFetch(`/transfers/${acknowledgeDialog.transferId}/acknowledge`, {
        method: "PUT",
      });

      setAcknowledgeDialog({ open: false, transferId: null });
      setSuccessMessage("Transfer acknowledged.");
      setTimeout(() => setSuccessMessage(null), 5000);
      fetchTransfers();
    } catch (err: any) {
      // Error handling - could show error in dialog
    }
  };

  // Role check for Create Transfer button
  const canCreateTransfer = user?.role === "Asset Manager" || user?.role === "System Administrator";

  // Filter transfers for display
  const displayedTransfers = transfers.filter((t) => {
    const matchesAssetId = assetIdFilter === "" || t.asset_id.toLowerCase().includes(assetIdFilter.toLowerCase());
    const matchesStatus = statusFilter === "All" || 
      (statusFilter === "Acknowledged" && t.acknowledged_at !== null) ||
      (statusFilter === "Pending" && t.acknowledged_at === null);
    return matchesAssetId && matchesStatus;
  });

  if (isLoading) return <div className="page-loading">Loading transfers...</div>;
  if (error) return <div className="alert-error">Error: {error}</div>;

  return (
    <>
      {successMessage && <SuccessBanner message={successMessage} onDismiss={() => setSuccessMessage(null)} />}

      {/* Filters */}
      <div className="filter-bar">
        <div className="filter-group">
          <label htmlFor="asset-id-filter" className="filter-label">Asset ID</label>
          <input
            id="asset-id-filter"
            type="text"
            className="filter-search"
            placeholder="Filter by Asset ID..."
            value={assetIdFilter}
            onChange={(e) => setAssetIdFilter(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label htmlFor="status-filter" className="filter-label">Status</label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "All" | "Acknowledged" | "Pending")}
            className="filter-select"
          >
            <option value="All">All</option>
            <option value="Acknowledged">Acknowledged</option>
            <option value="Pending">Pending</option>
          </select>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={handleClearFilters}>
          Clear Filters
        </button>
        <div className="filter-count">{displayedTransfers.length} transfers</div>
        {canCreateTransfer && (
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            ➕ Create Transfer
          </button>
        )}
      </div>

      {/* Error state */}
      {error && <ErrorMessage message={error} onRetry={fetchTransfers} />}

      {/* Table */}
      {!error && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Asset Transfers</h2>
            <div className="text-small text-muted">Custody change history</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th>From</th>
                <th>To</th>
                <th>Transfer Date</th>
                <th>Reason</th>
                <th>Authorised By</th>
                <th>Acknowledged</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedTransfers.map((t) => (
                <tr key={t.transfer_id}>
                  <td>
                    <div className="user-name">{t.asset_name}</div>
                    <div className="text-small text-muted">{t.asset_serial}</div>
                  </td>
                  <td>{t.from_user_name}</td>
                  <td>{t.to_user_name}</td>
                  <td className="text-small">{new Date(t.transfer_date).toLocaleDateString()}</td>
                  <td className="text-small" title={t.reason}>
                    {t.reason.length > 60 ? `${t.reason.substring(0, 60)}...` : t.reason}
                  </td>
                  <td>{t.authorised_by_name}</td>
                  <td>
                    {t.acknowledged_at ? (
                      <span className="text-small">{new Date(t.acknowledged_at).toLocaleString()}</span>
                    ) : (
                      <span className="badge badge-warning">Pending</span>
                    )}
                  </td>
                  <td>
                    {/* Acknowledge available to the receiving user or a System Administrator per business rules */}
                    {t.acknowledged_at === null && 
                     (t.to_user_id === parseInt(user?.user_id || "0", 10) || user?.role === "System Administrator") && (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleAcknowledgeClick(t.transfer_id)}
                        title="Acknowledge transfer"
                      >
                        🤝 Acknowledge
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {displayedTransfers.length === 0 && <div className="page-empty">No transfers found</div>}
        </div>
      )}

      {/* Create Transfer Modal */}
      <Modal open={showCreateModal} onClose={handleCreateModalClose} title="Create Transfer">
        <form onSubmit={handleCreateSubmit}>
          {createError && <ErrorMessage message={createError} />}
          
          <div className="form-group">
            <label htmlFor="asset_id" className="form-label">Asset</label>
            <select
              id="asset_id"
              className="form-control"
              value={createForm.asset_id}
              onChange={(e) => handleCreateFieldChange("asset_id", e.target.value)}
              required
            >
              <option value="">Select an asset...</option>
              {assets.map((asset) => (
                <option key={asset.asset_id} value={asset.asset_id}>
                  {asset.asset_name} - {asset.serial_number} ({asset.asset_type})
                </option>
              ))}
            </select>
            <small className="form-helper">Select the asset to transfer</small>
          </div>

          <div className="form-group">
            <label htmlFor="to_user_id" className="form-label">To User</label>
            <select
              id="to_user_id"
              className="form-control"
              value={createForm.to_user_id}
              onChange={(e) => handleCreateFieldChange("to_user_id", e.target.value)}
              required
            >
              <option value="">Select a user...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email}) - {u.role}
                </option>
              ))}
            </select>
            <small className="form-helper">Select the user receiving the asset</small>
          </div>

          <FormInput
            type="date"
            label="Transfer Date"
            value={createForm.transfer_date}
            onChange={(v) => handleCreateFieldChange("transfer_date", v)}
          />
          <FormInput
            type="textarea"
            label="Reason"
            value={createForm.reason}
            onChange={(v) => handleCreateFieldChange("reason", v)}
            helper="Provide a reason for this transfer"
            required
            characterCount={{ current: createForm.reason.length, min: 10 }}
          />
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={handleCreateModalClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isCreating || createForm.reason.trim().length < 10}
            >
              {isCreating ? <LoadingSpinner size="sm" /> : "Create Transfer"}
            </button>
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
    </>
  );
}
