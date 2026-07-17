/**
 * Role-Based Access Control (RBAC) Utilities
 * 
 * This file defines role permissions and provides helper functions
 * to check if a user has access to specific pages, actions, or features.
 * 
 * Role values match the backend UserRole enum (uppercase with underscores).
 * The normalizeRole function handles comparison between enum values and
 * display names so both formats work throughout the codebase.
 */

export type UserRole = 
  | "Super System Administrator"
  | "System Administrator" 
  | "Asset Manager"
  | "Asset Custodian"
  | "Employee"
  | "SUPER_SYSTEM_ADMINISTRATOR"
  | "SYSTEM_ADMINISTRATOR"
  | "ASSET_MANAGER"
  | "ASSET_CUSTODIAN"
  | "EMPLOYEE";

export interface PagePermission {
  path: string;
  allowedRoles: UserRole[];
  label: string;
}

export interface ActionPermission {
  action: string;
  allowedRoles: UserRole[];
}

// Page access permissions — roles listed using enum values to match the backend
export const PAGE_PERMISSIONS: PagePermission[] = [
  { path: "/dashboard",        allowedRoles: ["SUPER_SYSTEM_ADMINISTRATOR", "SYSTEM_ADMINISTRATOR", "ASSET_MANAGER", "ASSET_CUSTODIAN", "EMPLOYEE"], label: "Dashboard" },
  { path: "/requests",         allowedRoles: ["SUPER_SYSTEM_ADMINISTRATOR", "SYSTEM_ADMINISTRATOR", "ASSET_MANAGER", "ASSET_CUSTODIAN", "EMPLOYEE"], label: "Requests" },
  { path: "/assets",           allowedRoles: ["SUPER_SYSTEM_ADMINISTRATOR", "SYSTEM_ADMINISTRATOR", "ASSET_MANAGER", "ASSET_CUSTODIAN"], label: "Assets" },
  { path: "/assets/register",  allowedRoles: ["SUPER_SYSTEM_ADMINISTRATOR", "SYSTEM_ADMINISTRATOR", "ASSET_MANAGER", "ASSET_CUSTODIAN"], label: "Register Asset" },
  { path: "/inventory",        allowedRoles: ["SUPER_SYSTEM_ADMINISTRATOR", "SYSTEM_ADMINISTRATOR", "ASSET_MANAGER", "ASSET_CUSTODIAN", "EMPLOYEE"], label: "Inventory" },
  { path: "/assignments",      allowedRoles: ["SUPER_SYSTEM_ADMINISTRATOR", "SYSTEM_ADMINISTRATOR", "ASSET_MANAGER", "ASSET_CUSTODIAN", "EMPLOYEE"], label: "Assignments" },
  { path: "/storage",          allowedRoles: ["SUPER_SYSTEM_ADMINISTRATOR", "SYSTEM_ADMINISTRATOR", "ASSET_MANAGER"], label: "Storage" },
  { path: "/transfers",        allowedRoles: ["SUPER_SYSTEM_ADMINISTRATOR", "SYSTEM_ADMINISTRATOR", "ASSET_MANAGER"], label: "Transfers" },
  { path: "/maintenance",      allowedRoles: ["SUPER_SYSTEM_ADMINISTRATOR", "SYSTEM_ADMINISTRATOR", "ASSET_MANAGER"], label: "Maintenance" },
  { path: "/admin/users",      allowedRoles: ["SUPER_SYSTEM_ADMINISTRATOR", "SYSTEM_ADMINISTRATOR"], label: "User Management" },
  { path: "/admin/audit-logs", allowedRoles: ["SUPER_SYSTEM_ADMINISTRATOR", "SYSTEM_ADMINISTRATOR", "ASSET_MANAGER"], label: "Audit Logs" },
  { path: "/credentials",      allowedRoles: ["SUPER_SYSTEM_ADMINISTRATOR", "SYSTEM_ADMINISTRATOR"], label: "Credentials" },
  { path: "/settings",         allowedRoles: ["SUPER_SYSTEM_ADMINISTRATOR", "SYSTEM_ADMINISTRATOR", "ASSET_MANAGER", "ASSET_CUSTODIAN", "EMPLOYEE"], label: "Settings" },
];

