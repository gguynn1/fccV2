# State Service

The system's memory

Reads and writes all persistent data:
calendar events
chore records
financial records
grocery list
health profiles
pet care logs
school assignments
travel plans
vendor records
business leads and profiles
relationship history
family status snapshots
meal plans and dietary notes
maintenance assets and schedules
confirmation records
escalation status
digest history

Every other service reads from or writes to this one

Called by the Worker after decisions are made

## Configuration and State

The entire system definition lives in a single configuration store: all entities, threads, topic behavior, dispatch rules, priority definitions, outbound budget, routing rules, confirmation gates, input recognition rules, escalation profiles, data ingest sources, and daily rhythm.

Executable topic delivery policy is code-managed in `src/config/topic-delivery-policy.ts` and derived from runtime config plus hard safety defaults. It is intentionally adjacent to the persisted configuration store, not duplicated into SQLite as a second editable data blob.

The current state lives in a separate state store: all active and recent items across every topic, the queue (pending and recently dispatched), confirmations (pending and recent), digests (last delivered), ingest provenance/state, and per-topic records (calendar events, chores, bills, expenses, savings goals, grocery list, health profiles, pet care logs, school assignments, travel plans, vendor records, business profiles, business leads, relationship nudge history, family status snapshots, meal plans, dietary notes, maintenance assets, maintenance items).

Both stores together allow the system to be booted in any state — empty, mid-day, mid-scenario, or a specific test case — with all configuration and data already in place.

## First-Run Initialization

On first boot, the service writes a minimal configuration record and an empty state snapshot directly into SQLite. After that, the database is the only source of truth. Tests and eval may construct their own fixtures, but the running application never reads configuration or state from checked-in files.

## Implementation

SQLite is accessed via `better-sqlite3`. WAL mode is required for crash resilience and concurrent read performance.
