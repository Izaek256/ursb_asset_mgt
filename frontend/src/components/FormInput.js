import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React from "react";
export default function FormInput(props) {
    const baseId = React.useId();
    const errorId = `${baseId}-error`;
    const helperId = `${baseId}-helper`;
    const hasError = "error" in props && !!props.error;
    const renderInput = () => {
        switch (props.type) {
            case "select":
                return (_jsx("select", { id: baseId, value: props.value, onChange: (e) => props.onChange(e.target.value), disabled: props.disabled, className: `form-control ${hasError ? "form-control-error" : ""}`, "aria-invalid": hasError, "aria-describedby": hasError ? errorId : helperId, children: props.options.map((opt) => (_jsx("option", { value: opt.value, children: opt.label }, opt.value))) }));
            case "textarea":
                return (_jsxs(_Fragment, { children: [_jsx("textarea", { id: baseId, value: props.value, onChange: (e) => props.onChange(e.target.value), placeholder: props.placeholder, rows: props.rows || 4, disabled: props.disabled, className: `form-control ${hasError ? "form-control-error" : ""}`, "aria-invalid": hasError, "aria-describedby": hasError ? errorId : helperId }), props.characterCount && (_jsxs("div", { className: "form-char-counter", children: [props.characterCount.current, props.characterCount.min && ` / ${props.characterCount.min} minimum`] }))] }));
            case "checkbox":
                return (_jsxs("label", { className: "settings-toggle", children: [_jsx("input", { type: "checkbox", checked: props.checked, onChange: (e) => props.onChange(e.target.checked), disabled: props.disabled }), _jsx("span", { className: "toggle-slider" })] }));
            default:
                return (_jsx("input", { id: baseId, type: props.type, value: props.value, onChange: (e) => props.onChange(e.target.value), placeholder: props.placeholder, disabled: props.disabled, className: `form-control ${hasError ? "form-control-error" : ""}`, "aria-invalid": hasError, "aria-describedby": hasError ? errorId : helperId }));
        }
    };
    return (_jsxs("div", { className: `form-group ${props.className || ""}`, children: [props.label && (_jsxs("label", { htmlFor: baseId, className: "form-label", children: [props.label, props.required && _jsx("span", { className: "form-required", children: "*" })] })), renderInput(), props.helper && !hasError && (_jsx("small", { id: helperId, className: "form-helper", children: props.helper })), hasError && (_jsx("small", { id: errorId, className: "form-error", children: props.error }))] }));
}
