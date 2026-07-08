import React from "react";
import { AuthProvider, useAuth } from "./AuthContext";
import AppLayout from "./components/AppLayout";
import UserManagement from "./pages/UserManagement";
import AuditLogs from "./pages/AuditLogs";
import Assets from "./pages/Assets";
import AssetDetail from "./pages/AssetDetail";
import AssetRegistration from "./pages/AssetRegistration";
import Assignments from "./pages/Assignments";
import Dashboard from "./pages/Dashboard";
import LoginPage from "./pages/Login";
import Maintenance from "./pages/Maintenance";
import Requests from "./pages/Requests";
import Settings from "./pages/Settings";
import Storage from "./pages/Storage";
import Transfers from "./pages/Transfers";
import CredentialsPage from "./pages/CredentialsPage";

const NAV_LABELS: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/requests": "Requests",
  "/assets": "Assets",
  "/assets/register": "Register Asset",
  "/assignments": "Assignments",
  "/storage": "Storage",
  "/transfers": "Transfers",
  "/maintenance": "Maintenance",
  "/admin/users": "User Management",
  "/admin/audit-logs": "Audit Logs",
  "/settings": "Settings",
  "/credentials": "Credentials",
};

function AppShell() {
  const { user } = useAuth();
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

  const getRequestsLabel = () =>
    ["System Administrator", "Asset Manager"].includes(user!.role) ? "Requests" : "My Requests";

  const getPageTitle = (): string => {
    if (path.startsWith("/assets/") && path !== "/assets" && path !== "/assets/register") {
      return "Asset Detail";
    }
    if (path === "/requests") return getRequestsLabel();
    return NAV_LABELS[path] ?? "Dashboard";
  };

  const renderContent = (): React.ReactNode => {
    if (path.startsWith("/assets/") && path !== "/assets" && path !== "/assets/register") {
      return <AssetDetail />;
    }

    switch (path) {
      case "/dashboard":
        return <Dashboard onNavigate={navigate} />;
      case "/requests":
        return <Requests />;
      case "/assets":
        return <Assets />;
      case "/assets/register":
        return <AssetRegistration />;
      case "/assignments":
        return <Assignments />;
      case "/storage":
        return <Storage />;
      case "/transfers":
        return <Transfers />;
      case "/maintenance":
        return <Maintenance />;
      case "/admin/audit-logs":
        return <AuditLogs />;
      case "/admin/users":
        return <UserManagement />;
      case "/settings":
        return <Settings />;
      case "/credentials":
        return <CredentialsPage />;
      default:
        return <Dashboard onNavigate={navigate} />;
    }
  };

  return (
    <div className="h-screen overflow-hidden">
      <AppLayout pageTitle={getPageTitle()} activePath={path} onNavigate={navigate}>
        {renderContent()}
      </AppLayout>
    </div>
  );
}

function AppRoot() {
  const { user, isInitialLoading } = useAuth();

  if (isInitialLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-sky-page gap-5 select-none">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-sky-border border-t-ursb" />
        <div className="text-base text-ink-dim font-semibold">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return <AppShell />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoot />
    </AuthProvider>
  );
}
