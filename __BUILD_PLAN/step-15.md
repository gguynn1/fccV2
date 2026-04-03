# Step 15 — Health Topic Profile

> Source: src/02-supporting-services/04-topic-profile-service/04.05-health/notes.txt

## What to Build

- `src/02-supporting-services/04-topic-profile-service/04.05-health/types.ts` — Health types: appointments, medications, provider notes, follow-up needs
- `src/02-supporting-services/04-topic-profile-service/04.05-health/profile.ts` — Health behavior profile: attentive and specific tone, care-driven initiative, MEDIUM escalation, cross-topic to Calendar for appointments
- Routes to individual's private thread — health is personal
- Post-visit follow-up questions, medication reminders, overdue check-up flags

## Dependencies

Step 0, Step 3, Step 10.

## Technologies

SQLite via State Service, BullMQ for reminders, Claude API for note extraction

## Files to Create/Modify

- `types.ts` and `profile.ts` in `04.05-health/`

### Eval Scenario Specifications

- **Classification:** "doctor appointment next week" → health; "need to refill prescription" → health
- **Routing:** individual's private thread (health is personal)
- **Composition:** attentive, specific, privacy-respecting
- **Escalation:** MEDIUM — appointment reminders, follow-up after visits
- **Cross-topic:** health appointment → calendar event

## Acceptance Criteria

Private thread routing, attentive tone, appointment reminders, medication tracking, cross-topic calendar events

---
