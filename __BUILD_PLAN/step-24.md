# Step 24 — Maintenance Topic Profile

> Source: src/02-supporting-services/04-topic-profile-service/04.14-maintenance/notes.txt

## What to Build

- `src/02-supporting-services/04-topic-profile-service/04.14-maintenance/types.ts` — Maintenance types: assets (home, vehicle, appliance), maintenance items, intervals, history with costs
- `src/02-supporting-services/04-topic-profile-service/04.14-maintenance/profile.ts` — Maintenance behavior profile: practical and reminder-driven tone, cycle-driven initiative, LOW escalation
- Cross-topic connections: Vendors (professional service reference), Finances (cost tracking), Calendar (scheduled maintenance events)
- Cycle-driven reminders based on last-performed dates and configured intervals
- Maintenance history with who handled it and what it cost

## Dependencies

Step 0, Step 3, Step 10.

## Technologies

SQLite via State Service, BullMQ Scheduler for cycle reminders

## Files to Create/Modify

- `types.ts` and `profile.ts` in `04.14-maintenance/`

### Eval Scenario Specifications

- **Classification:** "when was the oil changed?" → maintenance; "the plumber is coming Tuesday" → vendors (NOT maintenance); "change the furnace filter" → chores (NOT maintenance — it's a one-off task, not a cycle-tracked item)
- **Routing:** responsible adult's private thread for individual items; shared for household-wide
- **Composition:** practical, reminder-driven
- **Escalation:** LOW
- **Cross-topic:** maintenance cost → finances; scheduled maintenance → calendar; professional service needed → vendors

## Acceptance Criteria

Cycle-based due date calculation, overdue detection, cross-topic vendor/finance/calendar links, history logging, practical tone

---
