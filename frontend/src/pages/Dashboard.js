import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from "react";
import { apiFetch } from "../AuthContext";
import { ICONS } from "../utils/icons";
import Button from "../components/common/Button";
import { CHART, DEPT_BAR_CLASSES, DOT_CLASSES } from "../theme/chartColors";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, } from "recharts";
// ── Fallback mock data ───────────────────────────────────────────────────────────
const MOCK = {
    stats: [
        { label: "Total Assets", value: 23 },
        { label: "Active / Assigned", value: 14 },
        { label: "In Maintenance", value: 2 },
        { label: "Disposed", value: 3 },
    ],
    recent_assets: [
        { id: "1", name: "Dell Latitude 5540", category: "ICT Equipment", value: "UGX 3,200,000", date: "Today" },
        { id: "2", name: "Office Desk (Mahogany)", category: "Furniture", value: "UGX 850,000", date: "Today" },
        { id: "3", name: "Toyota Land Cruiser Prado", category: "Vehicle", value: "UGX 120,000,000", date: "Today" },
    ],
    categories: [
        { name: "ICT Equipment", count: 12, total: "UGX 45,230,000", pct: 78 },
        { name: "Furniture", count: 4, total: "UGX 6,000,000", pct: 32 },
        { name: "Vehicle", count: 3, total: "UGX 290,000,000", pct: 88 },
        { name: "Software", count: 2, total: "UGX 14,350,000", pct: 22 },
    ],
    monthly_acquisitions: [
        { month: "Jan", count: 2 }, { month: "Feb", count: 1 }, { month: "Mar", count: 3 },
        { month: "Apr", count: 0 }, { month: "May", count: 2 }, { month: "Jun", count: 1 },
        { month: "Jul", count: 1 }, { month: "Aug", count: 0 }, { month: "Sep", count: 0 },
        { month: "Oct", count: 0 }, { month: "Nov", count: 0 }, { month: "Dec", count: 0 },
    ],
    departments: [
        { dept: "ICT", assets: 10 },
        { dept: "Administration", assets: 5 },
        { dept: "Finance", assets: 3 },
        { dept: "Legal", assets: 1 },
    ],
    maintenance_due: 3,
};
const CORE_STAT_KEYS = ["total", "active", "maintenance", "disposed"];
const resolveStatCard = (stats, key) => {
    const matchers = {
        total: (label) => label.toLowerCase().includes("total"),
        active: (label) => label.toLowerCase().includes("active") || label.toLowerCase().includes("assigned"),
        maintenance: (label) => label.toLowerCase().includes("maintenance"),
        disposed: (label) => label.toLowerCase().includes("disposed"),
    };
    const defaults = {
        total: { label: "Total Assets", value: 0 },
        active: { label: "Active / Assigned", value: 0 },
        maintenance: { label: "In Maintenance", value: 0 },
        disposed: { label: "Disposed", value: 0 },
    };
    return stats.find((s) => matchers[key](s.label)) ?? defaults[key];
};
const getStatConfig = (label) => {
    const l = label.toLowerCase();
    if (l.includes("total")) {
        return { icon: ICONS.assets, bg: "bg-stat-amberChip", text: "text-stat-amberIcon" };
    }
    if (l.includes("active") || l.includes("assigned")) {
        return { icon: ICONS.checkCircle, bg: "bg-stat-greenChip", text: "text-stat-greenIcon" };
    }
    if (l.includes("maintenance")) {
        return { icon: ICONS.maintenance, bg: "bg-stat-blueChip", text: "text-stat-blueIcon" };
    }
    if (l.includes("disposed")) {
        return { icon: ICONS.trashCircle, bg: "bg-stat-roseChip", text: "text-stat-roseIcon" };
    }
    return { icon: ICONS.assets, bg: "bg-stat-blueChip", text: "text-stat-blueIcon" };
};
export default function Dashboard({ onNavigate }) {
    const [data, setData] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
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
        return () => {
            cancelled = true;
        };
    }, []);
    if (loading || !data) {
        return (_jsx("div", { className: "flex justify-center items-center py-20 select-none", children: _jsx("div", { className: "animate-spin rounded-full h-10 w-10 border-b-2 border-ursb" }) }));
    }
    const statsList = CORE_STAT_KEYS.map((key) => resolveStatCard(data.stats, key));
    const totalDeptAssets = data.departments.reduce((sum, d) => sum + d.assets, 0) || 1;
    return (_jsxs("div", { className: "w-full flex flex-col gap-6 select-none font-sans", children: [data.maintenance_due > 0 && (_jsxs("div", { className: "bg-white border border-sky-cardBorder rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm hover:shadow-md transition-shadow duration-250", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: "w-11 h-11 rounded-xl bg-stat-amberChip text-stat-amberIcon flex items-center justify-center shrink-0", children: _jsx(ICONS.maintenance, { className: "w-5 h-5 stroke-[2.4]" }) }), _jsxs("div", { className: "flex flex-col", children: [_jsx("span", { className: "font-bold text-ink text-sm", children: "Maintenance Schedule Warning" }), _jsxs("span", { className: "text-xs text-ink-dim mt-0.5", children: ["There are ", data.maintenance_due, " assets requiring scheduled maintenance or repairs."] })] })] }), _jsx(Button, { variant: "primary", onClick: () => onNavigate("/maintenance"), children: "View Schedule" })] })), _jsx("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-5", children: statsList.map((s, index) => {
                    const cfg = getStatConfig(s.label);
                    const StatIcon = cfg.icon;
                    const staggerDelays = ["", "anim-delay-75", "anim-delay-150", "anim-delay-200"];
                    const delayClass = staggerDelays[index] ?? "anim-delay-200";
                    return (_jsxs("div", { className: `bg-white border border-sky-cardBorder rounded-2xl p-5 flex items-center gap-3.5 shadow-sm hover:shadow-xl hover:shadow-ursb/20 hover:-translate-y-1.5 hover:border-transparent duration-300 transition-all opacity-0 animate-statIn motion-reduce:animate-none motion-reduce:opacity-100 ${delayClass}`, children: [_jsx("span", { className: `w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg} ${cfg.text}`, children: _jsx(StatIcon, { className: "w-5 h-5 stroke-[2.4]" }) }), _jsxs("div", { className: "min-w-0", children: [_jsx("span", { className: "block text-[10px] font-bold uppercase tracking-wider text-ink-dim leading-tight", children: s.label }), _jsx("span", { className: "block text-2xl sm:text-3xl font-bold text-ink mt-1 font-sans leading-none tabular-nums", children: typeof s.value === "number" ? s.value.toLocaleString() : "—" })] })] }, s.label));
                }) }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-6", children: [_jsxs("div", { className: "lg:col-span-2 flex flex-col gap-6", children: [_jsxs("div", { className: "bg-white border border-sky-cardBorder rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow duration-250", children: [_jsxs("div", { className: "flex items-center justify-between border-b border-sky-page/20 pb-4 mb-4", children: [_jsxs("h3", { className: "font-bold text-sm text-ink flex items-center gap-2", children: [_jsx(ICONS.clock, { className: "w-4 h-4 stroke-[2.2] text-ink-icon" }), "Asset Acquisitions"] }), _jsx("span", { className: "text-[11px] font-bold text-ink-dim bg-sky-topbar px-2 py-0.5 rounded-lg border border-sky-border/30", children: new Date().getFullYear() })] }), _jsx("div", { className: "h-48 w-full", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(BarChart, { data: data.monthly_acquisitions, margin: { top: 15, right: 10, left: 10, bottom: 5 }, children: [_jsx("defs", { children: _jsxs("linearGradient", { id: "colorAcquisitions", x1: "0", y1: "0", x2: "0", y2: "1", children: [_jsx("stop", { offset: "0%", stopColor: CHART.ursbLight }), _jsx("stop", { offset: "50%", stopColor: CHART.ursb }), _jsx("stop", { offset: "100%", stopColor: CHART.ursbDark })] }) }), _jsx(XAxis, { dataKey: "month", axisLine: false, tickLine: false, tick: { fill: CHART.ursbDark, fontSize: 10, fontWeight: 600 } }), _jsx(Tooltip, { cursor: { fill: "rgba(215, 233, 252, 0.15)" }, content: ({ active, payload }) => {
                                                            if (active && payload && payload.length) {
                                                                return (_jsxs("div", { className: "bg-white border border-sky-cardBorder px-2.5 py-1.5 rounded-lg shadow-md text-xs font-bold text-ursb", children: [payload[0].value, " assets"] }));
                                                            }
                                                            return null;
                                                        } }), _jsx(Bar, { dataKey: "count", fill: "url(#colorAcquisitions)", radius: [8, 8, 0, 0], maxBarSize: 32 })] }) }) })] }), _jsxs("div", { className: "bg-white border border-sky-cardBorder rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow duration-250", children: [_jsxs("div", { className: "flex items-center justify-between border-b border-sky-page/20 pb-4 mb-4", children: [_jsxs("h3", { className: "font-bold text-sm text-ink flex items-center gap-2", children: [_jsx(ICONS.assets, { className: "w-4.5 h-4.5 stroke-[2.2] text-ink-icon" }), "Recent Assets"] }), _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx(Button, { variant: "icon", className: "w-8 h-8", onClick: () => onNavigate("/assets"), title: "Search inventory", "aria-label": "Search inventory", children: _jsx(ICONS.search, { className: "w-4 h-4 stroke-[2.2]" }) }), _jsx(Button, { variant: "icon", className: "w-8 h-8", onClick: () => onNavigate("/assets/register"), title: "Add asset", "aria-label": "Add asset", children: _jsx(ICONS.plus, { className: "w-4 h-4 stroke-[2.2]" }) })] })] }), _jsxs("div", { className: "flex flex-col divide-y divide-sky-page/10", children: [data.recent_assets.map((a, idx) => (_jsxs("div", { className: "flex items-center justify-between py-3 px-2 hover:bg-sky-page/20 rounded-xl transition-colors duration-150 motion-reduce:transition-none", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: `w-2 h-2 rounded-full shrink-0 ${DOT_CLASSES[idx % DOT_CLASSES.length]}` }), _jsxs("div", { className: "flex flex-col", children: [_jsx("span", { className: "font-bold text-ink text-xs sm:text-sm", children: a.name || "—" }), _jsx("span", { className: "text-[10px] text-ink-dim font-medium mt-0.5", children: a.category || "—" })] })] }), _jsxs("div", { className: "flex flex-col items-end gap-0.5", children: [_jsx("span", { className: "text-xs sm:text-sm font-bold text-ink text-right", children: a.value || "—" }), _jsx("span", { className: "text-[10px] text-ink-dim/60 font-semibold text-right", children: a.date || "—" })] })] }, a.id))), data.recent_assets.length === 0 && (_jsx("div", { className: "text-center py-6 text-xs text-ink-dim font-medium", children: "No assets registered yet." }))] })] })] }), _jsxs("div", { className: "flex flex-col gap-6", children: [_jsxs("div", { className: "bg-white border border-sky-cardBorder rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow duration-250", children: [_jsx("div", { className: "border-b border-sky-page/20 pb-4 mb-4", children: _jsxs("h3", { className: "font-bold text-sm text-ink flex items-center gap-2", children: [_jsx(ICONS.building, { className: "w-4.5 h-4.5 stroke-[2.2] text-ink-icon" }), "Asset Categories"] }) }), _jsx("div", { className: "flex flex-col gap-5", children: data.categories.map((c) => (_jsxs("div", { className: "flex flex-col gap-1.5", children: [_jsxs("div", { className: "flex items-center justify-between text-xs font-semibold text-ink", children: [_jsx("span", { className: "font-bold truncate max-w-[130px]", children: c.name || "—" }), _jsx("span", { className: "text-ink-dim", children: c.total || "—" })] }), _jsx("div", { className: "h-1.5 w-full bg-badge-greyBg rounded-full overflow-hidden", children: _jsx("div", { className: "h-full rounded-full bg-gradient-to-r from-ursb to-emerald-400 transition-all duration-500 motion-reduce:transition-none", style: { width: `${Math.min(c.pct, 100)}%` } }) }), _jsxs("span", { className: "text-[10px] text-ink-dim/60 font-semibold", children: [c.count, " assets"] })] }, c.name))) })] }), _jsxs("div", { className: "bg-white border border-sky-cardBorder rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow duration-250", children: [_jsx("div", { className: "border-b border-sky-page/20 pb-4 mb-4", children: _jsxs("h3", { className: "font-bold text-sm text-ink flex items-center gap-2", children: [_jsx(ICONS.users, { className: "w-4.5 h-4.5 stroke-[2.2] text-ink-icon" }), "Department Allocation"] }) }), _jsxs("div", { className: "flex flex-col gap-4", children: [_jsx("div", { className: "h-4 w-full bg-badge-greyBg rounded-lg overflow-hidden flex shadow-inner", children: data.departments.map((d, idx) => {
                                                    const pct = (d.assets / totalDeptAssets) * 100;
                                                    return (_jsx("div", { className: `h-full first:rounded-l-lg last:rounded-r-lg transition-all duration-300 ${DEPT_BAR_CLASSES[idx % DEPT_BAR_CLASSES.length]}`, style: { width: `${pct}%` }, title: `${d.dept}: ${d.assets} assets` }, d.dept));
                                                }) }), _jsx("div", { className: "flex flex-col gap-2", children: data.departments.map((d, idx) => (_jsxs("div", { className: "flex items-center justify-between text-xs font-semibold text-ink", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: `w-2.5 h-2.5 rounded-full shrink-0 ${DEPT_BAR_CLASSES[idx % DEPT_BAR_CLASSES.length]}` }), _jsx("span", { className: "truncate max-w-[130px]", children: d.dept || "—" })] }), _jsx("span", { className: "text-ink-dim font-bold", children: d.assets })] }, d.dept))) })] })] }), _jsxs("div", { className: "bg-gradient-to-br from-ursb to-ursb-dark text-white rounded-2xl p-5 shadow-sm", children: [_jsx("div", { className: "w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center mb-3", children: _jsx(ICONS.alertCircle, { className: "w-4 h-4 stroke-[2.2]" }) }), _jsx("h4", { className: "font-bold text-sm mb-1.5 font-sans leading-tight", children: "Optimize Organization Assets" }), _jsx("p", { className: "text-[11.5px] text-sky-page/90 leading-relaxed", children: data.maintenance_due > 0
                                            ? `${data.maintenance_due} asset(s) are overdue for scheduled service. Book maintenance schedules to extend lifecycle.`
                                            : "All organizational asset maintenance schedules are clean and completed. Awesome work!" }), _jsx(Button, { variant: "outline", className: "mt-4 w-full bg-white/10 hover:bg-white text-white hover:text-ursb border-white/20 hover:border-white shadow-none", onClick: () => onNavigate("/maintenance"), children: "View Maintenance Queue" })] })] })] })] }));
}
