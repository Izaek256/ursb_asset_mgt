import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Button from "./common/Button";
export default function ConfirmDialog({ open, title, message, onCancel, onConfirm, isLoading = false, }) {
    if (!open)
        return null;
    return (_jsx("div", { className: "modal-overlay", children: _jsxs("div", { className: "modal", children: [title && _jsx("h3", { className: "modal-title", children: title }), _jsx("div", { className: "modal-body", children: _jsx("p", { className: "text-small text-muted", children: message }) }), _jsxs("div", { className: "modal-footer", children: [_jsx(Button, { type: "button", variant: "ghost", onClick: onCancel, children: "Cancel" }), _jsx(Button, { type: "button", variant: "danger-outline", onClick: onConfirm, isLoading: isLoading, children: "Confirm & Apply" })] })] }) }));
}
