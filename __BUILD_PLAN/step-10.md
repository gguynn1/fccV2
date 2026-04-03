# Step 10 — Topic Profile Service

> Source: src/02-supporting-services/04-topic-profile-service/notes.txt

## What to Build

- `src/02-supporting-services/04-topic-profile-service/types.ts` — `TopicProfile` interface with `tone`, `format`, `initiative_style`, `escalation_level`, `framework_grounding` fields; `TopicConfig` type keyed by `TopicKey`
- `src/02-supporting-services/04-topic-profile-service/index.ts` — `TopicProfileService` implementation: registry of all 14 topic profiles, lookup by `TopicKey`
- Zod validation of profile config at boot
- Each profile returns: tone, format, initiative style, escalation level, framework grounding (if applicable), response format, cross-topic connections
- Each topic's `types.ts` defines a discriminated union of typed action payloads (e.g., `CalendarAction`, `ChoreAction`). These enforce required fields per mutation — a reschedule requires `event_id`, an expense log requires `amount`. When the Worker resolves a classified intent into a typed action and cannot (ambiguous reference, multiple matches), it produces a `ClarificationRequest` instead of proceeding.

## Dependencies

Step 0, Step 2.

## Technologies

Strict TypeScript, Zod validation, keyed by `TopicKey` enum

## Files to Create/Modify

- `src/02-supporting-services/04-topic-profile-service/types.ts`
- `src/02-supporting-services/04-topic-profile-service/index.ts`

## Acceptance Criteria

All 14 topics registered and distinct, Zod validates at boot, `npm run typecheck` passes

---
