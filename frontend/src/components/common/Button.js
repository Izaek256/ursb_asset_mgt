import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function Button({ variant = "primary", fullWidth = false, isLoading = false, active = false, children, className = "", disabled, ...props }) {
    const baseStyle = "inline-flex items-center justify-center font-bold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95 motion-reduce:transform-none motion-reduce:transition-none cursor-pointer select-none";
    const variants = {
        primary: "rounded-xl py-3 px-5 text-sm bg-gradient-to-br from-ursb to-ursb-dark text-white border-none shadow-lg shadow-ursb/30 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-ursb/40 focus:ring-ursb/50",
        outline: "rounded-lg py-2 px-4 text-xs bg-gradient-to-br from-ursb to-ursb-dark text-white border border-ursb shadow-md shadow-ursb/25 hover:bg-white hover:text-ursb-dark hover:border-ursb hover:-translate-y-0.5 hover:shadow-lg hover:shadow-ursb/30 focus:ring-ursb/50",
        "danger-outline": "rounded-lg py-2 px-4 text-xs bg-white text-badge-roseText border border-badge-roseText/30 hover:bg-badge-roseBg hover:border-badge-roseText hover:-translate-y-0.5 hover:shadow-md focus:ring-badge-roseText/40",
        ghost: "rounded-xl py-2.5 px-4 text-sm bg-sky-topbar text-ink border border-sky-cardBorder hover:bg-white hover:text-ursb hover:-translate-y-0.5 hover:shadow-md hover:shadow-ursb/15 focus:ring-ursb/30",
        icon: "w-10 h-10 rounded-xl bg-sky-topbar text-ink-dim border border-sky-cardBorder hover:bg-white hover:text-ursb hover:-translate-y-0.5 hover:shadow-md hover:shadow-ursb/15 focus:ring-ursb/30 p-0",
        nav: "w-full rounded-xl py-2.5 px-3 text-sm text-left gap-3 text-ink hover:bg-white hover:text-ursb-dark hover:shadow-lg hover:shadow-ursb/20 hover:-translate-y-0.5 focus:ring-ursb/30",
    };
    const activeNav = variant === "nav" && active
        ? "bg-white text-ursb-dark shadow-lg shadow-ursb/20 translate-y-0"
        : "";
    const widthStyle = fullWidth ? "w-full" : "";
    return (_jsxs("button", { className: `${baseStyle} ${variants[variant]} ${activeNav} ${widthStyle} ${className}`, disabled: disabled || isLoading, ...props, children: [isLoading && (_jsxs("svg", { className: "animate-spin -ml-1 mr-2 h-4 w-4 text-current motion-reduce:animate-none", xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", children: [_jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }), _jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" })] })), children] }));
}
