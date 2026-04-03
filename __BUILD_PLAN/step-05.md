# Step 5 — Scheduler Service

> Source: src/02-supporting-services/01-scheduler-service/notes.txt

## What to Build

Build the timer and scheduling infrastructure for digests, reminders, follow-ups, and escalation deadlines.

- `src/02-supporting-services/01-scheduler-service/types.ts` — scheduled event types, daily rhythm configuration, digest window definitions, `DigestEligibility` contract (what items qualify for inclusion: exclude already-dispatched, exclude stale beyond threshold, suppress repeats from previous digest, include unresolved from yesterday)
- `src/02-supporting-services/01-scheduler-service/index.ts` — SchedulerService implementation using BullMQ repeatable and delayed jobs
- Morning digest, evening check-in, and quiet window scheduling
- Reminder timers, follow-up windows, escalation deadlines, bill due date alerts, relationship nudge cooldowns
- Missed window recovery: on startup, check if a repeatable job should have fired during downtime; adapt or skip stale items
- Queue item production for scheduler-originated events

## Dependencies

Step 0, Step 1, Step 2, Step 4 (Queue).

## Technologies

- BullMQ repeatable and delayed jobs (Redis AOF required)
- pino logging for timer lifecycle events

## Files to Create/Modify

- `src/02-supporting-services/01-scheduler-service/types.ts`
- `src/02-supporting-services/01-scheduler-service/index.ts`

## Acceptance Criteria

- Scheduled jobs persist across Redis restarts (AOF)
- Morning digest fires at configured time and applies `DigestEligibility` rules (exclude stale, suppress repeats, include unresolved)
- Missed windows are detected and adapted on startup
- All scheduled events produce valid queue items
- `npm run typecheck` passes
