# Step 23 — Meals Topic Profile

> Source: src/02-supporting-services/04-topic-profile-service/04.13-meals/notes.txt

## What to Build

- `src/02-supporting-services/04-topic-profile-service/04.13-meals/types.ts` — Meal types: meal plans, dietary notes, recipe references
- `src/02-supporting-services/04-topic-profile-service/04.13-meals/profile.ts` — Meals behavior profile: collaborative and practical tone, moderate initiative, NO escalation
- Cross-topic connection to Grocery: meal plan generates grocery list items
- Routes to broadest shared thread for family meal planning, individual private thread for dietary notes
- Claude API interprets meal ideas and suggests grocery items
- No external recipe API

## Dependencies

Step 0, Step 3, Step 10.

## Technologies

SQLite via State Service, Claude API for meal interpretation

## Files to Create/Modify

- `types.ts` and `profile.ts` in `04.13-meals/`

### Eval Scenario Specifications

- **Classification:** "what should we have for dinner?" → meals; "we need ground beef" → grocery (NOT meals — this is a specific item, not meal planning)
- **Routing:** broadest shared thread for family meal planning; private for individual dietary notes
- **Composition:** collaborative, practical
- **Escalation:** NONE
- **Cross-topic:** meal plan generates grocery list items (meals→grocery connection)

## Acceptance Criteria

Collaborative tone, grocery cross-topic link, dietary notes tracking, no external API, timing-aware suggestions

---
