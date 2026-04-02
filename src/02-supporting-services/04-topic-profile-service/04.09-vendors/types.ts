export enum VendorJobStatus {
  Completed = "completed",
  WaitingForQuote = "waiting_for_quote",
}

export interface VendorJob {
  description: string;
  date: Date;
  cost: number | null;
  status: VendorJobStatus;
  notes: string;
}

export interface VendorRecord {
  id: string;
  name: string;
  type: string;
  jobs: VendorJob[];
  contact: string;
  managed_by: string;
  follow_up_pending: boolean;
  follow_up_due?: Date;
}

export interface VendorsState {
  records: VendorRecord[];
}
