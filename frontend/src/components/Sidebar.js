import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useAuth } from "../AuthContext";
import { ICONS } from "../utils/icons";
import Button from "./common/Button";
const ALL_ROLES = [
    "System Administrator",
    "Asset Manager",
    "Asset Custodian",
    "Employee",
];
const NAV_ITEMS = [
    { id: "dashboard", label: "Dashboard", icon: ICONS.dashboard, path: "/dashboard", roles: ALL_ROLES },
    { id: "requests", label: "Requests", icon: ICONS.requests, path: "/requests", roles: ALL_ROLES },
    { id: "assets", label: "Assets", icon: ICONS.assets, path: "/assets", roles: ["System Administrator", "Asset Manager", "Asset Custodian"] },
    { id: "assignments", label: "Assignments", icon: ICONS.assignments, path: "/assignments", roles: ["System Administrator", "Asset Manager"] },
    { id: "storage", label: "Storage", icon: ICONS.storage, path: "/storage", roles: ["System Administrator", "Asset Manager"] },
    { id: "transfers", label: "Transfers", icon: ICONS.transfers, path: "/transfers", roles: ["System Administrator", "Asset Manager"] },
    { id: "maintenance", label: "Maintenance", icon: ICONS.maintenance, path: "/maintenance", roles: ["System Administrator", "Asset Manager"] },
    { id: "users", label: "User Management", icon: ICONS.users, path: "/admin/users", roles: ["System Administrator", "Asset Manager"] },
    { id: "audit", label: "Audit Logs", icon: ICONS.audit, path: "/admin/audit-logs", roles: ["System Administrator", "Asset Manager"] },
    { id: "settings", label: "Settings", icon: ICONS.settings, path: "/settings", roles: ["System Administrator"] },
];
export default function Sidebar({ collapsed, onToggleCollapse, activePath, onNavigate, pinned = "inline", className = "", }) {
    const { user } = useAuth();
    const userInitials = user
        ? user.full_name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2)
        : "RS";
    const visibleNav = NAV_ITEMS.filter((n) => n.roles.some((r) => user?.role?.toLowerCase().includes(r.toLowerCase())));
    const pinClasses = pinned === "overlay"
        ? "fixed top-0 left-0 h-screen"
        : "sticky top-0 h-screen flex-shrink-0 overflow-hidden";
    return (_jsxs("aside", { className: `${pinClasses} z-40 flex flex-col p-4 gap-4 bg-gradient-to-b from-sky-sidebarTop to-sky-sidebarBot border-r border-sky-border transition-all duration-350 ease-in-out select-none motion-reduce:transition-none ${collapsed ? "w-20" : "w-[250px]"} ${className}`, children: [_jsxs("div", { className: "flex items-center gap-2.5 select-none", children: [_jsx("div", { className: "w-10 h-10 min-w-10 rounded-xl bg-gradient-to-br from-ursb to-ursb-dark flex items-center justify-center text-white font-bold text-base shadow-xl shadow-ursb/40 pointer-events-none", children: "U" }), _jsxs("div", { className: `flex flex-col overflow-hidden whitespace-nowrap transition-all duration-200 motion-reduce:transition-none ${collapsed ? "w-0 opacity-0" : "w-auto opacity-100"}`, children: [_jsx("span", { className: "font-bold text-sm text-ink leading-tight", children: "URSB Assets" }), _jsx("span", { className: "text-[11px] text-ink-dim font-medium mt-0.5", children: "Management Portal" })] })] }), _jsx("div", { className: `text-[10px] font-bold tracking-widest text-ink-dim uppercase transition-opacity duration-200 select-none ${collapsed ? "opacity-0 h-0 overflow-hidden" : "opacity-100"}`, children: "Main Menu" }), _jsx("nav", { className: "flex-1 min-h-0 flex flex-col gap-1 overflow-y-auto select-none scrollbar-thin scrollbar-thumb-sky-border/30 scrollbar-track-transparent", children: visibleNav.map((item) => {
                    const isActive = activePath === item.path ||
                        (item.path !== "/dashboard" && activePath.startsWith(item.path));
                    const Icon = item.icon;
                    return (_jsxs(Button, { variant: "nav", active: isActive, onClick: () => onNavigate(item.path), className: collapsed ? "justify-center px-2.5" : "", children: [_jsx("span", { className: `w-5 h-5 flex items-center justify-center shrink-0 ${isActive ? "text-ursb" : "text-ink-icon"}`, children: _jsx(Icon, { className: "w-4 h-4 stroke-[2.2]" }) }), _jsx("span", { className: `overflow-hidden whitespace-nowrap transition-all duration-200 ${collapsed ? "w-0 opacity-0 hidden" : "w-auto opacity-100"}`, children: item.label })] }, item.id));
                }) }), _jsxs("div", { className: "flex flex-col gap-4 select-none shrink-0", children: [_jsx("hr", { className: "border-sky-200/40 my-2" }), _jsxs("div", { className: "flex items-center gap-2.5 p-2.5 rounded-xl bg-white/60 shadow-sm", children: [_jsx("div", { className: "w-9 h-9 min-w-9 rounded-full bg-gradient-to-br from-ursb to-ursb-dark text-white flex items-center justify-center text-xs font-bold pointer-events-none", children: userInitials }), _jsxs("div", { className: `flex flex-col overflow-hidden whitespace-nowrap transition-all duration-200 ${collapsed ? "w-0 opacity-0" : "w-auto opacity-100"}`, children: [_jsx("span", { className: "text-xs font-bold text-ink leading-tight truncate max-w-36", children: user?.full_name || "Robert Ssekandi" }), _jsx("span", { className: "text-[10px] text-ink-dim font-medium mt-0.5 truncate max-w-36", children: user?.role || "System Administrator" })] })] }), _jsxs(Button, { variant: "ghost", fullWidth: true, onClick: onToggleCollapse, className: "border-dashed justify-start gap-2 text-xs text-ink-dim", children: [_jsx(ICONS.chevronLeft, { className: `w-4 h-4 transition-transform duration-350 shrink-0 motion-reduce:transition-none ${collapsed ? "rotate-180" : ""}` }), _jsx("span", { className: collapsed ? "hidden" : "", children: "Collapse" })] })] })] }));
}
