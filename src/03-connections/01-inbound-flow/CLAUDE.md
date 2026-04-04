# Inbound Flow

Three doors into the system — each produces **queue items** for the same BullMQ funnel:

```
External world
    |
    |--- phone-native channel ---> TRANSPORT ---> IDENTITY ---> THE QUEUE
    |--- email / parsing --------> DATA INGEST ---------------> THE QUEUE
    |--- scheduled triggers -----> SCHEDULER ----------------> THE QUEUE
```

## Door 1 — Phone-native channel → Transport → Identity

- Private-thread phone traffic is validated and normalized by the Transport layer, then a lightweight identity lookup resolves the sender to an entity id and their **private thread** before enqueue.
- When Twilio Conversations is enabled, shared-thread phone traffic enters through the Conversations webhook and is mapped directly to the configured shared thread id at the transport layer. Shared-thread meaning no longer degrades into private fallback.
- See `01.1-phone-to-transport/CLAUDE.md`.

## Door 2 — Email and structured ingest → Data Ingest

- Monitored inbox via **IMAP (imapflow)**; forwarded content and attachments can be normalized into ingest-originated items.
- Calendar-relevant material enters through **email parsing** (for example `.ics` attachments) or **conversational** capture — not by calling an external calendar API. See `01.2-external-to-ingest/CLAUDE.md`.

## Door 3 — Scheduled triggers → Scheduler

- **BullMQ** repeatable and delayed jobs produce items (morning digest, evening check-in, escalation timers, confirmation expiry, and other scheduled work).
- See `01.3-scheduled-triggers/CLAUDE.md`.

## What can enter (by shape)

- Human-authored content in any configured thread
- Positive or negative **reactions** on assistant messages (where the client exposes them; mapping is conservative across clients)
- **Images / attachments** (media downloaded and interpreted in context)
- Forwarded blocks (phone-native or email) normalized by Transport or Data Ingest
- Email messages and extracted fields from monitored inboxes
- Scheduler-fired and timer-driven work items

## Extending sources

New external facts should feed the queue the same way: parse from email, accept via conversation, or add a small producer that enqueues validated `PendingQueueItem` shapes — consistent with `data-input-boundaries` and `architecture` rules.
