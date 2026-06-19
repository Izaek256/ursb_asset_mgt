import React from "react";
import AdminUsers from "./pages/AdminUsers";
import AuditLogs from "./pages/AuditLogs";

const TAB_ITEMS = [
  { id: "users", label: "User Management", icon: "👥" },
  { id: "audit", label: "Audit Logs", icon: "🕐" },
];

function App() {
  const [path, setPath] = React.useState(window.location.pathname || "/admin/users");

  React.useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = (to: string) => {
    window.history.pushState({}, "", to);
    setPath(to);
  };

  let content: React.ReactNode;
  let activeTab = "users";

  if (path === "/admin/audit-logs") {
    content = <AuditLogs />;
    activeTab = "audit";
  } else {
    content = <AdminUsers />;
    activeTab = "users";
  }

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-icon">🏢</div>
          <div>
            <div className="sidebar-title">Staff Portal</div>
            <div className="sidebar-subtitle">Admin Dashboard</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">Main Menu</div>
          {TAB_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activeTab === item.id ? "active" : ""}`}
              onClick={() => navigate(item.id === "users" ? "/admin/users" : "/admin/audit-logs")}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-profile">
          <div className="profile-avatar">SA</div>
          <div>
            <div className="profile-name">System Admin</div>
            <div className="profile-role">Administrator</div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="main-content">
        <header className="header">
          <h1 className="header-title">
            {activeTab === "users" ? "User Management" : "Audit Logs"}
          </h1>
          <div className="header-actions">
            <button className="icon-btn">🔔</button>
            <button className="btn btn-secondary">Sign out</button>
          </div>
        </header>

        <div className="content-area">{content}</div>
      </div>
    </div>
  );
}

export default App;
