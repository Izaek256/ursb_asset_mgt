import React from "react";
import { AuthProvider, useAuth } from "./AuthContext";
import AdminUsers from "./pages/AdminUsers";
import AuditLogs from "./pages/AuditLogs";
import Assets from "./pages/Assets";
import AssetRegistration from "./pages/AssetRegistration";
import Dashboard from "./pages/Dashboard";
import LoginPage from "./pages/Login";
import Settings from "./pages/Settings";
import Transfers from "./pages/Transfers";
import ProfileModal from "./components/ProfileModal";
import NotificationPanel from "./components/NotificationPanel";

// ── Navigation config ────────────────────────────────────────────────────────────
type NavId = "dashboard" | "users" | "audit" | "assets" | "register-asset" | "transfers" | "settings";

interface NavItem {
  id: NavId;
  label: string;
  icon: string;
  path: string;
  roles: string[]; // which roles can see this nav item
}

const ALL_ROLES = [
  "System Administrator",
  "Asset Manager",
  "Asset Custodian",
  "Employee",
];

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "📊", path: "/dashboard", roles: ALL_ROLES },
  { id: "assets", label: "Assets", icon: "📦", path: "/assets", roles: ["System Administrator", "Asset Manager", "Asset Custodian"] },
  { id: "register-asset", label: "Register Asset", icon: "➕", path: "/assets/register", roles: ["Asset Manager"] },
  { id: "transfers", label: "Transfers", icon: "🔄", path: "/transfers", roles: ["System Administrator", "Asset Manager"] },
  { id: "users", label: "User Management", icon: "👥", path: "/admin/users", roles: ["System Administrator", "Asset Manager"] },
  { id: "audit", label: "Audit Logs", icon: "🕐", path: "/admin/audit-logs", roles: ["System Administrator", "Asset Manager"] },
  { id: "settings", label: "Settings", icon: "⚙️", path: "/settings", roles: ["System Administrator"] },
];

// ── Inner app (requires auth) ────────────────────────────────────────────────────
function AppShell() {
  const { user, logout } = useAuth();
  const [path, setPath] = React.useState(window.location.pathname || "/dashboard");
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);

  React.useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = (to: string) => {
    window.history.pushState({}, "", to);
    setPath(to);
  };

  // Filter nav items by user role
  const visibleNav = NAV_ITEMS.filter((n) => n.roles.includes(user!.role));
  const activeItem = visibleNav.find((n) => n.path === path) ?? visibleNav[0];

  // Route to correct content
  let content: React.ReactNode;
  switch (activeItem?.id) {
    case "dashboard":
      content = <Dashboard />;
      break;
    case "assets":
      content = <Assets />;
      break;
    case "register-asset":
      content = <AssetRegistration />;
      break;
    case "transfers":
      content = <Transfers />;
      break;
    case "audit":
      content = <AuditLogs />;
      break;
    case "users":
      content = <AdminUsers />;
      break;
    case "settings":
      content = <Settings />;
      break;
    default:
      content = (
        <div className="placeholder-page">
          <div className="placeholder-icon">{activeItem?.icon ?? "📄"}</div>
          <h2>{activeItem?.label ?? "Page"}</h2>
          <p>This section is under development.</p>
        </div>
      );
  }

  // User initials
  const initials = user!.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="app-container">
      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-icon">🏢</div>
          <div>
            <div className="sidebar-title">URSB Assets</div>
            <div className="sidebar-subtitle">Management Portal</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">Main Menu</div>
          {visibleNav.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activeItem?.id === item.id ? "active" : ""}`}
              onClick={() => navigate(item.path)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div
          className="sidebar-profile"
          onClick={() => setProfileOpen(true)}
        >
          <div className="profile-avatar">{initials}</div>
          <div className="profile-info">
            <div className="profile-name">{user!.full_name}</div>
            <div className="profile-role">{user!.role}</div>
          </div>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────────────────── */}
      <div className="main-content">
        <header className="header">
          <div>
            <h1 className="header-title">{activeItem?.label ?? "Dashboard"}</h1>
            <p className="header-breadcrumb">Home / {activeItem?.label ?? "Dashboard"}</p>
          </div>
          <div className="header-actions">
            <button
              className="icon-btn"
              title="Notifications"
              onClick={() => setNotifOpen(!notifOpen)}
            >
              🔔
            </button>
            <button className="icon-btn" title="Search">🔍</button>
            <button className="btn btn-secondary" onClick={logout}>
              Sign out
            </button>
          </div>
        </header>

        <div className="content-area">{content}</div>
      </div>

      {/* ── Overlays ─────────────────────────────────────────────────────────── */}
      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
      <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
    </div>
  );
}

// ── Root (auth gate) ─────────────────────────────────────────────────────────────
function AppRoot() {
  const { user, token } = useAuth();

  // Not logged in → show login
  if (!user || !token) {
    return <LoginPage />;
  }

  return <AppShell />;
}

// ── Wrapped export ───────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <AppRoot />
    </AuthProvider>
  );
}
