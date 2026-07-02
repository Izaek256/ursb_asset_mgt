import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useAuth } from "../AuthContext";
import Button from "./common/Button";
const ROLE_CLASS = {
    "System Administrator": "role-admin",
    "Asset Manager": "role-manager",
    "Asset Custodian": "role-custodian",
    "Employee": "role-employee",
};
export default function ProfileModal({ open, onClose }) {
    const { user } = useAuth();
    if (!open || !user)
        return null;
    const initials = user.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    const roleCls = ROLE_CLASS[user.role] || "role-employee";
    return (_jsx("div", { className: "modal-overlay", onClick: onClose, children: _jsxs("div", { className: "modal profile-modal", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "profile-modal-header", children: [_jsx("div", { className: `profile-modal-avatar ${roleCls}`, children: initials }), _jsxs("div", { children: [_jsx("h3", { className: "modal-title", children: user.full_name }), _jsx("span", { className: `badge ${roleCls}`, children: user.role })] })] }), _jsxs("div", { className: "profile-modal-body", children: [_jsxs("div", { className: "profile-detail-row", children: [_jsx("span", { className: "profile-detail-label", children: "Email" }), _jsx("span", { className: "profile-detail-value", children: user.email })] }), _jsxs("div", { className: "profile-detail-row", children: [_jsx("span", { className: "profile-detail-label", children: "Department" }), _jsx("span", { className: "profile-detail-value", children: user.department })] }), _jsxs("div", { className: "profile-detail-row", children: [_jsx("span", { className: "profile-detail-label", children: "Account Status" }), _jsx("span", { className: `badge ${user.is_active ? "badge-active" : "badge-inactive"}`, children: user.is_active ? "Active" : "Inactive" })] }), _jsxs("div", { className: "profile-detail-row", children: [_jsx("span", { className: "profile-detail-label", children: "User ID" }), _jsx("span", { className: "profile-detail-value text-small", children: user.user_id })] }), user.created_at && (_jsxs("div", { className: "profile-detail-row", children: [_jsx("span", { className: "profile-detail-label", children: "Member Since" }), _jsx("span", { className: "profile-detail-value", children: new Date(user.created_at).toLocaleDateString() })] }))] }), _jsx("div", { className: "modal-footer", children: _jsx(Button, { type: "button", variant: "ghost", onClick: onClose, children: "Close" }) })] }) }));
}
