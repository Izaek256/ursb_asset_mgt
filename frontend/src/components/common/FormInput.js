import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React from "react";
import { Listbox, Transition } from "@headlessui/react";
import { ICONS } from "../../utils/icons";
export default function FormInput(props) {
    const [showPassword, setShowPassword] = React.useState(false);
    const baseId = React.useId();
    const errorId = `${baseId}-error`;
    const helperId = `${baseId}-helper`;
    const hasError = !!props.error;
    const inputStyles = `w-full rounded-[9px] bg-navy-deep/30 border border-glass-border/38 py-3 px-4 text-white placeholder-white/30 focus:outline-none focus:bg-navy-deep/45 focus:border-ice focus:ring-[3px] focus:ring-ursb/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed`;
    const renderInput = () => {
        switch (props.type) {
            case "select":
                return (_jsx(Listbox, { value: props.value, onChange: props.onChange, disabled: props.disabled, children: _jsxs("div", { className: "relative w-full", children: [_jsxs(Listbox.Button, { className: "relative w-full text-left rounded-[9px] bg-navy-deep/30 border border-glass-border/38 py-3 pl-4 pr-10 text-white placeholder-white/30 focus:outline-none focus:bg-navy-deep/45 focus:border-ice focus:ring-[3px] focus:ring-ursb/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer", children: [_jsx("span", { className: "block truncate", children: props.options.find((opt) => opt.value === props.value)?.label ||
                                            props.placeholder ||
                                            "Select an option" }), _jsx("span", { className: "absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-white/50", children: _jsx(ICONS.chevronDown, { className: "w-5 h-5", "aria-hidden": "true" }) })] }), _jsx(Transition, { as: React.Fragment, leave: "transition ease-in duration-100", leaveFrom: "opacity-100", leaveTo: "opacity-0", children: _jsx(Listbox.Options, { className: "absolute z-50 w-full py-1 mt-1 overflow-auto text-base bg-navy-deep/95 border border-glass-border/38 rounded-[9px] shadow-lg max-h-60 ring-1 ring-black/5 focus:outline-none", children: props.options.map((opt) => (_jsx(Listbox.Option, { value: opt.value, className: ({ active }) => `relative cursor-pointer select-none py-2.5 pl-10 pr-4 ${active ? "bg-ursb text-white" : "text-ice"}`, children: ({ selected, active }) => (_jsxs(_Fragment, { children: [_jsx("span", { className: `block truncate ${selected ? "font-semibold" : "font-normal"}`, children: opt.label }), selected ? (_jsx("span", { className: `absolute inset-y-0 left-0 flex items-center pl-3 ${active ? "text-white" : "text-ursb"}`, children: _jsx(ICONS.checkCircle, { className: "w-5 h-5", "aria-hidden": "true" }) })) : null] })) }, opt.value))) }) })] }) }));
            case "password":
                return (_jsxs("div", { className: "relative w-full", children: [_jsx("input", { id: baseId, type: showPassword ? "text" : "password", value: props.value, onChange: (e) => props.onChange(e.target.value), placeholder: props.placeholder, disabled: props.disabled, className: `${inputStyles} pr-12 ${hasError ? "border-red-500/50" : ""}`, "aria-invalid": hasError, "aria-describedby": hasError ? errorId : helperId, autoComplete: props.autoComplete || "current-password" }), _jsx("button", { type: "button", onClick: () => setShowPassword(!showPassword), className: "absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 focus:outline-none transition-colors cursor-pointer", children: showPassword ? (_jsx(ICONS.eyeOff, { className: "w-5 h-5" })) : (_jsx(ICONS.eye, { className: "w-5 h-5" })) })] }));
            default:
                return (_jsx("input", { id: baseId, type: props.type, value: props.value, onChange: (e) => props.onChange(e.target.value), placeholder: props.placeholder, disabled: props.disabled, autoFocus: props.autoFocus, className: `${inputStyles} ${hasError ? "border-red-500/50" : ""}`, "aria-invalid": hasError, "aria-describedby": hasError ? errorId : helperId, autoComplete: props.autoComplete }));
        }
    };
    return (_jsxs("div", { className: `flex flex-col gap-2 w-full ${props.className || ""}`, children: [props.label && (_jsxs("label", { htmlFor: baseId, className: "text-xs font-semibold text-white/70 tracking-wide uppercase select-none", children: [props.label, props.required && _jsx("span", { className: "text-red-400 ml-1", children: "*" })] })), renderInput(), props.helper && !hasError && (_jsx("span", { id: helperId, className: "text-xs text-white/50 px-1", children: props.helper })), hasError && (_jsx("span", { id: errorId, className: "text-xs text-red-400 px-1 font-medium", children: props.error }))] }));
}
