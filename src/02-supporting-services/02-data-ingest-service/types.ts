export enum DataIngestSourceType {
  Email = "email",
  Calendar = "calendar",
  Forwarded = "forwarded",
}

export enum IngestOrigin {
  Inbox = "inbox",
  CalendarAttachment = "calendar_attachment",
  ForwardedContent = "forwarded_content",
}

export interface MonitoredInboxBinding {
  address: string;
  entity_id?: string;
  default_thread_id?: string;
}

export interface EmailMonitorSourceConfig {
  inboxes: string[];
  monitored_inboxes?: MonitoredInboxBinding[];
  poll_interval_minutes: number;
  mailbox?: string;
  relevance_window_minutes?: number;
}

export interface CalendarSyncSourceConfig {
  calendars: string[];
  sync_interval_minutes: number;
  mailbox?: string;
  relevance_window_minutes?: number;
}

export interface ForwardedMessagesSourceConfig {
  relevance_window_minutes?: number;
}

export interface EmailMonitorDataIngestSource {
  id: string;
  type: DataIngestSourceType.Email;
  description: string;
  active: boolean;
  config: EmailMonitorSourceConfig;
}

export interface CalendarSyncDataIngestSource {
  id: string;
  type: DataIngestSourceType.Calendar;
  description: string;
  active: boolean;
  config: CalendarSyncSourceConfig;
}

export interface ForwardedMessagesDataIngestSource {
  id: string;
  type: DataIngestSourceType.Forwarded;
  description: string;
  active: boolean;
  config?: ForwardedMessagesSourceConfig;
}

export type DataIngestSource =
  | EmailMonitorDataIngestSource
  | CalendarSyncDataIngestSource
  | ForwardedMessagesDataIngestSource;

export interface DataIngestConfig {
  sources: DataIngestSource[];
  future: string[];
}

export interface IngestAttachment {
  filename: string;
  content_type: string;
  content: string;
  content_transfer_encoding?: string;
}

export interface ParsedCalendarAttachment {
  uid?: string;
  summary: string;
  starts_at?: Date;
  ends_at?: Date;
  location?: string;
  organizer?: string;
  description?: string;
}

export interface ExtractedIngestPayload {
  summary: string;
  details: Record<string, string>;
  suggested_topic?: string;
  suggested_intent?: string;
  time_sensitive?: boolean;
  relevant_until?: Date | null;
  attributed_entity?: string | null;
  confidence?: number;
  parse_confidence?: number;
  parse_warnings?: string[];
}

export interface ProcessedIngestItem {
  source_id: string;
  origin?: IngestOrigin;
  from?: string;
  subject?: string;
  content_type?: string;
  received_at: Date;
  processed_at: Date;
  queue_item_created?: string;
  topic_classified: string;
  state_ref?: string;
  status?: "queued" | "stored_silent" | "skipped_duplicate";
}

export interface IngestSourceState {
  active: boolean;
  last_poll: Date | null;
  last_poll_result?: string;
  last_sync: Date | null;
  last_received?: Date;
  processed: ProcessedIngestItem[];
  watermark: Date | null;
  total_processed: number;
}

export interface DataIngestState {
  email_monitor: IngestSourceState;
  calendar_sync: IngestSourceState;
  forwarded_messages: IngestSourceState;
}
