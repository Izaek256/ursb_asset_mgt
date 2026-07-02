import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from "react";
import { apiFetch, useAuth } from "../AuthContext";
import Table from "../components/common/Table";
import Button from "../components/common/Button";
import FilterBar, { FilterField, filterInputCls, filterSelectCls } from "../components/common/FilterBar";
import ErrorMessage from "../components/ErrorMessage";
import PageHeader from "../components/PageHeader";
function formatActionDescription(log) {
    const action = log.action.replace(/_/g, " ");
    if (log.action === "LOGIN") {
        return `LOGIN — User ${log.user_name} logged in from session ${log.table_affected}`;
    }
    if (log.action === "ACKNOWLEDGE_TRANSFER") {
        return `${log.action} — Transfer acknowledged by ${log.user_name}`;
    }
    return `${log.action} — ${action} on ${log.table_affected}`;
}
export default function AuditLogs() {
    const { token } = useAuth();
    const [logs, setLogs] = React.useState([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [page, setPage] = React.useState(1);
    const [pageSize, setPageSize] = React.useState(20);
    const [total, setTotal] = React.useState(0);
    const [totalPages, setTotalPages] = React.useState(1);
    const [userId, setUserId] = React.useState("");
    const [action, setAction] = React.useState("");
    const [tableAffected, setTableAffected] = React.useState("");
    const [fromDate, setFromDate] = React.useState("");
    const [toDate, setToDate] = React.useState("");
    const [retryCount, setRetryCount] = React.useState(0);
    React.useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        setError(null);
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("page_size", String(pageSize));
        if (userId)
            params.set("user_id", userId);
        if (action)
            params.set("action", action);
        if (tableAffected)
            params.set("table_affected", tableAffected);
        if (fromDate)
            params.set("from_date", fromDate);
        if (toDate)
            params.set("to_date", toDate);
        apiFetch(`/admin/audit-logs?${params.toString()}`, {}, token)
            .then((data) => {
            if (!cancelled) {
                setLogs(Array.isArray(data.logs) ? data.logs : []);
                setTotal(data.total || 0);
                setTotalPages(data.total_pages || 1);
            }
        })
            .catch(() => {
            if (!cancelled) {
                setLogs([]);
                setError("Failed to load audit logs. Please try again.");
            }
        })
            .finally(() => { if (!cancelled)
            setIsLoading(false); });
        return () => { cancelled = true; };
    }, [token, page, pageSize, userId, action, tableAffected, fromDate, toDate, retryCount]);
    const dateInvalid = fromDate && toDate && fromDate > toDate;
    const columns = [
        {
            header: "Timestamp",
            render: (l) => (_jsx("span", { className: "text-xs text-ink-dim", children: new Date(l.timestamp).toLocaleString() })),
        },
        { header: "Performed By", render: (l) => l.user_name },
        { header: "Target", render: (l) => _jsx("span", { className: "text-xs text-ink-dim", children: l.table_affected }) },
        {
            header: "Action",
            render: (l) => (_jsx("span", { className: "text-xs text-ink font-medium", children: formatActionDescription(l) })),
        },
    ];
    const clearFilters = () => {
        setUserId("");
        setAction("");
        setTableAffected("");
        setFromDate("");
        setToDate("");
        setPage(1);
    };
    return (_jsxs("div", { className: "w-full flex flex-col gap-5 select-none font-sans", children: [error && (_jsx(ErrorMessage, { message: error, onRetry: () => { setError(null); setRetryCount((c) => c + 1); } })), _jsx(PageHeader, { title: "Audit Logs", subtitle: "System-wide activity history for compliance and troubleshooting" }), _jsxs(FilterBar, { onClear: clearFilters, children: [_jsx(FilterField, { label: "User ID", htmlFor: "user-id-filter", children: _jsx("input", { id: "user-id-filter", type: "number", className: filterInputCls, value: userId, disabled: isLoading, onChange: (e) => { setUserId(e.target.value); setPage(1); }, placeholder: "User ID" }) }), _jsx(FilterField, { label: "Action", htmlFor: "action-filter", children: _jsx("input", { id: "action-filter", type: "text", className: filterInputCls, value: action, disabled: isLoading, onChange: (e) => { setAction(e.target.value); setPage(1); }, placeholder: "e.g. ASSET, TRANSFER" }) }), _jsx(FilterField, { label: "Table", htmlFor: "table-filter", children: _jsxs("select", { id: "table-filter", value: tableAffected, disabled: isLoading, onChange: (e) => { setTableAffected(e.target.value); setPage(1); }, className: filterSelectCls, children: [_jsx("option", { value: "", children: "All Tables" }), _jsx("option", { value: "assets", children: "assets" }), _jsx("option", { value: "users", children: "users" }), _jsx("option", { value: "assignments", children: "assignments" }), _jsx("option", { value: "transfers", children: "transfers" }), _jsx("option", { value: "maintenance_records", children: "maintenance_records" }), _jsx("option", { value: "disposal_records", children: "disposal_records" }), _jsx("option", { value: "asset_requests", children: "asset_requests" }), _jsx("option", { value: "sessions", children: "sessions" })] }) }), _jsx(FilterField, { label: "From", htmlFor: "from-date", children: _jsx("input", { id: "from-date", type: "date", className: filterInputCls, value: fromDate, disabled: isLoading, onChange: (e) => { setFromDate(e.target.value); setPage(1); } }) }), _jsx(FilterField, { label: "To", htmlFor: "to-date", children: _jsx("input", { id: "to-date", type: "date", className: filterInputCls, value: toDate, disabled: isLoading, onChange: (e) => { setToDate(e.target.value); setPage(1); } }) })] }), dateInvalid && (_jsx("p", { className: "text-xs font-semibold text-badge-roseText", children: "From date must be before To date." })), _jsxs("div", { className: "bg-white border border-sky-cardBorder rounded-2xl p-5 sm:p-6 shadow-sm", children: [_jsxs("div", { className: "flex items-center justify-between border-b border-sky-page/20 pb-4 mb-4", children: [_jsx("h3", { className: "font-bold text-sm text-ink", children: "Activity Log" }), _jsxs("span", { className: "text-xs font-semibold text-ink-dim", children: [total, " records"] })] }), _jsx(Table, { data: logs, columns: columns, rowKey: (l) => l.log_id, isLoading: isLoading, emptyMessage: "No audit logs found.", embedded: true })] }), _jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3 p-4 bg-white border border-sky-cardBorder rounded-2xl shadow-sm", children: [_jsx(Button, { variant: "outline", onClick: () => setPage((p) => p - 1), disabled: page === 1 || isLoading, children: "Previous" }), _jsxs("span", { className: "text-sm font-semibold text-ink-dim", children: ["Page ", page, " of ", totalPages] }), _jsx(Button, { variant: "outline", onClick: () => setPage((p) => p + 1), disabled: page === totalPages || total === 0 || isLoading, children: "Next" }), _jsxs("select", { value: pageSize, onChange: (e) => { setPageSize(Number(e.target.value)); setPage(1); }, disabled: isLoading, className: filterSelectCls, children: [_jsx("option", { value: 10, children: "10 per page" }), _jsx("option", { value: 20, children: "20 per page" }), _jsx("option", { value: 50, children: "50 per page" })] })] })] }));
}
