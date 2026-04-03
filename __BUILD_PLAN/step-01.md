# Step 1 — Service Stack Contracts

> Source: src/01-service-stack/notes.txt

## What to Build

Define the TypeScript interfaces and type contracts that govern how services in the core pipeline communicate. No runtime implementation yet — just the type-level contracts.

- `src/01-service-stack/types.ts` — stack-level contracts for transport input/output, identity resolution result, classification result, queue item schema, worker decision object, action router result (dispatch/hold/store discriminated union)
- Ensure queue items carry: source, content, concerning (entity list), target_thread, created_at (required); topic (TopicKey) and intent (ClassifierIntent) are optional at enqueue — phone-originated items arrive without classification, the Worker classifies after dequeue; Data Ingest and Scheduler items may arrive pre-classified
- Ensure action results use discriminated unions for dispatch/hold/store outcomes
- Service interface definitions that the worker will call

## Dependencies

Step 0 (both parts) must be complete.

## Technologies

- Strict TypeScript with discriminated unions
- Zod schemas for queue item validation
- Imports from `src/types.ts` for shared enums

## Files to Create/Modify

- `src/01-service-stack/types.ts`

## Acceptance Criteria

- `npm run typecheck` passes
- Queue item schema enforces all required fields
- Action result discriminated union covers dispatch, hold, and store
- No runtime imports from sibling services — contracts only
