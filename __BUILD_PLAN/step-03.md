# Step 3 — State Service

> Source: src/02-supporting-services/03-state-service/notes.txt

## What to Build

Build the persistence layer that every other service reads from and writes to. This is the system's memory.

- `src/02-supporting-services/03-state-service/types.ts` — schemas for topic records, queue state, confirmations, digests, escalation status, thread history
- `src/02-supporting-services/03-state-service/index.ts` — StateService implementation using better-sqlite3
- SQLite schema design: tables for each topic's records, queue state (pending + recently_dispatched), confirmations, escalation entries, thread histories, digest history, budget tracker
- WAL mode enabled on database open
- Zod validation on reads and writes for complex records
- Bootstrapping support: empty state, seed state, and mid-scenario state
- Database migration support for schema evolution

## Dependencies

Step 0 (both parts), Step 1, Step 2 must be complete.

## Technologies

- better-sqlite3 with WAL mode
- Optional: Drizzle ORM for query building and migrations
- Zod for read/write boundary validation
- pino for audit logging on important state mutations

## Files to Create/Modify

- `src/02-supporting-services/03-state-service/types.ts`
- `src/02-supporting-services/03-state-service/index.ts`
- `src/02-supporting-services/03-state-service/schema.ts` (SQLite table definitions)

## Acceptance Criteria

- Database initializes in WAL mode
- All topic record types have corresponding tables
- Seed data loads correctly via `--seed`
- Read/write operations are validated with Zod
- State snapshots can be loaded for scenario testing
- `npm run typecheck` passes
