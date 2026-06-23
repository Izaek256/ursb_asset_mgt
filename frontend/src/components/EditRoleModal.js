import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from "react";
const ROLE_OPTIONS = [
    "System Administrator",
    "Asset Manager",
    "Asset Custodian",
    "Employee",
];
export default function EditRoleModal({ user, open, onClose, onRequestConfirm }) {
    const [selected, setSelected] = React.useState(null);
    React.useEffect(() => {
        setSelected(user ? user.role : null);
    }, [user, open]);
    if (!open || !user)
        return null;
    return (_jsx("div", { className: "modal-overlay", children: _jsxs("div", { className: "modal", children: [_jsx("div", { className: "modal-header", children: _jsx("h3", { className: "modal-title", children: "Edit Role" }) }), _jsxs("div", { className: "modal-body", children: [_jsxs("div", { className: "form-group", children: [_jsx("label", { className: "read-only-label", children: "Name" }), _jsx("div", { className: "read-only-text", children: user.name })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { className: "read-only-label", children: "Email" }), _jsx("div", { className: "read-only-text", children: user.email })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "role", className: "form-label", children: "Role" }), _jsxs("select", { id: "role", value: selected ?? "", onChange: (e) => setSelected(e.target.value), className: "form-control", children: [_jsx("option", { value: "", children: "Select a role..." }), ROLE_OPTIONS.map((r) => (_jsx("option", { value: r, children: r }, r)))] })] })] }), _jsxs("div", { className: "modal-footer", children: [_jsx("button", { className: "btn btn-secondary", onClick: onClose, children: "Cancel" }), _jsx("button", { className: "btn btn-primary", onClick: () => selected && onRequestConfirm(selected), disabled: selected === user.role || !selected, children: "Save Changes" })] })] }) }));
}
