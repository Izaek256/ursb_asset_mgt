export type Role =
  | "System Administrator"
  | "Asset Manager"
  | "Asset Custodian"
  | "Employee";

export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
}

export interface AuditLog {
  id: string;
  timestamp: string; // ISO
  performedBy: string;
  targetUser: string;
  action: string;
  ipAddress?: string;
}
