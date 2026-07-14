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
import { ICONS } from "../utils/icons";

interface AssetStub {
  asset_id: string;
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

interface StatPillProps {
  label: string;
  count: number;
  color: "blue" | "green" | "purple" | "yellow" | "amber";
}

function StatPill({ label, count, color }: StatPillProps) {
  const colorClasses = {
    blue: "bg-sky-100 text-sky-700 border-sky-200",
    green: "bg-emerald-100 text-emerald-700 border-emerald-200",
    purple: "bg-purple-100 text-purple-700 border-purple-200",
    yellow: "bg-amber-100 text-amber-700 border-amber-200",
    amber: "bg-orange-100 text-orange-700 border-orange-200",
  };

  return (
    <div className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${colorClasses[color]}`}>
      {label}: {count}
    </div>
  );
}

interface CategoryRowProps {
  category: InventoryCategory;
  isExpanded: boolean;
  onToggle: () => void;
}

function CategoryRow({ category, isExpanded, onToggle }: CategoryRowProps) {
  return (
    <div className="border border-sky-cardBorder rounded-xl overflow-hidden bg-white shadow-sm">
      {/* Collapsed/Expandable Header */}
      <button
        onClick={onToggle}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-sky-page/50 transition-colors text-left"
      >
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-bold text-ink text-sm">{category.asset_type}</span>
            <span className="text-ink-dim text-sm">—</span>
            <span className="font-semibold text-ink text-sm">{category.category}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatPill label="Total" count={category.total} color="blue" />
            <StatPill label="Available" count={category.available} color="green" />
            <StatPill label="Assigned" count={category.assigned} color="purple" />
            <StatPill label="Reserved" count={category.reserved} color="yellow" />
            <StatPill label="Under Maintenance" count={category.under_maintenance} color="amber" />
          </div>
        </div>
        <ICONS.chevronDown
          className={`w-5 h-5 text-ink-icon transition-transform duration-200 ${
            isExpanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Expanded Asset Table */}
      {isExpanded && (
        <div className="border-t border-sky-cardBorder">
          <table className="w-full text-sm">
            <thead className="bg-sky-page/50">
              <tr>
                <th className="px-5 py-2.5 text-left font-semibold text-ink text-xs">Asset ID</th>
                <th className="px-5 py-2.5 text-left font-semibold text-ink text-xs">Serial Number</th>
                <th className="px-5 py-2.5 text-left font-semibold text-ink text-xs">Status</th>
                <th className="px-5 py-2.5 text-left font-semibold text-ink text-xs">Department</th>
                <th className="px-5 py-2.5 text-left font-semibold text-ink text-xs">Custodian ID</th>
              </tr>
            </thead>
            <tbody>
              {category.assets.map((asset) => (
                <tr key={asset.asset_id} className="border-t border-sky-cardBorder hover:bg-sky-page/30">
                  <td className="px-5 py-2.5 font-medium text-ink text-xs">{asset.asset_id}</td>
                  <td className="px-5 py-2.5 text-ink-dim text-xs">{asset.serial_number}</td>
                  <td className="px-5 py-2.5">
                    <StatusBadge status={asset.status} />
                  </td>
                  <td className="px-5 py-2.5 text-ink-dim text-xs">{asset.department ?? "—"}</td>
                  <td className="px-5 py-2.5 text-ink-dim text-xs">{asset.current_custodian_id ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="border border-sky-cardBorder rounded-xl overflow-hidden bg-white shadow-sm">
      <div className="px-5 py-4 flex items-center justify-between">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-4 w-24 bg-sky-page rounded animate-pulse" />
            <div className="h-4 w-2 bg-sky-page rounded animate-pulse" />
            <div className="h-4 w-20 bg-sky-page rounded animate-pulse" />
          </div>
          <div className="flex gap-2">
            <div className="h-6 w-16 bg-sky-page rounded-full animate-pulse" />
            <div className="h-6 w-16 bg-sky-page rounded-full animate-pulse" />
            <div className="h-6 w-16 bg-sky-page rounded-full animate-pulse" />
          </div>
        </div>
        <div className="h-5 w-5 bg-sky-page rounded animate-pulse" />
      </div>
    </div>
  );
}

export default function Inventory() {
  const [categories, setCategories] = React.useState<InventoryCategory[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  
  /*
   * Accordion state structure:
   * Using a Set of category keys (asset_type|category) to track which rows are expanded.
   * This allows multiple rows to be expanded simultaneously as required.
   * The key format ensures uniqueness even if categories have the same name across different types.
   */
  const [expandedCategories, setExpandedCategories] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    apiFetch<InventoryCategory[]>("/inventory/categories", {})
      .then((data) => {
        if (!cancelled) setCategories(data);
      })
      .catch(() => {
        if (!cancelled) setCategories([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  const toggleCategory = (assetType: string, category: string) => {
    const key = `${assetType}|${category}`;
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

  const navigateToAssets = () => {
    window.history.pushState({}, "", "/assets");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const navigateToRegister = () => {
    window.history.pushState({}, "", "/assets/register");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const totalAssets = categories.reduce((sum, cat) => sum + cat.total, 0);

  if (isLoading) {
    return (
      <div className="w-full flex flex-col gap-5 select-none font-sans">
        <PageHeader
          title="Asset Inventory"
          subtitle="Loading inventory..."
        />
        <div className="space-y-3">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="w-full flex flex-col gap-5 select-none font-sans">
        <PageHeader
          title="Asset Inventory"
          subtitle="No assets found in the inventory"
        />
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <ICONS.assets className="w-16 h-16 text-ink-icon" />
          <p className="text-ink-dim text-sm">No assets found in the inventory.</p>
          <button
            onClick={navigateToRegister}
            className="px-4 py-2 bg-ursb text-white rounded-lg font-semibold text-sm hover:bg-ursb-dark transition-colors"
          >
            Register the first asset
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-5 select-none font-sans">
      <PageHeader
        title="Asset Inventory"
        subtitle={`${totalAssets} assets across ${categories.length} categories`}
        actions={
          <button
            onClick={navigateToAssets}
            className="text-sm text-ursb hover:text-ursb-dark font-semibold transition-colors"
          >
            View flat list →
          </button>
        }
      />
      
      <div className="text-xs text-ink-dim mb-2">
        This view groups assets by type and category for quick overview.{" "}
        <button onClick={navigateToAssets} className="text-ursb hover:underline">
          Go to Assets page
        </button>{" "}
        for the full individual list with filtering and search.
      </div>

      <div className="space-y-3">
        {categories.map((category) => {
          const key = `${category.asset_type}|${category.category}`;
          const isExpanded = expandedCategories.has(key);
          return (
            <CategoryRow
              key={key}
              category={category}
              isExpanded={isExpanded}
              onToggle={() => toggleCategory(category.asset_type, category.category)}
            />
          );
        })}
      </div>
    </div>
  );
}
