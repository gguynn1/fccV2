# Runtime Contract (Execution Invariants)

This document is the implementation contract for the Family Assistant runtime.
Refactors are allowed, but these invariants must remain true.

## Queue Funnel

- All inbound and system-generated work enters through the main queue.
- Unknown messaging identities are blocked before enqueue.
- Every queued item has source, target thread, concerning entities, and timestamp.

## Worker Order

The worker preserves this processing order for each item:

1. Classify topic/intent (or trust approved preclassified sources).
2. Resolve identity and thread context.
3. Determine typed action or clarification.
4. Evaluate outbound budget.
5. Evaluate escalation.
6. Evaluate confirmation state.
7. Apply topic behavior profile.
8. Route through action router to dispatch/hold/store.

## Classification Source Rules

- Human/reaction/forwarded/image items are classified by worker step 1.
- `email_monitor` and `data_ingest` items with topic set use the preclassified email trust path.
- `scheduled_trigger` items with topic set use the preclassified scheduled trust path.

## Dispatch Triad

- Every outbound result is one of:
  - `dispatch` (send now),
  - `hold` (defer for scheduler release),
  - `store` (silent persistence only).
- Worker persists dispatch decisions and history regardless of decision type.

## Thread Semantics

- Response behavior stays in the origin thread.
- Proactive behavior routes to the narrowest allowed thread for the concerned entities.
- Topic routing constraints (for example, `never` thread lists) must be respected.

## Confirmation Safety

- Protected actions require explicit approval.
- Confirmation replies are thread-scoped.
- Expired confirmations never auto-execute.
- Expiry is processed by timer workers and startup reconciliation.

## Staleness and Recovery

- Stale timed items are stored, not dispatched late.
- Startup reconciliation runs before worker pull loop starts.
- Escalation/scheduler/confirmation delayed work is reconciled and re-enqueued safely.
