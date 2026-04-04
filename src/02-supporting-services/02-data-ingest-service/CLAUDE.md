# Data Ingest Service

Watches external sources independently:
monitored inboxes (IMAP via imapflow — reconnects automatically after network outage)
calendar change signals (local CalDAV polling — see below)

When something relevant arrives:
extracts content
pre-classifies topic
creates a queue item
drops it into THE QUEUE
tagged as ingest-originated

## Forwarded SMS (phone-native)

**Transport is authoritative.** The transport layer detects forwarded SMS (e.g. bodies that look like `Fwd:` / “forwarded”), tags the queue item as a participant-originated forwarded message, and that item enters the same pipeline as other human traffic. That is the **production path** for forwarded SMS.

`processForwardedContent()` exists to build a fully ingest-style queue item in one call; it is useful for tests and tooling, **not** the live path for inbound forwarded SMS.

For structured extraction of the inner narrative from raw forwarded text, **DataIngestService** exposes **`extractForwardedPayload(content)`** (same extraction pipeline as ingest envelopes, without enqueueing). The `DataIngestService` contract includes this for the worker layer to call when forwarded handling needs an `ExtractedIngestPayload` without treating the item as `QueueItemSource.DataIngest` or going through **`processForwardedContent()`**.

## Data Ingest Layer

Outside information enters the same queue as human messages. No separate path.

```
MONITORED INBOX
  School emails, appointment confirmations,
  bill notifications, booking confirmations
  Extracted, classified, queued
         |
         v
    Same queue, same worker,
    same dispatch rules

FORWARDED SMS (see above)
  Detected and enveloped in transport;
  extraction via extractForwardedPayload when needed
         |
         v
    Same queue, same worker,
    same dispatch rules

CALENDAR SYNC (local CalDAV)
  Polls the local CalDAV URL on a timer (configurable interval)
  PROPFIND against the served calendar collection; when the
  response fingerprint changes, enqueues a calendar update item
  so the worker can react to edits made from external calendar apps
         |
         v
    Same queue, same worker,
    same dispatch rules

FUTURE DATA SOURCES
  Any new source feeds the queue via
  email parsing, conversational input,
  or a local adapter — never a paid
  third-party API without explicit discussion
         |
         v
    Same queue, same worker,
    same dispatch rules
```

Adding a new data source never requires rethinking the dispatch logic. It just feeds the queue.

## Implementation

Email content and image attachments are parsed using Anthropic Claude API before items are queued. Ingest items may arrive pre-classified — `topic` and `intent` already set on the queue item — in which case the Worker skips a fresh classification call and records the source as `preclassified_email`.

Calendar sync does **not** call an external calendar SaaS API; it observes **this** deployment’s CalDAV surface (`localhost`, configurable port) so changes originating in subscribed calendar apps can produce queue work.
