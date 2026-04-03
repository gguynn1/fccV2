# Step 25 — Routing Service

> Source: src/02-supporting-services/05-routing-service/notes.txt

## What to Build

- `src/02-supporting-services/05-routing-service/types.ts` — routing decision types, thread target types, `ContextTransitionPolicy` (when `active_topic_context` resets: on new topic classification, after idle timeout, on explicit switch signals)
- `src/02-supporting-services/05-routing-service/index.ts` — RoutingService implementation
- Two routing rules: Rule 1 (responses stay in context — reply in same thread), Rule 2 (proactive messages route to narrowest appropriate thread)
- Thread map lookup from system configuration
- Entity-to-thread mapping: one entity → private thread, multiple entities → narrowest shared thread, pet → responsible adult's thread
- When both rules apply (response now + proactive follow-up later), Rule 1 handles immediate, Rule 2 handles future

## Dependencies

Step 0, Step 2, Step 3 (State Service for thread definitions), Step 6 (Identity Service for entity-thread mapping).

## Technologies

Strict TypeScript over shared thread map and entity types

## Files to Create/Modify

`types.ts` and `index.ts` in `05-routing-service/`

## Acceptance Criteria

Response-in-place routing correct, proactive narrowest-thread routing correct, decision tables pass in Vitest, pet routes to responsible adult
