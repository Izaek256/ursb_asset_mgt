import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from "react";
const SAMPLE_NOTIFICATIONS = [
    {
        id: "1",
        title: "Maintenance Due",
        message: "3 assets are due for scheduled maintenance this week.",
        time: "2 hours ago",
        read: false,
        type: "warning",
    },
    {
        id: "2",
        title: "New Asset Registered",
        message: "Dell Latitude 5540 Laptop has been added to ICT Equipment.",
        time: "5 hours ago",
        read: false,
        type: "success",
    },
    {
        id: "3",
        title: "Role Change Completed",
        message: "John Mukasa's role was updated to Asset Custodian.",
        time: "1 day ago",
        read: true,
        type: "info",
    },
    {
        id: "4",
        title: "Disposal Approved",
        message: "Write-off for Dell OptiPlex 390 has been approved.",
        time: "2 days ago",
        read: true,
        type: "info",
    },
];
export default function NotificationPanel({ open, onClose }) {
    const [items, setItems] = React.useState(SAMPLE_NOTIFICATIONS);
    if (!open)
        return null;
    const unread = items.filter((n) => !n.read).length;
    const markAllRead = () => {
        setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    };
    const typeIcon = {
        info: "ℹ️",
        warning: "⚠️",
        success: "✅",
    };
    return (_jsx("div", { className: "notif-overlay", onClick: onClose, children: _jsxs("div", { className: "notif-panel", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "notif-header", children: [_jsxs("h3", { children: ["Notifications ", unread > 0 && _jsx("span", { className: "notif-badge", children: unread })] }), unread > 0 && (_jsx("button", { className: "notif-mark-read", onClick: markAllRead, children: "Mark all read" }))] }), _jsx("div", { className: "notif-list", children: items.map((n) => (_jsxs("div", { className: `notif-item ${n.read ? "read" : "unread"}`, children: [_jsx("span", { className: "notif-icon", children: typeIcon[n.type] }), _jsxs("div", { className: "notif-content", children: [_jsx("div", { className: "notif-title", children: n.title }), _jsx("div", { className: "notif-msg", children: n.message }), _jsx("div", { className: "notif-time", children: n.time })] })] }, n.id))) })] }) }));
}
