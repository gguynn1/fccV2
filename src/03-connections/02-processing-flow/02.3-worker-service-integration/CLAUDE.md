# Worker ↔ supporting services (no cross-imports)

```
WORKER (orchestrator only)
    |
    |-- Classifier Service     — step 1 (Claude API + stack-side validation)
    |-- Identity Service       — step 2
    |-- (action resolution)  — step 3; worker-internal / topic payload typing
    |-- Budget Service         — step 4
    |-- Escalation Service     — step 5 (XState + delayed jobs)
    |-- Confirmation Service   — step 6
    |-- Topic Profile Service  — step 7
    |-- Routing Service        — step 8 (target thread + follow-up metadata)
    |-- Action Router        — step 8 terminal (dispatch | hold | store modules)
    |-- State Service          — reads/writes across steps (history, records, audit)
    '-- Transport Service      — outbound send path; also used for clarification outbound
```

## Eight processing steps ↔ services

This table mirrors **`WorkerAction`** / **`WorkerService`** in `src/01-service-stack/05-worker/types.ts` and the trace order in `05-worker/index.ts`:

| # | Action | Service enum (when traced) | Responsibility |
| - | ------ | -------------------------- | -------------- |
| 1 | `classify_topic` | `WorkerService.Classifier` | Topic + intent + concerning |
| 2 | `identify_entities` | `WorkerService.Identity` | Entity/thread identity details |
| 3 | `determine_action_type` | _(none — worker-internal)_ | Typed action or clarification signal |
| 4 | `check_outbound_budget` | `WorkerService.Budget` | `DispatchPriority`, batching, collisions |
| 5 | `check_escalation` | `WorkerService.Escalation` | Stages, broader threads, timers |
| 6 | `check_confirmation` | `WorkerService.Confirmation` | Gates / reply resolution |
| 7 | `apply_behavior_profile` | `WorkerService.TopicProfile` | Tone, format, composition |
| 8 | `route_and_dispatch` | `WorkerService.Routing` | Target thread + **Action Router** result |

**State** is not a numbered `WorkerService` in traces but underpins history reads, persistence of `appendDispatchResult`, confirmations, escalations, and topic rows.

## Boundary rule

Numbered folders under `02-supporting-services/` **must not** import runtime code from one another. Integration happens **only** through Worker (and queue producers for Scheduler / Ingest). This documentation must not describe “Service A directly calls Service B” — only “Worker calls A then B.”

## Action Router

After step 8 chooses a final envelope, **Dispatch**, **Hold**, and **Store** handlers validate payloads (Zod) and perform transport, scheduler, or state persistence per `06-action-router` and `06.x-*` modules.
