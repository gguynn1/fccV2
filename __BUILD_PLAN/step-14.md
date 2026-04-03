# Step 14 — Grocery Topic Profile

> Source: src/02-supporting-services/04-topic-profile-service/04.04-grocery/notes.txt

## What to Build

- `src/02-supporting-services/04-topic-profile-service/04.04-grocery/types.ts` — Grocery types: list items with sections (`GrocerySection` enum), purchased status
- `src/02-supporting-services/04-topic-profile-service/04.04-grocery/profile.ts` — Grocery behavior profile: utilitarian tone, list format, low initiative, NO escalation, no confirmation gates
- Add, organize by section, read back, mark purchased flows
- Cross-topic: receives items from Meals topic
- Claude API can extract grocery items from natural language or images

## Dependencies

Step 0, Step 3, Step 10.

## Technologies

SQLite via State Service, Claude API for item extraction

## Files to Create/Modify

- `types.ts` and `profile.ts` in `04.04-grocery/`

### Eval Scenario Specifications

- **Classification:** "we need ground beef" → grocery; "add eggs and milk" → grocery; "what should we have for dinner?" → meals (NOT grocery)
- **Routing:** broadest shared thread for shared lists, or reply in originating thread
- **Composition:** utilitarian, minimal commentary
- **Escalation:** NONE — no follow-up
- **Cross-topic:** receives items from Meals topic
- **Negative:** no nagging about groceries

## Acceptance Criteria

Utilitarian brief responses, section-organized list, duplicate handling, cross-topic receives from meals

---
