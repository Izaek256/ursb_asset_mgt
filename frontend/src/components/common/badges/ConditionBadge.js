import { jsx as _jsx } from "react/jsx-runtime";
export default function ConditionBadge({ condition }) {
    const norm = condition.toLowerCase().trim();
    let colorClasses = "bg-badge-greyBg text-badge-greyText";
    if (["new", "good"].includes(norm)) {
        colorClasses = "bg-badge-greenBg text-badge-greenText";
    }
    else if (["fair"].includes(norm)) {
        colorClasses = "bg-badge-amberBg text-badge-amberText";
    }
    else if (["poor", "broken", "damaged"].includes(norm)) {
        colorClasses = "bg-badge-roseBg text-badge-roseText";
    }
    return (_jsx("span", { className: `inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold select-none tracking-wide ${colorClasses}`, children: condition }));
}
