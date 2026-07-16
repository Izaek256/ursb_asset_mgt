/**
 * Role-Based Access Control (RBAC) Utilities
 * 
 * This file defines role permissions and provides helper functions
 * to check if a user has access to specific pages, actions, or features.
 */

export type UserRole = 
  | "Super System Administrator"
  | "System Administrator" 
  | "Asset Manager"
  | "Asset Custodian"
  | "Employee";

export interface PagePermission {
  path: string;
  allowedRoles: UserRole[];
  label: string;
}

export interface ActionPermission {
  action: string;
  allowedRoles: UserRole[];
}

// Page access permissions
export const PAGE_PERMISSIONS: PagePermission[] = [
  { path: "/dashboard", allowedRoles: ["Super System Administrator", "System Administrator", "Asset Manager", "Asset Custodian", "Employee"], label: "Dashboard" },
  { path: "/requests", allowedRoles: ["Super System Administrator", "System Administrator", "Asset Manager", "Asset Custodian", "Employee"], label: "Requests" },
  { path: "/assets", allowedRoles: ["Super System Administrator", "System Administrator", "Asset Manager", "Asset Custodian"], label: "Assets" },
  { path: "/assets/register", allowedRoles: ["Super System Administrator", "System Administrator", "Asset Manager", "Asset Custodian"], label: "Register Asset" },
  { path: "/inventory", allowedRoles: ["Super System Administrator", "System Administrator", "Asset Manager", "Asset Custodian", "Employee"], label: "Inventory" },
  { path: "/assignments", allowedRoles: ["Super System Administrator", "System Administrator", "Asset Manager", "Asset Custodian", "Employee"], label: "Assignments" },
  { path: "/storage", allowedRoles: ["Super System Administrator", "System Administrator", "Asset Manager"], label: "Storage" },
  { path: "/transfers", allowedRoles: ["Super System Administrator", "System Administrator", "Asset Manager"], label: "Transfers" },
  { path: "/maintenance", allowedRoles: ["Super System Administrator", "System Administrator", "Asset Manager"], label: "Maintenance" },
  { path: "/admin/users", allowedRoles: ["Super System Administrator", "System Administrator", "Asset Manager"], label: "User Management" },
  { path: "/admin/audit-logs", allowedRoles: ["Super System Administrator", "System Administrator", "Asset Manager"], label: "Audit Logs" },
  { path: "/credentials", allowedRoles: ["Super System Administrator", "System Administrator", "Asset Manager"], label: "Credentials" },
  { path: "/settings", allowedRoles: ["Super System Administrator", "System Administrator", "Asset Manager", "Asset Custodian", "Employee"], label: "Settings" },
];

// Action permissions for specific operations
export const ACTION_PERMISSIONS: Record<string, ActionPermission[]> = {
  // Asset actions
  createAsset: [{ action: "createAsset", allowedRoles: ["Super System Administrator", "System Administrator", "Asset Manager", "Asset Custodian"] }],
  updateAsset: [{ action: "updateAsset", allowedRoles: ["Super System Administrator", "System Administrator", "Asset Manager", "Asset Custodian"] }],
  deleteAsset: [{ action: "deleteAsset", allowedRoles: ["Super System Administrator", "System Administrator", "Asset Manager"] }],
  deactivateAsset: [{ action: "deactivateAsset", allowedRoles: ["Super System Administrator", "System Administrator", "Asset Manager"] }],
  reactivateAsset: [{ action: "reactivateAsset", allowedRoles: ["Super System Administrator", "System Administrator", "Asset Manager"] }],
  bulkImportAssets: [{ action: "bulkImportAssets", allowedRoles: ["Super System Administrator", "System Administrator", "Asset Manager", "Asset Custodian"] }],
  
  // Request actions (with self-approval prevention for accountability)
  approveRequest: [{ action: "approveRequest", allowedRoles: ["Super System Administrator", "System Administrator", "Asset Manager"] }],
  rejectRequest: [{ action: "rejectRequest", allowedRoles: ["Super System Administrator", "System Administrator", "Asset Manager"] }],
  assignRequest: [{ action: "assignRequest", allowedRoles: ["Super System Administrator", "System Administrator", "Asset Manager"] }],
  completeRequest: [{ action: "completeRequest", allowedRoles: ["Super System Administrator", "System Administrator", "Asset Manager"] }],
  cancelRequest: [{ action: "cancelRequest", allowedRoles: ["Super System Administrator", "System Administrator", "Asset Manager", "Employee"] }],
  
  // Transfer actions (with self-transfer prevention for accountability)
  createTransfer: [{ action: "createTransfer", allowedRoles: ["Super System Administrator", "System Administrator", "Asset Manager"] }],
  acknowledgeTransfer: [{ action: "acknowledgeTransfer", allowedRoles: ["Super System Administrator", "System Administrator", "Asset Manager", "Asset Custodian", "Employee"] }],
  
  // Assignment actions (with self-assignment prevention for accountability)
  createAssignment: [{ action: "createAssignment", allowedRoles: ["Super System Administrator", "System Administrator", "Asset Manager"] }],
  acceptAssignment: [{ action: "acceptAssignment", allowedRoles: ["Super System Administrator", "System Administrator", "Asset Manager", "Asset Custodian", "Employee"] }],
  declineAssignment: [{ action: "declineAssignment", allowedRoles: ["Super System Administrator", "System Administrator", "Asset Manager", "Asset Custodian", "Employee"] }],
  confirmHandover: [{ action: "confirmHandover", allowedRoles: ["Super System Administrator", "System Administrator", "Asset Manager", "Asset Custodian"] }],
  returnAssignment: [{ action: "returnAssignment", allowedRoles: ["Super System Administrator", "System Administrator", "Asset Manager", "Asset Custodian", "Employee"] }],
  
  // Maintenance actions
  createMaintenance: [{ action: "createMaintenance", allowedRoles: ["Super System Administrator", "System Administrator", "Asset Manager"] }],
  updateMaintenance: [{ action: "updateMaintenance", allowedRoles: ["Super System Administrator", "System Administrator", "Asset Manager"] }],
  
  // Disposal actions
  disposeAsset: [{ action: "disposeAsset", allowedRoles: ["Super System Administrator", "System Administrator", "Asset Manager"] }],
  
  // User management actions
  createUser: [{ action: "createUser", allowedRoles: ["Super System Administrator", "System Administrator"] }],
  updateUser: [{ action: "updateUser", allowedRoles: ["Super System Administrator", "System Administrator"] }],
  deleteUser: [{ action: "deleteUser", allowedRoles: ["Super System Administrator", "System Administrator"] }],
  changeUserRole: [{ action: "changeUserRole", allowedRoles: ["Super System Administrator", "System Administrator"] }],
  resetPassword: [{ action: "resetPassword", allowedRoles: ["Super System Administrator", "System Administrator"] }],
  
  // Audit log actions
  viewAuditLogs: [{ action: "viewAuditLogs", allowedRoles: ["Super System Administrator", "System Administrator", "Asset Manager"] }],
  
  // Credential actions
  viewCredentials: [{ action: "viewCredentials", allowedRoles: ["Super System Administrator", "System Administrator"] }],
  generateCredentials: [{ action: "generateCredentials", allowedRoles: ["Super System Administrator", "System Administrator"] }],
};

