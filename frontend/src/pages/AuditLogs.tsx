import React from "react";
import { AuditLog } from "../types";
import { apiFetch } from "../AuthContext";

export default function AuditLogs() {
  const [logs, setLogs] = React.useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    apiFetch<AuditLog[]>("/admin/audit-logs", {})
      .then((data) => { if (!cancelled) setLogs(data); })
      .catch(() => { if (!cancelled) setLogs([]); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (isLoading) {
    return (
      <div className="page-loading">
        Loading audit logs...
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Activity Log</h2>
        <div className="text-small text-muted">{logs.length} records</div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Performed By</th>
            <th>Target</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id}>
              <td className="text-small">{new Date(l.timestamp).toLocaleString()}</td>
              <td>{l.performedBy}</td>
              <td>{l.targetUser}</td>
              <td className="text-small">{l.action}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {logs.length === 0 && (
        <div className="page-empty">
          No audit logs found.
        </div>
      )}
    </div>
  );
}
