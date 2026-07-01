import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function SuccessBanner({ message, onDismiss }) {
    return (_jsxs("div", { className: "alert-success", children: [_jsx("p", { children: message }), onDismiss && (_jsx("button", { className: "btn btn-secondary btn-sm", onClick: onDismiss, children: "Dismiss" }))] }));
}
