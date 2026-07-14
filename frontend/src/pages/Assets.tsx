import React, { Fragment } from "react";
import { Menu, MenuButton, MenuItem, MenuItems, Transition } from "@headlessui/react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { apiFetch } from "../AuthContext";
import Table, { Column } from "../components/common/Table";
import FilterBar, { FilterField, filterInputCls, filterSelectCls } from "../components/common/FilterBar";
import StatusBadge from "../components/common/badges/StatusBadge";
import ConditionBadge from "../components/common/badges/ConditionBadge";
import Button from "../components/common/Button";
import PageHeader from "../components/PageHeader";
import { ICONS } from "../utils/icons";
import { CHART } from "../theme/chartColors";
import excelIcon from "../assets/icons8-export-excel-50.png";
import pdfIcon from "../assets/icons8-export-pdf-50.png";
import BulkImportModal from "../components/assets/BulkImportModal";

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

const STATUS_FILTERS = ["All", "Available", "Reserved", "Pending Acceptance", "Pending Pickup", "Assigned", "Under Transfer", "Under Maintenance", "Returned", "Disposed", "Deactivated"];
const TYPE_FILTERS = ["All", "ICT Equipment", "Furniture", "Vehicle", "Software", "Other"];

const EXPORT_HEADERS = [
  "Asset Name",
  "Asset ID",
  "Type",
  "Serial No.",
  "Status",
  "Condition",
  "Cost",
  "Department",
  "Acquired",
] as const;

