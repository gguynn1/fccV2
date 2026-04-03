# Step 20 — Business Topic Profile

> Source: src/02-supporting-services/04-topic-profile-service/04.10-business/notes.txt

## What to Build

- `src/02-supporting-services/04-topic-profile-service/04.10-business/types.ts` — Business types: lead pipeline (inquiry, draft, booking status), per-entity business profiles with `business_type` and name, CRM schema (lead contact, inquiry date, event details, pipeline stage, follow-up history, booking status)
- `src/02-supporting-services/04-topic-profile-service/04.10-business/profile.ts` — Business behavior profile: professional tone (adapts per `business_type`), pipeline-driven initiative, NO escalation, confirmation-gated draft sends
- Routes to business owner's private thread — never expose one entity's leads to another
- Internal CRM owned by the topic profile — no external CRM service
- Lead intake from email parsing or conversation
- Claude API drafts client-facing messages adapted to `business_type`

## Dependencies

Step 0, Step 3, Step 10.

## Technologies

SQLite via State Service, Claude API for draft composition, BullMQ for quiet-period follow-ups

## Files to Create/Modify

- `types.ts` and `profile.ts` in `04.10-business/`

## Acceptance Criteria

Per-entity business profiles, pipeline stage tracking, `business_type`-aware tone, confirmation before sending drafts, lead privacy between entities

---
