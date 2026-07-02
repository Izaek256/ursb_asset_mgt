import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from "react";
export default function StatCard({ label, value, icon, color = "#185FA5" }) {
    const cardRef = React.useRef(null);
    React.useEffect(() => {
        const el = cardRef.current;
        if (!el)
            return;
        const iconEl = el.querySelector(".dash-stat-icon");
        if (iconEl && color) {
            iconEl.style.background = color + "20";
            iconEl.style.color = color;
        }
    }, [color]);
    return (_jsxs("div", { className: "dash-stat-card", ref: cardRef, children: [icon && _jsx("div", { className: "dash-stat-icon", children: icon }), _jsxs("div", { children: [_jsx("div", { className: "dash-stat-label", children: label }), _jsx("div", { className: "dash-stat-value", children: typeof value === "number" ? value.toLocaleString() : value })] })] }));
}
