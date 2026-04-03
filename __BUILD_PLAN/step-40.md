# Step 40 — Action Router → Store

> Source: src/01-service-stack/06-action-router/06.3-store/notes.txt

## What to Build

- `src/01-service-stack/06-action-router/06.3-store/index.ts` — Store handler
- Persists silent-priority items through the State Service into SQLite
- No transport or scheduler side effect — records stored only, surfaced when asked
- Typical silent records: completed task logs, vendor history, pet care records, general status entries
- Zod validation on stored record shape

## Dependencies

Step 3 (State Service), Step 37 (Action Router).

## Technologies

SQLite via State Service, Zod validation

## Files to Create/Modify

`index.ts` in `06.3-store/`

## Acceptance Criteria

Silent items stored correctly, no outbound messages sent, records surface on explicit request only, Vitest verifies no side effects
