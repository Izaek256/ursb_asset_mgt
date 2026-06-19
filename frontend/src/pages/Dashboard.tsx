import React from "react";

// ── Mock data ───────────────────────────────────────────────────────────────────
const ASSET_STATS = [
  { label: "Total Assets", value: "1,248", icon: "📦", color: "#8b5cf6" },
  { label: "Assigned", value: "874", icon: "✅", color: "#2563eb" },
  { label: "In Maintenance", value: "62", icon: "🔧", color: "#f59e0b" },
  { label: "Disposed", value: "312", icon: "🗑️", color: "#ef4444" },
];

const RECENT_ASSETS = [
  { id: "1", name: "Dell Latitude 5540", category: "IT Equipment", value: "$1,240", color: "#8b5cf6", date: "Today" },
  { id: "2", name: "Office Desk – Standing", category: "Furniture", value: "$680", color: "#2563eb", date: "Today" },
  { id: "3", name: "Toyota Hilux 2023", category: "Vehicles", value: "$42,500", color: "#f59e0b", date: "Today" },
  { id: "4", name: "HP LaserJet Pro M404", category: "IT Equipment", value: "$380", color: "#ef4444", date: "Yesterday" },
  { id: "5", name: "Conference Table – 8 Seat", category: "Furniture", value: "$1,950", color: "#0d9488", date: "Yesterday" },
  { id: "6", name: "MacBook Pro 14\" M3", category: "IT Equipment", value: "$2,499", color: "#8b5cf6", date: "2 days ago" },
];

const CATEGORY_BREAKDOWN = [
  { name: "IT Equipment", count: 487, total: "$1,278,028", pct: 78 },
  { name: "Furniture", count: 312, total: "$528,928", pct: 52 },
  { name: "Vehicles", count: 48, total: "$457,128", pct: 35 },
  { name: "Office Supplies", count: 264, total: "$45,840", pct: 22 },
  { name: "Machinery", count: 137, total: "$892,400", pct: 64 },
];

const MONTHLY_ACQUISITIONS = [
  { month: "Jan", count: 42 },
  { month: "Feb", count: 58 },
  { month: "Mar", count: 71 },
  { month: "Apr", count: 34 },
  { month: "May", count: 65 },
  { month: "Jun", count: 89 },
  { month: "Jul", count: 52 },
  { month: "Aug", count: 47 },
  { month: "Sep", count: 78 },
  { month: "Oct", count: 61 },
  { month: "Nov", count: 94 },
  { month: "Dec", count: 53 },
];

const DEPARTMENT_ALLOCATION = [
  { dept: "Engineering", assets: 312, color: "#2563eb" },
  { dept: "Operations", assets: 248, color: "#f59e0b" },
  { dept: "Finance", assets: 186, color: "#8b5cf6" },
  { dept: "HR", assets: 124, color: "#0d9488" },
  { dept: "Admin", assets: 378, color: "#ef4444" },
];

export default function Dashboard() {
  const maxBar = Math.max(...MONTHLY_ACQUISITIONS.map((m) => m.count));

  return (
    <div className="dashboard">
      {/* ── Stat cards ─────────────────────────────────────────────────────── */}
      <div className="dash-stats">
        {ASSET_STATS.map((s) => (
          <div className="dash-stat-card" key={s.label}>
            <div className="dash-stat-icon" style={{ background: `${s.color}20`, color: s.color }}>
              {s.icon}
            </div>
            <div>
              <div className="dash-stat-label">{s.label}</div>
              <div className="dash-stat-value">{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main grid ──────────────────────────────────────────────────────── */}
      <div className="dash-grid">
        {/* Left column – Recent assets + bar chart */}
        <div className="dash-col-main">
          {/* Bar chart card */}
          <div className="dash-card">
            <div className="dash-card-header">
              <h3>Asset Acquisitions</h3>
              <span className="dash-card-sub">Jan – Dec 2025</span>
            </div>
            <div className="dash-bar-chart">
              {MONTHLY_ACQUISITIONS.map((m) => (
                <div className="bar-col" key={m.month}>
                  <div className="bar" style={{ height: `${(m.count / maxBar) * 100}%` }}>
                    <span className="bar-val">{m.count}</span>
                  </div>
                  <span className="bar-label">{m.month}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent assets list */}
          <div className="dash-card">
            <div className="dash-card-header">
              <h3>Recent Assets</h3>
              <div className="dash-card-actions">
                <button className="dash-icon-btn">🔍</button>
                <button className="dash-icon-btn">➕</button>
                <button className="dash-icon-btn">⚙️</button>
              </div>
            </div>
            <div className="dash-asset-list">
              {RECENT_ASSETS.map((a) => (
                <div className="dash-asset-row" key={a.id}>
                  <span className="dash-dot" style={{ background: a.color }} />
                  <div className="dash-asset-info">
                    <span className="dash-asset-name">{a.name}</span>
                    <span className="dash-asset-cat">{a.category}</span>
                  </div>
                  <span className="dash-asset-value">{a.value}</span>
                  <span className="dash-asset-date">{a.date}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column – Categories + Department */}
        <div className="dash-col-side">
          {/* Category breakdown */}
          <div className="dash-card">
            <div className="dash-card-header">
              <h3>Asset Categories</h3>
            </div>
            <div className="dash-cat-list">
              {CATEGORY_BREAKDOWN.map((c) => (
                <div className="dash-cat-row" key={c.name}>
                  <div className="dash-cat-top">
                    <span className="dash-cat-name">{c.name}</span>
                    <span className="dash-cat-total">{c.total}</span>
                  </div>
                  <div className="dash-cat-bar-bg">
                    <div
                      className="dash-cat-bar-fill"
                      style={{ width: `${c.pct}%` }}
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
                {DEPARTMENT_ALLOCATION.map((d) => {
                  const total = DEPARTMENT_ALLOCATION.reduce((s, x) => s + x.assets, 0);
                  return (
                    <div
                      key={d.dept}
                      className="dash-hbar-seg"
                      style={{
                        width: `${(d.assets / total) * 100}%`,
                        background: d.color,
                      }}
                      title={`${d.dept}: ${d.assets}`}
                    />
                  );
                })}
              </div>
              <div className="dash-dept-legend">
                {DEPARTMENT_ALLOCATION.map((d) => (
                  <div className="dash-legend-item" key={d.dept}>
                    <span className="dash-dot-sm" style={{ background: d.color }} />
                    <span>{d.dept}</span>
                    <span className="dash-legend-val">{d.assets}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick insight card */}
          <div className="dash-card dash-insight-card">
            <div className="dash-insight-icon">💡</div>
            <h4>Optimize Your Assets</h4>
            <p>
              37 assets are due for maintenance this month. Schedule servicing early to avoid downtime
              and extend asset lifespan.
            </p>
            <button className="btn btn-primary btn-sm">View Maintenance Queue</button>
          </div>
        </div>
      </div>
    </div>
  );
}
