# Step 17 — School Topic Profile

> Source: src/02-supporting-services/04-topic-profile-service/04.07-school/notes.txt

## What to Build

- `src/02-supporting-services/04-topic-profile-service/04.07-school/types.ts` — School types: assignments, due dates, school communications, academic tracking
- `src/02-supporting-services/04-topic-profile-service/04.07-school/profile.ts` — School behavior profile: organized and encouraging with student, concise and actionable with parents, deadline-driven initiative, MEDIUM escalation
- Routes to student's private thread for their tasks, parent's private thread for awareness
- Escalation from child thread to parent thread when important items are ignored
- Input from email parsing or conversation — no LMS API

## Dependencies

Step 0, Step 3, Step 10.

## Technologies

SQLite via State Service, BullMQ for deadline reminders

## Files to Create/Modify

- `types.ts` and `profile.ts` in `04.07-school/`

### Eval Scenario Specifications

- **Classification:** "math homework due Thursday" → school; "parent-teacher conference next week" → school
- **Routing:** student's private thread for tasks; parent's private thread for awareness
- **Composition:** encouraging with student, concise and actionable with parents
- **Escalation:** MEDIUM — deadline reminders; escalation from child thread to parent thread when important items ignored
- **Negative:** no LMS API calls

## Acceptance Criteria

Dual-audience tone, deadline reminders, child-to-parent escalation, email-based input

---
