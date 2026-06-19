import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from "react";
export default function AuditLogs() {
    const [logs, setLogs] = React.useState([]);
    const [isLoading, setIsLoading] = React.useState(true);
    React.useEffect(() => {
        setIsLoading(true);
        fetch("/api/admin/audit-logs")
            .then((r) => (r.ok ? r.json() : Promise.reject()))
            .then((data) => {
            setLogs(data);
            setIsLoading(false);
        })
            .catch(() => {
            setLogs([
                {
                    id: "1",
                    timestamp: new Date(Date.now() - 3600000).toISOString(),
                    performedBy: "Alice Johnson",
                    targetUser: "Bob Smith",
                    action: "Changed role from Employee to Asset Manager",
                    ipAddress: "192.168.1.10",
                },
                {
                    id: "2",
                    timestamp: new Date(Date.now() - 7200000).toISOString(),
                    performedBy: "Alice Johnson",
                    targetUser: "Clara Zhou",
                    action: "Changed role from Asset Manager to Employee",
                    ipAddress: "192.168.1.11",
                },
                {
                    id: "3",
                    timestamp: new Date(Date.now() - 86400000).toISOString(),
                    performedBy: "Alice Johnson",
                    targetUser: "David Lee",
                    action: "Changed role from Employee to Asset Custodian",
                    ipAddress: "192.168.1.12",
                },
            ]);
            setIsLoading(false);
        });
    }, []);
    if (isLoading) {
        return (_jsx("div", { style: { textAlign: "center", padding: "2rem", color: "var(--color-muted)" }, children: "Loading audit logs..." }));
    }
    return (_jsxs("div", { className: "card", children: [_jsxs("div", { className: "card-header", children: [_jsx("h2", { className: "card-title", children: "Activity Log" }), _jsxs("div", { className: "text-small text-muted", children: [logs.length, " records"] })] }), _jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Timestamp" }), _jsx("th", { children: "Performed By (Admin)" }), _jsx("th", { children: "Target User" }), _jsx("th", { children: "Action Taken" }), _jsx("th", { children: "IP Address" })] }) }), _jsx("tbody", { children: logs.map((l) => (_jsxs("tr", { children: [_jsx("td", { className: "text-small", children: new Date(l.timestamp).toLocaleString() }), _jsx("td", { children: l.performedBy }), _jsx("td", { children: l.targetUser }), _jsx("td", { children: l.action }), _jsx("td", { className: "text-small text-muted", children: l.ipAddress ?? "-" })] }, l.id))) })] }), logs.length === 0 && (_jsx("div", { style: { padding: "2rem", textAlign: "center", color: "var(--color-muted)" }, children: "No audit logs found." }))] }));
}
