import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from "react";
import { apiFetch } from "../AuthContext";
import Table from "../components/common/Table";
import FilterBar, { FilterField, filterInputCls, filterSelectCls } from "../components/common/FilterBar";
import StatusBadge from "../components/common/badges/StatusBadge";
import ConditionBadge from "../components/common/badges/ConditionBadge";
import Button from "../components/common/Button";
import PageHeader from "../components/PageHeader";
import { ICONS } from "../utils/icons";
const STATUS_FILTERS = ["All", "Active", "In Storage", "Under Maintenance", "Disposed"];
const TYPE_FILTERS = ["All", "ICT Equipment", "Furniture", "Vehicle", "Software", "Other"];
export default function Assets() {
    const [assets, setAssets] = React.useState([]);
    const [isLoading, setIsLoading] = React.useState(true);
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
    ];
    return (_jsxs("div", { className: "w-full flex flex-col gap-5 select-none font-sans", children: [_jsx(PageHeader, { title: "Assets", subtitle: "Full inventory of registered organisation assets", actions: _jsxs(Button, { onClick: navigateToRegister, children: [_jsx(ICONS.plus, { className: "w-4 h-4 mr-1.5 stroke-[2.4]" }), "Add Asset"] }) }), _jsxs(FilterBar, { count: { value: assets.length, label: "assets" }, children: [_jsx(FilterField, { label: "Search", htmlFor: "asset-search", children: _jsx("input", { id: "asset-search", type: "text", className: filterInputCls, placeholder: "Search assets...", value: search, onChange: (e) => setSearch(e.target.value) }) }), _jsx(FilterField, { label: "Status", htmlFor: "status-filter", children: _jsx("select", { id: "status-filter", value: statusFilter, onChange: (e) => setStatusFilter(e.target.value), className: filterSelectCls, children: STATUS_FILTERS.map((s) => (_jsx("option", { value: s, children: s }, s))) }) }), _jsx(FilterField, { label: "Type", htmlFor: "type-filter", children: _jsx("select", { id: "type-filter", value: typeFilter, onChange: (e) => setTypeFilter(e.target.value), className: filterSelectCls, children: TYPE_FILTERS.map((t) => (_jsx("option", { value: t, children: t }, t))) }) })] }), _jsx(Table, { data: assets, columns: columns, rowKey: (a) => a.asset_id, isLoading: isLoading, emptyMessage: "No assets found matching your filters." })] }));
}
