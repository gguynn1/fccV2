# Step 34 — Worker → Escalation Integration

> Source: src/01-service-stack/05-worker/05.4-calls-escalation/notes.txt

## What to Build

- Wire the Worker's step 5 (check escalation) to the Escalation Service
- Worker checks: is this a follow-up? what step are we on? should we escalate to a broader thread?
- High accountability: private → follow-up → broader thread → digest flag
- Medium: message → follow-up → digest flag (no thread escalation unless deadline imminent)
- Low: send once → disappear if ignored
- Silence never counts as approval

## Dependencies

Step 27 (Escalation Service), Step 30 (Worker).

## Technologies

XState v5 for escalation state, BullMQ/Redis for timed steps

## Files to Create/Modify

Integration code within `src/01-service-stack/05-worker/` (step 5 wiring)

## Acceptance Criteria

All four escalation profiles wired correctly, timed steps fire at correct intervals, silence feeds escalation for high but not low
