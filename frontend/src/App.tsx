import React from "react";
import { AuthProvider, useAuth } from "./AuthContext";
import AdminUsers from "./pages/AdminUsers";
import AuditLogs from "./pages/AuditLogs";
import Assets from "./pages/Assets";
import AssetDetail from "./pages/AssetDetail";
import AssetRegistration from "./pages/AssetRegistration";
import Dashboard from "./pages/Dashboard";
import LoginPage from "./pages/Login";
import Settings from "./pages/Settings";
import Transfers from "./pages/Transfers";
import ProfileModal from "./components/ProfileModal";
import NotificationPanel from "./components/NotificationPanel";
import exportIcon from "./assets/icons8-export-30.png";
import pdfIcon from "./assets/icons8-export-pdf-50.png";
import excelIcon from "./assets/icons8-export-excel-50.png";

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
  const [assetManagerOpen, setAssetManagerOpen] = React.useState(false);
  const [exportError, setExportError] = React.useState<string | null>(null);
  const [isExporting, setIsExporting] = React.useState(false);
  const assetManagerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Click-outside detection for Asset Manager dropdown
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (assetManagerRef.current && !assetManagerRef.current.contains(event.target as Node)) {
        setAssetManagerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleExportPDF = async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      const response = await fetch("/api/v1/assets/export/pdf", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "assets_export.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setExportError(err.message || "Failed to export PDF");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      const response = await fetch("/api/v1/assets/export/excel", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "assets_export.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setExportError(err.message || "Failed to export Excel");
    } finally {
      setIsExporting(false);
    }
  };

  const canManageAssets = user?.role === "Asset Manager" || user?.role === "System Administrator";

  const navigate = (to: string) => {
    window.history.pushState({}, "", to);
    setPath(to);
  };

  // Filter nav items by user role
  const visibleNav = NAV_ITEMS.filter((n) => n.roles.includes(user!.role));
  const activeItem = visibleNav.find((n) => n.path === path) ?? visibleNav[0];

  // Route to correct content
  let content: React.ReactNode;
  
  // Check for asset detail page first
  if (path.startsWith("/assets/") && path !== "/assets" && path !== "/assets/register") {
    content = <AssetDetail />;
  } else {
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
        {exportError && (
          <div className="alert-error" style={{ margin: "16px" }}>
            {exportError}
            <button
              style={{ float: "right", background: "none", border: "none", cursor: "pointer" }}
              onClick={() => setExportError(null)}
            >
              ×
            </button>
          </div>
        )}
        <header className="header">
          <div>
            <h1 className="header-title">{activeItem?.label ?? "Dashboard"}</h1>
            <p className="header-breadcrumb">Home / {activeItem?.label ?? "Dashboard"}</p>
          </div>
          <div className="header-actions">
            {canManageAssets && (
              <div ref={assetManagerRef} style={{ position: "relative" }}>
                <button
                  onClick={() => setAssetManagerOpen(!assetManagerOpen)}
                  style={{
                    padding: "10px 16px",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    background: "white",
                    color: "#475569",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "500",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <img src={exportIcon} alt="Export" style={{ width: "20px", height: "20px" }} />
                  <span>Export</span>
                  <span style={{ fontSize: "10px" }}>▼</span>
                </button>
                {assetManagerOpen && (
                  <div style={{
                    position: "absolute",
                    top: "calc(100% + 8px)",
                    right: 0,
                    background: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
                    zIndex: 1000,
                    minWidth: "180px",
                    overflow: "hidden",
                  }}>
                    <button
                      onClick={handleExportPDF}
                      disabled={isExporting}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        width: "100%",
                        padding: "12px 16px",
                        textAlign: "left",
                        background: "none",
                        border: "none",
                        cursor: isExporting ? "not-allowed" : "pointer",
                        fontSize: "14px",
                        color: isExporting ? "#94a3b8" : "#475569",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        if (!isExporting) e.currentTarget.style.background = "#f8fafc";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "none";
                      }}
                    >
                      <img src={pdfIcon} alt="PDF" style={{ width: "24px", height: "24px" }} />
                      <span>{isExporting ? "Exporting..." : "Export as PDF"}</span>
                    </button>
                    <div style={{ height: "1px", background: "#e2e8f0", margin: "0 8px" }}></div>
                    <button
                      onClick={handleExportExcel}
                      disabled={isExporting}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        width: "100%",
                        padding: "12px 16px",
                        textAlign: "left",
                        background: "none",
                        border: "none",
                        cursor: isExporting ? "not-allowed" : "pointer",
                        fontSize: "14px",
                        color: isExporting ? "#94a3b8" : "#475569",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        if (!isExporting) e.currentTarget.style.background = "#f8fafc";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "none";
                      }}
                    >
                      <img src={excelIcon} alt="Excel" style={{ width: "24px", height: "24px" }} />
                      <span>{isExporting ? "Exporting..." : "Export as Excel"}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
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
