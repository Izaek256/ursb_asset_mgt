import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAssets } from "../services/assetService";
import type { AssetResponse } from "../types/asset";
import { useAuth } from "../context/AuthContext";

export default function AssetList() {
  const { user, signOut } = useAuth();
  const [assets, setAssets] = useState<AssetResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchAssets = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getAssets();
      setAssets(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load assets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem", fontFamily: "system-ui" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ margin: 0 }}>Assets</h1>
          <p style={{ color: "#666", margin: "0.25rem 0 0" }}>
            Signed in as {user?.email} ({user?.role ?? "no role"})
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          {user?.role === "Asset Manager" && (
            <Link
              to="/assets/register"
              style={{
                padding: "0.5rem 1.2rem",
                background: "#2563eb",
                color: "#fff",
                borderRadius: 6,
                textDecoration: "none",
                fontSize: "0.9rem",
              }}
            >
              + Register Asset
            </Link>
          )}
          <button
            onClick={signOut}
            style={{
              padding: "0.5rem 1.2rem",
              background: "#f3f4f6",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: "0.9rem",
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      {error && (
        <div style={{ padding: "0.75rem 1rem", background: "#fef2f2", color: "#b91c1c", borderRadius: 6, marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {loading ? (
        <p>Loading assets...</p>
      ) : assets.length === 0 ? (
        <p style={{ color: "#666" }}>No assets registered yet.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #e5e7eb", textAlign: "left" }}>
              <th style={{ padding: "0.6rem" }}>Asset ID</th>
              <th style={{ padding: "0.6rem" }}>Name</th>
              <th style={{ padding: "0.6rem" }}>Category</th>
              <th style={{ padding: "0.6rem" }}>Status</th>
              <th style={{ padding: "0.6rem" }}>Location</th>
              <th style={{ padding: "0.6rem" }}>Purchase Cost</th>
              <th style={{ padding: "0.6rem" }}>Purchase Date</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => (
              <tr key={asset.asset_id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                <td style={{ padding: "0.6rem", fontFamily: "monospace", fontSize: "0.85rem" }}>{asset.asset_id}</td>
                <td style={{ padding: "0.6rem" }}>{asset.asset_name}</td>
                <td style={{ padding: "0.6rem" }}>{asset.category}</td>
                <td style={{ padding: "0.6rem" }}>
                  <span
                    style={{
                      padding: "0.2rem 0.6rem",
                      borderRadius: 99,
                      fontSize: "0.8rem",
                      background: asset.status === "Active" ? "#dcfce7" : "#f3f4f6",
                      color: asset.status === "Active" ? "#166534" : "#374151",
                    }}
                  >
                    {asset.status}
                  </span>
                </td>
                <td style={{ padding: "0.6rem" }}>{asset.location ?? "—"}</td>
                <td style={{ padding: "0.6rem" }}>
                  {asset.purchase_cost != null ? `UGX ${Number(asset.purchase_cost).toLocaleString()}` : "—"}
                </td>
                <td style={{ padding: "0.6rem" }}>{asset.purchase_date ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
