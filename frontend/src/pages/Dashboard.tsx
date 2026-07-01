import React from "react";
import { apiFetch } from "../AuthContext";

// ── Types ────────────────────────────────────────────────────────────────────────
interface StatCard { label: string; value: number; icon: string; color: string; }
interface RecentAsset { id: string; name: string; category: string; value: string; color: string; date: string; }
interface CategoryBreakdown { name: string; count: number; total: string; pct: number; }
interface MonthlyAcquisition { month: string; count: number; }
interface DepartmentAllocation { dept: string; assets: number; color: string; }
interface DashboardData {
  stats: StatCard[];
  recent_assets: RecentAsset[];
  categories: CategoryBreakdown[];
  monthly_acquisitions: MonthlyAcquisition[];
  departments: DepartmentAllocation[];
  maintenance_due: number;
}

// ── Fallback mock data (used if API fails) ───────────────────────────────────────
const MOCK: DashboardData = {
  stats: [
    { label: "Total Assets", value: 22, icon: "📦", color: "#8b5cf6" },
    { label: "Active / Assigned", value: 14, icon: "✅", color: "#2563eb" },
    { label: "In Maintenance", value: 2, icon: "🔧", color: "#f59e0b" },
    { label: "Disposed", value: 3, icon: "🗑️", color: "#ef4444" },
  ],
  recent_assets: [
    { id: "1", name: "Dell Latitude 5540", category: "ICT Equipment", value: "UGX 3,200,000", color: "#8b5cf6", date: "Today" },
    { id: "2", name: "Office Desk (Mahogany)", category: "Furniture", value: "UGX 850,000", color: "#2563eb", date: "Today" },
    { id: "3", name: "Toyota Land Cruiser Prado", category: "Vehicle", value: "UGX 120,000,000", color: "#f59e0b", date: "Today" },
  ],
  categories: [
    { name: "ICT Equipment", count: 12, total: "UGX 45,230,000", pct: 78 },
    { name: "Furniture", count: 4, total: "UGX 6,000,000", pct: 32 },
    { name: "Vehicle", count: 3, total: "UGX 290,000,000", pct: 55 },
    { name: "Software", count: 2, total: "UGX 14,350,000", pct: 22 },
  ],
  monthly_acquisitions: [
    { month: "Jan", count: 2 }, { month: "Feb", count: 1 }, { month: "Mar", count: 3 },
    { month: "Apr", count: 0 }, { month: "May", count: 2 }, { month: "Jun", count: 1 },
    { month: "Jul", count: 0 }, { month: "Aug", count: 0 }, { month: "Sep", count: 0 },
    { month: "Oct", count: 0 }, { month: "Nov", count: 0 }, { month: "Dec", count: 0 },
  ],
  departments: [
    { dept: "ICT", assets: 10, color: "#2563eb" },
    { dept: "Administration", assets: 5, color: "#f59e0b" },
    { dept: "Finance & Administration", assets: 3, color: "#8b5cf6" },
    { dept: "Legal", assets: 1, color: "#0d9488" },
  ],
  maintenance_due: 3,
};

