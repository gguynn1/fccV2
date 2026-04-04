export interface QueueReconciliationPayload {
  removed_item_ids: string[];
  updated_item_ids: string[];
  skipped_active_item_ids: string[];
}

export interface ConfigReconciliationPayload {
  normalized_threads: boolean;
  normalized_scheduler_times: boolean;
  removed_thread_histories: string[];
  removed_state_thread_contexts: string[];
  removed_pending_queue_items: string[];
  updated_pending_queue_items: string[];
  removed_recent_dispatches: string[];
  updated_recent_dispatches: string[];
  removed_confirmations: string[];
  removed_escalations: string[];
  removed_digest_targets: number;
  removed_topic_records: number;
}

export interface AdminMutationResponseBase {
  ok: boolean;
  reconciliation: ConfigReconciliationPayload;
  queue_reconciliation: QueueReconciliationPayload;
}
