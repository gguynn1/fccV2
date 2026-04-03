export enum MaintenanceAssetType {
  Home = "home",
  Vehicle = "vehicle",
  Appliance = "appliance",
}

export enum MaintenanceInterval {
  Monthly = "monthly",
  Quarterly = "quarterly",
  Biannual = "biannual",
  Annual = "annual",
  MileageBased = "mileage_based",
  AsNeeded = "as_needed",
}

export enum MaintenanceStatus {
  Current = "current",
  DueSoon = "due_soon",
  Overdue = "overdue",
}

export interface MaintenanceCycle {
  interval: MaintenanceInterval;
  interval_days?: number;
  mileage_interval?: number;
}

export interface MaintenanceHistoryEntry {
  id?: string;
  date: Date;
  performed_by: string;
  cost: number | null;
  notes: string;
  handled_by_vendor_id?: string;
  linked_finance_record_id?: string;
  linked_calendar_event_id?: string;
}

export interface MaintenanceAsset {
  id: string;
  type: MaintenanceAssetType;
  name: string;
  details: Record<string, string>;
}

export interface MaintenanceItem {
  id: string;
  asset_id: string;
  task: string;
  interval: MaintenanceInterval;
  cycle?: MaintenanceCycle;
  last_performed: Date | null;
  next_due: Date | null;
  mileage_last_performed?: number | null;
  mileage_next_due?: number | null;
  responsible: string;
  household_wide?: boolean;
  status: MaintenanceStatus;
  history: MaintenanceHistoryEntry[];
}

export interface MaintenanceState {
  assets: MaintenanceAsset[];
  items: MaintenanceItem[];
}

export type MaintenanceAction =
  | { type: "log_maintenance"; item_id: string; performed_by: string; cost?: number; notes: string }
  | {
      type: "add_asset";
      asset_type: MaintenanceAssetType;
      name: string;
      details: Record<string, string>;
    }
  | {
      type: "add_item";
      asset_id: string;
      task: string;
      interval: MaintenanceInterval;
      responsible: string;
    }
  | {
      type: "schedule_maintenance";
      item_id: string;
      due_at: Date;
      linked_calendar_event_id?: string;
    }
  | {
      type: "set_professional_service";
      item_id: string;
      vendor_name: string;
      vendor_record_id?: string;
    }
  | { type: "query_maintenance"; asset_type?: MaintenanceAssetType; status?: MaintenanceStatus };
