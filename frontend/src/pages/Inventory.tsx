/*
 * Inventory Page
 * Live view of assets grouped by type and category.
 * Stats (Available, Assigned, etc.) reflect real-time asset status.
 * Auto-refreshes every 30 seconds.
 */

import React from "react";
import { apiFetch } from "../AuthContext";
import StatusBadge from "../components/common/badges/StatusBadge";
import PageHeader from "../components/PageHeader";
import Button from "../components/common/Button";
import FilterBar, { FilterField, filterSelectCls } from "../components/common/FilterBar";
import { ICONS } from "../utils/icons";
import { SkeletonCard } from "../components/common/LoadingSkeleton";

interface AssetStub {
  asset_id: string;
  asset_name: string;
  status: string;
  serial_number: string;
  current_custodian_id: string | null;
  department: string | null;
}

interface InventoryCategory {
  asset_type: string;
  category: string;
  total: number;
  available: number;
  assigned: number;
  under_maintenance: number;
  pending: number;
  disposed: number;
  other: number;
  assets: AssetStub[];
}

interface PaginatedInventoryResponse {
  categories: InventoryCategory[];
  total_categories: number;
  page: number;
  page_size: number;
  total_assets: number;
  summary_available: number;
  summary_assigned: number;
  summary_under_maintenance: number;
  summary_pending: number;
  summary_disposed: number;
}

const TYPE_FILTERS = ["All", "ICT Equipment", "Furniture", "Vehicle", "Software", "Other"];

// ── Summary stat chip ────────────────────────────────────────────────────────────
function SummaryStat({
  label,
  count,
  colorClass,
}: {
  label: string;
  count: number;
  colorClass: string;
}) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold ${colorClass}`}>
      <span className="text-base font-bold tabular-nums">{count.toLocaleString()}</span>
      <span className="opacity-80">{label}</span>
    </div>
  );
}

// ── Per-category status badge ────────────────────────────────────────────────────
function StatBadge({ label, count, color }: { label: string; count: number; color: string }) {
  const colorClasses: Record<string, string> = {
    blue:   "bg-sky-100 text-sky-700 border-sky-200",
    green:  "bg-emerald-100 text-emerald-700 border-emerald-200",
    purple: "bg-purple-100 text-purple-700 border-purple-200",
    amber:  "bg-amber-100 text-amber-700 border-amber-200",
    red:    "bg-rose-100 text-rose-700 border-rose-200",
    gray:   "bg-gray-100 text-gray-600 border-gray-200",
  };
  return (
    <div className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${colorClasses[color] ?? colorClasses.gray}`}>
      {label}: {count}
    </div>
  );
}

