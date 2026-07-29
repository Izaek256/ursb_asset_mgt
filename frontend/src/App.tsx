import React from "react";
import { AuthProvider, useAuth } from "./AuthContext";
import { ImportProgressProvider, useImportProgress } from "./context/ImportProgressContext";
import AppLayout from "./components/AppLayout";
import RoleGuard from "./components/RoleGuard";
import ToastContainer from "./components/Toast";
import ImportProgressBar from "./components/ImportProgressBar";
import BulkUserImportModal from "./components/users/BulkUserImportModal";
import ReloadConfirmationModal from "./components/ReloadConfirmationModal";
import UserManagement from "./pages/UserManagement";
import AuditLogs from "./pages/AuditLogs";
import Assets from "./pages/Assets";
import AssetDetail from "./pages/AssetDetail";
import AssetRegistration from "./pages/AssetRegistration";
import Assignments from "./pages/Assignments";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import LoginPage from "./pages/Login";
import Maintenance from "./pages/Maintenance";
import Requests from "./pages/Requests";
import Settings from "./pages/Settings";
import Storage from "./pages/Storage";
import Transfers from "./pages/Transfers";
import CredentialsPage from "./pages/CredentialsPage";
import { hasPageAccess, getDefaultPathForRole, hasActionPermission } from "./utils/rbac";
import { PageLoader } from "./components/common/LoadingSkeleton";

