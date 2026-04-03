# Step 41 — Service Stack Barrel Exports

> Source: src/01-service-stack/notes.txt

## What to Build

- Barrel export files (`index.ts`) for the service stack so each service is importable from a single entry point
- Stack-level validation that all services conform to their contracts
- End-to-end scenario runner infrastructure: transport in → identity → queue → worker (classifier + entity resolution + service calls) → action router → output
- Mocks for supporting-service calls for isolated stack testing
- Vitest scenario suites that validate the full top-to-bottom pipeline with mocked services

_(This step focuses on barrel exports and stack-level integration; contracts were established in Step 1.)_

### Architecture Rule Update

The cursor rule `architecture.mdc` shows the flow as "Transport → Identity → Classifier → Queue → Worker." Now that implementation is complete, update this rule to reflect the physical reality: Transport → Identity → Queue → Worker (Classifier is called by the Worker as step 1). This prevents new developers or AI assistants from having the wrong mental model of the pipeline.

## Dependencies

Steps 1, 4, 6, 7, 9, 30, 37 (all service stack components built).

## Technologies

TypeScript barrel exports, Vitest scenario suites.

## Files to Create/Modify

- `src/01-service-stack/index.ts` (barrel exports)
- Scenario test scaffolding (Vitest)

## Acceptance Criteria

- Full pipeline testable end-to-end with mocks
- All service contracts verified
- Pipeline order invariant verified: classification occurs exactly once per item, inside the Worker (step 1), not before the queue
- `npm run typecheck` passes

---