function formatExportDate(): string {
  return new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatFileDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function assetToExportRow(asset: AssetRow): string[] {
  return [
    asset.asset_name || "—",
    asset.asset_id || "—",
    asset.asset_type || "—",
    asset.serial_number || "—",
    asset.status || "—",
    asset.condition || "—",
    typeof asset.cost === "number" ? asset.cost.toLocaleString() : "—",
    asset.department ?? "—",
    asset.acquisition_date || "—",
  ];
}

function exportAssetsPdf(rows: AssetRow[]) {
  const doc = new jsPDF({ orientation: rows.length > 8 ? "landscape" : "portrait", unit: "pt" });
  const exportDate = formatExportDate();

  doc.setFontSize(14);
  doc.setTextColor(CHART.ursbDark);
  doc.text("URSB Asset Management — Assets Export", 40, 40);
  doc.setFontSize(10);
  doc.setTextColor(CHART.ursb);
  doc.text(`Exported: ${exportDate}`, 40, 58);

  autoTable(doc, {
    startY: 72,
    head: [EXPORT_HEADERS as unknown as string[]],
    body: rows.map(assetToExportRow),
    styles: {
      fontSize: 9,
      cellPadding: 6,
      textColor: CHART.ursbDark,
    },
    headStyles: {
      fillColor: CHART.ursb,
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: CHART.ursbLight,
    },
    margin: { left: 40, right: 40 },
  });

  doc.save(`ursb-assets-export-${formatFileDate()}.pdf`);
}

function exportAssetsExcel(rows: AssetRow[]) {
  const sheetData = [EXPORT_HEADERS as unknown as string[], ...rows.map(assetToExportRow)];
  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
  worksheet["!cols"] = [
    { wch: 28 },
    { wch: 14 },
    { wch: 18 },
    { wch: 16 },
    { wch: 16 },
    { wch: 14 },
    { wch: 14 },
    { wch: 18 },
    { wch: 14 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Assets");
  XLSX.writeFile(workbook, `ursb-assets-export-${formatFileDate()}.xlsx`);
}

export default function Assets() {
  const [assets, setAssets] = React.useState<AssetRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isExporting, setIsExporting] = React.useState(false);
  const [statusFilter, setStatusFilter] = React.useState("All");
  const [typeFilter, setTypeFilter] = React.useState("All");
  const [search, setSearch] = React.useState("");
  const [isImportModalOpen, setIsImportModalOpen] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const pageSize = 50;

  React.useEffect(() => {
    setPage(1);
  }, [statusFilter, typeFilter, search]);

  const totalPages = Math.ceil(assets.length / pageSize);

  const paginatedAssets = React.useMemo(() => {
    return assets.slice((page - 1) * pageSize, page * pageSize);
  }, [assets, page]);

  const fetchAssets = React.useCallback(() => {
    setIsLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== "All") params.set("status", statusFilter);
    if (typeFilter !== "All") params.set("asset_type", typeFilter);
    if (search) params.set("search", search);

    apiFetch<AssetRow[]>(`/assets?${params.toString()}`, {})
      .then((data) => setAssets(data))
      .catch(() => setAssets([]))
      .finally(() => setIsLoading(false));
  }, [statusFilter, typeFilter, search]);

  React.useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const navigateToRegister = () => {
    window.history.pushState({}, "", "/assets/register");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const navigateToDetail = (assetId: string) => {
    window.history.pushState({}, "", `/assets/${assetId}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const handleExport = async (format: "pdf" | "excel") => {
    if (isExporting || assets.length === 0) return;
    setIsExporting(true);
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 150));
      if (format === "pdf") {
        exportAssetsPdf(assets);
      } else {
        exportAssetsExcel(assets);
      }
    } finally {
      setIsExporting(false);
    }
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
    {
      header: "Actions",
      render: (a) => (
        <Button variant="outline" onClick={() => navigateToDetail(a.asset_id)}>
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="w-full flex flex-col gap-5 select-none font-sans">
      <PageHeader
        title="Assets"
        subtitle="Full inventory of registered organisation assets"
        actions={
          <>
            <Menu as="div" className="relative">
              {({ open }) => (
                <>
                  <MenuButton
                    as={Button}
                    variant="outline"
                    disabled={isExporting || assets.length === 0}
                    isLoading={isExporting}
                    className="gap-1.5"
                  >
                    Export
                    <ICONS.chevronDown
                      className={`w-4 h-4 stroke-[2.4] transition-transform duration-150 motion-reduce:transition-none ${
                        open ? "rotate-180" : ""
                      }`}
                    />
                  </MenuButton>

                  <Transition
                    as={Fragment}
                    show={open}
                    enter="transition ease-out duration-150 motion-reduce:transition-none"
                    enterFrom="opacity-0 scale-95 -translate-y-1"
                    enterTo="opacity-100 scale-100 translate-y-0"
                    leave="transition ease-in duration-150 motion-reduce:transition-none"
                    leaveFrom="opacity-100 scale-100 translate-y-0"
                    leaveTo="opacity-0 scale-95 -translate-y-1"
                  >
                    <MenuItems
                      anchor="bottom end"
                      className="z-50 mt-2 w-52 origin-top-right rounded-xl border border-sky-cardBorder bg-white p-1.5 shadow-xl focus:outline-none"
                    >
                      <MenuItem disabled={isExporting}>
                        {({ focus }) => (
                          <Button
                            variant="ghost"
                            fullWidth
                            disabled={isExporting}
                            onClick={() => void handleExport("pdf")}
                            className={`justify-start gap-2 rounded-lg border-0 px-3.5 py-2.5 text-sm !text-ink shadow-none hover:bg-sky-page/60 hover:shadow-none ${
                              focus ? "bg-sky-page/60" : "bg-transparent"
                            }`}
                          >
                            <img src={pdfIcon} alt="PDF" className="w-5 h-5 object-contain shrink-0" />
                            Export as PDF
                          </Button>
                        )}
                      </MenuItem>
                      <MenuItem disabled={isExporting}>
                        {({ focus }) => (
                          <Button
                            variant="ghost"
                            fullWidth
                            disabled={isExporting}
                            onClick={() => void handleExport("excel")}
                            className={`justify-start gap-2 rounded-lg border-0 px-3.5 py-2.5 text-sm !text-ink shadow-none hover:bg-sky-page/60 hover:shadow-none ${
                              focus ? "bg-sky-page/60" : "bg-transparent"
                            }`}
                          >
                            <img src={excelIcon} alt="Excel" className="w-5 h-5 object-contain shrink-0" />
                            Export as Excel
                          </Button>
                        )}
                      </MenuItem>
                    </MenuItems>
                  </Transition>
                </>
              )}
            </Menu>
            <Button variant="outline" onClick={() => setIsImportModalOpen(true)}>
              <ICONS.upload className="w-4 h-4 mr-1.5 stroke-[2.4]" />
              Bulk Import
            </Button>
            <Button onClick={navigateToRegister}>
              <ICONS.plus className="w-4 h-4 mr-1.5 stroke-[2.4]" />
              Add Asset
            </Button>
          </>
        }
      />

      <FilterBar count={{ value: assets.length, label: "assets" }}>
        <FilterField label="Search" htmlFor="asset-search">
          <input
            id="asset-search"
            type="text"
            className={filterInputCls}
            placeholder="Search by name, ID, or serial..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </FilterField>
        <FilterField label="Status" htmlFor="status-filter">
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
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

      <Table
        data={paginatedAssets}
        columns={columns}
        rowKey={(a) => a.asset_id}
        isLoading={isLoading}
        emptyMessage="No assets found matching your filters."
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white border border-sky-cardBorder rounded-2xl p-4 shadow-sm select-none">
          <div className="text-xs text-ink-dim font-medium">
            Showing <span className="font-semibold text-ink">{Math.min((page - 1) * pageSize + 1, assets.length)}</span> to{" "}
            <span className="font-semibold text-ink">{Math.min(page * pageSize, assets.length)}</span> of{" "}
            <span className="font-semibold text-ink">{assets.length}</span> assets
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

      <BulkImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={() => fetchAssets()}
      />
    </div>
  );
}
