# Step 22 — Family Status Topic Profile

> Source: src/02-supporting-services/04-topic-profile-service/04.12-family-status/notes.txt

## What to Build

- `src/02-supporting-services/04-topic-profile-service/04.12-family-status/types.ts` — Family status types: ETA updates, location snapshots, freshness/expiry windows
- `src/02-supporting-services/04-topic-profile-service/04.12-family-status/profile.ts` — Family Status behavior profile: brief and functional tone, minimal initiative, LOW escalation
- Current snapshot maintenance with old entries expiring
- Routes to whatever thread fits the audience — narrowest appropriate
- Might ask for ETA update if calendar suggests someone should be in transit

## Dependencies

Step 0, Step 3, Step 10.

## Technologies

SQLite via State Service, BullMQ for status expiry

## Files to Create/Modify

- `types.ts` and `profile.ts` in `04.12-family-status/`

### Eval Scenario Specifications

- **Classification:** "I'll be home by 6" → family_status; "where is everyone?" → family_status
- **Routing:** narrowest thread that fits the audience
- **Composition:** brief, functional
- **Escalation:** LOW — minimal proactive behavior

## Acceptance Criteria

Brief functional tone, snapshot expiry, on-request surfacing, minimal proactive behavior

---
