import { jsx as _jsx } from "react/jsx-runtime";
export default function RoleBadge({ role }) {
    const norm = role.toLowerCase().replace(/\s+/g, "");
    let colorClasses = "bg-badge-greyBg text-badge-greyText";
    if (norm.includes("systemadministrator") || norm.includes("admin")) {
        colorClasses = "bg-badge-roseBg text-badge-roseText";
    }
    else if (norm.includes("assetmanager") || norm.includes("manager")) {
        colorClasses = "bg-badge-blueBg text-badge-blueText";
    }
    else if (norm.includes("custodian")) {
        colorClasses = "bg-badge-greenBg text-badge-greenText";
    }
    else if (norm.includes("employee") || norm.includes("staff")) {
        colorClasses = "bg-badge-greyBg text-badge-greyText";
    }
    return (_jsx("span", { className: `inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold select-none tracking-wide ${colorClasses}`, children: role }));
}
