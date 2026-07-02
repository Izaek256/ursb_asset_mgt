import { jsx as _jsx } from "react/jsx-runtime";
export default function LoadingSpinner({ size = "md", className = "" }) {
    const sizeClass = size === "sm" ? "spinner-sm" : size === "lg" ? "spinner-lg" : "spinner";
    return _jsx("span", { className: `spinner ${sizeClass} ${className}` });
}
