import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function EmptyState({ icon = "📭", title, description }) {
    return (_jsxs("div", { className: "page-empty", children: [_jsx("div", { className: "empty-state-icon", children: icon }), _jsx("h3", { children: title }), description && _jsx("p", { className: "text-muted", children: description })] }));
}
