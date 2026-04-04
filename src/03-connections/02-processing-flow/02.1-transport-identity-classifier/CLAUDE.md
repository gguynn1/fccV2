# Transport → Identity → Classifier (logical) vs implemented order

## What the code actually does

1. **Transport** — Validates inbound webhook, normalizes payload (text, structured choice, reaction, media, forwarded envelope) into stack inbound types.
2. **Identity (lightweight, pre-enqueue)** — Resolves sender **messaging identity** to **entity id** and **target_thread** for phone-originated items. Full identity resolution (`EntityType`, permissions, thread memberships) happens in Worker step 2.
3. **Enqueue** — Produces a `PendingQueueItem`. For typical phone traffic, **`topic` and `ClassifierIntent` are omitted**; `QueueItemSource` distinguishes human message / reaction / image / forwarded / etc. (`src/types.ts`, `04-queue/types.ts`).
4. **Worker step 1** — Calls **Classifier** with capped thread history. Claude returns structured fields; the stack validates and maps them to **`ClassificationResult`** (`TopicKey`, `ClassifierIntent`, `concerning`). On API failure, classifier service supplies a deterministic bounded fallback path rather than propagating the error.

**Preclassified path:** Data Ingest or Scheduler may enqueue items with `topic` / `intent` already set; Worker step 1 trusts that policy and records `classification_source` as `preclassified_email` or `preclassified_scheduled` in the processing trace.

## Identity resolution (step 2 inside Worker; after Transport for phone)

- Maps messaging identities to **participant\_\*** / **pet** entity ids (anonymized configuration).
- Supplies thread membership used later by Routing and Escalation.

## Classification output (aligns with `src/types.ts`)

- **TopicKey** — all 14 topic enum values (`calendar` … `maintenance`).
- **ClassifierIntent** — `request`, `update`, `cancellation`, `query`, `response`, `completion`, `confirmation`, `forwarded_data`.
- **concerning** — string entity ids the message bears on.

## Diagrams

**Physical (enqueue + worker):**

```
TRANSPORT ---> IDENTITY ---> THE QUEUE ---> WORKER step 1: CLASSIFIER
```

**Logical (mental model):**

```
TRANSPORT ---> IDENTITY ---> CLASSIFIER ---> THE QUEUE ---> WORKER (steps 2–8)
```

Both diagrams are correct when labelled; connection docs should **never** imply the Classifier runs before the queue for phone-native traffic.
