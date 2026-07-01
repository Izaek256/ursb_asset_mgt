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
import Requests from "./pages/Requests";
import Assignments from "./pages/Assignments";
import Storage from "./pages/Storage";
import Maintenance from "./pages/Maintenance";
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
    { id: "requests", label: "Requests", icon: "📋", path: "/requests", roles: ALL_ROLES },
    { id: "assets", label: "Assets", icon: "📦", path: "/assets", roles: ["System Administrator", "Asset Manager", "Asset Custodian"] },
    { id: "register-asset", label: "Register Asset", icon: "➕", path: "/assets/register", roles: ["Asset Manager"] },
    { id: "assignments", label: "Assignments", icon: "🔑", path: "/assignments", roles: ["System Administrator", "Asset Manager"] },
    { id: "storage", label: "Storage", icon: "🏪", path: "/storage", roles: ["System Administrator", "Asset Manager"] },
    { id: "transfers", label: "Transfers", icon: "🔄", path: "/transfers", roles: ["System Administrator", "Asset Manager"] },
    { id: "maintenance", label: "Maintenance", icon: "🔧", path: "/maintenance", roles: ["System Administrator", "Asset Manager"] },
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
        case "requests":
            content = _jsx(Requests, {});
            break;
        case "assets":
            content = _jsx(Assets, {});
            break;
        case "register-asset":
            content = _jsx(AssetRegistration, {});
            break;
        case "assignments":
            content = _jsx(Assignments, {});
            break;
        case "storage":
            content = _jsx(Storage, {});
            break;
        case "maintenance":
            content = _jsx(Maintenance, {});
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
    // Dynamic label for requests based on role
    const getRequestsLabel = () => {
        return ["System Administrator", "Asset Manager"].includes(user.role) ? "Requests" : "My Requests";
    };
    const getPageTitle = (item) => {
        if (!item)
            return "Dashboard";
        if (item.id === "requests")
            return getRequestsLabel();
        return item.label;
    };
    return (_jsxs("div", { className: "app-container", children: [_jsxs("aside", { className: "sidebar", children: [_jsxs("div", { className: "sidebar-header", children: [_jsx("div", { className: "sidebar-icon", children: "\uD83C\uDFE2" }), _jsxs("div", { children: [_jsx("div", { className: "sidebar-title", children: "URSB Assets" }), _jsx("div", { className: "sidebar-subtitle", children: "Management Portal" })] })] }), _jsxs("nav", { className: "sidebar-nav", children: [_jsx("div", { className: "nav-section", children: "Main Menu" }), visibleNav.map((item) => (_jsxs("button", { className: `nav-item ${activeItem?.id === item.id ? "active" : ""}`, onClick: () => navigate(item.path), children: [_jsx("span", { className: "nav-icon", children: item.icon }), _jsx("span", { className: "nav-label", children: item.id === "requests" ? getRequestsLabel() : item.label })] }, item.id)))] }), _jsxs("div", { className: "sidebar-profile", onClick: () => setProfileOpen(true), children: [_jsx("div", { className: "profile-avatar", children: initials }), _jsxs("div", { className: "profile-info", children: [_jsx("div", { className: "profile-name", children: user.full_name }), _jsx("div", { className: "profile-role", children: user.role })] })] })] }), _jsxs("div", { className: "main-content", children: [_jsxs("header", { className: "header", children: [_jsxs("div", { children: [_jsx("h1", { className: "header-title", children: getPageTitle(activeItem) }), _jsxs("p", { className: "header-breadcrumb", children: ["Home / ", getPageTitle(activeItem)] })] }), _jsxs("div", { className: "header-actions", children: [_jsx("button", { className: "icon-btn", title: "Notifications", onClick: () => setNotifOpen(!notifOpen), children: "\uD83D\uDD14" }), _jsx("button", { className: "icon-btn", title: "Search", children: "\uD83D\uDD0D" }), _jsx("button", { className: "btn btn-secondary", onClick: logout, children: "Sign out" })] })] }), _jsx("div", { className: "content-area", children: content })] }), _jsx(ProfileModal, { open: profileOpen, onClose: () => setProfileOpen(false) }), _jsx(NotificationPanel, { open: notifOpen, onClose: () => setNotifOpen(false) })] }));
}
// ── Root (auth gate) ─────────────────────────────────────────────────────────────
function AppRoot() {
    const { user, isInitialLoading } = useAuth();
    // Show loading spinner during initial auth check
    if (isInitialLoading) {
        return (_jsxs("div", { style: {
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                height: "100vh",
                backgroundColor: "#f5f5f5",
                gap: "20px"
            }, children: [_jsx("div", { style: {
                        width: "50px",
                        height: "50px",
                        border: "4px solid #e0e0e0",
                        borderTop: "4px solid #4a90e2",
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite"
                    } }), _jsx("div", { style: { fontSize: "18px", color: "#666", fontWeight: "500" }, children: "Loading..." }), _jsx("style", { children: `
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        ` })] }));
    }
    // Not logged in → show login
    if (!user) {
        return _jsx(LoginPage, {});
    }
    return _jsx(AppShell, {});
}
// ── Wrapped export ───────────────────────────────────────────────────────────────
export default function App() {
    return (_jsx(AuthProvider, { children: _jsx(AppRoot, {}) }));
}
