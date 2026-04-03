# Step 4 — Queue

> Source: src/01-service-stack/04-queue/notes.txt

## What to Build

Build the single intake point that accepts items from every source: human messages, ingest events, and scheduled triggers.

- `src/01-service-stack/04-queue/types.ts` — queue item schema with source, content, entity, thread, timestamp (required), and topic, intent (nullable — set by the Worker's Classifier call after dequeue; may be pre-populated by Data Ingest items)
- `src/01-service-stack/04-queue/index.ts` — BullMQ queue setup with producer and consumer interfaces
- Zod validation before enqueue and before worker consumption
- Idempotency safeguards for duplicate items
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
- Items are validated before enqueue (topic/intent may be null for phone-originated items; source, entity, thread, content, timestamp are always required)
- Items are validated before worker consumption
- Stale items are detected and logged on startup
- Failed jobs retry with exponential backoff
- Dead-letter queue captures exhausted items
- `npm run typecheck` passes
