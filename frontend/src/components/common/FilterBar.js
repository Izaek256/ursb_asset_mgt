import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Button from "./Button";
export const filterInputCls = "w-full min-w-0 px-3 py-2.5 text-sm text-ink bg-sky-topbar border border-sky-cardBorder rounded-lg focus:outline-none focus:ring-2 focus:ring-ursb/20 focus:border-ursb placeholder:text-ink-dim/50 transition-colors motion-reduce:transition-none";
export const filterSelectCls = filterInputCls;
export default function FilterBar({ children, trailing, count, onClear, className = "", }) {
    return (_jsxs("div", { className: `flex flex-wrap items-end gap-4 sm:gap-6 p-4 sm:px-5 bg-white border border-sky-cardBorder rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-250 motion-reduce:transition-none ${className}`, children: [children, onClear && (_jsx(Button, { variant: "outline", onClick: onClear, children: "Clear Filters" })), trailing, count && (_jsxs("span", { className: "ml-auto text-sm font-semibold text-ink-dim self-center whitespace-nowrap", children: [count.value, " ", count.label] }))] }));
}
export function FilterField({ label, htmlFor, children, className = "", grow = false, }) {
    return (_jsxs("div", { className: `flex flex-col gap-1.5 ${grow ? "flex-1 min-w-[180px]" : ""} ${className}`, children: [label && (_jsx("label", { htmlFor: htmlFor, className: "text-[10px] font-bold uppercase tracking-wider text-ink-dim select-none", children: label })), children] }));
}
/** @deprecated use count prop on FilterBar instead */
export function FilterCount({ count, label }) {
    return (_jsxs("span", { className: "ml-auto text-sm font-semibold text-ink-dim self-center whitespace-nowrap", children: [count, " ", label] }));
}
