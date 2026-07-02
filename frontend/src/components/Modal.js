import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function Modal({ open, onClose, title, children }) {
    if (!open)
        return null;
    return (_jsx("div", { className: "modal-overlay", onClick: onClose, children: _jsxs("div", { className: "modal", onClick: (e) => e.stopPropagation(), children: [title && (_jsx("div", { className: "modal-header", children: _jsx("h3", { className: "modal-title", children: title }) })), _jsx("div", { className: "modal-body", children: children })] }) }));
}
