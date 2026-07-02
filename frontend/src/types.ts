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

export interface Transfer {
  transfer_id: number;
  asset_id: string;
  from_user_id: number;
  to_user_id: number;
  authorised_by: number;
  transfer_date: string;
  reason: string;
  acknowledged_at: string | null;
  asset_name: string;
  asset_serial: string;
  from_user_name: string;
  to_user_name: string;
  authorised_by_name: string;
}

export interface TransferListResponse {
  transfers: Transfer[];
  total: number;
}

export interface UserSettings {
  user_id: number;
  theme: "light" | "dark";
  language: "en" | "fr";
  notifications_email: boolean;
  notifications_in_app: boolean;
  notifications_maintenance_alerts: boolean;
  notifications_transfer_alerts: boolean;
  notifications_request_updates: boolean;
}

export interface SystemSettings {
  organisation_name: string;
  asset_id_prefix: string;
  session_timeout_hours: number;
  max_failed_login_attempts: number;
}

export interface AssetRequest {
  request_id: number;
  asset_id: string;
  asset_type: string;
  requested_by: number;
  reviewed_by: number | null;
  assigned_to: number | null;
  status: string;
  priority: string;
  reason: string;
  notes: string | null;
  requested_date: string;
  required_by_date: string | null;
  reviewed_at: string | null;
  assigned_at: string | null;
  pickup_confirmed_at: string | null;
  requested_by_name: string;
  asset_name: string;
}

export interface AssetRequestListResponse {
  requests: AssetRequest[];
  total: number;
}

export interface StorageAsset {
  asset_id: string;
  asset_name: string;
  asset_type: string;
  serial_number: string;
  condition: string;
  department: string;
  stored_at: string;
}

export interface StorageListResponse {
  assets: StorageAsset[];
  total: number;
  by_department: Record<string, number>;
  by_type: Record<string, number>;
}

export interface Assignment {
  assignment_id: number;
  asset_id: string;
  asset_name: string;
  assigned_to: number;
  assigned_to_name: string;
  assigned_by: number;
  assigned_by_name: string;
  assigned_date: string;
  return_date: string | null;
  status: string;
  notes: string | null;
}

export interface AssignmentListResponse {
  assignments: Assignment[];
  total: number;
}

export interface MaintenanceRecord {
  maintenance_id: number;
  asset_id: string;
  asset_name: string;
  maintenance_type: string;
  performed_by: number;
  performed_by_name: string;
  scheduled_date: string;
  completed_date: string | null;
  cost: number;
  notes: string | null;
  asset_status: string;
}

export interface MaintenanceListResponse {
  records: MaintenanceRecord[];
  total: number;
}

export interface CurrentCustodian {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  department: string | null;
}

export interface AssignmentHistoryEntry {
  assignment_id: number;
  assigned_to_name: string | null;
  assigned_by_name: string | null;
  assignment_date: string;
  return_date: string | null;
  status: string;
  notes: string | null;
}

export interface MaintenanceHistoryEntry {
  maintenance_id: number;
  service_date: string;
  service_provider: string;
  description: string;
  cost: number;
  next_service_date: string | null;
}

export interface TransferHistoryEntry {
  transfer_id: number;
  from_user_name: string | null;
  to_user_name: string | null;
  transfer_date: string;
  reason: string;
  acknowledged_at: string | null;
}

export interface DisposalRecord {
  disposal_id: number;
  asset_id: string;
  disposal_date: string;
  disposal_method: string;
  reason: string;
  authorised_by: string;
  authorised_by_name: string;
}

export interface AssetDetail {
  asset_id: string;
  asset_name: string;
  asset_type: string;
  category: string;
  serial_number: string;
  condition: string;
  status: string;
  source_type: string;
  procurement_ref: string | null;
  cost: number;
  acquisition_date: string;
  supplier: string;
  department: string | null;
  current_custodian_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  current_custodian: CurrentCustodian | null;
  assignment_history: AssignmentHistoryEntry[];
  maintenance_history: MaintenanceHistoryEntry[];
  transfer_history: TransferHistoryEntry[];
  disposal_record: DisposalRecord | null;
}

export interface DisposalListResponse {
  disposals: DisposalRecord[];
  total: number;
}

// ── Asset Types ─────────────────────────────────────────────────────────────────────

/** Current custodian information - returned by GET /api/v1/assets/{id} */
export interface CurrentCustodian {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  department: string | null;
}

/** Assignment history entry - returned by GET /api/v1/assets/{id} */
export interface AssignmentHistoryEntry {
  assignment_id: number;
  assigned_to_name: string | null;
  assigned_by_name: string | null;
  assignment_date: string;
  return_date: string | null;
  status: string;
  notes: string | null;
}