const NAV_LABELS: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/requests": "Requests",
  "/assets": "Assets",
  "/assets/register": "Register Asset",
  "/inventory": "Inventory",
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
  const { setOpenUserImportModal, setOnJobComplete, setOnCancelJob, jobs } = useImportProgress();
  const [path, setPath] = React.useState(window.location.pathname || "/dashboard");
  const [isUserImportModalOpen, setIsUserImportModalOpen] = React.useState(false);
  const [userManagementRefreshKey, setUserManagementRefreshKey] = React.useState(0);
  const [showReloadModal, setShowReloadModal] = React.useState(false);

  // Browser reload protection
  React.useEffect(() => {
    const runningJobs = jobs.filter((j) => j.status === "running");
    const hasRunningJobs = runningJobs.length > 0;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasRunningJobs) {
        e.preventDefault();
        e.returnValue = ""; // Chrome requires returnValue to be set
        return ""; // Other browsers
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [jobs]);

  // Register the user import modal opener with the context
  React.useEffect(() => {
    const openModal = () => setIsUserImportModalOpen(true);
    setOpenUserImportModal(() => openModal);
  }, [setOpenUserImportModal]);

  // Register job complete callback to refresh user management data
  React.useEffect(() => {
    const handleJobComplete = (job: any) => {
      if (job.type === "user" && job.status === "done") {
        // Refresh user management data
        setUserManagementRefreshKey((prev) => prev + 1);
      }
    };
    setOnJobComplete(() => handleJobComplete);
    return () => setOnJobComplete(() => {});
  }, [setOnJobComplete]);

  // Register cancel job callback for user imports
  React.useEffect(() => {
    const handleCancelJob = (jobId: string) => {
      // The BulkUserImportModal handles its own cancellation via WebSocket
      // This is a placeholder for future integration if needed
    };
    setOnCancelJob(() => handleCancelJob);
    return () => setOnCancelJob(() => {});
  }, [setOnCancelJob]);

  React.useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = (to: string) => {
    // Check if user has access to the target page
    if (!hasPageAccess(user?.role, to)) {
      // Redirect to default page for their role if they don't have access
      const defaultPath = getDefaultPathForRole(user?.role);
      window.history.pushState({}, "", defaultPath);
      setPath(defaultPath);
      return;
    }
    window.history.pushState({}, "", to);
    setPath(to);
  };

  // Redirect to default path if current path is not accessible
  React.useEffect(() => {
    if (user && !hasPageAccess(user.role, path)) {
      const defaultPath = getDefaultPathForRole(user.role);
      window.history.pushState({}, "", defaultPath);
      setPath(defaultPath);
    }
  }, [user, path]);

  const getRequestsLabel = () =>
    hasActionPermission(user?.role, "approveRequest") ? "Requests" : "My Requests";

  const getPageTitle = (): string => {
    if (path.startsWith("/assets/") && path !== "/assets" && path !== "/assets/register") {
      return "Asset Detail";
    }
    if (path === "/requests") return getRequestsLabel();
    return NAV_LABELS[path] ?? "Dashboard";
  };

  const renderContent = (): React.ReactNode => {
    if (path.startsWith("/assets/") && path !== "/assets" && path !== "/assets/register") {
      return (
        <RoleGuard requiredPath="/assets">
          <AssetDetail />
        </RoleGuard>
      );
    }

    switch (path) {
      case "/dashboard":
        return (
          <RoleGuard requiredPath="/dashboard">
            <Dashboard onNavigate={navigate} />
          </RoleGuard>
        );
      case "/requests":
        return (
          <RoleGuard requiredPath="/requests">
            <Requests />
          </RoleGuard>
        );
      case "/assets":
        return (
          <RoleGuard requiredPath="/assets">
            <Assets />
          </RoleGuard>
        );
      case "/assets/register":
        return (
          <RoleGuard requiredPath="/assets/register">
            <AssetRegistration />
          </RoleGuard>
        );
      case "/inventory":
        return (
          <RoleGuard requiredPath="/inventory">
            <Inventory />
          </RoleGuard>
        );
      case "/assignments":
        return (
          <RoleGuard requiredPath="/assignments">
            <Assignments />
          </RoleGuard>
        );
      case "/storage":
        return (
          <RoleGuard requiredPath="/storage">
            <Storage />
          </RoleGuard>
        );
      case "/transfers":
        return (
          <RoleGuard requiredPath="/transfers">
            <Transfers />
          </RoleGuard>
        );
      case "/maintenance":
        return (
          <RoleGuard requiredPath="/maintenance">
            <Maintenance />
          </RoleGuard>
        );
      case "/admin/audit-logs":
        return (
          <RoleGuard requiredPath="/admin/audit-logs">
            <AuditLogs />
          </RoleGuard>
        );
      case "/admin/users":
        return (
          <RoleGuard requiredPath="/admin/users">
            <UserManagement refreshKey={userManagementRefreshKey} />
          </RoleGuard>
        );
      case "/settings":
        return (
          <RoleGuard requiredPath="/settings">
            <Settings />
          </RoleGuard>
        );
      case "/credentials":
        return (
          <RoleGuard requiredPath="/credentials">
            <CredentialsPage />
          </RoleGuard>
        );
      default:
        return (
          <RoleGuard requiredPath="/dashboard">
            <Dashboard onNavigate={navigate} />
          </RoleGuard>
        );
    }
  };

  return (
    <div className="h-screen overflow-hidden">
      <ToastContainer />
      <AppLayout pageTitle={getPageTitle()} activePath={path} onNavigate={navigate}>
        {renderContent()}
      </AppLayout>
      <ImportProgressBar />
      <BulkUserImportModal
        isOpen={isUserImportModalOpen}
        onClose={() => setIsUserImportModalOpen(false)}
        onImportSuccess={() => {
          // Trigger the refresh callback which will update UserManagement if needed
          if (path === "/admin/users") {
            setUserManagementRefreshKey(prev => prev + 1);
          }
        }}
        onMinimize={() => setIsUserImportModalOpen(false)}
      />
      <ReloadConfirmationModal
        isOpen={showReloadModal}
        onConfirm={() => {
          setShowReloadModal(false);
          window.location.reload();
        }}
        onCancel={() => setShowReloadModal(false)}
        jobCount={jobs.filter((j) => j.status === "running").length}
      />
    </div>
  );
}

function AppRoot() {
  const { user, isInitialLoading } = useAuth();

  if (isInitialLoading) {
    return <PageLoader message="Loading application..." />;
  }

  if (!user) {
    return <LoginPage />;
  }

  return <AppShell />;
}

export default function App() {
  return (
    <AuthProvider>
      <ImportProgressProvider>
        <AppRoot />
      </ImportProgressProvider>
    </AuthProvider>
  );
}
