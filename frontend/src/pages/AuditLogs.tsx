import React from "react";
import { AuditLog, AuditLogListResponse } from "../types";
import { apiFetch, useAuth } from "../AuthContext";

export default function AuditLogs() {
  const { token } = useAuth();
  // Action colour map — cosmetic only, does not affect filtering
  const ACTION_COLOURS: Record<string, string> = {
    LOGIN: "blue", LOGOUT: "blue", SIGNUP: "blue",
    FAILED_LOGIN: "blue", CREATE_USER: "blue", CHANGE_ROLE: "blue",
    DEACTIVATE_USER: "red", REACTIVATE_USER: "blue", CHANGE_PASSWORD: "blue",
    REGISTER_ASSET: "green", UPDATE_ASSET: "green", DEACTIVATE_ASSET: "red",
    REACTIVATE_ASSET: "green", DISPOSE_ASSET: "red",
    EXPORT_ASSETS_PDF: "green", EXPORT_ASSETS_EXCEL: "green",
    TRANSFER_ASSET: "purple", ACKNOWLEDGE_TRANSFER: "purple",
    ASSIGN_ASSET: "green", RETURN_ASSET: "green",
    RECORD_MAINTENANCE: "green", COMPLETE_MAINTENANCE: "green",
  };
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
          setLogs(data.logs);
          setTotal(data.total);
          setTotalPages(data.total_pages);
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

  if (isLoading) {
    return (
      <div className="page-loading">
        Loading audit logs...
      </div>
    );
  }
  if (error) {
    return (
      <div className="card">
        <p>{error}</p>
        <button onClick={() => {setError(null); setRetryCount(c => c + 1);}}>Retry</button>
      </div>
    );
  }
  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Activity Log</h2>
        <div className="text-small text-muted">{total} records</div>
      </div>
    
<div className="filter-bar">

  {/* User ID filter */}
  <div>
    <label>User ID</label>
    <input
      type="number"
      value={userId}
      disabled={isLoading}
      onChange={(e) => { setUserId(e.target.value); setPage(1); }}
      placeholder="User ID"
    />
    {userId && <button onClick={() => { setUserId(""); setPage(1); }}>×</button>}
  </div>

  {/* Action filter — debounce prevents a fetch on every keystroke */}
  <div>
    <label>Action</label>
    <input
      type="text"
      value={action}
      disabled={isLoading}
      onChange={(e) => { setAction(e.target.value); setPage(1); }}
      placeholder="e.g. ASSET, TRANSFER, LOGIN"
    />
    {action && <button onClick={() => { setAction(""); setPage(1); }}>×</button>}
  </div>

  {/* Table select */}
  <div>
    <label>Table</label>
    <select
      value={tableAffected}
      disabled={isLoading}
      onChange={(e) => { setTableAffected(e.target.value); setPage(1); }}
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
  </div>

  {/* Date range */}
  <div>
    <label>From</label>
    <input
      type="date"
      value={fromDate}
      disabled={isLoading}
      onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
    />
  </div>

  <div>
    <label>To</label>
    <input
      type="date"
      value={toDate}
      disabled={isLoading}
      onChange={(e) => { setToDate(e.target.value); setPage(1); }}
    />
    {/* Inline date validation */}
    {fromDate && toDate && fromDate > toDate && (
      <span style={{ color: "red" }}>From date must be before To date</span>
    )}
  </div>

  {/* Clear all filters */}
  <button
    onClick={() => {
      setUserId("");
      setAction("");
      setTableAffected("");
      setFromDate("");
      setToDate("");
      setPage(1);
    }}
  >
    Clear All Filters
  </button>

</div>
      <table>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>User</th>
            <th>Table</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.log_id}>
              <td className="text-small">{new Date(l.timestamp).toLocaleString()}</td>
              <td>{l.user_name}</td>
              <td>{l.table_affected}</td>
              <td
                className="text-small"
                style={{ color: ACTION_COLOURS[l.action] || "inherit" }}>
                {l.action}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination Controls */}
<div className="pagination">

  {/* disabled on first page */}
  <button
    onClick={() => setPage(p => p - 1)}
    disabled={page === 1 || isLoading}
  >
    Previous
  </button>

  <span>Page {page} of {totalPages}</span>

  {/*disabled on last page or no results */}
  <button
    onClick={() => setPage(p => p + 1)}
    disabled={page === totalPages || total === 0 || isLoading}
  >
    Next
  </button>

  {/* Rows per page — reset to page 1 when page size changes, current page may be out of range */}
  <select
    value={pageSize}
    onChange={(e) => {
      setPageSize(Number(e.target.value));
      setPage(1);
    }}
    disabled={isLoading}
  >
    <option value={10}>10 per page</option>
    <option value={20}>20 per page</option>
    <option value={50}>50 per page</option>
  </select>

</div>

      {logs.length === 0 && (
        <div className="page-empty">
          No audit logs found.
        </div>
      )}
    </div>
  );
}
