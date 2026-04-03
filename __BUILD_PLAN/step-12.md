# Step 12 — Chores Topic Profile

> Source: src/02-supporting-services/04-topic-profile-service/04.02-chores/notes.txt

## What to Build

- `src/02-supporting-services/04-topic-profile-service/04.02-chores/types.ts` — Chore types: assignee, deadline, completion state, escalation tracking
- `src/02-supporting-services/04-topic-profile-service/04.02-chores/profile.ts` — Chores behavior profile: direct tone, clear task format, structured reminder initiative, HIGH escalation level
- High-accountability timing: reminder at assignment, follow-up before deadline, escalation after deadline, completion logged on confirmation
- Routes to assigned entity's private thread first, escalates to broader shared thread if unresolved

## Dependencies

Step 0, Step 3, Step 10.

## Technologies

SQLite via State Service, BullMQ scheduling, XState for accountability state

## Files to Create/Modify

- `types.ts` and `profile.ts` in `04.02-chores/`

## Acceptance Criteria

Direct tone output, deadline-based reminders, high escalation path, completion tracking

---
