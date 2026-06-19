export type AssetStatus = "Active" | "Inactive" | "In Storage" | "Under Maintenance" | "Disposed";

export const ASSET_STATUSES: AssetStatus[] = [
  "Active",
  "Inactive",
  "In Storage",
  "Under Maintenance",
  "Disposed",
];

export interface AssetCreatePayload {
  asset_name: string;
  category: string;
  description?: string;
  status: AssetStatus;
  purchase_date: string; // ISO date string YYYY-MM-DD
  purchase_cost: number;
  location: string;
  serial_number?: string;
}

export interface AssetResponse {
  asset_id: string;
  asset_name: string;
  category: string;
  description?: string | null;
  status: AssetStatus;
  purchase_date?: string | null;
  purchase_cost?: number | null;
  location?: string | null;
  serial_number?: string | null;
  created_by?: number | null;
  created_at: string;
}
