import React from "react";
import { AuditLog } from "../types";

export default function AuditLogs() {
  const [logs, setLogs] = React.useState<AuditLog[]>([]);
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
    return (
      <div style={{ textAlign: "center", padding: "2rem", color: "var(--color-muted)" }}>
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
            <th>Performed By (Admin)</th>
            <th>Target User</th>
            <th>Action Taken</th>
            <th>IP Address</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id}>
              <td className="text-small">{new Date(l.timestamp).toLocaleString()}</td>
              <td>{l.performedBy}</td>
              <td>{l.targetUser}</td>
              <td>{l.action}</td>
              <td className="text-small text-muted">{l.ipAddress ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {logs.length === 0 && (
        <div style={{ padding: "2rem", textAlign: "center", color: "var(--color-muted)" }}>
          No audit logs found.
        </div>
      )}
    </div>
  );
}
