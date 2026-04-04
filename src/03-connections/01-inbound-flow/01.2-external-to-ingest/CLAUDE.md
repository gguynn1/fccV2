# External sources → Data Ingest

```
MONITORED INBOX (IMAP / imapflow) -----> extract / classify -----> THE QUEUE
Forwarded phone-native content --------> normalize ----------------> THE QUEUE
(Future: same pattern) ----------------> producer -----------------> THE QUEUE
```

## Email monitoring

- **imapflow** maintains a long-lived IMAP connection when real credentials are configured; placeholder credentials skip live connect at runtime.
- Messages are normalized into ingest payloads with **inbox attribution**, freshness / stale awareness, and optional **structured extraction** (headers, body fragments, attachments).

## Calendar-related input

- Calendar facts enter through **email parsing** (for example appointment confirmations and **`.ics`** attachments) or **conversational** capture.
- The system does **not** poll or subscribe to an external calendar SaaS API; the served calendar (CalDAV) is local/read-oriented. Wording here matches `data-input-boundaries`.

## Forwarded content

- Phone-native forwarded payloads and email forwards share the same idea: Transport or Data Ingest extracts an inner narrative, classifies when needed, and enqueues a `PendingQueueItem` with an ingest-appropriate `QueueItemSource`.

## Pre-classification

- Ingest may set `topic` and `ClassifierIntent` on the queue item. The Worker treats trusted ingest sources as **preclassified** for step 1 when those fields are present on `QueueItemSource.EmailMonitor`, `QueueItemSource.DataIngest`, or scheduled items, and records the corresponding `classification_source`.

## Safety

- Ambiguous inbox attribution is quarantined into the safest private operator context and marked silent rather than surfaced to a shared family audience.
- Calendar sync now produces event-level `created` / `updated` / `removed` queue items instead of a generic “calendar changed” signal.

## Future integrations

- Each new source should **enqueue queue items** (and optional pre-classification) through the same schema. Prefer parsing mail, conversational capture, or a dedicated producer — not unapproved third-party APIs — per project boundaries.
