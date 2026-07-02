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
    return (_jsxs("div", { className: "min-h-screen w-full flex bg-sky-page text-ink select-none overflow-x-hidden", children: [_jsx(Transition, { show: mobileOpen, as: React.Fragment, enter: "transition-opacity ease-out duration-300 motion-reduce:transition-none", enterFrom: "opacity-0", enterTo: "opacity-100", leave: "transition-opacity ease-in duration-200 motion-reduce:transition-none", leaveFrom: "opacity-100", leaveTo: "opacity-0", children: _jsx("div", { className: "fixed inset-0 z-40 bg-navy-deep/40 backdrop-blur-sm md:hidden", onClick: () => setMobileOpen(false), "aria-hidden": "true" }) }), _jsx(Transition, { show: mobileOpen, as: React.Fragment, enter: "transition ease-out duration-300 motion-reduce:transition-none", enterFrom: "-translate-x-full", enterTo: "translate-x-0", leave: "transition ease-in duration-200 motion-reduce:transition-none", leaveFrom: "translate-x-0", leaveTo: "-translate-x-full", children: _jsx("div", { className: "fixed md:hidden top-0 left-0 h-screen z-50", children: _jsx(Sidebar, { collapsed: false, onToggleCollapse: () => setCollapsed(!collapsed), activePath: activePath, onNavigate: (path) => {
                            onNavigate(path);
                            setMobileOpen(false);
                        } }) }) }), _jsx("div", { className: "hidden md:block sticky top-0 h-screen z-40", children: _jsx(Sidebar, { collapsed: collapsed, onToggleCollapse: () => setCollapsed(!collapsed), activePath: activePath, onNavigate: onNavigate }) }), _jsxs("div", { className: "flex-1 min-w-0 flex flex-col min-h-screen", children: [_jsx(Header, { pageTitle: pageTitle, onLogout: logout, onToggleMobileSidebar: () => setMobileOpen(true) }), _jsx("main", { className: "flex-1 p-5 sm:p-8 overflow-y-auto animate-fadeIn motion-reduce:animate-none", children: children })] })] }));
}
