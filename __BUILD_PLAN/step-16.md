# Step 16 — Pets Topic Profile

> Source: src/02-supporting-services/04-topic-profile-service/04.06-pets/notes.txt

## What to Build

- `src/02-supporting-services/04-topic-profile-service/04.06-pets/types.ts` — Pet care types: vet visits, medications, grooming, boarding, care history
- `src/02-supporting-services/04-topic-profile-service/04.06-pets/profile.ts` — Pets behavior profile: warm and practical caretaker tone, gentle initiative, LOW escalation, cross-topic to Calendar for vet appointments
- Routes to responsible adult's private thread
- PET is a tracked entity with no messaging identity
- Periodic overdue-care reminders, travel prep checklists

## Dependencies

Step 0, Step 3, Step 10.

## Technologies

SQLite via State Service, BullMQ for care reminders

## Files to Create/Modify

- `types.ts` and `profile.ts` in `04.06-pets/`

## Acceptance Criteria

Caretaker tone, responsible adult routing, care history tracking, LOW escalation profile (send once — no follow-up if ignored), cross-topic calendar events

---
