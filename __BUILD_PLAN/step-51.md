# Step 51 — Queue to Worker Flow Documentation

> Source: src/03-connections/02-processing-flow/02.2-queue-to-worker/notes.txt

## What to Build

- Verify/update Queue → Worker flow documentation
- Document single-queue principle: one funnel for all sources
- Document BullMQ backed by Redis with AOF persistence
- Document worker pull model: one item at a time
- Document retry behavior and dead-letter queue

## Dependencies

Steps 4, 30 (Queue and Worker implementations).

## Technologies

Markdown, ASCII diagrams.

## Files to Create/Modify

- `src/03-connections/02-processing-flow/02.2-queue-to-worker/CLAUDE.md` (verify/update)

## Acceptance Criteria

- Single-funnel principle documented
- Retry and dead-letter described
- BullMQ/Redis path accurate

---
