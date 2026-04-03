# Step 27 — Escalation Service

> Source: src/02-supporting-services/07-escalation-service/notes.txt

## What to Build

- `src/02-supporting-services/07-escalation-service/types.ts` — escalation state types, step types, accountability level types
- `src/02-supporting-services/07-escalation-service/index.ts` — EscalationService implementation with XState v5 state machines
- Four escalation profiles: HIGH (chores, finances — multi-step with thread widening), MEDIUM (school, health, calendar, travel — follow-up + digest flag), LOW (relationship, pets, family status, maintenance — send once then disappear), NONE (grocery, vendors, business, meals — no follow-up)
- Timed escalation steps via BullMQ/Redis scheduling
- Silence handling: feeds escalation for high-accountability, means "not now" for low, never treated as approval
- Recovery after downtime: reconcile active escalations — expired timers advance step, don't fire missed step late
- Persist escalation state through State Service into SQLite

## Dependencies

Step 0, Step 2, Step 3 (State Service), Step 5 (Scheduler Service for timer infrastructure).

## Technologies

XState v5 state machines, BullMQ/Redis scheduling (AOF required), SQLite persistence

## Files to Create/Modify

`types.ts` and `index.ts` in `07-escalation-service/`

## Acceptance Criteria

All four profiles implemented, timed steps fire correctly, downtime recovery advances missed steps, silence never equals approval, XState machines model all paths
