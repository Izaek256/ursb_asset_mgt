import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function PageHeader({ title, subtitle, actions }) {
    return (_jsxs("div", { className: "page-header-actions-bar", style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }, children: [_jsxs("div", { children: [_jsx("h2", { style: { fontSize: "1.5rem", fontWeight: 600, color: "var(--color-primary)" }, children: title }), subtitle && _jsx("p", { className: "text-small text-muted", style: { marginTop: "0.25rem" }, children: subtitle })] }), actions && _jsx("div", { className: "page-header-buttons", style: { display: "flex", gap: "0.5rem" }, children: actions })] }));
}
