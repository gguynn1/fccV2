# Step 35 — Worker → Confirmation Integration

> Source: src/01-service-stack/05-worker/05.5-calls-confirmation/notes.txt

## What to Build

- Wire the Worker's step 6 (check confirmation) to the Confirmation Service
- Worker checks: does this action require approval? is there a pending confirmation to resolve?
- Three gate types enforced: sending on behalf, financial actions, system changes
- Incoming message resolving a pending confirmation: approval → execute, rejection → cancel, expiry → notify and offer reissue
- Reaction handling: positive reaction = approved, negative reaction = rejected

## Dependencies

Step 28 (Confirmation Service), Step 30 (Worker).

## Technologies

SQLite via State Service, BullMQ for expiry timers

## Files to Create/Modify

Integration code within `src/01-service-stack/05-worker/` (step 6 wiring)

## Acceptance Criteria

All three gate types block until approval, reactions resolve confirmations, expired confirmations never auto-execute
