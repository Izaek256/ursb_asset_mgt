/*
 * Inventory Page
 * 
 * This page provides a supplementary view of assets grouped by type and category.
 * The canonical individual asset list is on the Assets page (/assets).
 * This view is designed for quick overview and inventory management by showing
 * aggregate counts per category with expandable details.
 */

import React from "react";
import { apiFetch } from "../AuthContext";
import StatusBadge from "../components/common/badges/StatusBadge";
import PageHeader from "../components/PageHeader";
import Button from "../components/common/Button";
import FilterBar, { FilterField, filterSelectCls } from "../components/common/FilterBar";
import { ICONS } from "../utils/icons";

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
  reserved: number;
  under_maintenance: number;
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
}

const TYPE_FILTERS = ["All", "ICT Equipment", "Furniture", "Vehicle", "Software", "Other"];

function StatBadge({ label, count, color }: { label: string; count: number; color: string }) {
  const colorClasses: Record<string, string> = {
    blue: "bg-sky-100 text-sky-700 border-sky-200",
    green: "bg-emerald-100 text-emerald-700 border-emerald-200",
    purple: "bg-purple-100 text-purple-700 border-purple-200",
    yellow: "bg-amber-100 text-amber-700 border-amber-200",
    red: "bg-rose-100 text-rose-700 border-rose-200",
    gray: "bg-gray-100 text-gray-700 border-gray-200",
  };

  return (
    <div className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${colorClasses[color] || colorClasses.gray}`}>
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
      .then((responseData) => {
        setData(responseData);
      })
      .catch(() => {
        setData(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [page, typeFilter]);

  React.useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const navigateToAssets = () => {
    window.history.pushState({}, "", "/assets");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const navigateToRegister = () => {
    window.history.pushState({}, "", "/assets/register");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const toggleCategory = (assetType: string, category: string, index: number) => {
    const key = `${assetType}|${category}|${index}`;
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const totalPages = data ? Math.ceil(data.total_categories / pageSize) : 0;

  if (isLoading && !data) {
    return (
      <div className="w-full flex flex-col gap-5 select-none font-sans">
        <PageHeader
          title="Asset Inventory"
          subtitle="Loading inventory..."
        />
        <div className="bg-white border border-sky-cardBorder rounded-2xl p-10 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ursb mx-auto" />
        </div>
      </div>
    );
  }

  if (!data || data.categories.length === 0) {
    return (
      <div className="w-full flex flex-col gap-5 select-none font-sans">
        <PageHeader
          title="Asset Inventory"
          subtitle={data ? "No categories found matching your filters" : "No assets found in the inventory"}
        />
        <div className="flex flex-col items-center justify-center py-16 gap-4 bg-white border border-sky-cardBorder rounded-2xl">
          <ICONS.assets className="w-16 h-16 text-ink-icon" />
          <p className="text-ink-dim text-sm font-medium">
            {data ? "No categories match your current filters." : "No assets found in the inventory."}
          </p>
          {!data && (
            <Button onClick={navigateToRegister}>
              <ICONS.plus className="w-4 h-4 mr-1.5 stroke-[2.4]" />
              Register the first asset
            </Button>
          )}
          {data && typeFilter !== "All" && (
            <Button variant="outline" onClick={() => setTypeFilter("All")}>
              Clear filters
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-5 select-none font-sans">
      <PageHeader
        title="Asset Inventory"
        subtitle={`${data.total_assets} assets across ${data.total_categories} categories`}
        actions={
          <Button variant="outline" onClick={navigateToAssets}>
            View flat list
            <ICONS.chevronRight className="w-4 h-4 ml-1.5 stroke-[2.4]" />
          </Button>
        }
      />

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

      <div className="bg-white border border-sky-cardBorder rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-250 motion-reduce:transition-none">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-ink">
            <thead>
              <tr className="bg-sky-topbar border-b border-sky-cardBorder select-none">
                <th className="text-[10px] uppercase font-bold tracking-wider text-ink-dim px-4 sm:px-5 py-3.5">
                  Asset Type
                </th>
                <th className="text-[10px] uppercase font-bold tracking-wider text-ink-dim px-4 sm:px-5 py-3.5">
                  Category
                </th>
                <th className="text-[10px] uppercase font-bold tracking-wider text-ink-dim px-4 sm:px-5 py-3.5">
                  Status Breakdown
                </th>
                <th className="text-[10px] uppercase font-bold tracking-wider text-ink-dim px-4 sm:px-5 py-3.5">
                  Assets in Category
                </th>
                <th className="text-[10px] uppercase font-bold tracking-wider text-ink-dim px-4 sm:px-5 py-3.5 w-10">
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-page/30">
              {data.categories.map((category, index) => {
                const key = `${category.asset_type}|${category.category}|${index}`;
                const isExpanded = expandedCategories.has(key);
                return (
                  <React.Fragment key={key}>
                    <tr className="hover:bg-sky-page/20 transition-colors duration-150 motion-reduce:transition-none">
                      <td className="px-4 sm:px-5 py-4 align-middle">
                        <span className="font-bold text-ink text-sm">{category.asset_type}</span>
                      </td>
                      <td className="px-4 sm:px-5 py-4 align-middle">
                        <span className="font-semibold text-ink text-sm">{category.category}</span>
                      </td>
                      <td className="px-4 sm:px-5 py-4 align-middle">
                        <div className="flex flex-wrap gap-1.5">
                          <StatBadge label="Total" count={category.total} color="blue" />
                          <StatBadge label="Available" count={category.available} color="green" />
                          <StatBadge label="Assigned" count={category.assigned} color="purple" />
                          {category.reserved > 0 && <StatBadge label="Reserved" count={category.reserved} color="yellow" />}
                          {category.under_maintenance > 0 && <StatBadge label="Maintenance" count={category.under_maintenance} color="red" />}
                          {category.disposed > 0 && <StatBadge label="Disposed" count={category.disposed} color="gray" />}
                        </div>
                      </td>
                      <td className="px-4 sm:px-5 py-4 align-middle">
                        <span className="text-xs text-ink-dim">{category.total} assets</span>
                      </td>
                      <td className="px-4 sm:px-5 py-4 align-middle">
                        <button
                          onClick={() => toggleCategory(category.asset_type, category.category, index)}
                          className="p-2 outline-none border-0 bg-transparent"
                        >
                          <ICONS.chevronDown
                            className={`w-4 h-4 text-ink-icon transition-transform duration-200 ${
                              isExpanded ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-sky-page/30">
                        <td colSpan={5} className="px-0 py-0">
                          <div className="px-4 sm:px-5 py-4">
                            <table className="w-full border-collapse text-left text-xs text-ink">
                              <thead className="bg-sky-topbar/50">
                                <tr>
                                  <th className="px-3 py-2 text-left font-semibold text-ink-dim text-[10px] uppercase tracking-wider">Asset Name</th>
                                  <th className="px-3 py-2 text-left font-semibold text-ink-dim text-[10px] uppercase tracking-wider">Asset ID</th>
                                  <th className="px-3 py-2 text-left font-semibold text-ink-dim text-[10px] uppercase tracking-wider">Serial Number</th>
                                  <th className="px-3 py-2 text-left font-semibold text-ink-dim text-[10px] uppercase tracking-wider">Status</th>
                                  <th className="px-3 py-2 text-left font-semibold text-ink-dim text-[10px] uppercase tracking-wider">Department</th>
                                  <th className="px-3 py-2 text-left font-semibold text-ink-dim text-[10px] uppercase tracking-wider">Custodian ID</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-sky-page/20">
                                {category.assets.map((asset) => (
                                  <tr key={asset.asset_id} className="hover:bg-sky-page/40 transition-colors">
                                    <td className="px-3 py-2 font-medium text-ink text-xs">{asset.asset_name}</td>
                                    <td className="px-3 py-2 text-ink-dim text-xs">{asset.asset_id}</td>
                                    <td className="px-3 py-2 text-ink-dim text-xs">{asset.serial_number}</td>
                                    <td className="px-3 py-2">
                                      <StatusBadge status={asset.status} />
                                    </td>
                                    <td className="px-3 py-2 text-ink-dim text-xs">{asset.department ?? "—"}</td>
                                    <td className="px-3 py-2 text-ink-dim text-xs">{asset.current_custodian_id ?? "—"}</td>
                                  </tr>
                                ))}
                                {category.assets.length === 0 && (
                                  <tr>
                                    <td colSpan={6} className="px-3 py-4 text-center text-ink-dim text-xs">
                                      No assets in this category
                                    </td>
                                  </tr>
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white border border-sky-cardBorder rounded-2xl p-4 shadow-sm select-none">
          <div className="text-xs text-ink-dim font-medium">
            Showing <span className="font-semibold text-ink">{Math.min((page - 1) * pageSize + 1, data.total_categories)}</span> to{" "}
            <span className="font-semibold text-ink">{Math.min(page * pageSize, data.total_categories)}</span> of{" "}
            <span className="font-semibold text-ink">{data.total_categories}</span> categories
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page === 1}
              className="py-1 px-3 gap-1"
            >
              <ICONS.chevronLeft className="w-3.5 h-3.5" />
              Previous
            </Button>
            <div className="flex items-center gap-1.5 px-2">
              <span className="text-xs font-semibold text-ink">Page {page} of {totalPages}</span>
            </div>
            <Button
              variant="outline"
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page === totalPages}
              className="py-1 px-3 gap-1"
            >
              Next
              <ICONS.chevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
