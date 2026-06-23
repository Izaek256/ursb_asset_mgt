import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React from "react";
import { apiFetch, useAuth } from "../AuthContext";
const STATUS_FILTERS = ["All", "Active", "In Storage", "Under Maintenance", "Disposed"];
const TYPE_FILTERS = ["All", "ICT Equipment", "Furniture", "Vehicle", "Software", "Other"];
const STATUS_CLASS = {
    Active: "badge-active",
    "In Storage": "badge-info",
    "Under Maintenance": "badge-warning",
    Disposed: "badge-inactive",
};
export default function Assets() {
    const { token } = useAuth();
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
        apiFetch(`/assets?${params.toString()}`, {}, token)
            .then((data) => { if (!cancelled)
            setAssets(data); })
            .catch(() => { if (!cancelled)
            setAssets([]); })
            .finally(() => { if (!cancelled)
            setIsLoading(false); });
        return () => { cancelled = true; };
    }, [token, statusFilter, typeFilter, search]);
    if (isLoading) {
        return _jsx("div", { className: "page-loading", children: "Loading assets..." });
    }
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "filter-bar", children: [_jsx("div", { className: "filter-group", children: _jsx("input", { type: "text", className: "filter-search", placeholder: "Search assets...", value: search, onChange: (e) => setSearch(e.target.value) }) }), _jsxs("div", { className: "filter-group", children: [_jsx("label", { htmlFor: "status-filter", className: "filter-label", children: "Status" }), _jsx("select", { id: "status-filter", value: statusFilter, onChange: (e) => setStatusFilter(e.target.value), className: "filter-select", children: STATUS_FILTERS.map((s) => (_jsx("option", { value: s, children: s }, s))) })] }), _jsxs("div", { className: "filter-group", children: [_jsx("label", { htmlFor: "type-filter", className: "filter-label", children: "Type" }), _jsx("select", { id: "type-filter", value: typeFilter, onChange: (e) => setTypeFilter(e.target.value), className: "filter-select", children: TYPE_FILTERS.map((t) => (_jsx("option", { value: t, children: t }, t))) })] }), _jsxs("div", { className: "filter-count", children: [assets.length, " assets"] })] }), _jsxs("div", { className: "card", children: [_jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Asset Name" }), _jsx("th", { children: "Asset ID" }), _jsx("th", { children: "Type" }), _jsx("th", { children: "Serial No." }), _jsx("th", { children: "Status" }), _jsx("th", { children: "Condition" }), _jsx("th", { children: "Cost (UGX)" }), _jsx("th", { children: "Department" }), _jsx("th", { children: "Acquired" })] }) }), _jsx("tbody", { children: assets.map((a) => (_jsxs("tr", { children: [_jsxs("td", { children: [_jsx("div", { className: "user-name", children: a.asset_name }), _jsx("div", { className: "text-small text-muted", children: a.supplier })] }), _jsx("td", { className: "text-small", children: a.asset_id }), _jsx("td", { children: a.asset_type }), _jsx("td", { className: "text-small", children: a.serial_number }), _jsx("td", { children: _jsx("span", { className: `badge ${STATUS_CLASS[a.status] || "badge"}`, children: a.status }) }), _jsx("td", { children: a.condition }), _jsx("td", { children: a.cost.toLocaleString() }), _jsx("td", { children: a.department ?? "—" }), _jsx("td", { className: "text-small", children: a.acquisition_date })] }, a.asset_id))) })] }), assets.length === 0 && (_jsx("div", { className: "page-empty", children: "No assets found matching your filters." }))] })] }));
}
