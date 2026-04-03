# Queue → Worker

```
THE QUEUE (BullMQ, fcc-main)
    |
    |  Redis with AOF persistence (required for durability)
    |  Producer: enqueue + optional idempotency dedupe
    |  Consumer: Worker pulls one job at a time (concurrency configurable; stack assumes sequential semantics)
    v
 WORKER
```

## Single-funnel principle

All sources produce **`PendingQueueItem`** shapes validated by **`pendingQueueItemSchema`**. There is no parallel “fast path” that bypasses the Worker for decisions — only different **sources** (`QueueItemSource` enum) and optional **preclassification**.

## What each item carries (high level)

| Field                                  | Note                                                                                |
| -------------------------------------- | ----------------------------------------------------------------------------------- |
| `source`                               | `human_message`, `reaction`, `email_monitor`, `data_ingest`, `scheduled_trigger`, … |
| `concerning`                           | Entity ids (required array)                                                         |
| `content`                              | String or structured email extract                                                  |
| `target_thread`                        | Originating thread id                                                               |
| `topic` / `intent`                     | **Optional** until Worker step 1 completes (or provided for preclassified items)    |
| `created_at`                           | Enqueue time                                                                        |
| `idempotency_key` / `clarification_of` | Optional linkage / dedupe                                                           |

## Worker pull model

- BullMQ **Worker** invokes the stack `Worker.process…` handler per job.
- Architecture invariant: decisions are **sequential** — the second item sees state left by the first (`architecture.mdc`).

## Retries and dead-letter

- Failed jobs retry with **exponential backoff** (configurable attempts + delay).
- Exhausted retries move to a **dead-letter queue** (companion BullMQ queue) for operator inspection / retry / discard (see queue service implementation).

## Startup reconciliation

- **Stale** waiting jobs can be removed with silent logging.
- **Duplicate** `idempotency_key` entries can be collapsed before processing resumes.
