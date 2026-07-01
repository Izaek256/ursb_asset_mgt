import React from "react";
import { apiFetch } from "../AuthContext";

interface AssetRow {
  asset_id: string;
  asset_name: string;
  asset_type: string;
  category: string;
  serial_number: string;
  condition: string;
  status: string;
  cost: number;
  acquisition_date: string;
  supplier: string;
  department: string | null;
}

const STATUS_FILTERS = ["All", "Active", "In Storage", "Under Maintenance", "Disposed"];
const TYPE_FILTERS = ["All", "ICT Equipment", "Furniture", "Vehicle", "Software", "Other"];

const STATUS_CLASS: Record<string, string> = {
  Active: "badge-active",
  "In Storage": "badge-info",
  "Under Maintenance": "badge-warning",
  Disposed: "badge-inactive",
};

export default function Assets() {
  const [assets, setAssets] = React.useState<AssetRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState("All");
  const [typeFilter, setTypeFilter] = React.useState("All");
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    const params = new URLSearchParams();
    if (statusFilter !== "All") params.set("status", statusFilter);
    if (typeFilter !== "All") params.set("asset_type", typeFilter);
    if (search) params.set("search", search);

    apiFetch<AssetRow[]>(`/assets?${params.toString()}`, {})
      .then((data) => { if (!cancelled) setAssets(data); })
      .catch(() => { if (!cancelled) setAssets([]); })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [statusFilter, typeFilter, search]);

  if (isLoading) {
    return <div className="page-loading">Loading assets...</div>;
  }

  return (
    <>
      {/* Filters */}
      <div className="filter-bar">
        <div className="filter-group">
          <input
            type="text"
            className="filter-search"
            placeholder="Search assets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label htmlFor="status-filter" className="filter-label">Status</label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="filter-select"
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="type-filter" className="filter-label">Type</label>
          <select
            id="type-filter"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="filter-select"
          >
            {TYPE_FILTERS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="filter-count">{assets.length} assets</div>
      </div>

      {/* Table */}
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Asset Name</th>
              <th>Asset ID</th>
              <th>Type</th>
              <th>Serial No.</th>
              <th>Status</th>
              <th>Condition</th>
              <th>Cost (UGX)</th>
              <th>Department</th>
              <th>Acquired</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a) => (
              <tr key={a.asset_id}>
                <td>
                  <div className="user-name">{a.asset_name}</div>
                  <div className="text-small text-muted">{a.supplier}</div>
                </td>
                <td className="text-small">{a.asset_id}</td>
                <td>{a.asset_type}</td>
                <td className="text-small">{a.serial_number}</td>
                <td>
                  <span className={`badge ${STATUS_CLASS[a.status] || "badge"}`}>
                    {a.status}
                  </span>
                </td>
                <td>{a.condition}</td>
                <td>{a.cost.toLocaleString()}</td>
                <td>{a.department ?? "—"}</td>
                <td className="text-small">{a.acquisition_date}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {assets.length === 0 && (
          <div className="page-empty">No assets found matching your filters.</div>
        )}
      </div>
    </>
  );
}
