import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from "react";
import { Transition } from "@headlessui/react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { useAuth } from "../AuthContext";
export default function AppLayout({ pageTitle, activePath, onNavigate, children, }) {
    const { logout } = useAuth();
    const [collapsed, setCollapsed] = React.useState(false);
    const [mobileOpen, setMobileOpen] = React.useState(false);
    return (_jsxs("div", { className: "flex h-screen w-full overflow-hidden bg-sky-page text-ink select-none", children: [_jsx(Transition, { show: mobileOpen, as: React.Fragment, enter: "transition-opacity ease-out duration-300 motion-reduce:transition-none", enterFrom: "opacity-0", enterTo: "opacity-100", leave: "transition-opacity ease-in duration-200 motion-reduce:transition-none", leaveFrom: "opacity-100", leaveTo: "opacity-0", children: _jsx("div", { className: "fixed inset-0 z-40 bg-navy-deep/40 backdrop-blur-sm md:hidden", onClick: () => setMobileOpen(false), "aria-hidden": "true" }) }), _jsx(Transition, { show: mobileOpen, as: React.Fragment, enter: "transition ease-out duration-300 motion-reduce:transition-none", enterFrom: "-translate-x-full", enterTo: "translate-x-0", leave: "transition ease-in duration-200 motion-reduce:transition-none", leaveFrom: "translate-x-0", leaveTo: "-translate-x-full", children: _jsx("div", { className: "fixed md:hidden top-0 left-0 h-screen z-50", children: _jsx(Sidebar, { pinned: "overlay", collapsed: false, onToggleCollapse: () => setCollapsed(!collapsed), activePath: activePath, onNavigate: (path) => {
                            onNavigate(path);
                            setMobileOpen(false);
                        } }) }) }), _jsx("div", { className: "hidden md:block h-screen flex-shrink-0", children: _jsx(Sidebar, { pinned: "inline", collapsed: collapsed, onToggleCollapse: () => setCollapsed(!collapsed), activePath: activePath, onNavigate: onNavigate }) }), _jsxs("div", { className: "flex flex-1 flex-col min-w-0 h-screen overflow-hidden bg-sky-page", children: [_jsx(Header, { pageTitle: pageTitle, onLogout: logout, onToggleMobileSidebar: () => setMobileOpen(true) }), _jsx("main", { className: "flex-1 min-h-0 overflow-y-auto p-6 animate-fadeIn motion-reduce:animate-none", children: children })] })] }));
}
