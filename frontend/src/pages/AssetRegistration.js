import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React from "react";
import { apiFetch, useAuth } from "../AuthContext";
const ASSET_TYPES = ["ICT Equipment", "Furniture", "Vehicle", "Software", "Other"];
const CONDITIONS = ["New", "Good", "Refurbished", "Damaged"];
const STATUSES = ["Active", "In Store"];
const SOURCE_TYPES = ["Procurement", "Donation", "Other"];
const INITIAL = {
    name: "",
    asset_type: "ICT Equipment",
    serial_number: "",
    condition: "New",
    cost: "",
    department: "",
    acquisition_date: "",
    status: "Active",
    category: "",
    supplier: "",
    source_type: "Procurement",
};
export default function AssetRegistration() {
    const { token } = useAuth();
    const [form, setForm] = React.useState(INITIAL);
    const [error, setError] = React.useState(null);
    const [submitting, setSubmitting] = React.useState(false);
    const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        // Basic client-side validation
        if (!form.name.trim())
            return setError("Asset name is required.");
        if (!form.serial_number.trim())
            return setError("Serial number is required.");
        if (!form.category.trim())
            return setError("Category is required.");
        if (!form.supplier.trim())
            return setError("Supplier is required.");
        if (!form.cost || parseFloat(form.cost) <= 0)
            return setError("Cost must be a positive number.");
        if (!form.acquisition_date)
            return setError("Acquisition date is required.");
        setSubmitting(true);
        try {
            await apiFetch("/assets", {
                method: "POST",
                body: JSON.stringify({
                    name: form.name.trim(),
                    asset_type: form.asset_type,
                    serial_number: form.serial_number.trim(),
                    condition: form.condition,
                    cost: parseFloat(form.cost),
                    department: form.department.trim() || null,
                    acquisition_date: form.acquisition_date,
                    status: form.status,
                    category: form.category.trim(),
                    supplier: form.supplier.trim(),
                    source_type: form.source_type,
                }),
            }, token);
            // Success — navigate back to assets list
            window.history.pushState({}, "", "/assets");
            window.dispatchEvent(new PopStateEvent("popstate"));
        }
        catch (err) {
            setError(err.message || "Failed to register asset.");
        }
        finally {
            setSubmitting(false);
        }
    };
    return (_jsx(_Fragment, { children: _jsxs("div", { className: "card", children: [_jsx("div", { className: "card-header", children: _jsx("h3", { className: "card-title", children: "Register New Asset" }) }), _jsxs("div", { className: "card-body", children: [error && _jsx("div", { className: "alert-error", children: error }), _jsxs("form", { onSubmit: handleSubmit, children: [_jsxs("div", { className: "form-row", children: [_jsxs("div", { className: "form-group", children: [_jsx("label", { className: "form-label", htmlFor: "reg-name", children: "Asset Name *" }), _jsx("input", { id: "reg-name", type: "text", className: "form-control", placeholder: "e.g. Dell Latitude 5520", value: form.name, onChange: set("name"), required: true })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { className: "form-label", htmlFor: "reg-serial", children: "Serial Number *" }), _jsx("input", { id: "reg-serial", type: "text", className: "form-control", placeholder: "e.g. SN-2024-00123", value: form.serial_number, onChange: set("serial_number"), required: true })] })] }), _jsxs("div", { className: "form-row", children: [_jsxs("div", { className: "form-group", children: [_jsx("label", { className: "form-label", htmlFor: "reg-type", children: "Asset Type *" }), _jsx("select", { id: "reg-type", className: "form-control", value: form.asset_type, onChange: set("asset_type"), children: ASSET_TYPES.map((t) => _jsx("option", { value: t, children: t }, t)) })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { className: "form-label", htmlFor: "reg-category", children: "Category *" }), _jsx("input", { id: "reg-category", type: "text", className: "form-control", placeholder: "e.g. Laptops", value: form.category, onChange: set("category"), required: true })] })] }), _jsxs("div", { className: "form-row", children: [_jsxs("div", { className: "form-group", children: [_jsx("label", { className: "form-label", htmlFor: "reg-condition", children: "Condition *" }), _jsx("select", { id: "reg-condition", className: "form-control", value: form.condition, onChange: set("condition"), children: CONDITIONS.map((c) => _jsx("option", { value: c, children: c }, c)) })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { className: "form-label", htmlFor: "reg-status", children: "Status *" }), _jsx("select", { id: "reg-status", className: "form-control", value: form.status, onChange: set("status"), children: STATUSES.map((s) => _jsx("option", { value: s, children: s }, s)) })] })] }), _jsxs("div", { className: "form-row", children: [_jsxs("div", { className: "form-group", children: [_jsx("label", { className: "form-label", htmlFor: "reg-cost", children: "Cost (UGX) *" }), _jsx("input", { id: "reg-cost", type: "number", className: "form-control", placeholder: "e.g. 2500000", value: form.cost, onChange: set("cost"), min: "0", step: "0.01", required: true })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { className: "form-label", htmlFor: "reg-date", children: "Acquisition Date *" }), _jsx("input", { id: "reg-date", type: "date", className: "form-control", value: form.acquisition_date, onChange: set("acquisition_date"), required: true })] })] }), _jsxs("div", { className: "form-row", children: [_jsxs("div", { className: "form-group", children: [_jsx("label", { className: "form-label", htmlFor: "reg-supplier", children: "Supplier *" }), _jsx("input", { id: "reg-supplier", type: "text", className: "form-control", placeholder: "e.g. ABC Supplies Ltd", value: form.supplier, onChange: set("supplier"), required: true })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { className: "form-label", htmlFor: "reg-source", children: "Source Type *" }), _jsx("select", { id: "reg-source", className: "form-control", value: form.source_type, onChange: set("source_type"), children: SOURCE_TYPES.map((s) => _jsx("option", { value: s, children: s }, s)) })] })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { className: "form-label", htmlFor: "reg-dept", children: "Department (optional)" }), _jsx("input", { id: "reg-dept", type: "text", className: "form-control", placeholder: "e.g. ICT Department", value: form.department, onChange: set("department") })] }), _jsxs("div", { style: { display: "flex", gap: "10px", marginTop: "20px" }, children: [_jsx("button", { type: "submit", className: "btn btn-primary", disabled: submitting, children: submitting ? "Registering…" : "Register Asset" }), _jsx("button", { type: "button", className: "btn btn-secondary", onClick: () => {
                                                window.history.pushState({}, "", "/assets");
                                                window.dispatchEvent(new PopStateEvent("popstate"));
                                            }, children: "Cancel" })] })] })] })] }) }));
}