// ── Component ────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const dashRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await apiFetch<DashboardData>("/dashboard/stats", {});
        if (!cancelled) setData(result);
      } catch {
        if (!cancelled) setData(MOCK);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Apply dynamic styles from data-* attributes (keeps CSS rules external)
  React.useEffect(() => {
    const el = dashRef.current;
    if (!el) return;
    el.querySelectorAll<HTMLElement>("[data-color]").forEach((node) => {
      const c = node.dataset.color!;
      if (node.classList.contains("dash-stat-icon")) {
        node.style.background = c + "20";
        node.style.color = c;
      } else {
        node.style.background = c;
      }
    });
    el.querySelectorAll<HTMLElement>("[data-height]").forEach((node) => {
      node.style.height = node.dataset.height!;
    });
    el.querySelectorAll<HTMLElement>("[data-width]").forEach((node) => {
      node.style.width = node.dataset.width!;
    });
  }, [data]);

  if (loading || !data) {
    return (
      <div className="dashboard-loading">
        Loading dashboard...
      </div>
    );
  }

  const maxBar = Math.max(...data.monthly_acquisitions.map((m) => m.count), 1);

  return (
    <div className="dashboard" ref={dashRef}>
      {/* ── Stat cards ───────────────────────────────────────────────────────── */}
      <div className="dash-stats">
        {data.stats.map((s) => (
          <div className="dash-stat-card" key={s.label}>
            <div
              className="dash-stat-icon"
              data-color={s.color}
            >
              {s.icon}
            </div>
            <div>
              <div className="dash-stat-label">{s.label}</div>
              <div className="dash-stat-value">{s.value.toLocaleString()}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main grid ────────────────────────────────────────────────────────── */}
      <div className="dash-grid">
        {/* Left column */}
        <div className="dash-col-main">
          {/* Bar chart */}
          <div className="dash-card">
            <div className="dash-card-header">
              <h3>Asset Acquisitions</h3>
              <span className="dash-card-sub">{new Date().getFullYear()}</span>
            </div>
            <div className="dash-bar-chart">
              {data.monthly_acquisitions.map((m) => (
                <div className="bar-col" key={m.month}>
                  <div
                    className="bar"
                    data-height={`${(m.count / maxBar) * 100}%`}
                  >
                    {m.count > 0 && <span className="bar-val">{m.count}</span>}
                  </div>
                  <span className="bar-label">{m.month}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent assets */}
          <div className="dash-card">
            <div className="dash-card-header">
              <h3>Recent Assets</h3>
              <div className="dash-card-actions">
                <button className="dash-icon-btn" title="Search">🔍</button>
                <button className="dash-icon-btn" title="Add">➕</button>
                <button className="dash-icon-btn" title="Settings">⚙️</button>
              </div>
            </div>
            <div className="dash-asset-list">
              {data.recent_assets.map((a) => (
                <div className="dash-asset-row" key={a.id}>
                  <span className="dash-dot" data-color={a.color} />
                  <div className="dash-asset-info">
                    <span className="dash-asset-name">{a.name}</span>
                    <span className="dash-asset-cat">{a.category}</span>
                  </div>
                  <span className="dash-asset-value">{a.value}</span>
                  <span className="dash-asset-date">{a.date}</span>
                </div>
              ))}
              {data.recent_assets.length === 0 && (
                <div className="dash-empty">
                  No assets registered yet.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="dash-col-side">
          {/* Category breakdown */}
          <div className="dash-card">
            <div className="dash-card-header">
              <h3>Asset Categories</h3>
            </div>
            <div className="dash-cat-list">
              {data.categories.map((c) => (
                <div className="dash-cat-row" key={c.name}>
                  <div className="dash-cat-top">
                    <span className="dash-cat-name">{c.name}</span>
                    <span className="dash-cat-total">{c.total}</span>
                  </div>
                  <div className="dash-cat-bar-bg">
                    <div
                      className="dash-cat-bar-fill"
                      data-width={`${c.pct}%`}
                    />
                  </div>
                  <span className="dash-cat-count">{c.count} assets</span>
                </div>
              ))}
            </div>
          </div>

          {/* Department allocation */}
          <div className="dash-card">
            <div className="dash-card-header">
              <h3>Department Allocation</h3>
            </div>
            <div className="dash-dept-chart">
              <div className="dash-hbar-stack">
                {data.departments.map((d) => {
                  const total = data.departments.reduce((s, x) => s + x.assets, 0);
                  return (
                    <div
                      key={d.dept}
                      className="dash-hbar-seg"
                      data-width={`${(d.assets / total) * 100}%`}
                      data-color={d.color}
                      title={`${d.dept}: ${d.assets}`}
                    />
                  );
                })}
              </div>
              <div className="dash-dept-legend">
                {data.departments.map((d) => (
                  <div className="dash-legend-item" key={d.dept}>
                    <span className="dash-dot-sm" data-color={d.color} />
                    <span>{d.dept}</span>
                    <span className="dash-legend-val">{d.assets}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Insight card */}
          <div className="dash-card dash-insight-card">
            <div className="dash-insight-icon">💡</div>
            <h4>Optimize Your Assets</h4>
            <p>
              {data.maintenance_due > 0
                ? `${data.maintenance_due} asset(s) are due for maintenance. Schedule servicing early to avoid downtime.`
                : "All maintenance is up to date. Great job keeping assets in top shape!"}
            </p>
            <button className="btn btn-primary btn-sm">View Maintenance Queue</button>
          </div>
        </div>
      </div>
    </div>
  );
}
