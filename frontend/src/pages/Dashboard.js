import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from "react";
import { apiFetch } from "../AuthContext";
// ── Fallback mock data (used if API fails) ───────────────────────────────────────
const MOCK = {
    stats: [
        { label: "Total Assets", value: 22, icon: "📦", color: "#8b5cf6" },
        { label: "Active / Assigned", value: 14, icon: "✅", color: "#2563eb" },
        { label: "In Maintenance", value: 2, icon: "🔧", color: "#f59e0b" },
        { label: "Disposed", value: 3, icon: "🗑️", color: "#ef4444" },
    ],
    recent_assets: [
        { id: "1", name: "Dell Latitude 5540", category: "ICT Equipment", value: "UGX 3,200,000", color: "#8b5cf6", date: "Today" },
        { id: "2", name: "Office Desk (Mahogany)", category: "Furniture", value: "UGX 850,000", color: "#2563eb", date: "Today" },
        { id: "3", name: "Toyota Land Cruiser Prado", category: "Vehicle", value: "UGX 120,000,000", color: "#f59e0b", date: "Today" },
    ],
    categories: [
        { name: "ICT Equipment", count: 12, total: "UGX 45,230,000", pct: 78 },
        { name: "Furniture", count: 4, total: "UGX 6,000,000", pct: 32 },
        { name: "Vehicle", count: 3, total: "UGX 290,000,000", pct: 55 },
        { name: "Software", count: 2, total: "UGX 14,350,000", pct: 22 },
    ],
    monthly_acquisitions: [
        { month: "Jan", count: 2 }, { month: "Feb", count: 1 }, { month: "Mar", count: 3 },
        { month: "Apr", count: 0 }, { month: "May", count: 2 }, { month: "Jun", count: 1 },
        { month: "Jul", count: 0 }, { month: "Aug", count: 0 }, { month: "Sep", count: 0 },
        { month: "Oct", count: 0 }, { month: "Nov", count: 0 }, { month: "Dec", count: 0 },
    ],
    departments: [
        { dept: "ICT", assets: 10, color: "#2563eb" },
        { dept: "Administration", assets: 5, color: "#f59e0b" },
        { dept: "Finance & Administration", assets: 3, color: "#8b5cf6" },
        { dept: "Legal", assets: 1, color: "#0d9488" },
    ],
    maintenance_due: 3,
};
// ── Component ────────────────────────────────────────────────────────────────────
export default function Dashboard() {
    const [data, setData] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const dashRef = React.useRef(null);
    React.useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const result = await apiFetch("/dashboard/stats", {});
                if (!cancelled)
                    setData(result);
            }
            catch {
                if (!cancelled)
                    setData(MOCK);
            }
            finally {
                if (!cancelled)
                    setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);
    // Apply dynamic styles from data-* attributes (keeps CSS rules external)
    React.useEffect(() => {
        const el = dashRef.current;
        if (!el)
            return;
        el.querySelectorAll("[data-color]").forEach((node) => {
            const c = node.dataset.color;
            if (node.classList.contains("dash-stat-icon")) {
                node.style.background = c + "20";
                node.style.color = c;
            }
            else {
                node.style.background = c;
            }
        });
        el.querySelectorAll("[data-height]").forEach((node) => {
            node.style.height = node.dataset.height;
        });
        el.querySelectorAll("[data-width]").forEach((node) => {
            node.style.width = node.dataset.width;
        });
    }, [data]);
    if (loading || !data) {
        return (_jsx("div", { className: "dashboard-loading", children: "Loading dashboard..." }));
    }
    const maxBar = Math.max(...data.monthly_acquisitions.map((m) => m.count), 1);
    return (_jsxs("div", { className: "dashboard", ref: dashRef, children: [_jsx("div", { className: "dash-stats", children: data.stats.map((s) => (_jsxs("div", { className: "dash-stat-card", children: [_jsx("div", { className: "dash-stat-icon", "data-color": s.color, children: s.icon }), _jsxs("div", { children: [_jsx("div", { className: "dash-stat-label", children: s.label }), _jsx("div", { className: "dash-stat-value", children: s.value.toLocaleString() })] })] }, s.label))) }), _jsxs("div", { className: "dash-grid", children: [_jsxs("div", { className: "dash-col-main", children: [_jsxs("div", { className: "dash-card", children: [_jsxs("div", { className: "dash-card-header", children: [_jsx("h3", { children: "Asset Acquisitions" }), _jsx("span", { className: "dash-card-sub", children: new Date().getFullYear() })] }), _jsx("div", { className: "dash-bar-chart", children: data.monthly_acquisitions.map((m) => (_jsxs("div", { className: "bar-col", children: [_jsx("div", { className: "bar", "data-height": `${(m.count / maxBar) * 100}%`, children: m.count > 0 && _jsx("span", { className: "bar-val", children: m.count }) }), _jsx("span", { className: "bar-label", children: m.month })] }, m.month))) })] }), _jsxs("div", { className: "dash-card", children: [_jsxs("div", { className: "dash-card-header", children: [_jsx("h3", { children: "Recent Assets" }), _jsxs("div", { className: "dash-card-actions", children: [_jsx("button", { className: "dash-icon-btn", title: "Search", children: "\uD83D\uDD0D" }), _jsx("button", { className: "dash-icon-btn", title: "Add", children: "\u2795" }), _jsx("button", { className: "dash-icon-btn", title: "Settings", children: "\u2699\uFE0F" })] })] }), _jsxs("div", { className: "dash-asset-list", children: [data.recent_assets.map((a) => (_jsxs("div", { className: "dash-asset-row", children: [_jsx("span", { className: "dash-dot", "data-color": a.color }), _jsxs("div", { className: "dash-asset-info", children: [_jsx("span", { className: "dash-asset-name", children: a.name }), _jsx("span", { className: "dash-asset-cat", children: a.category })] }), _jsx("span", { className: "dash-asset-value", children: a.value }), _jsx("span", { className: "dash-asset-date", children: a.date })] }, a.id))), data.recent_assets.length === 0 && (_jsx("div", { className: "dash-empty", children: "No assets registered yet." }))] })] })] }), _jsxs("div", { className: "dash-col-side", children: [_jsxs("div", { className: "dash-card", children: [_jsx("div", { className: "dash-card-header", children: _jsx("h3", { children: "Asset Categories" }) }), _jsx("div", { className: "dash-cat-list", children: data.categories.map((c) => (_jsxs("div", { className: "dash-cat-row", children: [_jsxs("div", { className: "dash-cat-top", children: [_jsx("span", { className: "dash-cat-name", children: c.name }), _jsx("span", { className: "dash-cat-total", children: c.total })] }), _jsx("div", { className: "dash-cat-bar-bg", children: _jsx("div", { className: "dash-cat-bar-fill", "data-width": `${c.pct}%` }) }), _jsxs("span", { className: "dash-cat-count", children: [c.count, " assets"] })] }, c.name))) })] }), _jsxs("div", { className: "dash-card", children: [_jsx("div", { className: "dash-card-header", children: _jsx("h3", { children: "Department Allocation" }) }), _jsxs("div", { className: "dash-dept-chart", children: [_jsx("div", { className: "dash-hbar-stack", children: data.departments.map((d) => {
                                                    const total = data.departments.reduce((s, x) => s + x.assets, 0);
                                                    return (_jsx("div", { className: "dash-hbar-seg", "data-width": `${(d.assets / total) * 100}%`, "data-color": d.color, title: `${d.dept}: ${d.assets}` }, d.dept));
                                                }) }), _jsx("div", { className: "dash-dept-legend", children: data.departments.map((d) => (_jsxs("div", { className: "dash-legend-item", children: [_jsx("span", { className: "dash-dot-sm", "data-color": d.color }), _jsx("span", { children: d.dept }), _jsx("span", { className: "dash-legend-val", children: d.assets })] }, d.dept))) })] })] }), _jsxs("div", { className: "dash-card dash-insight-card", children: [_jsx("div", { className: "dash-insight-icon", children: "\uD83D\uDCA1" }), _jsx("h4", { children: "Optimize Your Assets" }), _jsx("p", { children: data.maintenance_due > 0
                                            ? `${data.maintenance_due} asset(s) are due for maintenance. Schedule servicing early to avoid downtime.`
                                            : "All maintenance is up to date. Great job keeping assets in top shape!" }), _jsx("button", { className: "btn btn-primary btn-sm", children: "View Maintenance Queue" })] })] })] })] }));
}
