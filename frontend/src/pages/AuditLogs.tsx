import React from "react";
import { AuditLog, AuditLogListResponse } from "../types";
import { apiFetch, useAuth } from "../AuthContext";
import Table, { Column } from "../components/common/Table";
import Button from "../components/common/Button";
import FilterBar, { FilterField, filterInputCls, filterSelectCls } from "../components/common/FilterBar";
import ErrorMessage from "../components/ErrorMessage";
import PageHeader from "../components/PageHeader";
import { fmtDateTime } from "../utils/formatDate";

function formatActionDescription(log: AuditLog): string {
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
  const [logs, setLogs] = React.useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
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
    if (userId) params.set("user_id", userId);
    if (action) params.set("action", action);
    if (tableAffected) params.set("table_affected", tableAffected);
    if (fromDate) params.set("from_date", fromDate);
    if (toDate) params.set("to_date", toDate);

    apiFetch<AuditLogListResponse>(`/admin/audit-logs?${params.toString()}`, {}, token)
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
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [token, page, pageSize, userId, action, tableAffected, fromDate, toDate, retryCount]);

  const dateInvalid = fromDate && toDate && fromDate > toDate;

  const columns: Column<AuditLog>[] = [
    {
      header: "Timestamp",
      render: (l) => (
        <span className="text-xs text-ink-dim">{fmtDateTime(l.timestamp)}</span>
      ),
    },
    { header: "Performed By", render: (l) => l.user_name },
    { header: "Target", render: (l) => <span className="text-xs text-ink-dim">{l.table_affected}</span> },
    {
      header: "Action",
      render: (l) => (
        <span className="text-xs text-ink font-medium">{formatActionDescription(l)}</span>
      ),
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

  return (
    <div className="w-full flex flex-col gap-5 select-none font-sans">
      {error && (
        <ErrorMessage message={error} onRetry={() => { setError(null); setRetryCount((c) => c + 1); }} />
      )}

      <PageHeader
        title="Audit Logs"
        subtitle="System-wide activity history for compliance and troubleshooting"
      />

      <FilterBar onClear={clearFilters}>
        <FilterField label="User ID" htmlFor="user-id-filter">
          <input
            id="user-id-filter"
            type="number"
            className={filterInputCls}
            value={userId}
            disabled={isLoading}
            onChange={(e) => { setUserId(e.target.value); setPage(1); }}
            placeholder="User ID"
          />
        </FilterField>
        <FilterField label="Action" htmlFor="action-filter">
          <input
            id="action-filter"
            type="text"
            className={filterInputCls}
            value={action}
            disabled={isLoading}
            onChange={(e) => { setAction(e.target.value); setPage(1); }}
            placeholder="e.g. ASSET, TRANSFER"
          />
        </FilterField>
        <FilterField label="Table" htmlFor="table-filter">
          <select
            id="table-filter"
            value={tableAffected}
            disabled={isLoading}
            onChange={(e) => { setTableAffected(e.target.value); setPage(1); }}
            className={filterSelectCls}
          >
            <option value="">All Tables</option>
            <option value="assets">assets</option>
            <option value="users">users</option>
            <option value="assignments">assignments</option>
            <option value="transfers">transfers</option>
            <option value="maintenance_records">maintenance_records</option>
            <option value="disposal_records">disposal_records</option>
            <option value="asset_requests">asset_requests</option>
            <option value="sessions">sessions</option>
          </select>
        </FilterField>
        <FilterField label="From" htmlFor="from-date">
          <input
            id="from-date"
            type="date"
            className={filterInputCls}
            value={fromDate}
            disabled={isLoading}
            onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
          />
        </FilterField>
        <FilterField label="To" htmlFor="to-date">
          <input
            id="to-date"
            type="date"
            className={filterInputCls}
            value={toDate}
            disabled={isLoading}
            onChange={(e) => { setToDate(e.target.value); setPage(1); }}
          />
        </FilterField>
      </FilterBar>

      {dateInvalid && (
        <p className="text-xs font-semibold text-badge-roseText">From date must be before To date.</p>
      )}

      <div className="bg-white border border-sky-cardBorder rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-sky-page/20 pb-4 mb-4">
          <h3 className="font-bold text-sm text-ink">Activity Log</h3>
          <span className="text-xs font-semibold text-ink-dim">{total} records</span>
        </div>
        <Table
          data={logs}
          columns={columns}
          rowKey={(l) => l.log_id}
          isLoading={isLoading}
          emptyMessage="No audit logs found."
          embedded
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white border border-sky-cardBorder rounded-2xl shadow-sm">
        <Button variant="outline" onClick={() => setPage((p) => p - 1)} disabled={page === 1 || isLoading}>
          Previous
        </Button>
        <span className="text-sm font-semibold text-ink-dim">Page {page} of {totalPages}</span>
        <Button variant="outline" onClick={() => setPage((p) => p + 1)} disabled={page === totalPages || total === 0 || isLoading}>
          Next
        </Button>
        <select
          value={pageSize}
          onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
          disabled={isLoading}
          className={filterSelectCls}
        >
          <option value={10}>10 per page</option>
          <option value={20}>20 per page</option>
          <option value={50}>50 per page</option>
        </select>
      </div>
    </div>
  );
}
