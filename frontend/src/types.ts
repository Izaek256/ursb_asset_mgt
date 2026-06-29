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
  id: string;
  timestamp: string; // ISO
  performedBy: string;
  targetUser: string;
  action: string;
  ipAddress?: string;
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
