import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function ConfirmDialog({ open, title, message, onCancel, onConfirm, }) {
    if (!open)
        return null;
    return (_jsx("div", { className: "modal-overlay", children: _jsxs("div", { className: "modal", children: [title && _jsx("h3", { className: "modal-title", children: title }), _jsx("div", { className: "modal-body", children: _jsx("p", { className: "text-small text-muted", children: message }) }), _jsxs("div", { className: "modal-footer", children: [_jsx("button", { className: "btn btn-secondary", onClick: onCancel, children: "Cancel" }), _jsx("button", { className: "btn btn-danger", onClick: onConfirm, children: "Confirm & Apply" })] })] }) }));
}
