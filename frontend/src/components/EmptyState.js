import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from "react";
import { ICONS } from "../utils/icons";
const DefaultIcon = ICONS.assets;
export default function EmptyState({ icon, title, description }) {
    const renderedIcon = icon ??
        React.createElement(DefaultIcon, { className: "w-6 h-6 text-ink-icon stroke-[2.2]" });
    return (_jsxs("div", { className: "bg-white border border-sky-cardBorder rounded-2xl p-12 text-center flex flex-col items-center gap-3 shadow-sm", children: [_jsx("span", { className: "w-14 h-14 rounded-2xl bg-sky-topbar border border-sky-border/30 flex items-center justify-center select-none", children: renderedIcon }), _jsx("h3", { className: "font-bold text-ink text-base", children: title }), description && (_jsx("p", { className: "text-sm text-ink-dim max-w-sm leading-relaxed", children: description }))] }));
}
