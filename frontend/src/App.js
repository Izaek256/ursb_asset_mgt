import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from "react";
import AdminUsers from "./pages/AdminUsers";
import AuditLogs from "./pages/AuditLogs";
const TAB_ITEMS = [
    { id: "users", label: "User Management", icon: "👥" },
    { id: "audit", label: "Audit Logs", icon: "🕐" },
];
function App() {
    const [path, setPath] = React.useState(window.location.pathname || "/admin/users");
    React.useEffect(() => {
        const onPop = () => setPath(window.location.pathname);
        window.addEventListener("popstate", onPop);
        return () => window.removeEventListener("popstate", onPop);
    }, []);
    const navigate = (to) => {
        window.history.pushState({}, "", to);
        setPath(to);
    };
    let content;
    let activeTab = "users";
    if (path === "/admin/audit-logs") {
        content = _jsx(AuditLogs, {});
        activeTab = "audit";
    }
    else {
        content = _jsx(AdminUsers, {});
        activeTab = "users";
    }
    return (_jsxs("div", { className: "app-container", children: [_jsxs("aside", { className: "sidebar", children: [_jsxs("div", { className: "sidebar-header", children: [_jsx("div", { className: "sidebar-icon", children: "\uD83C\uDFE2" }), _jsxs("div", { children: [_jsx("div", { className: "sidebar-title", children: "Staff Portal" }), _jsx("div", { className: "sidebar-subtitle", children: "Admin Dashboard" })] })] }), _jsxs("nav", { className: "sidebar-nav", children: [_jsx("div", { className: "nav-section", children: "Main Menu" }), TAB_ITEMS.map((item) => (_jsxs("button", { className: `nav-item ${activeTab === item.id ? "active" : ""}`, onClick: () => navigate(item.id === "users" ? "/admin/users" : "/admin/audit-logs"), children: [_jsx("span", { className: "nav-icon", children: item.icon }), item.label] }, item.id)))] }), _jsxs("div", { className: "sidebar-profile", children: [_jsx("div", { className: "profile-avatar", children: "SA" }), _jsxs("div", { children: [_jsx("div", { className: "profile-name", children: "System Admin" }), _jsx("div", { className: "profile-role", children: "Administrator" })] })] })] }), _jsxs("div", { className: "main-content", children: [_jsxs("header", { className: "header", children: [_jsx("h1", { className: "header-title", children: activeTab === "users" ? "User Management" : "Audit Logs" }), _jsxs("div", { className: "header-actions", children: [_jsx("button", { className: "icon-btn", children: "\uD83D\uDD14" }), _jsx("button", { className: "btn btn-secondary", children: "Sign out" })] })] }), _jsx("div", { className: "content-area", children: content })] })] }));
}
export default App;
