import React from "react";
import { apiFetch, useAuth } from "../AuthContext";

interface TransferRow {
  transfer_id: number;
  asset_name: string;
  asset_id: string;
  from_user: string;
  to_user: string;
  transfer_date: string;
  reason: string;
  authorised_by: string;
  acknowledged: boolean;
}

export default function Transfers() {
  const { token } = useAuth();
  const [transfers, setTransfers] = React.useState<TransferRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Handle ?openModal=true in URL
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("openModal") === "true") {
      // When Create Transfer modal is implemented, open it here
      // For now, this is a placeholder for future functionality
      console.log("Create Transfer modal would open here");
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    apiFetch<TransferRow[]>("/transfers", {}, token)
      .then((data) => { if (!cancelled) setTransfers(data); })
      .catch(() => { if (!cancelled) setTransfers([]); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  if (isLoading) {
    return <div className="page-loading">Loading transfers...</div>;
  }

  return (
    <>
      <div className="filter-bar">
        <div className="filter-count">{transfers.length} transfers</div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Asset Transfers</h2>
          <div className="text-small text-muted">Custody change history</div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Asset</th>
              <th>From</th>
              <th>To</th>
              <th>Date</th>
              <th>Reason</th>
              <th>Authorised By</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {transfers.map((t) => (
              <tr key={t.transfer_id}>
                <td>
                  <div className="user-name">{t.asset_name}</div>
                  <div className="text-small text-muted">{t.asset_id}</div>
                </td>
                <td>{t.from_user}</td>
                <td>{t.to_user}</td>
                <td className="text-small">{t.transfer_date}</td>
                <td className="text-small">{t.reason}</td>
                <td>{t.authorised_by}</td>
                <td>
                  <span className={`badge ${t.acknowledged ? "badge-active" : "badge-warning"}`}>
                    {t.acknowledged ? "Acknowledged" : "Pending"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {transfers.length === 0 && (
          <div className="page-empty">No transfers recorded yet.</div>
        )}
      </div>
    </>
  );
}
