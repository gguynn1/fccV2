# Step 2 — Supporting Services Contracts

> Source: src/02-supporting-services/notes.txt

## What to Build

Define the TypeScript interfaces for all supporting services that the worker calls or that feed the queue. Service boundaries stay explicit through interfaces.

- `src/02-supporting-services/types.ts` — service interfaces for: SchedulerService, DataIngestService, StateService, TopicProfileService, RoutingService, BudgetService, EscalationService, ConfirmationService
- Each interface defines the contract the worker uses to call that service
- Queue producer interfaces for scheduler and data ingest

## Dependencies

Step 0 (both parts) and Step 1 must be complete.

## Technologies

- Strict TypeScript interfaces
- Imports from `src/types.ts` and `src/01-service-stack/types.ts`

## Files to Create/Modify

- `src/02-supporting-services/types.ts`

## Acceptance Criteria

- `npm run typecheck` passes
- Every supporting service has a typed interface
- No direct runtime cross-service imports — only interface contracts
- Worker can depend on these interfaces without coupling to implementations