/**
 * Normalize role name for comparison (handles both "SUPER_SYSTEM_ADMINISTRATOR" and "Super System Administrator")
 */
function normalizeRole(role: string): string {
  return role.toLowerCase().replace(/[_\s]/g, '');
}

/**
 * Check if a user role has access to a specific page
 */
export function hasPageAccess(userRole: UserRole | string | undefined, path: string): boolean {
  if (!userRole) return false;
  
  const permission = PAGE_PERMISSIONS.find(p => p.path === path);
  if (!permission) return false;
  
  const normalizedUserRole = normalizeRole(userRole);
  return permission.allowedRoles.some(role => 
    normalizedUserRole === normalizeRole(role)
  );
}

/**
 * Check if a user role has permission to perform a specific action
 */
export function hasActionPermission(userRole: UserRole | string | undefined, action: string): boolean {
  if (!userRole) return false;
  
  const permissions = ACTION_PERMISSIONS[action];
  if (!permissions) return false;
  
  const normalizedUserRole = normalizeRole(userRole);
  return permissions.some(permission => 
    permission.allowedRoles.some(role => 
      normalizedUserRole === normalizeRole(role)
    )
  );
}

/**
 * Get all pages accessible to a user role
 */
export function getAccessiblePages(userRole: UserRole | string | undefined): PagePermission[] {
  if (!userRole) return [];
  
  const normalizedUserRole = normalizeRole(userRole);
  return PAGE_PERMISSIONS.filter(permission => 
    permission.allowedRoles.some(role => 
      normalizedUserRole === normalizeRole(role)
    )
  );
}

/**
 * Get the default redirect path for a user role
 */
export function getDefaultPathForRole(userRole: UserRole | string | undefined): string {
  if (!userRole) return "/dashboard";
  
  const normalizedUserRole = normalizeRole(userRole);
  
  if (normalizedUserRole === normalizeRole("Super System Administrator") || 
      normalizedUserRole === normalizeRole("System Administrator")) {
    return "/dashboard";
  }
  if (normalizedUserRole === normalizeRole("Asset Manager")) {
    return "/dashboard";
  }
  if (normalizedUserRole === normalizeRole("Asset Custodian")) {
    return "/dashboard";
  }
  if (normalizedUserRole === normalizeRole("Employee")) {
    return "/dashboard";
  }
  
  return "/dashboard";
}

/**
 * Check if user can view all requests or only their own
 */
export function canViewAllRequests(userRole: UserRole | string | undefined): boolean {
  if (!userRole) return false;
  const normalizedUserRole = normalizeRole(userRole);
  return normalizedUserRole === normalizeRole("Super System Administrator") || 
         normalizedUserRole === normalizeRole("System Administrator") ||
         normalizedUserRole === normalizeRole("Asset Manager");
}

/**
 * Check if user can manage users
 */
export function canManageUsers(userRole: UserRole | string | undefined): boolean {
  if (!userRole) return false;
  const normalizedUserRole = normalizeRole(userRole);
  return normalizedUserRole === normalizeRole("Super System Administrator") || 
         normalizedUserRole === normalizeRole("System Administrator") ||
         normalizedUserRole === normalizeRole("Asset Manager");
}

/**
 * Check if user can view audit logs
 */
export function canViewAuditLogs(userRole: UserRole | string | undefined): boolean {
  if (!userRole) return false;
  const normalizedUserRole = normalizeRole(userRole);
  return normalizedUserRole === normalizeRole("Super System Administrator") || 
         normalizedUserRole === normalizeRole("System Administrator") ||
         normalizedUserRole === normalizeRole("Asset Manager");
}

/**
 * Check if user can access credentials
 */
export function canAccessCredentials(userRole: UserRole | string | undefined): boolean {
  if (!userRole) return false;
  const normalizedUserRole = normalizeRole(userRole);
  return normalizedUserRole === normalizeRole("Super System Administrator") || 
         normalizedUserRole === normalizeRole("System Administrator");
}
