import { jsx as _jsx } from "react/jsx-runtime";
export default function StatusBadge({ status }) {
    const normStatus = status.toLowerCase().replace(/\s+/g, "");
    let colorClasses = "bg-badge-greyBg text-badge-greyText"; // Default / fallback
    if (["active", "approved", "completed", "active/assigned", "pickedup"].includes(normStatus)) {
        colorClasses = "bg-badge-greenBg text-badge-greenText";
    }
    else if (["assigned", "instorage", "instore"].includes(normStatus)) {
        colorClasses = "bg-badge-blueBg text-badge-blueText";
    }
    else if (["undermaintenance", "high", "pending"].includes(normStatus)) {
        colorClasses = "bg-badge-amberBg text-badge-amberText";
    }
    else if (["low", "normal"].includes(normStatus)) {
        colorClasses = "bg-badge-greyBg text-badge-greyText";
    }
    else if (["urgent", "returned", "rejected", "deactivated", "disposed", "cancelled"].includes(normStatus)) {
        colorClasses = "bg-badge-roseBg text-badge-roseText";
    }
    // Display human-readable label
    let label = status;
    if (normStatus === "undermaintenance")
        label = "Under Maintenance";
    if (normStatus === "instorage")
        label = "In Storage";
    if (normStatus === "pickedup")
        label = "Picked Up";
    return (_jsx("span", { className: `inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold select-none tracking-wide ${colorClasses}`, children: label }));
}
