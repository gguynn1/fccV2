export enum DataIngestSourceType {
  Email = "email",
  Calendar = "calendar",
  Forwarded = "forwarded",
}

export interface DataIngestSourceConfig {
  inboxes?: string[];
  calendars?: string[];
  poll_interval_minutes?: number;
  sync_interval_minutes?: number;
}

export interface DataIngestSource {
  id: string;
  type: DataIngestSourceType;
  description: string;
  active: boolean;
  config?: DataIngestSourceConfig;
}

export interface DataIngestConfig {
  sources: DataIngestSource[];
  future: string[];
}

export interface ProcessedIngestItem {
  source_id: string;
  from?: string;
  subject?: string;
  content_type?: string;
  received_at: Date;
  processed_at: Date;
  queue_item_created?: string;
  topic_classified: string;
  state_ref?: string;
}

export interface IngestSourceState {
  active: boolean;
  last_poll?: Date | null;
  last_poll_result?: string;
  last_sync?: Date | null;
  last_received?: Date;
  processed: ProcessedIngestItem[];
  watermark?: Date | null;
  total_processed?: number;
}

export interface DataIngestState {
  email_monitor: IngestSourceState;
  calendar_sync: IngestSourceState;
  forwarded_messages: IngestSourceState;
}
