# Step 19 — Vendors Topic Profile

> Source: src/02-supporting-services/04-topic-profile-service/04.09-vendors/notes.txt

## What to Build

- `src/02-supporting-services/04-topic-profile-service/04.09-vendors/types.ts` — Vendor types: contact, cost, stage, pending follow-up status
- `src/02-supporting-services/04-topic-profile-service/04.09-vendors/profile.ts` — Vendors behavior profile: businesslike tone, follow-up-driven initiative, NO escalation
- Routes to managing adult's private thread
- No proactive outbound unless something is flagged pending
- Historical query support: "who fixed the dishwasher and what did we pay?"

## Dependencies

Step 0, Step 3, Step 10.

## Technologies

SQLite via State Service, BullMQ for follow-up reminders

## Files to Create/Modify

- `types.ts` and `profile.ts` in `04.09-vendors/`

### Eval Scenario Specifications

- **Classification:** "the plumber is coming Tuesday" → vendors; "who fixed the dishwasher last time?" → vendors (not maintenance — this is about the vendor relationship)
- **Routing:** managing adult's private thread
- **Composition:** businesslike
- **Escalation:** NONE — no proactive outbound unless flagged pending

## Acceptance Criteria

Businesslike tone, follow-up reminders for pending vendors, historical query support, no escalation

---
