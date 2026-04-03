# Step 39 — Action Router → Hold

> Source: src/01-service-stack/06-action-router/06.2-hold/notes.txt

## What to Build

- `src/01-service-stack/06-action-router/06.2-hold/index.ts` — Hold handler
- Moves batched-priority items into BullMQ scheduling for delivery at the next natural touchpoint
- Natural touchpoints: morning digest, evening check-in, next quiet window
- Multiple held items for the same person within a window combine into one message via Claude API digest merging
- Missed window recovery: if machine was down during a digest window, process held items with staleness awareness — stale items logged, not dispatched

## Dependencies

Step 5 (Scheduler Service), Step 37 (Action Router).

## Technologies

BullMQ delayed/scheduled jobs (Redis AOF required), Claude API for digest merging

## Files to Create/Modify

`index.ts` in `06.2-hold/`

## Acceptance Criteria

Batched items scheduled for correct windows, multiple items merge, missed windows handled, stale items not dispatched
