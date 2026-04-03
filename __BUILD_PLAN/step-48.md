# Step 48 — Processing Flow Documentation

> Source: src/03-connections/02-processing-flow/notes.txt

## What to Build

- Verify/update processing flow documentation
- Document full flow: Transport → Identity → Queue → Worker (Classifier + entity resolution + supporting service calls) → Action Router
- Document stale catch-up after downtime
- Cross-check with all implemented services

### Pipeline Order Clarification

The connection diagram "Transport → Identity → Classifier → Queue" shows the **logical** end-to-end flow a phone message traverses. The **physical** flow is: Transport normalizes inbound input → Identity resolves who sent it → item enters the Queue without topic classification → Worker pulls the item and calls the Classifier as its first step. This distinction matters for the queue item schema (topic/intent may be null on enqueue) and for Data Ingest items that arrive pre-classified. Update the diagram and prose to make this clear.

## Dependencies

Steps 4, 6, 7, 9, 30, 37 (all processing pipeline components).

## Technologies

Markdown, ASCII diagrams.

## Files to Create/Modify

- `src/03-connections/02-processing-flow/CLAUDE.md` (verify/update)

## Acceptance Criteria

- Full processing flow documented accurately
- Stale catch-up described

---