// Action permissions for specific operations
export const ACTION_PERMISSIONS: Record<string, ActionPermission[]> = {
  // Asset actions
  createAsset:      [{ action: "createAsset",      allowedRoles: ["SUPER_SYSTEM_ADMINISTRATOR", "SYSTEM_ADMINISTRATOR", "ASSET_MANAGER", "ASSET_CUSTODIAN"] }],
  updateAsset:      [{ action: "updateAsset",      allowedRoles: ["SUPER_SYSTEM_ADMINISTRATOR", "SYSTEM_ADMINISTRATOR", "ASSET_MANAGER", "ASSET_CUSTODIAN"] }],
  deleteAsset:      [{ action: "deleteAsset",      allowedRoles: ["SUPER_SYSTEM_ADMINISTRATOR", "SYSTEM_ADMINISTRATOR", "ASSET_MANAGER"] }],
  deactivateAsset:  [{ action: "deactivateAsset",  allowedRoles: ["SUPER_SYSTEM_ADMINISTRATOR", "SYSTEM_ADMINISTRATOR", "ASSET_MANAGER"] }],
  reactivateAsset:  [{ action: "reactivateAsset",  allowedRoles: ["SUPER_SYSTEM_ADMINISTRATOR", "SYSTEM_ADMINISTRATOR", "ASSET_MANAGER"] }],
  bulkImportAssets: [{ action: "bulkImportAssets", allowedRoles: ["SUPER_SYSTEM_ADMINISTRATOR", "SYSTEM_ADMINISTRATOR", "ASSET_MANAGER", "ASSET_CUSTODIAN"] }],

  // Request actions
  approveRequest:  [{ action: "approveRequest",  allowedRoles: ["SUPER_SYSTEM_ADMINISTRATOR", "SYSTEM_ADMINISTRATOR", "ASSET_MANAGER"] }],
  rejectRequest:   [{ action: "rejectRequest",   allowedRoles: ["SUPER_SYSTEM_ADMINISTRATOR", "SYSTEM_ADMINISTRATOR", "ASSET_MANAGER"] }],
  assignRequest:   [{ action: "assignRequest",   allowedRoles: ["SUPER_SYSTEM_ADMINISTRATOR", "SYSTEM_ADMINISTRATOR", "ASSET_MANAGER"] }],
  completeRequest: [{ action: "completeRequest", allowedRoles: ["SUPER_SYSTEM_ADMINISTRATOR", "SYSTEM_ADMINISTRATOR", "ASSET_MANAGER"] }],
  cancelRequest:   [{ action: "cancelRequest",   allowedRoles: ["SUPER_SYSTEM_ADMINISTRATOR", "SYSTEM_ADMINISTRATOR", "ASSET_MANAGER", "EMPLOYEE"] }],

  // Transfer actions
  createTransfer:      [{ action: "createTransfer",      allowedRoles: ["SUPER_SYSTEM_ADMINISTRATOR", "SYSTEM_ADMINISTRATOR", "ASSET_MANAGER"] }],
  acknowledgeTransfer: [{ action: "acknowledgeTransfer", allowedRoles: ["SUPER_SYSTEM_ADMINISTRATOR", "SYSTEM_ADMINISTRATOR", "ASSET_MANAGER", "ASSET_CUSTODIAN", "EMPLOYEE"] }],

  // Assignment actions
  createAssignment:  [{ action: "createAssignment",  allowedRoles: ["SUPER_SYSTEM_ADMINISTRATOR", "SYSTEM_ADMINISTRATOR", "ASSET_MANAGER"] }],
  acceptAssignment:  [{ action: "acceptAssignment",  allowedRoles: ["SUPER_SYSTEM_ADMINISTRATOR", "SYSTEM_ADMINISTRATOR", "ASSET_MANAGER", "ASSET_CUSTODIAN", "EMPLOYEE"] }],
  declineAssignment: [{ action: "declineAssignment", allowedRoles: ["SUPER_SYSTEM_ADMINISTRATOR", "SYSTEM_ADMINISTRATOR", "ASSET_MANAGER", "ASSET_CUSTODIAN", "EMPLOYEE"] }],
  confirmHandover:   [{ action: "confirmHandover",   allowedRoles: ["SUPER_SYSTEM_ADMINISTRATOR", "SYSTEM_ADMINISTRATOR", "ASSET_MANAGER", "ASSET_CUSTODIAN"] }],
  returnAssignment:  [{ action: "returnAssignment",  allowedRoles: ["SUPER_SYSTEM_ADMINISTRATOR", "SYSTEM_ADMINISTRATOR", "ASSET_MANAGER", "ASSET_CUSTODIAN", "EMPLOYEE"] }],

  // Maintenance actions
  createMaintenance: [{ action: "createMaintenance", allowedRoles: ["SUPER_SYSTEM_ADMINISTRATOR", "SYSTEM_ADMINISTRATOR", "ASSET_MANAGER"] }],
  updateMaintenance: [{ action: "updateMaintenance", allowedRoles: ["SUPER_SYSTEM_ADMINISTRATOR", "SYSTEM_ADMINISTRATOR", "ASSET_MANAGER"] }],

  // Disposal actions
  disposeAsset: [{ action: "disposeAsset", allowedRoles: ["SUPER_SYSTEM_ADMINISTRATOR", "SYSTEM_ADMINISTRATOR", "ASSET_MANAGER"] }],

  // User management actions
  createUser:    [{ action: "createUser",    allowedRoles: ["SUPER_SYSTEM_ADMINISTRATOR", "SYSTEM_ADMINISTRATOR"] }],
  updateUser:    [{ action: "updateUser",    allowedRoles: ["SUPER_SYSTEM_ADMINISTRATOR", "SYSTEM_ADMINISTRATOR"] }],
  deleteUser:    [{ action: "deleteUser",    allowedRoles: ["SUPER_SYSTEM_ADMINISTRATOR", "SYSTEM_ADMINISTRATOR"] }],
  changeUserRole:[{ action: "changeUserRole",allowedRoles: ["SUPER_SYSTEM_ADMINISTRATOR", "SYSTEM_ADMINISTRATOR"] }],
  resetPassword: [{ action: "resetPassword", allowedRoles: ["SUPER_SYSTEM_ADMINISTRATOR", "SYSTEM_ADMINISTRATOR"] }],

  // Audit log actions
  viewAuditLogs: [{ action: "viewAuditLogs", allowedRoles: ["SUPER_SYSTEM_ADMINISTRATOR", "SYSTEM_ADMINISTRATOR", "ASSET_MANAGER"] }],

  // Credential actions
  viewCredentials:     [{ action: "viewCredentials",     allowedRoles: ["SUPER_SYSTEM_ADMINISTRATOR", "SYSTEM_ADMINISTRATOR"] }],
  generateCredentials: [{ action: "generateCredentials", allowedRoles: ["SUPER_SYSTEM_ADMINISTRATOR", "SYSTEM_ADMINISTRATOR"] }],
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

  // Handle dynamic asset detail paths like /assets/URSB-XXXXXXXX
  const normalizedPath = path.startsWith("/assets/") && path !== "/assets/register"
    ? "/assets"
    : path;

  const permission = PAGE_PERMISSIONS.find(p => p.path === normalizedPath);
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
  return hasActionPermission(userRole, "approveRequest");
}

/**
 * Check if user can manage users
 */
export function canManageUsers(userRole: UserRole | string | undefined): boolean {
  return hasPageAccess(userRole, "/admin/users");
}

/**
 * Check if user can view audit logs
 */
export function canViewAuditLogs(userRole: UserRole | string | undefined): boolean {
  return hasPageAccess(userRole, "/admin/audit-logs");
}

/**
 * Check if user can access credentials
 */
export function canAccessCredentials(userRole: UserRole | string | undefined): boolean {
  return hasPageAccess(userRole, "/credentials");
}
