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
