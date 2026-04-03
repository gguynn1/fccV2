# Step 38 — Action Router → Dispatch

> Source: src/01-service-stack/06-action-router/06.1-dispatch/notes.txt

## What to Build

- `src/01-service-stack/06-action-router/06.1-dispatch/index.ts` — Dispatch handler
- Hands off immediate-priority items to the Transport Layer for outbound delivery
- Target thread and payload validated with Zod before transport handoff
- Twilio status callbacks for delivery tracking
- Network outage: failed sends retry via BullMQ exponential backoff, items queue locally

## Dependencies

Step 7 (Transport Layer), Step 37 (Action Router).

## Technologies

Twilio REST API, Zod validation, BullMQ retry, pino logging

## Files to Create/Modify

`index.ts` in `06.1-dispatch/`

## Acceptance Criteria

Immediate items sent via Twilio, delivery status tracked, failed sends retry, payloads validated
