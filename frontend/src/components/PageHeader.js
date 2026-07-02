import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function PageHeader({ title, subtitle, actions }) {
    return (_jsxs("div", { className: "flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-1", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-xl sm:text-2xl font-bold text-ink leading-tight", children: title }), subtitle && (_jsx("p", { className: "text-sm text-ink-dim mt-1.5 font-medium", children: subtitle }))] }), actions && (_jsx("div", { className: "flex flex-wrap items-center gap-2 shrink-0", children: actions }))] }));
}
