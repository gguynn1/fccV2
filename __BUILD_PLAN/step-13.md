# Step 13 — Finances Topic Profile

> Source: src/02-supporting-services/04-topic-profile-service/04.03-finances/notes.txt

## What to Build

- `src/02-supporting-services/04-topic-profile-service/04.03-finances/types.ts` — Finance types: bills, expenses, savings goals, milestones
- `src/02-supporting-services/04-topic-profile-service/04.03-finances/profile.ts` — Finances behavior profile: calm and factual tone, snapshot-with-numbers format, deadline-driven initiative, HIGH escalation, confirmation-gated financial actions
- Routes to adults-only shared thread exclusively — NEVER to a child entity's thread
- Inputs from email parsing or conversation — no bank/financial API

## Dependencies

Step 0, Step 3, Step 10.

## Technologies

SQLite via State Service, BullMQ for bill alerts

## Files to Create/Modify

- `types.ts` and `profile.ts` in `04.03-finances/`

## Acceptance Criteria

Factual tone, numbers-based snapshots, adults-only routing, confirmation gates on all financial actions, never leaks to child thread

---
