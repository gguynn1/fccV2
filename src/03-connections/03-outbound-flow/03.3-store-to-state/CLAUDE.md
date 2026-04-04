# Store → State

```
ACTION ROUTER (decision: store)
        |
        v
 STORE handler (Zod-validated silent payload)
        |
        v
 STATE SERVICE (SQLite / WAL) — topic rows, audit, thread history notes
        |
        x  (no Transport send, no Scheduler side effect for this decision)
```

## Silent priority (`DispatchPriority.Silent`)

- Records structured outcomes that should **not** generate proactive outbound: completed chores logged, vendor history, pet care notes, halted actions after confirmation rejection, stale drops converted to store reasons, etc.

## Surfacing rules

- Silent rows **do not notify** by default. They appear when:
  - a participant asks a query the Worker resolves against state,
  - an admin or tooling reads SQLite-backed tables,
  - a downstream digest job explicitly includes stored summaries per policy,
  - an explanation-style request asks what was ingested, why something was sent, or what is being held for later.

## Distinction from Hold

- **Hold** schedules future work (time metadata + scheduler/BullMQ involvement).
- **Store** completes the pipeline with persistence only — any follow-up requires a new queue item from a participant, ingest event, or timer.
