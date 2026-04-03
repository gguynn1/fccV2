# Step 37 — Action Router

> Source: src/01-service-stack/06-action-router/notes.txt

## What to Build

- `src/01-service-stack/06-action-router/types.ts` — action result types using discriminated unions: DispatchResult, HoldResult, StoreResult. Also defines `CollisionPrecedence` enum (SafetyAndHealth > TimeSensitiveDeadline > ActiveConversation > ScheduledReminder > ProactiveOutbound) and `CollisionPolicy` with a strict `precedence_order` and `same_precedence_strategy`.
- `src/01-service-stack/06-action-router/index.ts` — ActionRouter implementation
- Maps worker decisions to three outcomes: dispatch (send now via Transport), hold (batch via Scheduler), store (save in State)
- Priority mapping: immediate → dispatch, batched → hold, silent → store
- **Collision resolution**: when multiple immediate items compete for the same person or thread, apply the `precedence_order` from `CollisionPolicy`. Higher-precedence items dispatch first; same-precedence items batch into a single message or space out per the `same_precedence_strategy`.
- Adapters from worker decision objects into transport, scheduler, or state actions
- pino logs explain final routing outcomes

## Dependencies

Step 0, Step 1, Step 30 (Worker).

## Technologies

Discriminated unions, pino logging

## Files to Create/Modify

`types.ts` and `index.ts` in `06-action-router/`

## Acceptance Criteria

All three outcomes correctly routed, discriminated union exhaustiveness checked at compile time, decision logs explain routing
