import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from "react";
import { AuthProvider, useAuth } from "./AuthContext";
import AppLayout from "./components/AppLayout";
import AdminUsers from "./pages/AdminUsers";
import AuditLogs from "./pages/AuditLogs";
import Assets from "./pages/Assets";
import AssetDetail from "./pages/AssetDetail";
import AssetRegistration from "./pages/AssetRegistration";
import Assignments from "./pages/Assignments";
import Dashboard from "./pages/Dashboard";
import LoginPage from "./pages/Login";
import Maintenance from "./pages/Maintenance";
import Requests from "./pages/Requests";
import Settings from "./pages/Settings";
import Storage from "./pages/Storage";
import Transfers from "./pages/Transfers";
const NAV_LABELS = {
    "/dashboard": "Dashboard",
    "/requests": "Requests",
    "/assets": "Assets",
    "/assets/register": "Register Asset",
    "/assignments": "Assignments",
    "/storage": "Storage",
    "/transfers": "Transfers",
    "/maintenance": "Maintenance",
    "/admin/users": "User Management",
    "/admin/audit-logs": "Audit Logs",
    "/settings": "Settings",
};
function AppShell() {
    const { user } = useAuth();
    const [path, setPath] = React.useState(window.location.pathname || "/dashboard");
    React.useEffect(() => {
        const onPop = () => setPath(window.location.pathname);
        window.addEventListener("popstate", onPop);
        return () => window.removeEventListener("popstate", onPop);
    }, []);
    const navigate = (to) => {
        window.history.pushState({}, "", to);
        setPath(to);
    };
    const getRequestsLabel = () => ["System Administrator", "Asset Manager"].includes(user.role) ? "Requests" : "My Requests";
    const getPageTitle = () => {
        if (path.startsWith("/assets/") && path !== "/assets" && path !== "/assets/register") {
            return "Asset Detail";
        }
        if (path === "/requests")
            return getRequestsLabel();
        return NAV_LABELS[path] ?? "Dashboard";
    };
    const renderContent = () => {
        if (path.startsWith("/assets/") && path !== "/assets" && path !== "/assets/register") {
            return _jsx(AssetDetail, {});
        }
        switch (path) {
            case "/dashboard":
                return _jsx(Dashboard, { onNavigate: navigate });
            case "/requests":
                return _jsx(Requests, {});
            case "/assets":
                return _jsx(Assets, {});
            case "/assets/register":
                return _jsx(AssetRegistration, {});
            case "/assignments":
                return _jsx(Assignments, {});
            case "/storage":
                return _jsx(Storage, {});
            case "/transfers":
                return _jsx(Transfers, {});
            case "/maintenance":
                return _jsx(Maintenance, {});
            case "/admin/audit-logs":
                return _jsx(AuditLogs, {});
            case "/admin/users":
                return _jsx(AdminUsers, {});
            case "/settings":
                return _jsx(Settings, {});
            default:
                return _jsx(Dashboard, { onNavigate: navigate });
        }
    };
    return (_jsx(AppLayout, { pageTitle: getPageTitle(), activePath: path, onNavigate: navigate, children: renderContent() }));
}
function AppRoot() {
    const { user, isInitialLoading } = useAuth();
    if (isInitialLoading) {
        return (_jsxs("div", { className: "flex flex-col justify-center items-center h-screen bg-sky-page gap-5 select-none", children: [_jsx("div", { className: "animate-spin rounded-full h-12 w-12 border-4 border-sky-border border-t-ursb" }), _jsx("div", { className: "text-base text-ink-dim font-semibold", children: "Loading..." })] }));
    }
    if (!user) {
        return _jsx(LoginPage, {});
    }
    return _jsx(AppShell, {});
}
export default function App() {
    return (_jsx(AuthProvider, { children: _jsx(AppRoot, {}) }));
}
