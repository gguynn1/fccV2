# Step 6 — Identity Service

> Source: src/01-service-stack/02-identity-service/notes.txt

## What to Build

Build the sender resolution service that maps messaging identities to entities.

- `src/01-service-stack/02-identity-service/types.ts` — entity types (adult, child, pet), identity resolution result, permission model, thread membership
- `src/01-service-stack/02-identity-service/index.ts` — IdentityService implementation
- Sender-to-entity resolution: maps messaging identity to entity ID, entity type, permissions, thread memberships
- Entity registry: reads from system configuration
- Thread-membership lookups for routing and approval decisions
- Zod validation on configuration load for entity records

## Dependencies

Step 0, Step 1, Step 3 (State Service for entity registry data).

## Technologies

- Strict TypeScript
- Zod for config validation

## Files to Create/Modify

- `src/01-service-stack/02-identity-service/types.ts`
- `src/01-service-stack/02-identity-service/index.ts`

## Acceptance Criteria

- Resolves participant_1, participant_2, participant_3 messaging identities to entities
- Returns correct entity type (adult/child) and permissions
- Returns which thread a message came from
- Pet entities have no messaging identity
- Malformed entity records fail fast at config load
- `npm run typecheck` passes
