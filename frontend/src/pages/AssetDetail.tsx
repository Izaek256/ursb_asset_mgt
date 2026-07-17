import React from "react";
import Button from "../components/common/Button";
import { apiFetch, useAuth } from "../AuthContext";
import type { AssetDetail } from "../types";
import ConfirmDialog from "../components/ConfirmDialog";

const STATUS_CLASS: Record<string, string> = {
  Available: "badge-info",
  Reserved: "badge-warning",
  "Pending Acceptance": "badge-warning",
  "Pending Pickup": "badge-warning",
  Assigned: "badge-active",
  "Under Transfer": "badge-warning",
  "Under Maintenance": "badge-warning",
  Returned: "badge-warning",
  Disposed: "badge-inactive",
  Deactivated: "badge-inactive",
};

const CONDITION_CLASS: Record<string, string> = {
  New: "badge-active",
  Good: "badge-info",
  Refurbished: "badge-warning",
  Damaged: "badge-inactive",
};

export default function AssetDetail() {
  const { token, user } = useAuth();
  const [assetId, setAssetId] = React.useState<string>("");
  const [asset, setAsset] = React.useState<AssetDetail | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  // Edit mode
  const [isEditing, setIsEditing] = React.useState(false);
  const [editForm, setEditForm] = React.useState<Partial<AssetDetail>>({});
  const [editError, setEditError] = React.useState<string | null>(null);

  // Disposal dialog
  const [showDisposeDialog, setShowDisposeDialog] = React.useState(false);
  const [disposalReason, setDisposalReason] = React.useState("");
  const [disposalError, setDisposalError] = React.useState<string | null>(null);
  const [isDisposing, setIsDisposing] = React.useState(false);

  // Deactivate dialog
  const [showDeactivateDialog, setShowDeactivateDialog] = React.useState(false);
  const [isDeactivating, setIsDeactivating] = React.useState(false);

  // Disposal recommendation state
  const [showRecommendDialog, setShowRecommendDialog] = React.useState(false);
  const [recommendReason, setRecommendReason] = React.useState("");
  const [recommendError, setRecommendError] = React.useState<string | null>(null);
  const [isRecommending, setIsRecommending] = React.useState(false);

  // Pending recommendation for Asset Manager view
  const [pendingDisposal, setPendingDisposal] = React.useState<any>(null);
  const [showApproveDialog, setShowApproveDialog] = React.useState(false);
  const [showRejectDialog, setShowRejectDialog] = React.useState(false);
  const [approvalMethod, setApprovalMethod] = React.useState("Write-off");
  const [approvalDate, setApprovalDate] = React.useState("");
  const [rejectReason, setRejectReason] = React.useState("");
  const [isActioning, setIsActioning] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  // Active tab
  const [activeTab, setActiveTab] = React.useState<1 | 2 | 3 | 4>(1);

  // Extract asset_id from URL
  React.useEffect(() => {
    const pathParts = window.location.pathname.split("/");
    const id = pathParts[pathParts.length - 1];
    if (id && id !== "assets") {
      setAssetId(id);
    }
  }, []);

  // Fetch asset detail
  React.useEffect(() => {
    if (!assetId) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    apiFetch<AssetDetail>(`/assets/${assetId}`, {}, token)
      .then((data) => {
        if (!cancelled) {
          setAsset(data);
          setEditForm(data);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load asset");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [assetId, token]);

  // Fetch pending disposal recommendation for Asset Manager view
  React.useEffect(() => {
    if (!assetId || !user) return;
    if (
      user.role !== "Asset Manager" && user.role !== "ASSET_MANAGER" &&
      user.role !== "System Administrator" && user.role !== "SYSTEM_ADMINISTRATOR" &&
      user.role !== "SUPER_SYSTEM_ADMINISTRATOR"
    ) return;

    apiFetch<any>(`/disposals?asset_id=${assetId}&status=Recommended`, {}, token)
      .then((data) => {
        if (data?.disposals?.length > 0) {
          setPendingDisposal(data.disposals[0]);
        } else {
          setPendingDisposal(null);
        }
      })
      .catch(() => setPendingDisposal(null));
  }, [assetId, token, user]);

  const handleSaveEdit = async () => {
    if (!asset) return;
    // Only include changed fields
    const changes: Record<string, any> = {};
    if (editForm.asset_name !== asset.asset_name) changes.asset_name = editForm.asset_name;
    if (editForm.category !== asset.category) changes.category = editForm.category;
    if (editForm.condition !== asset.condition) changes.condition = editForm.condition;
    if (editForm.status !== asset.status) changes.status = editForm.status;
    if (editForm.department !== asset.department) changes.department = editForm.department;
    if (editForm.supplier !== asset.supplier) changes.supplier = editForm.supplier;
    if (editForm.procurement_ref !== asset.procurement_ref) changes.procurement_ref = editForm.procurement_ref;
    if (editForm.cost !== asset.cost) changes.cost = editForm.cost;

    if (Object.keys(changes).length === 0) {
      setIsEditing(false);
      return;
    }

    setEditError(null);
    try {
      await apiFetch<AssetDetail>(`/assets/${assetId}`, {
        method: "PUT",
        body: JSON.stringify(changes),
      }, token);
      setSuccessMessage("Asset updated successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
      setIsEditing(false);
      // Re-fetch asset
      const updated = await apiFetch<AssetDetail>(`/assets/${assetId}`, {}, token);
      setAsset(updated);
      setEditForm(updated);
    } catch (err: any) {
      setEditError(err.message || "Failed to update asset");
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm(asset || {});
    setEditError(null);
  };

  const handleDeactivate = async () => {
    if (!assetId) return;
    setIsDeactivating(true);
    try {
      await apiFetch(`/assets/${assetId}/deactivate`, {
        method: "PATCH",
      }, token);
      setSuccessMessage("Asset deactivated successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
      setShowDeactivateDialog(false);
      // Re-fetch asset
      const updated = await apiFetch<AssetDetail>(`/assets/${assetId}`, {}, token);
      setAsset(updated);
      setEditForm(updated);
    } catch (err: any) {
      setEditError(err.message || "Failed to deactivate asset");
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleReactivate = async () => {
    if (!assetId) return;
    try {
      await apiFetch(`/assets/${assetId}/reactivate`, {
        method: "PATCH",
      }, token);
      setSuccessMessage("Asset reactivated successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
      // Re-fetch asset
      const updated = await apiFetch<AssetDetail>(`/assets/${assetId}`, {}, token);
      setAsset(updated);
      setEditForm(updated);
    } catch (err: any) {
      setEditError(err.message || "Failed to reactivate asset");
    }
  };

  const handleDispose = async () => {
    if (!assetId || disposalReason.length < 10) return;
    setIsDisposing(true);
    setDisposalError(null);
    try {
      await apiFetch("/disposals", {
        method: "POST",
        body: JSON.stringify({
          asset_id: assetId,
          disposal_method: "Write-off",
          reason: disposalReason,
        }),
      }, token);
      setSuccessMessage("Asset disposed successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
      setShowDisposeDialog(false);
      setDisposalReason("");
      // Re-fetch asset
      const updated = await apiFetch<AssetDetail>(`/assets/${assetId}`, {}, token);
      setAsset(updated);
      setEditForm(updated);
    } catch (err: any) {
      setDisposalError(err.message || "Failed to dispose asset");
    } finally {
      setIsDisposing(false);
    }
  };

  const handleRecommend = async () => {
    if (!assetId || recommendReason.length < 10) return;
    setIsRecommending(true);
    setRecommendError(null);
    try {
      await apiFetch(`/assets/${assetId}/recommend-disposal`, {
        method: "POST",
        body: JSON.stringify({ reason: recommendReason }),
      }, token);
      setSuccessMessage("Disposal recommendation submitted successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
      setShowRecommendDialog(false);
      setRecommendReason("");
      const updated = await apiFetch<AssetDetail>(`/assets/${assetId}`, {}, token);
      setAsset(updated);
      setEditForm(updated);
    } catch (err: any) {
      setRecommendError(err.message || "Failed to submit recommendation");
    } finally {
      setIsRecommending(false);
    }
  };

  const handleApprove = async () => {
    if (!pendingDisposal || !approvalDate) return;
    setIsActioning(true);
    setActionError(null);
    try {
      await apiFetch(`/disposals/${pendingDisposal.disposal_id}/approve`, {
        method: "POST",
        body: JSON.stringify({
          disposal_method: approvalMethod,
          disposal_date: approvalDate,
        }),
      }, token);
      setSuccessMessage("Disposal approved successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
      setShowApproveDialog(false);
      setPendingDisposal(null);
      const updated = await apiFetch<AssetDetail>(`/assets/${assetId}`, {}, token);
      setAsset(updated);
      setEditForm(updated);
    } catch (err: any) {
      setActionError(err.message || "Failed to approve disposal");
    } finally {
      setIsActioning(false);
    }
  };

  const handleReject = async () => {
    if (!pendingDisposal || rejectReason.length < 5) return;
    setIsActioning(true);
    setActionError(null);
    try {
      await apiFetch(`/disposals/${pendingDisposal.disposal_id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: rejectReason }),
      }, token);
      setSuccessMessage("Disposal recommendation rejected");
      setTimeout(() => setSuccessMessage(null), 3000);
      setShowRejectDialog(false);
      setPendingDisposal(null);
      const updated = await apiFetch<AssetDetail>(`/assets/${assetId}`, {}, token);
      setAsset(updated);
      setEditForm(updated);
    } catch (err: any) {
      setActionError(err.message || "Failed to reject disposal");
    } finally {
      setIsActioning(false);
    }
  };

  const canEdit = 
    user?.role === "Asset Manager" || user?.role === "ASSET_MANAGER" ||
    user?.role === "System Administrator" || user?.role === "SYSTEM_ADMINISTRATOR" ||
    user?.role === "SUPER_SYSTEM_ADMINISTRATOR";

  if (isLoading) {
    return <div className="page-loading">Loading asset details...</div>;
  }

  if (error || !asset) {
    return (
      <div className="page-error">
        <div className="alert-error">{error || "Asset not found"}</div>
        <button className="btn btn-secondary" onClick={() => window.history.back()}>
          ← Back to Assets
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
      {successMessage && (
        <div style={{
          backgroundColor: "#10b981",
          color: "white",
          padding: "12px 16px",
          borderRadius: "8px",
          marginBottom: "24px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}>
          <span>✓</span>
          <span>{successMessage}</span>
        </div>
      )}

      {/* Header */}
      <div style={{
        marginBottom: "32px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        flexWrap: "wrap",
        gap: "16px",
      }}>
        <div>
          <button
            onClick={() => window.history.back()}
            style={{
              background: "none",
              border: "none",
              color: "#64748b",
              cursor: "pointer",
              fontSize: "14px",
              marginBottom: "12px",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            ← Back to Assets
          </button>
          <h1 style={{
            fontSize: "28px",
            fontWeight: "600",
            color: "#1e293b",
            margin: "0 0 8px 0",
          }}>
            {asset.asset_name}
          </h1>
          <div style={{
            display: "flex",
            gap: "16px",
            color: "#64748b",
            fontSize: "14px",
          }}>
            <span>ID: {asset.asset_id}</span>
            <span>•</span>
            <span>{asset.asset_type}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {canEdit && (
            <>
              {asset.is_active ? (
                <Button
                  variant="danger-outline"
                  onClick={() => setShowDeactivateDialog(true)}
                >
                  Deactivate
                </Button>
              ) : (
                <Button
                  variant="success"
                  onClick={handleReactivate}
                >
                  Reactivate
                </Button>
              )}
              <Button
                variant={isEditing ? "danger-outline" : "primary"}
                onClick={() => setIsEditing(!isEditing)}
              >
                {isEditing ? "Cancel" : "Edit Asset"}
              </Button>
              <Button
                variant="danger-outline"
                onClick={() => setShowDisposeDialog(true)}
                disabled={asset.status === "Disposed"}
              >
                Dispose Asset
              </Button>
            </>
          )}

          {/* Custodian: Recommend Disposal button */}
          {(user?.role === "Asset Custodian" || user?.role === "ASSET_CUSTODIAN") &&
            asset.status !== "Disposed" &&
            asset.is_active && (
            <Button
              variant="danger-outline"
              onClick={() => setShowRecommendDialog(true)}
            >
              Recommend Disposal
            </Button>
          )}

          {/* Asset Manager: Approve/Reject buttons */}
          {(user?.role === "Asset Manager" || user?.role === "ASSET_MANAGER" ||
            user?.role === "System Administrator" || user?.role === "SYSTEM_ADMINISTRATOR" ||
            user?.role === "SUPER_SYSTEM_ADMINISTRATOR") &&
            pendingDisposal && asset.status !== "Disposed" && (
            <>
              <Button
                variant="success"
                onClick={() => setShowApproveDialog(true)}
              >
                Approve Disposal
              </Button>
              <Button
                variant="danger-outline"
                onClick={() => setShowRejectDialog(true)}
              >
                Reject
              </Button>
            </>
          )}

        </div>
      </div>

      {/* Status badges */}
      <div style={{
        display: "flex",
        gap: "12px",
        marginBottom: "32px",
        flexWrap: "wrap",
      }}>
        <span style={{
          padding: "6px 12px",
          borderRadius: "20px",
          fontSize: "13px",
          fontWeight: "500",
          background: STATUS_CLASS[asset.status] === "badge-active" ? "#dcfce7" :
                     STATUS_CLASS[asset.status] === "badge-info" ? "#dbeafe" :
                     STATUS_CLASS[asset.status] === "badge-warning" ? "#fef3c7" : "#fee2e2",
          color: STATUS_CLASS[asset.status] === "badge-active" ? "#166534" :
                 STATUS_CLASS[asset.status] === "badge-info" ? "#1e40af" :
                 STATUS_CLASS[asset.status] === "badge-warning" ? "#92400e" : "#991b1b",
        }}>
          {asset.status}
        </span>
        <span style={{
          padding: "6px 12px",
          borderRadius: "20px",
          fontSize: "13px",
          fontWeight: "500",
          background: CONDITION_CLASS[asset.condition] === "badge-active" ? "#dcfce7" :
                     CONDITION_CLASS[asset.condition] === "badge-info" ? "#dbeafe" :
                     CONDITION_CLASS[asset.condition] === "badge-warning" ? "#fef3c7" : "#fee2e2",
          color: CONDITION_CLASS[asset.condition] === "badge-active" ? "#166534" :
                 CONDITION_CLASS[asset.condition] === "badge-info" ? "#1e40af" :
                 CONDITION_CLASS[asset.condition] === "badge-warning" ? "#92400e" : "#991b1b",
        }}>
          {asset.condition}
        </span>
        <span style={{
          padding: "6px 12px",
          borderRadius: "20px",
          fontSize: "13px",
          fontWeight: "500",
          background: asset.is_active ? "#dcfce7" : "#fee2e2",
          color: asset.is_active ? "#166534" : "#991b1b",
        }}>
          {asset.is_active ? "Active" : "Inactive"}
        </span>
      </div>

      {/* Main content */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "24px" }}>
        {/* Asset Information */}
        <div style={{
          background: "white",
          borderRadius: "12px",
          border: "1px solid #e2e8f0",
          overflow: "hidden",
        }}>
          <div style={{
            padding: "20px 24px",
            borderBottom: "1px solid #e2e8f0",
            background: "#f8fafc",
          }}>
            <h2 style={{
              fontSize: "18px",
              fontWeight: "600",
              color: "#1e293b",
              margin: 0,
            }}>
              Asset Information
            </h2>
          </div>
          <div style={{ padding: "24px" }}>
            {isEditing ? (
              <div>
                {editError && (
                  <div style={{
                    backgroundColor: "#fee2e2",
                    color: "#991b1b",
                    padding: "12px 16px",
                    borderRadius: "8px",
                    marginBottom: "16px",
                  }}>
                    {editError}
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "20px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "14px", fontWeight: "500", color: "#475569", marginBottom: "6px" }}>
                      Asset Name
                    </label>
                    <input
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                        fontSize: "14px",
                      }}
                      value={editForm.asset_name || ""}
                      onChange={(e) => setEditForm({ ...editForm, asset_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "14px", fontWeight: "500", color: "#475569", marginBottom: "6px" }}>
                      Category
                    </label>
                    <input
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                        fontSize: "14px",
                      }}
                      value={editForm.category || ""}
                      onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "14px", fontWeight: "500", color: "#475569", marginBottom: "6px" }}>
                      Condition
                    </label>
                    <select
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                        fontSize: "14px",
                      }}
                      value={editForm.condition || ""}
                      onChange={(e) => setEditForm({ ...editForm, condition: e.target.value })}
                    >
                      <option value="New">New</option>
                      <option value="Good">Good</option>
                      <option value="Refurbished">Refurbished</option>
                      <option value="Damaged">Damaged</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "14px", fontWeight: "500", color: "#475569", marginBottom: "6px" }}>
                      Status
                    </label>
                    <select
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                        fontSize: "14px",
                      }}
                      value={editForm.status || ""}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    >
                      <option value="Available">Available</option>
                      <option value="Reserved">Reserved</option>
                      <option value="Pending Acceptance">Pending Acceptance</option>
                      <option value="Pending Pickup">Pending Pickup</option>
                      <option value="Assigned">Assigned</option>
                      <option value="Under Transfer">Under Transfer</option>
                      <option value="Under Maintenance">Under Maintenance</option>
                      <option value="Returned">Returned</option>
                      {asset.status === "Disposed" && <option value="Disposed">Disposed</option>}
                      {asset.status === "Deactivated" && <option value="Deactivated">Deactivated</option>}
                    </select>
                    {(editForm.status === "Disposed" || editForm.status === "Deactivated") && (
                      <div style={{
                        backgroundColor: "#fef3c7",
                        color: "#92400e",
                        padding: "8px 12px",
                        borderRadius: "6px",
                        marginTop: "8px",
                        fontSize: "13px",
                      }}>
                        Warning: {editForm.status} is a terminal state. No further changes will be allowed.
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "14px", fontWeight: "500", color: "#475569", marginBottom: "6px" }}>
                      Department
                    </label>
                    <input
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                        fontSize: "14px",
                      }}
                      value={editForm.department || ""}
                      onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "14px", fontWeight: "500", color: "#475569", marginBottom: "6px" }}>
                      Supplier
                    </label>
                    <input
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                        fontSize: "14px",
                      }}
                      value={editForm.supplier || ""}
                      onChange={(e) => setEditForm({ ...editForm, supplier: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "14px", fontWeight: "500", color: "#475569", marginBottom: "6px" }}>
                      Cost (UGX)
                    </label>
                    <input
                      type="number"
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                        fontSize: "14px",
                      }}
                      value={editForm.cost || 0}
                      onChange={(e) => setEditForm({ ...editForm, cost: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "14px", fontWeight: "500", color: "#475569", marginBottom: "6px" }}>
                      Procurement Ref
                    </label>
                    <input
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                        fontSize: "14px",
                      }}
                      value={editForm.procurement_ref || ""}
                      onChange={(e) => setEditForm({ ...editForm, procurement_ref: e.target.value })}
                    />
                  </div>
                </div>
                <div style={{ marginTop: "24px", display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                  <button
                    onClick={handleCancelEdit}
                    style={{
                      padding: "10px 20px",
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                      background: "white",
                      color: "#475569",
                      cursor: "pointer",
                      fontSize: "14px",
                      fontWeight: "500",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    style={{
                      padding: "10px 20px",
                      borderRadius: "8px",
                      border: "none",
                      background: "#3b82f6",
                      color: "white",
                      cursor: "pointer",
                      fontSize: "14px",
                      fontWeight: "500",
                    }}
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px" }}>
                <div style={{ padding: "16px", background: "#f8fafc", borderRadius: "8px" }}>
                  <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>Asset ID</div>
                  <div style={{ fontSize: "15px", fontWeight: "500", color: "#1e293b" }}>{asset.asset_id}</div>
                </div>
                <div style={{ padding: "16px", background: "#f8fafc", borderRadius: "8px" }}>
                  <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>Serial Number</div>
                  <div style={{ fontSize: "15px", fontWeight: "500", color: "#1e293b" }}>{asset.serial_number}</div>
                </div>
                <div style={{ padding: "16px", background: "#f8fafc", borderRadius: "8px" }}>
                  <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>Asset Type</div>
                  <div style={{ fontSize: "15px", fontWeight: "500", color: "#1e293b" }}>{asset.asset_type}</div>
                </div>
                <div style={{ padding: "16px", background: "#f8fafc", borderRadius: "8px" }}>
                  <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>Category</div>
                  <div style={{ fontSize: "15px", fontWeight: "500", color: "#1e293b" }}>{asset.category}</div>
                </div>
                <div style={{ padding: "16px", background: "#f8fafc", borderRadius: "8px" }}>
                  <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>Condition</div>
                  <div style={{ fontSize: "15px", fontWeight: "500", color: "#1e293b" }}>{asset.condition}</div>
                </div>
                <div style={{ padding: "16px", background: "#f8fafc", borderRadius: "8px" }}>
                  <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>Status</div>
                  <div style={{ fontSize: "15px", fontWeight: "500", color: "#1e293b" }}>{asset.status}</div>
                </div>
                <div style={{ padding: "16px", background: "#f8fafc", borderRadius: "8px" }}>
                  <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>Source Type</div>
                  <div style={{ fontSize: "15px", fontWeight: "500", color: "#1e293b" }}>{asset.source_type}</div>
                </div>
                <div style={{ padding: "16px", background: "#f8fafc", borderRadius: "8px" }}>
                  <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>Cost</div>
                  <div style={{ fontSize: "15px", fontWeight: "500", color: "#1e293b" }}>{asset.cost.toLocaleString()} UGX</div>
                </div>
                <div style={{ padding: "16px", background: "#f8fafc", borderRadius: "8px" }}>
                  <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>Acquisition Date</div>
                  <div style={{ fontSize: "15px", fontWeight: "500", color: "#1e293b" }}>{asset.acquisition_date}</div>
                </div>
                <div style={{ padding: "16px", background: "#f8fafc", borderRadius: "8px" }}>
                  <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>Supplier</div>
                  <div style={{ fontSize: "15px", fontWeight: "500", color: "#1e293b" }}>{asset.supplier}</div>
                </div>
                <div style={{ padding: "16px", background: "#f8fafc", borderRadius: "8px" }}>
                  <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>Department</div>
                  <div style={{ fontSize: "15px", fontWeight: "500", color: "#1e293b" }}>{asset.department || "—"}</div>
                </div>
                <div style={{ padding: "16px", background: "#f8fafc", borderRadius: "8px" }}>
                  <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>Procurement Ref</div>
                  <div style={{ fontSize: "15px", fontWeight: "500", color: "#1e293b" }}>{asset.procurement_ref || "—"}</div>
                </div>
                {asset.current_custodian && (
                  <div style={{ padding: "16px", background: "#f8fafc", borderRadius: "8px", gridColumn: "1 / -1" }}>
                    <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>Current Custodian</div>
                    <div style={{ fontSize: "15px", fontWeight: "500", color: "#1e293b" }}>
                      {asset.current_custodian.first_name} {asset.current_custodian.last_name}
                      <span style={{ fontSize: "13px", color: "#64748b", marginLeft: "8px" }}>
                        ({asset.current_custodian.email})
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* History Tabs */}
        <div style={{
          background: "white",
          borderRadius: "12px",
          border: "1px solid #e2e8f0",
          overflow: "hidden",
        }}>
          <div style={{
            padding: "20px 24px",
            borderBottom: "1px solid #e2e8f0",
            background: "#f8fafc",
          }}>
            <h2 style={{
              fontSize: "18px",
              fontWeight: "600",
              color: "#1e293b",
              margin: 0,
            }}>
              History
            </h2>
          </div>
          <div style={{ padding: "24px" }}>
            <div style={{
              display: "flex",
              gap: "4px",
              borderBottom: "1px solid #e2e8f0",
              marginBottom: "20px",
            }}>
              <button
                onClick={() => setActiveTab(1)}
                style={{
                  padding: "10px 16px",
                  borderRadius: "6px 6px 0 0",
                  border: "none",
                  background: activeTab === 1 ? "#3b82f6" : "transparent",
                  color: activeTab === 1 ? "white" : "#64748b",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "500",
                  borderBottom: activeTab === 1 ? "2px solid #3b82f6" : "2px solid transparent",
                  marginBottom: "-1px",
                }}
              >
                Assignments ({asset.assignment_history.length})
              </button>
              <button
                onClick={() => setActiveTab(2)}
                style={{
                  padding: "10px 16px",
                  borderRadius: "6px 6px 0 0",
                  border: "none",
                  background: activeTab === 2 ? "#3b82f6" : "transparent",
                  color: activeTab === 2 ? "white" : "#64748b",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "500",
                  borderBottom: activeTab === 2 ? "2px solid #3b82f6" : "2px solid transparent",
                  marginBottom: "-1px",
                }}
              >
                Maintenance ({asset.maintenance_history.length})
              </button>
              <button
                onClick={() => setActiveTab(3)}
                style={{
                  padding: "10px 16px",
                  borderRadius: "6px 6px 0 0",
                  border: "none",
                  background: activeTab === 3 ? "#3b82f6" : "transparent",
                  color: activeTab === 3 ? "white" : "#64748b",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "500",
                  borderBottom: activeTab === 3 ? "2px solid #3b82f6" : "2px solid transparent",
                  marginBottom: "-1px",
                }}
              >
                Transfers ({asset.transfer_history.length})
              </button>
              {asset.status === "Disposed" && (
                <button
                  onClick={() => setActiveTab(4)}
                  style={{
                    padding: "10px 16px",
                    borderRadius: "6px 6px 0 0",
                    border: "none",
                    background: activeTab === 4 ? "#3b82f6" : "transparent",
                    color: activeTab === 4 ? "white" : "#64748b",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "500",
                    borderBottom: activeTab === 4 ? "2px solid #3b82f6" : "2px solid transparent",
                    marginBottom: "-1px",
                  }}
                >
                  Disposal
                </button>
              )}
            </div>

            {activeTab === 1 && (
              <div>
                {asset.assignment_history.length === 0 ? (
                  <div style={{
                    textAlign: "center",
                    padding: "40px",
                    color: "#64748b",
                  }}>
                    No assignment history
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {asset.assignment_history.map((entry) => (
                      <div key={entry.assignment_id} style={{
                        padding: "16px",
                        background: "#f8fafc",
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                          <span style={{ fontSize: "15px", fontWeight: "500", color: "#1e293b" }}>
                            Assigned to: {entry.assigned_to_name || "Unknown"}
                          </span>
                          <span style={{
                            padding: "4px 10px",
                            borderRadius: "12px",
                            fontSize: "12px",
                            fontWeight: "500",
                            background: entry.status === "Active" ? "#dcfce7" : "#dbeafe",
                            color: entry.status === "Active" ? "#166534" : "#1e40af",
                          }}>
                            {entry.status}
                          </span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <div style={{ fontSize: "13px", color: "#64748b" }}>
                            Assigned by: {entry.assigned_by_name || "Unknown"}
                          </div>
                          <div style={{ fontSize: "13px", color: "#64748b" }}>
                            Date: {entry.assignment_date}
                          </div>
                          {entry.return_date && (
                            <div style={{ fontSize: "13px", color: "#64748b" }}>
                              Returned: {entry.return_date}
                            </div>
                          )}
                          {entry.notes && (
                            <div style={{ fontSize: "13px", color: "#64748b" }}>
                              Notes: {entry.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 2 && (
              <div>
                {asset.maintenance_history.length === 0 ? (
                  <div style={{
                    textAlign: "center",
                    padding: "40px",
                    color: "#64748b",
                  }}>
                    No maintenance history
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {asset.maintenance_history.map((entry) => (
                      <div key={entry.maintenance_id} style={{
                        padding: "16px",
                        background: "#f8fafc",
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                          <span style={{ fontSize: "15px", fontWeight: "500", color: "#1e293b" }}>
                            {entry.service_provider}
                          </span>
                          <span style={{ fontSize: "13px", color: "#64748b" }}>{entry.service_date}</span>
                        </div>
                        <div style={{ marginBottom: "8px" }}>{entry.description}</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <div style={{ fontSize: "13px", color: "#64748b" }}>
                            Cost: {entry.cost.toLocaleString()} UGX
                          </div>
                          {entry.next_service_date && (
                            <div style={{ fontSize: "13px", color: "#64748b" }}>
                              Next service: {entry.next_service_date}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 3 && (
              <div>
                {asset.transfer_history.length === 0 ? (
                  <div style={{
                    textAlign: "center",
                    padding: "40px",
                    color: "#64748b",
                  }}>
                    No transfer history
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {asset.transfer_history.map((entry) => (
                      <div key={entry.transfer_id} style={{
                        padding: "16px",
                        background: "#f8fafc",
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                          <span style={{ fontSize: "15px", fontWeight: "500", color: "#1e293b" }}>
                            {entry.from_user_name || "Unknown"} → {entry.to_user_name || "Unknown"}
                          </span>
                          <span style={{ fontSize: "13px", color: "#64748b" }}>{entry.transfer_date}</span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <div style={{ fontSize: "13px", color: "#64748b" }}>Reason: {entry.reason}</div>
                          {entry.acknowledged_at && (
                            <div style={{ fontSize: "13px", color: "#64748b" }}>
                              Acknowledged: {entry.acknowledged_at}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 4 && asset.disposal_record && (
              <div style={{
                padding: "16px",
                background: "#fef2f2",
                borderRadius: "8px",
                border: "1px solid #fecaca",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontSize: "15px", fontWeight: "500", color: "#991b1b" }}>
                    {asset.disposal_record.disposal_method}
                  </span>
                  <span style={{ fontSize: "13px", color: "#64748b" }}>{asset.disposal_record.disposal_date}</span>
                </div>
                <div style={{ marginBottom: "8px" }}>{asset.disposal_record.reason}</div>
                <div style={{ fontSize: "13px", color: "#64748b" }}>
                  Authorised by: {asset.disposal_record.authorised_by_name}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Deactivate Dialog */}
      <ConfirmDialog
        open={showDeactivateDialog}
        title="Deactivate Asset"
        message="Are you sure you want to deactivate this asset? It will not be available for assignment, transfer, or disposal."
        onConfirm={handleDeactivate}
        onCancel={() => setShowDeactivateDialog(false)}
        isLoading={isDeactivating}
      />

      {/* Disposal Dialog */}
      {showDisposeDialog && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}>
          <div style={{
            background: "white",
            borderRadius: "12px",
            maxWidth: "500px",
            width: "90%",
            maxHeight: "90vh",
            overflow: "auto",
          }}>
            <div style={{
              padding: "20px 24px",
              borderBottom: "1px solid #e2e8f0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <h3 style={{
                fontSize: "18px",
                fontWeight: "600",
                color: "#1e293b",
                margin: 0,
              }}>
                Dispose Asset
              </h3>
              <button
                onClick={() => {
                  setShowDisposeDialog(false);
                  setDisposalReason("");
                  setDisposalError(null);
                }}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "24px",
                  color: "#64748b",
                  cursor: "pointer",
                  padding: 0,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
            <div style={{ padding: "24px" }}>
              <div style={{ marginBottom: "16px" }}>
                <label style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#475569",
                  marginBottom: "6px",
                }}>
                  Reason for disposal (min. 10 characters)
                </label>
                <textarea
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    fontSize: "14px",
                    minHeight: "100px",
                    resize: "vertical",
                  }}
                  value={disposalReason}
                  onChange={(e) => setDisposalReason(e.target.value)}
                  placeholder="Explain why this asset is being disposed..."
                />
              </div>
              {disposalError && (
                <div style={{
                  backgroundColor: "#fee2e2",
                  color: "#991b1b",
                  padding: "12px 16px",
                  borderRadius: "8px",
                  marginBottom: "16px",
                }}>
                  {disposalError}
                </div>
              )}
            </div>
            <div style={{
              padding: "16px 24px",
              borderTop: "1px solid #e2e8f0",
              display: "flex",
              justifyContent: "flex-end",
              gap: "12px",
            }}>
              <button
                onClick={() => {
                  setShowDisposeDialog(false);
                  setDisposalReason("");
                  setDisposalError(null);
                }}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  background: "white",
                  color: "#475569",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "500",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDispose}
                disabled={disposalReason.length < 10 || isDisposing}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "none",
                  background: disposalReason.length < 10 || isDisposing ? "#cbd5e1" : "#ef4444",
                  color: "white",
                  cursor: disposalReason.length < 10 || isDisposing ? "not-allowed" : "pointer",
                  fontSize: "14px",
                  fontWeight: "500",
                }}
              >
                {isDisposing ? "Disposing..." : "Confirm Disposal"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recommend Disposal Modal */}
      {showRecommendDialog && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "white", borderRadius: "12px", maxWidth: "500px", width: "90%", overflow: "auto" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "600", color: "#1e293b", margin: 0 }}>Recommend Disposal</h3>
              <button onClick={() => { setShowRecommendDialog(false); setRecommendReason(""); setRecommendError(null); }} style={{ background: "none", border: "none", fontSize: "24px", color: "#64748b", cursor: "pointer" }}>×</button>
            </div>
            <div style={{ padding: "24px" }}>
              {/* Reason field for disposal recommendation */}
              <label style={{ display: "block", fontSize: "14px", fontWeight: "500", color: "#475569", marginBottom: "6px" }}>
                Reason for recommending disposal (min. 10 characters)
              </label>
              <textarea
                style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "14px", minHeight: "100px", resize: "vertical" }}
                value={recommendReason}
                onChange={(e) => setRecommendReason(e.target.value)}
                placeholder="Explain why this asset should be disposed..."
              />
              {recommendError && <div style={{ backgroundColor: "#fee2e2", color: "#991b1b", padding: "12px", borderRadius: "8px", marginTop: "12px" }}>{recommendError}</div>}
            </div>
            <div style={{ padding: "16px 24px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button onClick={() => { setShowRecommendDialog(false); setRecommendReason(""); setRecommendError(null); }} style={{ padding: "10px 20px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "white", color: "#475569", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleRecommend} disabled={recommendReason.length < 10 || isRecommending} style={{ padding: "10px 20px", borderRadius: "8px", border: "none", background: recommendReason.length < 10 || isRecommending ? "#cbd5e1" : "#ef4444", color: "white", cursor: recommendReason.length < 10 || isRecommending ? "not-allowed" : "pointer" }}>
                {isRecommending ? "Submitting..." : "Submit Recommendation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approve Disposal Modal */}
      {showApproveDialog && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "white", borderRadius: "12px", maxWidth: "500px", width: "90%", overflow: "auto" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "600", color: "#1e293b", margin: 0 }}>Approve Disposal</h3>
              <button onClick={() => { setShowApproveDialog(false); setActionError(null); }} style={{ background: "none", border: "none", fontSize: "24px", color: "#64748b", cursor: "pointer" }}>×</button>
            </div>
            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Disposal method dropdown — calls POST /disposals/{id}/approve */}
              <div>
                <label style={{ display: "block", fontSize: "14px", fontWeight: "500", color: "#475569", marginBottom: "6px" }}>Disposal Method</label>
                <select value={approvalMethod} onChange={(e) => setApprovalMethod(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "14px" }}>
                  <option value="Sale">Sale</option>
                  <option value="Write-off">Write-off</option>
                  <option value="Donation">Donation</option>
                  <option value="Destruction">Destruction</option>
                </select>
              </div>
              {/* Disposal date picker */}
              <div>
                <label style={{ display: "block", fontSize: "14px", fontWeight: "500", color: "#475569", marginBottom: "6px" }}>Disposal Date</label>
                <input type="date" value={approvalDate} onChange={(e) => setApprovalDate(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "14px" }} />
              </div>
              {actionError && <div style={{ backgroundColor: "#fee2e2", color: "#991b1b", padding: "12px", borderRadius: "8px" }}>{actionError}</div>}
            </div>
            <div style={{ padding: "16px 24px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button onClick={() => { setShowApproveDialog(false); setActionError(null); }} style={{ padding: "10px 20px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "white", color: "#475569", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleApprove} disabled={!approvalDate || isActioning} style={{ padding: "10px 20px", borderRadius: "8px", border: "none", background: !approvalDate || isActioning ? "#cbd5e1" : "#10b981", color: "white", cursor: !approvalDate || isActioning ? "not-allowed" : "pointer" }}>
                {isActioning ? "Approving..." : "Confirm Approval"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Disposal Modal */}
      {showRejectDialog && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "white", borderRadius: "12px", maxWidth: "500px", width: "90%", overflow: "auto" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "600", color: "#1e293b", margin: 0 }}>Reject Disposal Recommendation</h3>
              <button onClick={() => { setShowRejectDialog(false); setRejectReason(""); setActionError(null); }} style={{ background: "none", border: "none", fontSize: "24px", color: "#64748b", cursor: "pointer" }}>×</button>
            </div>
            <div style={{ padding: "24px" }}>
              {/* Rejection reason — required per spec, manager must explain decision */}
              <label style={{ display: "block", fontSize: "14px", fontWeight: "500", color: "#475569", marginBottom: "6px" }}>
                Reason for rejection (min. 5 characters)
              </label>
              <textarea
                style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "14px", minHeight: "100px", resize: "vertical" }}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain why this disposal recommendation is being rejected..."
              />
              {actionError && <div style={{ backgroundColor: "#fee2e2", color: "#991b1b", padding: "12px", borderRadius: "8px", marginTop: "12px" }}>{actionError}</div>}
            </div>
            <div style={{ padding: "16px 24px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button onClick={() => { setShowRejectDialog(false); setRejectReason(""); setActionError(null); }} style={{ padding: "10px 20px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "white", color: "#475569", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleReject} disabled={rejectReason.length < 5 || isActioning} style={{ padding: "10px 20px", borderRadius: "8px", border: "none", background: rejectReason.length < 5 || isActioning ? "#cbd5e1" : "#ef4444", color: "white", cursor: rejectReason.length < 5 || isActioning ? "not-allowed" : "pointer" }}>
                {isActioning ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
