import type { AdminMutationResponseBase } from "@/hooks/admin-mutations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface ReconciliationSummaryProps {
  result: AdminMutationResponseBase | undefined;
  title?: string;
}

function nonZeroEntries(result: AdminMutationResponseBase) {
  const entries = [
    ["Removed held queue items", result.reconciliation.removed_pending_queue_items.length],
    ["Updated held queue items", result.reconciliation.updated_pending_queue_items.length],
    ["Removed queued jobs", result.queue_reconciliation.removed_item_ids.length],
    ["Updated queued jobs", result.queue_reconciliation.updated_item_ids.length],
    ["Skipped active queued jobs", result.queue_reconciliation.skipped_active_item_ids.length],
    ["Removed thread histories", result.reconciliation.removed_thread_histories.length],
    ["Removed state thread contexts", result.reconciliation.removed_state_thread_contexts.length],
    ["Removed recent dispatches", result.reconciliation.removed_recent_dispatches.length],
    ["Updated recent dispatches", result.reconciliation.updated_recent_dispatches.length],
    ["Removed confirmations", result.reconciliation.removed_confirmations.length],
    ["Removed escalations", result.reconciliation.removed_escalations.length],
    ["Removed digest targets", result.reconciliation.removed_digest_targets],
    ["Removed topic records", result.reconciliation.removed_topic_records],
  ] as const;

  return entries.filter(([, count]) => count > 0);
}

export function ReconciliationSummary({
  result,
  title = "Last Save Cleanup",
}: ReconciliationSummaryProps) {
  if (!result) {
    return null;
  }

  const entries = nonZeroEntries(result);
  const normalizedFlags = [
    result.reconciliation.normalized_threads ? "Threads normalized" : null,
    result.reconciliation.normalized_scheduler_times ? "Digest times synchronized" : null,
  ].filter(Boolean);

  if (entries.length === 0 && normalizedFlags.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        {normalizedFlags.length > 0 && <p>{normalizedFlags.join(" • ")}</p>}
        {entries.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {entries.map(([label, count]) => (
              <div key={label} className="rounded-md border border-border px-3 py-2">
                <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
                <div className="mt-1 text-lg font-semibold text-foreground">{count}</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
