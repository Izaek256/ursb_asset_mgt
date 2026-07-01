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
  department: string;
  created_at: string;
}

export interface AuditLog {
  log_id: string;
  timestamp: string;
  user_id: number | null;
  user_name: string;
  action: string;
  table_affected: string;
  record_id: string;
  details: string;
}

export interface AuditLogListResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
