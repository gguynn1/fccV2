# Step 49 — Processing Flow Documentation

> Source: src/03-connections/02-processing-flow/notes.txt

## What to Build

- Verify/update processing flow documentation
- Document full flow: Transport → Identity → Queue → Worker (Classifier + entity resolution + action resolution + supporting service calls) → Action Router
- Document the **clarification loop**: when action resolution fails (ambiguous intent, ambiguous reference, multiple matches, missing required field), the Worker sends a clarification question to the participant's thread instead of proceeding. The response re-enters the Queue with `clarification_of` linking it to the original item. Document how the Worker resumes processing when the clarification response arrives.
- Document stale catch-up after downtime, including recovery ordering for conflicting queued items (state-changing actions take precedence over informational actions)
- Document idempotency: queue items carry an `idempotency_key` for deduplication on enqueue and during startup backlog processing
- Cross-check with all implemented services

### Pipeline Order Clarification

The connection diagram "Transport → Identity → Classifier → Queue" shows the **logical** end-to-end flow a phone message traverses. The **physical** flow is: Transport normalizes inbound input → Identity resolves who sent it → item enters the Queue without topic classification → Worker pulls the item and calls the Classifier as its first step, which returns a typed `ClassificationResult` (TopicKey + ClassifierIntent). This distinction matters for the queue item schema (`topic` and `intent` are optional on `PendingQueueItem` — absent for phone-originated items, may be pre-populated for Data Ingest and Scheduler items). Update the diagram and prose to make this clear.

## Dependencies

Steps 4, 6, 7, 9, 30, 37 (all processing pipeline components).

## Technologies

Markdown, ASCII diagrams.

## Files to Create/Modify

- `src/03-connections/02-processing-flow/CLAUDE.md` (verify/update)

## Acceptance Criteria

- Full processing flow documented accurately
- Clarification loop documented with diagram
- Stale catch-up and recovery ordering described
- Idempotency mechanism described

---
