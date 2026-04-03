# Step 21 — Relationship Topic Profile

> Source: src/02-supporting-services/04-topic-profile-service/04.11-relationship/notes.txt

## What to Build

- `src/02-supporting-services/04-topic-profile-service/04.11-relationship/types.ts` — Relationship types: prompt types (appreciation, connection, conversation starters), nudge history, cooldown tracking
- `src/02-supporting-services/04-topic-profile-service/04.11-relationship/profile.ts` — Relationship behavior profile: warm and brief tone (never clinical), softest initiative of any topic, LOW escalation, framework grounding (IFS, emotionally focused therapy, attachment-based practices)
- Routes to adults-only shared thread ONLY
- If nudge ignored: quietly disappears, no follow-up, no guilt, no escalation
- Retry with different content after cooldown period
- Quiet-window awareness: never during busy or stressful periods

## Dependencies

Step 0, Step 3, Step 10.

## Technologies

SQLite via State Service, Claude API for personalized prompts, BullMQ for quiet-window scheduling

## Files to Create/Modify

- `types.ts` and `profile.ts` in `04.11-relationship/`

## Acceptance Criteria

Warm non-clinical tone, zero escalation on ignore, framework-grounded prompts, quiet-window respect, adults-only routing

---
