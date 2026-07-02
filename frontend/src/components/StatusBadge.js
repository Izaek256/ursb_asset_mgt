import { jsx as _jsx } from "react/jsx-runtime";
export default function StatusBadge({ status }) {
    let cls = "badge-info";
    let label = status;
    const normalized = status.toLowerCase().replace(/\s+/g, "");
    switch (normalized) {
        case "active":
            cls = "badge-active";
            break;
        case "inactive":
        case "disposed":
        case "cancelled":
        case "returned":
            cls = "badge-inactive";
            break;
        case "pending":
            cls = "badge-pending";
            break;
        case "approved":
            cls = "badge-approved";
            break;
        case "rejected":
            cls = "badge-rejected";
            break;
        case "undermaintenance":
            cls = "badge-warning";
            label = "Under Maintenance";
            break;
        case "instorage":
        case "instore":
            cls = "badge-info";
            label = "In Storage";
            break;
        case "assigned":
            cls = "badge-info";
            break;
        case "pickedup":
            cls = "badge-active";
            label = "Picked Up";
            break;
        case "completed":
            cls = "badge-active";
            break;
        default:
            cls = "badge-info";
    }
    return _jsx("span", { className: `badge ${cls}`, children: label });
}
