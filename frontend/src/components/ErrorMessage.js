import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Button from "./common/Button";
export default function ErrorMessage({ message, onRetry }) {
    return (_jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-badge-roseBg border border-badge-roseText/20 text-badge-roseText text-sm animate-fadeIn motion-reduce:animate-none", children: [_jsx("p", { className: "font-semibold", children: message }), onRetry && (_jsx(Button, { variant: "danger-outline", onClick: onRetry, children: "Retry" }))] }));
}
