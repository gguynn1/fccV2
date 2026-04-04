# Seed Data

Initial state for database bootstrapping. These files populate every table when the application starts with `--seed`.

## Files

- `system-config.ts` — the complete system definition: entities, threads, 14 topic behavior profiles, dispatch rules (priority levels, outbound budget, routing rules, collision avoidance), confirmation gates, input recognition with topic disambiguation, data ingest sources, daily rhythm, the 8-step worker processing sequence, and escalation profiles (high, medium, low, none).
- `system-state.ts` — a representative mid-day runtime snapshot: queue with pending and recently dispatched items, outbound budget tracker with per-person message counts, active escalation status, and per-topic records across all 14 topics (calendar, chores, finances, grocery, health, pets, school, travel, vendors, business, relationship, family status, meals, maintenance), plus confirmations, thread histories, data ingest processing state, and digest history.
- `resolve.ts` — async seed loader with local override support. All seed consumption goes through `loadSeedConfig()` and `loadSeedState()` from this module. Never import directly from `system-config.ts` or `system-state.ts` in runtime code.

## Local Override

A root-level `_seed/` directory (gitignored) can override these defaults. When the seeder runs, `resolve.ts` checks for `_seed/system-config.{js,ts}` and `_seed/system-state.{js,ts}` at the project root before falling back to `src/_seed/`. This allows developers to seed with their own data without modifying committed files.

Resolution order per file: `.js` first (works in compiled `node dist/` runs), then `.ts` (works under tsx / dev mode). If no override exists, `src/_seed/` is used.

The root `_seed/` files must export the same shapes (`systemConfig` and `systemState`) as their `src/_seed/` counterparts. Because root `_seed/` is gitignored, it is exempt from PID anonymization rules — it exists specifically for real personal data. The committed `src/_seed/` defaults remain fully anonymized.

## Rules

These files are static. The running application reads from and writes to the database — never back here.

They change only when:

- A topic is added or removed from the enum
- An interface gains or loses a field
- An enum gains or loses a value
- The developer adjusts the initial sample data for development or testing

They must always:

- Compile against the current type system with zero errors
- Represent a complete, valid system — every TopicKey present in both config and state, every entity, every thread, every escalation profile populated
- Contain realistic sample data so the seeded application looks like an active mid-day system, not an empty shell

## Relationship to the Type System

`SystemConfig.topics` is `Record<TopicKey, TopicConfig>` — a missing topic is a compile error. `SystemState` has a named field per topic — a missing field is a compile error. Enum values are used throughout — a removed member surfaces everywhere it was referenced. If these files compile, the seed is valid.

## Relationship to the Database

At runtime, the state service reads from and writes to SQLite. The seed files exist solely to provide the initial data for that database. Once seeded, all mutations happen in the database. The seed files are never consulted again until the next `--seed` invocation.

## Import Rule

Runtime code must never import `system-config.ts` or `system-state.ts` directly. Always use `loadSeedConfig()` and `loadSeedState()` from `resolve.ts` so the local override path is respected.
