import React from "react";
import { useAuth } from "../AuthContext";
import { hasPageAccess } from "../utils/rbac";

interface RoleGuardProps {
  children: React.ReactNode;
  requiredPath?: string;
  fallback?: React.ReactNode;
}

/**
 * RoleGuard component to protect pages based on user role
 * If user doesn't have access, renders fallback or redirects
 */
export default function RoleGuard({ children, requiredPath, fallback }: RoleGuardProps) {
  const { user } = useAuth();
  
  // If no user is authenticated, let the auth context handle redirect
  if (!user) {
    return <>{children}</>;
  }

  // If no specific path is required, allow access
  if (!requiredPath) {
    return <>{children}</>;
  }

  // Check if user has access to the required path
  if (!hasPageAccess(user.role, requiredPath)) {
    if (fallback) {
      return <>{fallback}</>;
    }
    
    // Default fallback: access denied message
    return (
      <div className="flex items-center justify-center h-screen bg-sky-page">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-ink mb-2">Access Denied</h2>
          <p className="text-ink-dim">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