/** Maintenance history entry - returned by GET /api/v1/assets/{id} */
export interface MaintenanceHistoryEntry {
  maintenance_id: number;
  service_date: string;
  service_provider: string;
  description: string;
  cost: number;
  next_service_date: string | null;
}

/** Transfer history entry - returned by GET /api/v1/assets/{id} */
export interface TransferHistoryEntry {
  transfer_id: number;
  from_user_name: string | null;
  to_user_name: string | null;
  transfer_date: string;
  reason: string;
  acknowledged_at: string | null;
}

/** Disposal record - returned by GET /api/v1/assets/{id} and GET /api/v1/disposals */
export interface DisposalRecord {
  disposal_id: number;
  asset_id: string;
  disposal_date: string;
  disposal_method: string;
  reason: string;
  authorised_by: string;
  authorised_by_name: string;
}

/** Full asset detail - returned by GET /api/v1/assets/{id} */
export interface AssetDetail {
  asset_id: string;
  asset_name: string;
  asset_type: string;
  category: string;
  serial_number: string;
  condition: string;
  status: string;
  source_type: string;
  procurement_ref: string | null;
  cost: number;
  acquisition_date: string;
  supplier: string;
  department: string | null;
  current_custodian_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  current_custodian: CurrentCustodian | null;
  assignment_history: AssignmentHistoryEntry[];
  maintenance_history: MaintenanceHistoryEntry[];
  transfer_history: TransferHistoryEntry[];
  disposal_record: DisposalRecord | null;
}

/** Disposal list response - returned by GET /api/v1/disposals */
export interface DisposalListResponse {
  disposals: DisposalRecord[];
  total: number;
}

// ── Transfer Types (GET /api/v1/transfers, POST /api/v1/transfers) ─────────────
export interface Transfer {
  transfer_id: number;
  asset_id: string;
  from_user_id: number;
  to_user_id: number;
  authorised_by: number;
  transfer_date: string;
  reason: string;
  acknowledged_at: string | null;
  asset_name: string;
  asset_serial: string;
  from_user_name: string;
  to_user_name: string;
  authorised_by_name: string;
}

export interface TransferListResponse {
  transfers: Transfer[];
  total: number;
}

// ── Settings Types (GET /api/v1/settings, PUT /api/v1/settings) ───────────────
export interface UserSettings {
  user_id: number;
  theme: "light" | "dark";
  language: "en" | "fr";
  notifications_email: boolean;
  notifications_in_app: boolean;
  notifications_maintenance_alerts: boolean;
  notifications_transfer_alerts: boolean;
  notifications_request_updates: boolean;
}

// ── System Settings Types (GET /api/v1/settings/system, PUT /api/v1/settings/system) ─
export interface SystemSettings {
  organisation_name: string;
  asset_id_prefix: string;
  session_timeout_hours: number;
  max_failed_login_attempts: number;
}

// ── Asset Request Types (GET /api/v1/requests) ───────────────────────────────────
export interface AssetRequest {
  request_id: number;
  asset_id: string;
  asset_type: string;
  requested_by: number;
  reviewed_by: number | null;
  assigned_to: number | null;
  status: string;
  priority: string;
  reason: string;
  notes: string | null;
  requested_date: string;
  required_by_date: string | null;
  reviewed_at: string | null;
  assigned_at: string | null;
  pickup_confirmed_at: string | null;
  requested_by_name: string;
  asset_name: string;
}

export interface AssetRequestListResponse {
  requests: AssetRequest[];
  total: number;
}

// ── Storage Types (GET /api/v1/storage) ───────────────────────────────────────────
export interface StorageAsset {
  asset_id: string;
  asset_name: string;
  asset_type: string;
  serial_number: string;
  condition: string;
  department: string;
  stored_at: string;
}

export interface StorageListResponse {
  assets: StorageAsset[];
  total: number;
  by_department: Record<string, number>;
  by_type: Record<string, number>;
}

// ── Assignment Types (GET /api/v1/assignments) ───────────────────────────────────
export interface Assignment {
  assignment_id: number;
  asset_id: string;
  asset_name: string;
  assigned_to: number;
  assigned_to_name: string;
  assigned_by: number;
  assigned_by_name: string;
  assigned_date: string;
  return_date: string | null;
  status: string;
  notes: string | null;
}

export interface AssignmentListResponse {
  assignments: Assignment[];
  total: number;
}

// ── Maintenance Types (GET /api/v1/maintenance) ───────────────────────────────────
export interface MaintenanceRecord {
  maintenance_id: number;
  asset_id: string;
  asset_name: string;
  maintenance_type: string;
  performed_by: number;
  performed_by_name: string;
  scheduled_date: string;
  completed_date: string | null;
  cost: number;
  notes: string | null;
  asset_status: string;
}

export interface MaintenanceListResponse {
  records: MaintenanceRecord[];
  total: number;
}
