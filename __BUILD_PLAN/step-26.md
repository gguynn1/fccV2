# Step 26 — Budget Service

> Source: src/02-supporting-services/06-budget-service/notes.txt

## What to Build

- `src/02-supporting-services/06-budget-service/types.ts` — budget decision types (immediate/batched/silent), counter types, collision check types
- `src/02-supporting-services/06-budget-service/index.ts` — BudgetService implementation
- Redis-backed counters: messages sent per person per day, messages sent per thread per hour
- Three priority outcomes: immediate (send now), batched (hold for digest/quiet window), silent (store only)
- Collision avoidance: check pending and recently sent for same person/thread, batch multiple items into one message
- Budget reconstruction from SQLite `recently_dispatched` records if Redis counters are lost

## Dependencies

Step 0, Step 2, Step 3 (State Service for `recently_dispatched` records), Step 4 (Queue/Redis).

## Technologies

Redis counters (shared with BullMQ, AOF required), Vitest fake timers for budget window tests

## Files to Create/Modify

`types.ts` and `index.ts` in `06-budget-service/`

## Acceptance Criteria

Counters track per-person and per-thread sends, collision avoidance batches correctly, counters reconstruct from SQLite on loss, priority decisions are typed

### Budget Reconstruction Algorithm

When Redis counters are lost despite AOF (e.g., catastrophic failure), the Budget Service must reconstruct from SQLite `recently_dispatched` records:

1. Query `recently_dispatched` for messages sent within the current budget window (today for per-person daily limits, current hour for per-thread hourly limits)
2. Count messages per entity and per thread from the query results
3. Set Redis counters to match the reconstructed counts
4. Handle edge cases: partial outage periods where some sends are in Redis but not SQLite, duplicate records, and defining "recent" as a configurable window (default: 24 hours)
5. Log the reconstruction event via pino so the operator knows counters were rebuilt
