import React from "react";
import { apiFetch } from "../AuthContext";
import Table, { Column } from "../components/common/Table";
import FilterBar, { FilterField, filterInputCls, filterSelectCls } from "../components/common/FilterBar";
import StatusBadge from "../components/common/badges/StatusBadge";
import ConditionBadge from "../components/common/badges/ConditionBadge";
import Button from "../components/common/Button";
import PageHeader from "../components/PageHeader";
import { ICONS } from "../utils/icons";

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

  const navigateToRegister = () => {
    window.history.pushState({}, "", "/assets/register");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const columns: Column<AssetRow>[] = [
    {
      header: "Asset Name",
      render: (a) => (
        <div>
          <div className="font-bold text-ink text-sm">{a.asset_name}</div>
          <div className="text-[11px] text-ink-dim mt-0.5">{a.supplier}</div>
        </div>
      ),
    },
    {
      header: "Asset ID",
      render: (a) => <span className="text-xs text-ink-dim font-medium">{a.asset_id}</span>,
    },
    { header: "Type", render: (a) => a.asset_type },
    {
      header: "Serial No.",
      render: (a) => <span className="text-xs text-ink-dim">{a.serial_number}</span>,
    },
    {
      header: "Status",
      render: (a) => <StatusBadge status={a.status} />,
    },
    {
      header: "Condition",
      render: (a) => <ConditionBadge condition={a.condition} />,
    },
    {
      header: "Cost (UGX)",
      render: (a) => <span className="font-semibold">{a.cost.toLocaleString()}</span>,
    },
    {
      header: "Department",
      render: (a) => a.department ?? "—",
    },
    {
      header: "Acquired",
      render: (a) => <span className="text-xs text-ink-dim">{a.acquisition_date}</span>,
    },
  ];

  return (
    <div className="w-full flex flex-col gap-5 select-none font-sans">
      <PageHeader
        title="Assets"
        subtitle="Full inventory of registered organisation assets"
        actions={
          <Button onClick={navigateToRegister}>
            <ICONS.plus className="w-4 h-4 mr-1.5 stroke-[2.4]" />
            Add Asset
          </Button>
        }
      />

      <FilterBar count={{ value: assets.length, label: "assets" }}>
        <FilterField label="Search" htmlFor="asset-search">
          <input
            id="asset-search"
            type="text"
            className={filterInputCls}
            placeholder="Search assets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </FilterField>
        <FilterField label="Status" htmlFor="status-filter">
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={filterSelectCls}
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Type" htmlFor="type-filter">
          <select
            id="type-filter"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className={filterSelectCls}
          >
            {TYPE_FILTERS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </FilterField>
      </FilterBar>

      <Table
        data={assets}
        columns={columns}
        rowKey={(a) => a.asset_id}
        isLoading={isLoading}
        emptyMessage="No assets found matching your filters."
      />
    </div>
  );
}
