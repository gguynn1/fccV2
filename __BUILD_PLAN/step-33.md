# Step 33 — Worker → Budget Integration

> Source: src/01-service-stack/05-worker/05.3-calls-budget/notes.txt

## What to Build

- Wire the Worker's step 4 (check outbound budget) to the Budget Service
- Worker receives: immediate/batched/silent priority decision and collision check result
- Immediate items proceed to dispatch, batched items go to hold, silent items go to store
- Multiple pending items for same person batch into one message

## Dependencies

Step 26 (Budget Service), Step 30 (Worker).

## Technologies

Redis-backed counters, Vitest fake timers for window tests

## Files to Create/Modify

Integration code within `src/01-service-stack/05-worker/` (step 4 wiring)

## Acceptance Criteria

Priority decisions route correctly to dispatch/hold/store, collision avoidance batches items, digest windows and spacing work
