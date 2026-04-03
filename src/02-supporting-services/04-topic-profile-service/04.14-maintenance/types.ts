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

export interface MaintenanceHistoryEntry {
  date: Date;
  performed_by: string;
  cost: number | null;
  notes: string;
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
  last_performed: Date | null;
  next_due: Date | null;
  responsible: string;
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
  | { type: "query_maintenance"; asset_type?: MaintenanceAssetType; status?: MaintenanceStatus };
