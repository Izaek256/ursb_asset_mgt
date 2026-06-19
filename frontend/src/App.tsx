import React from "react";
import AdminUsers from "./pages/AdminUsers";
import AuditLogs from "./pages/AuditLogs";
import Dashboard from "./pages/Dashboard";

type NavId = "dashboard" | "users" | "audit" | "assets" | "transfers" | "settings";

interface NavItem {
  id: NavId;
  label: string;
  icon: string;
  path: string;
  badge?: number;
}

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "📊", path: "/dashboard" },
  { id: "assets", label: "Assets", icon: "📦", path: "/assets", badge: 12 },
  { id: "transfers", label: "Transfers", icon: "🔄", path: "/transfers" },
  { id: "users", label: "User Management", icon: "👥", path: "/admin/users" },
  { id: "audit", label: "Audit Logs", icon: "🕐", path: "/admin/audit-logs" },
  { id: "settings", label: "Settings", icon: "⚙️", path: "/settings" },
];

function App() {
  const [path, setPath] = React.useState(window.location.pathname || "/dashboard");

  React.useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = (to: string) => {
    window.history.pushState({}, "", to);
    setPath(to);
  };

  const activeItem = NAV_ITEMS.find((n) => n.path === path) ?? NAV_ITEMS[0];

  let content: React.ReactNode;
  switch (activeItem.id) {
    case "dashboard":
      content = <Dashboard />;
      break;
    case "audit":
      content = <AuditLogs />;
      break;
    case "users":
      content = <AdminUsers />;
      break;
    default:
      content = (
        <div className="placeholder-page">
          <div className="placeholder-icon">{activeItem.icon}</div>
          <h2>{activeItem.label}</h2>
          <p>This section is under development.</p>
        </div>
      );
  }

  return (
    <div className="app-container">
      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <aside className="sidebar">
        {/* Logo / brand */}
        <div className="sidebar-header">
          <div className="sidebar-icon">🏢</div>
          <div>
            <div className="sidebar-title">URSB Assets</div>
            <div className="sidebar-subtitle">Management Portal</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          <div className="nav-section">Main Menu</div>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activeItem.id === item.id ? "active" : ""}`}
              onClick={() => navigate(item.path)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
              {item.badge && <span className="nav-badge">{item.badge}</span>}
            </button>
          ))}
        </nav>

        {/* Profile */}
        <div className="sidebar-profile">
          <div className="profile-avatar">SA</div>
          <div className="profile-info">
            <div className="profile-name">System Admin</div>
            <div className="profile-role">admin@ursb.go.ug</div>
          </div>
          <button className="sidebar-logout" title="Sign out">⏻</button>
        </div>
      </aside>

      {/* ── Main ───────────────────────────────────────────────────────────── */}
      <div className="main-content">
        <header className="header">
          <div>
            <h1 className="header-title">{activeItem.label}</h1>
            <p className="header-breadcrumb">Home / {activeItem.label}</p>
          </div>
          <div className="header-actions">
            <button className="icon-btn" title="Notifications">🔔</button>
            <button className="icon-btn" title="Search">🔍</button>
            <button className="btn btn-secondary">Sign out</button>
          </div>
        </header>

        <div className="content-area">{content}</div>
      </div>
    </div>
  );
}

export default App;
