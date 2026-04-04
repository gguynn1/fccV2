# Scheduled triggers → Scheduler → Queue

```
SCHEDULER (BullMQ repeatable + delayed jobs) -----> validated PendingQueueItem -----> THE QUEUE
```

## Mechanism

- **Repeatable jobs** — cron-like rhythms (e.g. morning digest, evening check-in).
- **Delayed jobs** — one-shot fire-at times (escalations, confirmation expiry follow-ups, reminders).
- All Scheduler output is validated against **`pendingQueueItemSchema`** before enqueue so Worker-side consumption matches stack types.

## Daily rhythm (design intent)

```
MORNING
  Digest-style touchpoint per participant (private thread)
  Summarize “today”, due items, and carry-over unresolved items where policy allows

DAYTIME
  Quiet unless user-driven input or an immediate/scheduled exception fires

EVENING
  Light check-in when open items remain; otherwise silence

DEFAULT
  Quiet earns trust; speak when useful
```

Exact job names and times live in Scheduler service configuration — this page describes the connection pattern, not production crontab literals.

## Missed-window recovery

- On **startup**, the Scheduler reconciles repeatable / delayed work that should have fired during downtime.
- Fired jobs re-check concrete relevance before emitting a queue item:
  - digest eligibility excludes stale or already-surfaced items
  - relationship nudges are suppressed when the quiet window is marked busy or stressful
  - startup recovery counts and skips stale windows instead of dispatching them late “as if on time”

## Queue tagging

- Items use `QueueItemSource.ScheduledTrigger` (and related metadata). The Worker may treat them as **preclassified** when `topic` / `intent` are present.
