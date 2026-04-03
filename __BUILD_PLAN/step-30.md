# Step 30 — Worker

> Source: src/01-service-stack/05-worker/notes.txt

## What to Build

- `src/01-service-stack/05-worker/types.ts` — worker decision types, processing step types, service client interfaces
- `src/01-service-stack/05-worker/index.ts` — Worker implementation: pulls one item at a time from the queue, runs the fixed 8-step processing sequence
- Fixed processing sequence: 1) classify topic, 2) identify entities, 3) determine action type, 4) check outbound budget, 5) check escalation, 6) check confirmation, 7) apply topic behavior profile, 8) route and dispatch
- Service client interfaces for each supporting service call
- Decision tracing via pino for auditability
- Stale catch-up on startup: check each item's age and relevance before processing
- Network outage: failed service calls (Claude, Twilio) retry via BullMQ backoff
- Worker never holds state in memory between items

### Pipeline Order Clarification

The inbound path for phone-native messages is: Transport normalizes → Identity resolves sender → item enters the Queue with source, sender entity, thread, raw content, and timestamp. Topic and intent are **not yet classified** at this point.

The Worker owns classification. When it pulls an item, step 1 calls the Classifier Service and step 2 resolves which entities are **concerned** (distinct from step 6 in the Identity Service, which resolves who **sent** it). Data Ingest items may arrive pre-classified; the Worker validates or re-classifies as needed.

The connection documentation (step-48) shows "Transport → Identity → Classifier → Queue" as the **logical end-to-end flow** a phone message traverses, not a pre-queue pipeline. Physically, the Classifier is invoked by the Worker after the item is dequeued.

## Dependencies

Step 0, Step 1, Step 2, Step 3, Step 4 (Queue), Step 5, Step 6, Step 7, Step 9, Step 10, Steps 25-28 (all supporting services).

## Technologies

BullMQ worker, pino logging, Strict TypeScript orchestration

## Files to Create/Modify

`types.ts` and `index.ts` in `05-worker/`

## Acceptance Criteria

Processes one item at a time through all 8 steps, decision trace logged, stale items handled, no in-memory state between items, all service calls go through interfaces
