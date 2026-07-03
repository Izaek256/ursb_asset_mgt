import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { Fragment } from "react";
import { Menu, MenuButton, MenuItem, MenuItems, Transition } from "@headlessui/react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { apiFetch } from "../AuthContext";
import Table from "../components/common/Table";
import FilterBar, { FilterField, filterInputCls, filterSelectCls } from "../components/common/FilterBar";
import StatusBadge from "../components/common/badges/StatusBadge";
import ConditionBadge from "../components/common/badges/ConditionBadge";
import Button from "../components/common/Button";
import PageHeader from "../components/PageHeader";
import { ICONS } from "../utils/icons";
import { CHART } from "../theme/chartColors";
const STATUS_FILTERS = ["All", "Active", "In Storage", "Under Maintenance", "Disposed"];
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
];
function formatExportDate() {
    return new Date().toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}
function formatFileDate() {
    return new Date().toISOString().slice(0, 10);
}
function assetToExportRow(asset) {
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
function exportAssetsPdf(rows) {
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
        head: [EXPORT_HEADERS],
        body: rows.map(assetToExportRow),
        styles: {
            fontSize: 9,
            cellPadding: 6,
            textColor: CHART.ursbDark,
        },
        headStyles: {
            fillColor: CHART.ursb,
            textColor: "#ffffff",
            fontStyle: "bold",
        },
        alternateRowStyles: {
            fillColor: CHART.ursbLight,
        },
        margin: { left: 40, right: 40 },
    });
    doc.save(`ursb-assets-export-${formatFileDate()}.pdf`);
}
function exportAssetsExcel(rows) {
    const sheetData = [EXPORT_HEADERS, ...rows.map(assetToExportRow)];
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
    const [assets, setAssets] = React.useState([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isExporting, setIsExporting] = React.useState(false);
    const [statusFilter, setStatusFilter] = React.useState("All");
    const [typeFilter, setTypeFilter] = React.useState("All");
    const [search, setSearch] = React.useState("");
    React.useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        const params = new URLSearchParams();
        if (statusFilter !== "All")
            params.set("status", statusFilter);
        if (typeFilter !== "All")
            params.set("asset_type", typeFilter);
        if (search)
            params.set("search", search);
        apiFetch(`/assets?${params.toString()}`, {})
            .then((data) => { if (!cancelled)
            setAssets(data); })
            .catch(() => { if (!cancelled)
            setAssets([]); })
            .finally(() => { if (!cancelled)
            setIsLoading(false); });
        return () => { cancelled = true; };
    }, [statusFilter, typeFilter, search]);
    const navigateToRegister = () => {
        window.history.pushState({}, "", "/assets/register");
        window.dispatchEvent(new PopStateEvent("popstate"));
    };
    const navigateToDetail = (assetId) => {
        window.history.pushState({}, "", `/assets/${assetId}`);
        window.dispatchEvent(new PopStateEvent("popstate"));
    };
    const handleExport = async (format) => {
        if (isExporting || assets.length === 0)
            return;
        setIsExporting(true);
        try {
            await new Promise((resolve) => window.setTimeout(resolve, 150));
            if (format === "pdf") {
                exportAssetsPdf(assets);
            }
            else {
                exportAssetsExcel(assets);
            }
        }
        finally {
            setIsExporting(false);
        }
    };
    const columns = [
        {
            header: "Asset Name",
            render: (a) => (_jsxs("div", { children: [_jsx("div", { className: "font-bold text-ink text-sm", children: a.asset_name }), _jsx("div", { className: "text-[11px] text-ink-dim mt-0.5", children: a.supplier })] })),
        },
        {
            header: "Asset ID",
            render: (a) => _jsx("span", { className: "text-xs text-ink-dim font-medium", children: a.asset_id }),
        },
        { header: "Type", render: (a) => a.asset_type },
        {
            header: "Serial No.",
            render: (a) => _jsx("span", { className: "text-xs text-ink-dim", children: a.serial_number }),
        },
        {
            header: "Status",
            render: (a) => _jsx(StatusBadge, { status: a.status }),
        },
        {
            header: "Condition",
            render: (a) => _jsx(ConditionBadge, { condition: a.condition }),
        },
        {
            header: "Cost (UGX)",
            render: (a) => _jsx("span", { className: "font-semibold", children: a.cost.toLocaleString() }),
        },
        {
            header: "Department",
            render: (a) => a.department ?? "—",
        },
        {
            header: "Acquired",
            render: (a) => _jsx("span", { className: "text-xs text-ink-dim", children: a.acquisition_date }),
        },
        {
            header: "Actions",
            render: (a) => (_jsx(Button, { variant: "outline", onClick: () => navigateToDetail(a.asset_id), children: "View" })),
        },
    ];
    return (_jsxs("div", { className: "w-full flex flex-col gap-5 select-none font-sans", children: [_jsx(PageHeader, { title: "Assets", subtitle: "Full inventory of registered organisation assets", actions: _jsxs(_Fragment, { children: [_jsx(Menu, { as: "div", className: "relative", children: ({ open }) => (_jsxs(_Fragment, { children: [_jsxs(MenuButton, { as: Button, variant: "outline", disabled: isExporting || assets.length === 0, isLoading: isExporting, className: "gap-1.5", children: ["Export", _jsx(ICONS.chevronDown, { className: `w-4 h-4 stroke-[2.4] transition-transform duration-150 motion-reduce:transition-none ${open ? "rotate-180" : ""}` })] }), _jsx(Transition, { as: Fragment, show: open, enter: "transition ease-out duration-150 motion-reduce:transition-none", enterFrom: "opacity-0 scale-95 -translate-y-1", enterTo: "opacity-100 scale-100 translate-y-0", leave: "transition ease-in duration-150 motion-reduce:transition-none", leaveFrom: "opacity-100 scale-100 translate-y-0", leaveTo: "opacity-0 scale-95 -translate-y-1", children: _jsxs(MenuItems, { anchor: "bottom end", className: "z-50 mt-2 w-52 origin-top-right rounded-xl border border-sky-cardBorder bg-white p-1.5 shadow-xl focus:outline-none", children: [_jsx(MenuItem, { disabled: isExporting, children: ({ focus }) => (_jsxs(Button, { variant: "ghost", fullWidth: true, disabled: isExporting, onClick: () => void handleExport("pdf"), className: `justify-start gap-2 rounded-lg border-0 px-3.5 py-2.5 text-sm text-ink shadow-none hover:bg-sky-page/60 hover:shadow-none ${focus ? "bg-sky-page/60" : "bg-transparent"}`, children: [_jsx(ICONS.fileText, { className: "w-4 h-4 text-ursb stroke-[2.2] shrink-0" }), "Export as PDF"] })) }), _jsx(MenuItem, { disabled: isExporting, children: ({ focus }) => (_jsxs(Button, { variant: "ghost", fullWidth: true, disabled: isExporting, onClick: () => void handleExport("excel"), className: `justify-start gap-2 rounded-lg border-0 px-3.5 py-2.5 text-sm text-ink shadow-none hover:bg-sky-page/60 hover:shadow-none ${focus ? "bg-sky-page/60" : "bg-transparent"}`, children: [_jsx(ICONS.fileSpreadsheet, { className: "w-4 h-4 text-ursb stroke-[2.2] shrink-0" }), "Export as Excel"] })) })] }) })] })) }), _jsxs(Button, { onClick: navigateToRegister, children: [_jsx(ICONS.plus, { className: "w-4 h-4 mr-1.5 stroke-[2.4]" }), "Add Asset"] })] }) }), _jsxs(FilterBar, { count: { value: assets.length, label: "assets" }, children: [_jsx(FilterField, { label: "Search", htmlFor: "asset-search", children: _jsx("input", { id: "asset-search", type: "text", className: filterInputCls, placeholder: "Search assets...", value: search, onChange: (e) => setSearch(e.target.value) }) }), _jsx(FilterField, { label: "Status", htmlFor: "status-filter", children: _jsx("select", { id: "status-filter", value: statusFilter, onChange: (e) => setStatusFilter(e.target.value), className: filterSelectCls, children: STATUS_FILTERS.map((s) => (_jsx("option", { value: s, children: s }, s))) }) }), _jsx(FilterField, { label: "Type", htmlFor: "type-filter", children: _jsx("select", { id: "type-filter", value: typeFilter, onChange: (e) => setTypeFilter(e.target.value), className: filterSelectCls, children: TYPE_FILTERS.map((t) => (_jsx("option", { value: t, children: t }, t))) }) })] }), _jsx(Table, { data: assets, columns: columns, rowKey: (a) => a.asset_id, isLoading: isLoading, emptyMessage: "No assets found matching your filters." })] }));
}
