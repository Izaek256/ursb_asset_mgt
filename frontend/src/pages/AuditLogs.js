import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from "react";
import { apiFetch, useAuth } from "../AuthContext";
export default function AuditLogs() {
    const { token } = useAuth();
    const [logs, setLogs] = React.useState([]);
    const [isLoading, setIsLoading] = React.useState(true);
    React.useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        apiFetch("/admin/audit-logs", {}, token)
            .then((data) => { if (!cancelled)
            setLogs(data); })
            .catch(() => { if (!cancelled)
            setLogs([]); })
            .finally(() => { if (!cancelled)
            setIsLoading(false); });
        return () => { cancelled = true; };
    }, [token]);
    if (isLoading) {
        return (_jsx("div", { className: "page-loading", children: "Loading audit logs..." }));
    }
    return (_jsxs("div", { className: "card", children: [_jsxs("div", { className: "card-header", children: [_jsx("h2", { className: "card-title", children: "Activity Log" }), _jsxs("div", { className: "text-small text-muted", children: [logs.length, " records"] })] }), _jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Timestamp" }), _jsx("th", { children: "Performed By" }), _jsx("th", { children: "Target" }), _jsx("th", { children: "Action" })] }) }), _jsx("tbody", { children: logs.map((l) => (_jsxs("tr", { children: [_jsx("td", { className: "text-small", children: new Date(l.timestamp).toLocaleString() }), _jsx("td", { children: l.performedBy }), _jsx("td", { children: l.targetUser }), _jsx("td", { className: "text-small", children: l.action })] }, l.id))) })] }), logs.length === 0 && (_jsx("div", { className: "page-empty", children: "No audit logs found." }))] }));
}
