# Step 4 — Queue

> Source: src/01-service-stack/04-queue/notes.txt

## What to Build

Build the single intake point that accepts items from every source: human messages, ingest events, and scheduled triggers.

- `src/01-service-stack/04-queue/types.ts` — queue item schema with source, content, concerning (entity list), target_thread, created_at (required), and topic (TopicKey), intent (ClassifierIntent) — both optional at enqueue, set by the Worker's Classifier call after dequeue; may be pre-populated by Data Ingest or Scheduler items. Also carries optional `idempotency_key` (content-based fingerprint) and `clarification_of` (links a response to the original queue item when this is a clarification reply).
- `src/01-service-stack/04-queue/index.ts` — BullMQ queue setup with producer and consumer interfaces
- Zod validation before enqueue and before worker consumption
- Idempotency safeguards using `idempotency_key`: before enqueue, check for an existing item with the same key in the pending queue. On startup after downtime, deduplicate backlog items with matching keys — keep the most recent, discard duplicates.
- Stale detection on startup: items past their relevance window are logged silently, never dispatched
- Dead-letter queue for items that exhaust retries
- pino logging on enqueue, dequeue, retry, and dead-letter events

## Dependencies

Step 0 (both parts), Step 1, Step 3 (State Service for stale detection).

## Technologies

- BullMQ backed by Redis (AOF persistence required)
- Zod for queue item validation
- pino for lifecycle event logging

## Files to Create/Modify

- `src/01-service-stack/04-queue/types.ts`
- `src/01-service-stack/04-queue/index.ts`

## Acceptance Criteria

- Queue connects to Redis successfully
- Items are validated before enqueue (topic/intent may be absent for phone-originated items; source, concerning, target_thread, content, created_at are always required)
- Items are validated before worker consumption
- Stale items are detected and logged on startup
- Failed jobs retry with exponential backoff
- Dead-letter queue captures exhausted items
- `npm run typecheck` passes
