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

### Pre-Classification Trust Policy

Data Ingest items (Step 29) may arrive with topic/intent pre-populated. The Worker applies this policy:

1. If `topic` is null → call the Classifier (always true for phone-originated items)
2. If `topic` is set AND the source is `ingest` → trust the pre-classification, skip the Classifier call (saves API quota)
3. If `topic` is set AND the source is `scheduler` → trust the pre-classification (scheduler items are system-generated with known topics)
4. Log the classification source (pre-classified vs. worker-classified) in the decision trace for debugging

### Cross-Topic Event Wiring

When the Worker processes an item, it must check for cross-topic side effects declared in the topic profile's `cross_topic_connections`. For each declared connection:

1. After step 7 (apply topic behavior profile), check if the current action triggers a cross-topic event
2. If triggered, create a new queue item for the target topic (e.g., Meals→Grocery generates grocery list additions)
3. The new item enters the queue as a system-generated event with source `cross_topic`
4. Cross-topic items are processed by the same Worker pipeline — no special handling

Declared connections to wire: Meals→Grocery, Maintenance→Vendors, Maintenance→Finances, Maintenance→Calendar, Health→Calendar, Pets→Calendar, Business→Finances, Business→Calendar, Travel→Calendar, Travel→Pets, Travel→Finances, Travel→Grocery.

### Thread History Context Window

The Worker must cap the thread history passed to the Classifier at a configured maximum (e.g., last 15 messages). This prevents unbounded growth in classification prompt size, which would increase latency and cost. The cap is a system configuration value, not hardcoded.

## Dependencies

Step 0, Step 1, Step 2, Step 3, Step 4 (Queue), Step 5, Step 6, Step 7, Step 9, Step 10, Steps 11-24 (all 14 topic profiles must be registered for the Worker to produce distinct topic-shaped outputs), Steps 25-28 (all supporting services).

## Technologies

BullMQ worker, pino logging, Strict TypeScript orchestration

## Files to Create/Modify

`types.ts` and `index.ts` in `05-worker/`

## Acceptance Criteria

Processes one item at a time through all 8 steps, decision trace logged, stale items handled, no in-memory state between items, all service calls go through interfaces, cross-topic events produce new queue items, pre-classification trust policy applied correctly, thread history capped at configured maximum
