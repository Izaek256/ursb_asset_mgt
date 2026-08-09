import React from "react";
import { useAuth } from "../AuthContext";
import { hasActionPermission } from "../utils/rbac";

interface PermissionGuardProps {
  children: React.ReactNode;
  action: string;
  fallback?: React.ReactNode;
}

/**
 * PermissionGuard component to protect UI elements based on user role and action permissions
 * If user doesn't have permission, renders fallback or hides children
 */
export default function PermissionGuard({ children, action, fallback }: PermissionGuardProps) {
  const { user } = useAuth();
  
  // If no user is authenticated, hide the protected element
  if (!user) {
    if (fallback) {
      return <>{fallback}</>;
    }
    return null;
  }

  // Check if user has permission for the action
  if (!hasActionPermission(user.role, action)) {
    if (fallback) {
      return <>{fallback}</>;
    }
    return null;
  }

  return <>{children}</>;
}
