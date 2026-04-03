# Step 36 — Worker → State Integration

> Source: src/01-service-stack/05-worker/05.6-calls-state/notes.txt

## What to Build

- Wire the Worker's state reads and writes throughout the processing sequence
- Reads during processing: thread history, escalation status, confirmation records, outbound budget tracker, per-topic records, digest history
- Writes after processing: queue state (pending → dispatched), topic records (new/updated), escalation state, confirmation state, thread history (append outbound), budget tracker (increment counters)
- Worker never holds state in memory between items — crash between items loses nothing
- Zod validation at read/write boundaries
- pino audit logs for important state mutations

## Dependencies

Step 3 (State Service), Step 30 (Worker).

## Technologies

SQLite via State Service, Zod validation, pino audit logging

## Files to Create/Modify

Integration code within `src/01-service-stack/05-worker/` (state read/write wiring)

## Acceptance Criteria

All reads provide correct data for decisions, all writes persist correctly, crash between items loses no data, audit logs capture mutations
