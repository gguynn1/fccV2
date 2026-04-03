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
