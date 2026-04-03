# Step 0 Part 2 — Core Shared Types, Configuration & Seed Infrastructure

> Source: src/notes.txt

## What to Build

This establishes the shared vocabulary, configuration interfaces, state interfaces, and seed data infrastructure that every service depends on.

- `src/types.ts` — shared enums: TopicKey (14 topics), EscalationLevel, GrocerySection, InputMethod, DispatchPriority, EntityType, ThreadType, ActionType, IntentType
- `src/index.ts` — barrel exports + `SystemConfig` interface + `SystemState` interface
- `src/_seed/system-config.ts` — complete system definition with all entities (anonymized: participant_1, participant_2, participant_3, pet), threads, 14 topic behavior profiles, dispatch rules, confirmation gates, input recognition with disambiguation rules, data ingest sources, daily rhythm, worker processing sequence, escalation profiles
- `src/_seed/system-state.ts` — representative mid-day runtime snapshot with queue state, budget tracker, escalation status, per-topic records across all 14 topics, confirmations, thread histories, digest history
- Database bootstrapping logic — `--seed` flag support that reads seed files and populates SQLite tables
- Environment variable validation module — fail fast on startup with a clear error listing any missing required env vars (`ANTHROPIC_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_IDENTITY`, `REDIS_URL`, `DATABASE_PATH`)

### Thread Structure Definition

The system configuration must explicitly enumerate all threads. Define these in `system-config.ts`:

| Thread                  | Type    | Participants                                              |
| ----------------------- | ------- | --------------------------------------------------------- |
| Private — participant_1 | private | participant_1 + assistant                                 |
| Private — participant_2 | private | participant_2 + assistant                                 |
| Private — participant_3 | private | participant_3 + assistant                                 |
| Shared — adults only    | shared  | participant_1 + participant_2 + assistant                 |
| Shared — family         | shared  | participant_1 + participant_2 + participant_3 + assistant |

Pet has no messaging identity and no thread — pet-related messages route to the responsible adult's private thread.

### Drizzle ORM Decision

**Decision: better-sqlite3 without Drizzle.** The State Service uses better-sqlite3 directly with hand-written SQL. This avoids an additional abstraction layer and keeps the dependency surface minimal. If query complexity grows beyond what raw SQL handles cleanly, Drizzle can be introduced later as a non-breaking addition. This decision affects Steps 3, 0 Part 1 (no Drizzle in dependencies), and the migration strategy (see Step 3).

## Dependencies

Step 0 Part 1 must be complete.

## Technologies

- TypeScript strict mode with ESM
- Zod for configuration and state validation schemas
- better-sqlite3 for database initialization (no Drizzle — see decision above)
- `Record<TopicKey, TopicConfig>` pattern so missing topics are compile errors

## Files to Create/Modify

- `src/types.ts`
- `src/index.ts`
- `src/_seed/system-config.ts`
- `src/_seed/system-state.ts`

## Acceptance Criteria

- `npm run typecheck` passes with all shared types
- Every TopicKey has a corresponding entry in system-config and system-state
- Seed files compile with zero errors against the type system
- Adding or removing a TopicKey value causes compile errors in seed files
- All entity references use anonymized identifiers (participant_1, participant_2, participant_3, pet)
- `npm run start:seed` bootstraps the database from seed data
- Thread structure is explicitly enumerated in system-config with 5 threads (3 private + 2 shared)
- Missing required environment variables cause a clear failure message on startup
