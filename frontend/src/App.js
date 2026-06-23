import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from "react";
import { AuthProvider, useAuth } from "./AuthContext";
import AdminUsers from "./pages/AdminUsers";
import AuditLogs from "./pages/AuditLogs";
import Assets from "./pages/Assets";
import AssetRegistration from "./pages/AssetRegistration";
import Dashboard from "./pages/Dashboard";
import LoginPage from "./pages/Login";
import Settings from "./pages/Settings";
import Transfers from "./pages/Transfers";
import ProfileModal from "./components/ProfileModal";
import NotificationPanel from "./components/NotificationPanel";
const ALL_ROLES = [
    "System Administrator",
    "Asset Manager",
    "Asset Custodian",
    "Employee",
];
const NAV_ITEMS = [
    { id: "dashboard", label: "Dashboard", icon: "📊", path: "/dashboard", roles: ALL_ROLES },
    { id: "assets", label: "Assets", icon: "📦", path: "/assets", roles: ["System Administrator", "Asset Manager", "Asset Custodian"] },
    { id: "register-asset", label: "Register Asset", icon: "➕", path: "/assets/register", roles: ["Asset Manager"] },
    { id: "transfers", label: "Transfers", icon: "🔄", path: "/transfers", roles: ["System Administrator", "Asset Manager"] },
    { id: "users", label: "User Management", icon: "👥", path: "/admin/users", roles: ["System Administrator", "Asset Manager"] },
    { id: "audit", label: "Audit Logs", icon: "🕐", path: "/admin/audit-logs", roles: ["System Administrator", "Asset Manager"] },
    { id: "settings", label: "Settings", icon: "⚙️", path: "/settings", roles: ["System Administrator"] },
];
// ── Inner app (requires auth) ────────────────────────────────────────────────────
function AppShell() {
    const { user, logout } = useAuth();
    const [path, setPath] = React.useState(window.location.pathname || "/dashboard");
    const [profileOpen, setProfileOpen] = React.useState(false);
    const [notifOpen, setNotifOpen] = React.useState(false);
    React.useEffect(() => {
        const onPop = () => setPath(window.location.pathname);
        window.addEventListener("popstate", onPop);
        return () => window.removeEventListener("popstate", onPop);
    }, []);
    const navigate = (to) => {
        window.history.pushState({}, "", to);
        setPath(to);
    };
    // Filter nav items by user role
    const visibleNav = NAV_ITEMS.filter((n) => n.roles.includes(user.role));
    const activeItem = visibleNav.find((n) => n.path === path) ?? visibleNav[0];
    // Route to correct content
    let content;
    switch (activeItem?.id) {
        case "dashboard":
            content = _jsx(Dashboard, {});
            break;
        case "assets":
            content = _jsx(Assets, {});
            break;
        case "register-asset":
            content = _jsx(AssetRegistration, {});
            break;
        case "transfers":
            content = _jsx(Transfers, {});
            break;
        case "audit":
            content = _jsx(AuditLogs, {});
            break;
        case "users":
            content = _jsx(AdminUsers, {});
            break;
        case "settings":
            content = _jsx(Settings, {});
            break;
        default:
            content = (_jsxs("div", { className: "placeholder-page", children: [_jsx("div", { className: "placeholder-icon", children: activeItem?.icon ?? "📄" }), _jsx("h2", { children: activeItem?.label ?? "Page" }), _jsx("p", { children: "This section is under development." })] }));
    }
    // User initials
    const initials = user.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    return (_jsxs("div", { className: "app-container", children: [_jsxs("aside", { className: "sidebar", children: [_jsxs("div", { className: "sidebar-header", children: [_jsx("div", { className: "sidebar-icon", children: "\uD83C\uDFE2" }), _jsxs("div", { children: [_jsx("div", { className: "sidebar-title", children: "URSB Assets" }), _jsx("div", { className: "sidebar-subtitle", children: "Management Portal" })] })] }), _jsxs("nav", { className: "sidebar-nav", children: [_jsx("div", { className: "nav-section", children: "Main Menu" }), visibleNav.map((item) => (_jsxs("button", { className: `nav-item ${activeItem?.id === item.id ? "active" : ""}`, onClick: () => navigate(item.path), children: [_jsx("span", { className: "nav-icon", children: item.icon }), _jsx("span", { className: "nav-label", children: item.label })] }, item.id)))] }), _jsxs("div", { className: "sidebar-profile", onClick: () => setProfileOpen(true), children: [_jsx("div", { className: "profile-avatar", children: initials }), _jsxs("div", { className: "profile-info", children: [_jsx("div", { className: "profile-name", children: user.full_name }), _jsx("div", { className: "profile-role", children: user.role })] })] })] }), _jsxs("div", { className: "main-content", children: [_jsxs("header", { className: "header", children: [_jsxs("div", { children: [_jsx("h1", { className: "header-title", children: activeItem?.label ?? "Dashboard" }), _jsxs("p", { className: "header-breadcrumb", children: ["Home / ", activeItem?.label ?? "Dashboard"] })] }), _jsxs("div", { className: "header-actions", children: [_jsx("button", { className: "icon-btn", title: "Notifications", onClick: () => setNotifOpen(!notifOpen), children: "\uD83D\uDD14" }), _jsx("button", { className: "icon-btn", title: "Search", children: "\uD83D\uDD0D" }), _jsx("button", { className: "btn btn-secondary", onClick: logout, children: "Sign out" })] })] }), _jsx("div", { className: "content-area", children: content })] }), _jsx(ProfileModal, { open: profileOpen, onClose: () => setProfileOpen(false) }), _jsx(NotificationPanel, { open: notifOpen, onClose: () => setNotifOpen(false) })] }));
}
// ── Root (auth gate) ─────────────────────────────────────────────────────────────
function AppRoot() {
    const { user, token } = useAuth();
    // Not logged in → show login
    if (!user || !token) {
        return _jsx(LoginPage, {});
    }
    return _jsx(AppShell, {});
}
// ── Wrapped export ───────────────────────────────────────────────────────────────
export default function App() {
    return (_jsx(AuthProvider, { children: _jsx(AppRoot, {}) }));
}
