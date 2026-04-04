# The Queue

Single intake point
Accepts items from every source

Each item tagged with: source, entity, thread, topic, intent, timestamp

Also receives items from:
Scheduler Service
Data Ingest Service

Items wait here until the worker pulls them

## What Feeds the Queue

All of these produce the same kind of queue item. The system doesn't care where it came from. Same funnel, same rules.

```
Human text message ----------->|
                               |
Reaction on a message -------->|
                               |
Forwarded text or email ------>|
                               |
Image or attachment ---------->|  THE QUEUE
                               |
Email arriving in a ---------->|
monitored inbox                |
                               |
Calendar event added, -------->|
updated, or removed            |
                               |
Scheduled trigger firing ----->|
(cron, timer, reminder due)    |
                               |
Future local producers ------->|
(mail parsing, conversation,   |
state-driven adapters)         |
```

Everything flows through a single queue. There is no separate path for human input versus system-generated events. One funnel, one worker, one set of rules.

Every queue item carries: source, raw content, who it involves, which thread it originated from (if applicable), and a timestamp.

## Implementation

BullMQ backed by shared Redis. AOF persistence (`appendonly yes`) is required — a crash without it loses the entire queue.

Queue items carry an optional `idempotency_key` for deduplication on enqueue and during startup backlog reconciliation. Items are validated with Zod both before enqueue and before the Worker consumes them.

Failed jobs retry with exponential backoff. Items that exhaust all retries move to a dead-letter queue for operator inspection, retry, or discard.
