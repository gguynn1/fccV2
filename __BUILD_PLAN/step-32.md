# Step 32 — Worker → Routing Integration

> Source: src/01-service-stack/05-worker/05.2-calls-routing/notes.txt

## What to Build

- Wire the Worker's step 8 (route and dispatch) to the Routing Service
- Worker sends: topic, entities involved, is this a response or proactive?
- Routing Service returns: target thread ID
- For events needing both immediate reply and later follow-up, split into Rule 1 (immediate) and Rule 2 (future proactive)

## Dependencies

Step 25 (Routing Service), Step 30 (Worker).

## Technologies

Typed routing decisions, decision-table tests

## Files to Create/Modify

Integration code within `src/01-service-stack/05-worker/` (step 8 routing wiring)

## Acceptance Criteria

Response-in-place correct, narrowest-thread proactive correct, dual-rule events handled, decision tables pass
