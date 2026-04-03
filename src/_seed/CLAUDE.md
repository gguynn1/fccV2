# Seed Data

Initial state for database bootstrapping. These files populate every table when the application starts with `--seed`.

## Files

- `system-config.ts` — the complete system definition: entities, threads, 14 topic behavior profiles, dispatch rules (priority levels, outbound budget, routing rules, collision avoidance), confirmation gates, input recognition with topic disambiguation, data ingest sources, daily rhythm, the 8-step worker processing sequence, and escalation profiles (high, medium, low, none).
- `system-state.ts` — a representative mid-day runtime snapshot: queue with pending and recently dispatched items, outbound budget tracker with per-person message counts, active escalation status, and per-topic records across all 14 topics (calendar, chores, finances, grocery, health, pets, school, travel, vendors, business, relationship, family status, meals, maintenance), plus confirmations, thread histories, data ingest processing state, and digest history.

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
