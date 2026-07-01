import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function ErrorMessage({ message, onRetry }) {
    return (_jsxs("div", { className: "alert-error", children: [_jsx("p", { children: message }), onRetry && (_jsx("button", { className: "btn btn-secondary btn-sm", onClick: onRetry, children: "Retry" }))] }));
}
