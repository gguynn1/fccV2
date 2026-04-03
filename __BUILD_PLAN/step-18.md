# Step 18 — Travel Topic Profile

> Source: src/02-supporting-services/04-topic-profile-service/04.08-travel/notes.txt

## What to Build

- `src/02-supporting-services/04-topic-profile-service/04.08-travel/types.ts` — Travel types: itineraries, checklists, countdown reminders, post-trip follow-up
- `src/02-supporting-services/04-topic-profile-service/04.08-travel/profile.ts` — Travel behavior profile: organized and anticipatory tone, countdown-driven initiative, MEDIUM escalation
- Cross-topic connections: Calendar (travel dates), Pets (boarding), Finances (trip budgets), Grocery (pre/post-trip shopping)
- Routes to broadest shared thread including all travelers, or individual's private thread for solo travel
- Input from email parsing (booking confirmations) or conversation — no booking/flight API

## Dependencies

Step 0, Step 3, Step 10.

## Technologies

SQLite via State Service, BullMQ for countdown reminders

## Files to Create/Modify

- `types.ts` and `profile.ts` in `04.08-travel/`

### Eval Scenario Specifications

- **Classification:** "flight to Denver on the 15th" → travel; "need to book a hotel" → travel
- **Routing:** broadest shared thread including all travelers for group trips; private for solo
- **Composition:** organized, anticipatory
- **Escalation:** MEDIUM — countdown reminders
- **Cross-topic:** travel dates → calendar, pet boarding → pets, trip budget → finances, pre-trip shopping → grocery

## Acceptance Criteria

Countdown reminders, cross-topic connections to calendar/pets/finances/grocery, audience-appropriate routing

---
