# Step 0 Part 2 — Core Shared Types, Configuration & Seed Infrastructure

> Source: src/notes.txt

## What to Build

This establishes the shared vocabulary, configuration interfaces, state interfaces, and seed data infrastructure that every service depends on.

- `src/types.ts` — shared enums: TopicKey (14 topics), EscalationLevel, GrocerySection, InputMethod, DispatchPriority, EntityType, ThreadType, ActionType, IntentType
- `src/index.ts` — barrel exports + `SystemConfig` interface + `SystemState` interface
- `src/_seed/system-config.ts` — complete system definition with all entities (anonymized: participant_1, participant_2, participant_3, pet), threads, 14 topic behavior profiles, dispatch rules, confirmation gates, input recognition with disambiguation rules, data ingest sources, daily rhythm, worker processing sequence, escalation profiles
- `src/_seed/system-state.ts` — representative mid-day runtime snapshot with queue state, budget tracker, escalation status, per-topic records across all 14 topics, confirmations, thread histories, digest history
- Database bootstrapping logic — `--seed` flag support that reads seed files and populates SQLite tables

## Dependencies

Step 0 Part 1 must be complete.

## Technologies

- TypeScript strict mode with ESM
- Zod for configuration and state validation schemas
- better-sqlite3 for database initialization
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