export default function Inventory() {
  const [data, setData] = React.useState<PaginatedInventoryResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [typeFilter, setTypeFilter] = React.useState("All");
  const [page, setPage] = React.useState(1);
  const pageSize = 10;
  const [expandedCategories, setExpandedCategories] = React.useState<Set<string>>(new Set());

  // Reset to page 1 and collapse rows when filter changes
  React.useEffect(() => {
    setPage(1);
    setExpandedCategories(new Set());
  }, [typeFilter]);

  const fetchInventory = React.useCallback(() => {
    setIsLoading(true);
    const params = new URLSearchParams();
    params.set("page", page.toString());
    params.set("page_size", pageSize.toString());
    if (typeFilter !== "All") params.set("asset_type", typeFilter);

    apiFetch<PaginatedInventoryResponse>(`/inventory/categories?${params.toString()}`, {})
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setIsLoading(false));
  }, [page, typeFilter]);

  // Initial fetch + re-fetch when deps change
  React.useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  // Auto-refresh every 30 s so status counts stay live
  React.useEffect(() => {
    const interval = setInterval(fetchInventory, 30_000);
    return () => clearInterval(interval);
  }, [fetchInventory]);

  const navigateToAssets = () => {
    window.history.pushState({}, "", "/assets");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const toggleCategory = (key: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const totalPages = data ? Math.ceil(data.total_categories / pageSize) : 0;

  // ── Loading skeleton ─────────────────────────────────────────────────────────
  if (isLoading && !data) {
    return (
      <div className="w-full flex flex-col gap-5 select-none font-sans">
        <PageHeader title="Asset Inventory" subtitle="Loading inventory…" />
        <SkeletonCard className="h-96" />
      </div>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (!data || data.categories.length === 0) {
    return (
      <div className="w-full flex flex-col gap-5 select-none font-sans">
        <PageHeader
          title="Asset Inventory"
          subtitle={data ? "No categories match your filters" : "No assets in the inventory"}
        />
        <div className="flex flex-col items-center justify-center py-16 gap-4 bg-white border border-sky-cardBorder rounded-2xl">
          <ICONS.assets className="w-16 h-16 text-ink-icon" />
          <p className="text-ink-dim text-sm font-medium">
            {data ? "No categories match your current filters." : "No assets found."}
          </p>
          {data && typeFilter !== "All" && (
            <Button variant="outline" onClick={() => setTypeFilter("All")}>Clear filters</Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-5 select-none font-sans">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <PageHeader
        title="Asset Inventory"
        subtitle={`${data.total_assets.toLocaleString()} assets · ${data.total_categories} categories`}
        actions={
          <Button variant="outline" onClick={navigateToAssets}>
            View flat list
            <ICONS.chevronRight className="w-4 h-4 ml-1.5 stroke-[2.4]" />
          </Button>
        }
      />

      {/* ── Live summary bar ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 items-center">
        <SummaryStat
          label="Available"
          count={data.summary_available}
          colorClass="bg-emerald-50 text-emerald-700 border-emerald-200"
        />
        <SummaryStat
          label="Assigned"
          count={data.summary_assigned}
          colorClass="bg-purple-50 text-purple-700 border-purple-200"
        />
        {data.summary_pending > 0 && (
          <SummaryStat
            label="Pending"
            count={data.summary_pending}
            colorClass="bg-amber-50 text-amber-700 border-amber-200"
          />
        )}
        {data.summary_under_maintenance > 0 && (
          <SummaryStat
            label="Maintenance"
            count={data.summary_under_maintenance}
            colorClass="bg-rose-50 text-rose-700 border-rose-200"
          />
        )}
        {data.summary_disposed > 0 && (
          <SummaryStat
            label="Disposed"
            count={data.summary_disposed}
            colorClass="bg-gray-100 text-gray-600 border-gray-200"
          />
        )}
        {/* Manual refresh button */}
        <Button
          variant="outline"
          onClick={fetchInventory}
          className="ml-auto !py-1.5 !px-3 gap-1.5 text-xs"
          title="Refresh inventory"
        >
          <ICONS.regenerate className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <FilterBar count={{ value: data.total_assets, label: "assets" }}>
        <FilterField label="Asset Type" htmlFor="type-filter">
          <select
            id="type-filter"
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className={filterSelectCls}
          >
            {TYPE_FILTERS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </FilterField>
      </FilterBar>

      {/* ── Category table ──────────────────────────────────────────────────── */}
      <div className="bg-white border border-sky-cardBorder rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-ink">
            <thead>
              <tr className="bg-sky-topbar border-b border-sky-cardBorder">
                <th className="text-[10px] uppercase font-bold tracking-wider text-ink-dim px-4 sm:px-5 py-3.5">Asset Type</th>
                <th className="text-[10px] uppercase font-bold tracking-wider text-ink-dim px-4 sm:px-5 py-3.5">Category</th>
                <th className="text-[10px] uppercase font-bold tracking-wider text-ink-dim px-4 sm:px-5 py-3.5">Status Breakdown</th>
                <th className="text-[10px] uppercase font-bold tracking-wider text-ink-dim px-4 sm:px-5 py-3.5">Total</th>
                <th className="w-10 px-4 sm:px-5 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-page/30">
              {data.categories.map((cat, index) => {
                const key = `${cat.asset_type}|${cat.category}|${index}`;
                const isExpanded = expandedCategories.has(key);
                return (
                  <React.Fragment key={key}>
                    <tr className="hover:bg-sky-page/20 transition-colors duration-150">
                      <td className="px-4 sm:px-5 py-4 align-middle font-bold text-ink text-sm">{cat.asset_type}</td>
                      <td className="px-4 sm:px-5 py-4 align-middle font-semibold text-ink text-sm">{cat.category}</td>
                      <td className="px-4 sm:px-5 py-4 align-middle">
                        <div className="flex flex-wrap gap-1.5">
                          <StatBadge label="Total"     count={cat.total}             color="blue"   />
                          <StatBadge label="Available" count={cat.available}         color="green"  />
                          <StatBadge label="Assigned"  count={cat.assigned}          color="purple" />
                          {cat.pending > 0          && <StatBadge label="Pending"     count={cat.pending}           color="amber"  />}
                          {cat.under_maintenance > 0 && <StatBadge label="Maintenance" count={cat.under_maintenance} color="red"    />}
                          {cat.disposed > 0         && <StatBadge label="Disposed"    count={cat.disposed}          color="gray"   />}
                          {cat.other > 0            && <StatBadge label="Returned"    count={cat.other}             color="gray"   />}
                        </div>
                      </td>
                      <td className="px-4 sm:px-5 py-4 align-middle text-xs text-ink-dim">{cat.total} assets</td>
                      <td className="px-4 sm:px-5 py-4 align-middle">
                        <button
                          onClick={() => toggleCategory(key)}
                          className="p-2 outline-none border-0 bg-transparent"
                          aria-label={isExpanded ? "Collapse" : "Expand"}
                        >
                          <ICONS.chevronDown
                            className={`w-4 h-4 text-ink-icon transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                          />
                        </button>
                      </td>
                    </tr>

                    {/* Expanded asset list */}
                    {isExpanded && (
                      <tr className="bg-sky-page/30">
                        <td colSpan={5} className="px-0 py-0">
                          <div className="px-4 sm:px-5 py-4">
                            <table className="w-full border-collapse text-left text-xs text-ink">
                              <thead className="bg-sky-topbar/50">
                                <tr>
                                  <th className="px-3 py-2 text-[10px] uppercase font-semibold text-ink-dim tracking-wider">Asset Name</th>
                                  <th className="px-3 py-2 text-[10px] uppercase font-semibold text-ink-dim tracking-wider">Asset ID</th>
                                  <th className="px-3 py-2 text-[10px] uppercase font-semibold text-ink-dim tracking-wider">Serial No.</th>
                                  <th className="px-3 py-2 text-[10px] uppercase font-semibold text-ink-dim tracking-wider">Status</th>
                                  <th className="px-3 py-2 text-[10px] uppercase font-semibold text-ink-dim tracking-wider">Department</th>
                                  <th className="px-3 py-2 text-[10px] uppercase font-semibold text-ink-dim tracking-wider">Custodian ID</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-sky-page/20">
                                {cat.assets.length === 0 ? (
                                  <tr>
                                    <td colSpan={6} className="px-3 py-4 text-center text-ink-dim text-xs">
                                      No assets in this category
                                    </td>
                                  </tr>
                                ) : (
                                  cat.assets.map((asset) => (
                                    <tr key={asset.asset_id} className="hover:bg-sky-page/40 transition-colors">
                                      <td className="px-3 py-2 font-medium text-ink">{asset.asset_name}</td>
                                      <td className="px-3 py-2 text-ink-dim font-mono">{asset.asset_id}</td>
                                      <td className="px-3 py-2 text-ink-dim">{asset.serial_number}</td>
                                      <td className="px-3 py-2"><StatusBadge status={asset.status} /></td>
                                      <td className="px-3 py-2 text-ink-dim">{asset.department ?? "—"}</td>
                                      <td className="px-3 py-2 text-ink-dim font-mono">{asset.current_custodian_id ?? "—"}</td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pagination ──────────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white border border-sky-cardBorder rounded-2xl p-4 shadow-sm">
          <div className="text-xs text-ink-dim font-medium">
            Showing <span className="font-semibold text-ink">{Math.min((page - 1) * pageSize + 1, data.total_categories)}</span>–
            <span className="font-semibold text-ink">{Math.min(page * pageSize, data.total_categories)}</span> of{" "}
            <span className="font-semibold text-ink">{data.total_categories}</span> categories
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPage((p) => Math.max(p - 1, 1))} disabled={page === 1} className="py-1 px-3 gap-1">
              <ICONS.chevronLeft className="w-3.5 h-3.5" /> Previous
            </Button>
            <div className="flex items-center gap-1.5 px-2">
              <span className="text-xs font-semibold text-ink">Page {page} of {totalPages}</span>
            </div>
            <Button variant="outline" onClick={() => setPage((p) => Math.min(p + 1, totalPages))} disabled={page === totalPages} className="py-1 px-3 gap-1">
              Next <ICONS.chevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
