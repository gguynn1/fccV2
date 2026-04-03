# Processing flow

## Physical pipeline diagram

```
TRANSPORT / INGEST / SCHEDULER
            |
            v
       IDENTITY (phone path only; ingest/scheduler skip straight to queue)
            |
            v
        THE QUEUE  <-- items may omit topic/intent (typical for HumanMessage)
            |
            v
         WORKER  (one item at a time; step 1 = Classifier unless preclassified)
            |
            +-- Step 1: Classifier → TopicKey + ClassifierIntent + concerning
            +-- Step 2: Identity → resolution payload for routing/constraints
            +-- Step 3: Action resolution (typed action or clarification)
            +-- Step 4: Budget → DispatchPriority, hold_until, collision hints
            +-- Step 5: Escalation → broader thread / timers
            +-- Step 6: Confirmation → gate before risky sends
            +-- Step 7: Topic Profile → composed outbound shape
            +-- Step 8: Routing + Action Router → dispatch | hold | store
            |
            +-- State: thread history, topic records, audit (reads + writes interleaved)
            v
      ACTION ROUTER  →  DISPATCH | HOLD | STORE
```

**Logical vs physical:** A diagram that reads “Transport → Identity → Classifier → Queue” is the **logical** story. In code, **classification happens in Worker step 1** after dequeue, except when the item is **preclassified** (trusted ingest or scheduled payloads with `topic` / `intent` already set). Queue schema: `topic` and `intent` are **optional** on `PendingQueueItem` until after step 1.

## Worker step sequence (implemented)

| Step | WorkerAction | Primary service / notes |
| ---- | ------------ | ------------------------ |
| 1 | `classify_topic` | **Classifier** (Claude structured output; stack validates). Skipped/trusted when preclassified. |
| 2 | `identify_entities` | **Identity** |
| 3 | `determine_action_type` | Worker-internal resolution to a typed action; may **raise clarification** instead |
| 4 | `check_outbound_budget` | **Budget** |
| 5 | `check_escalation` | **Escalation** |
| 6 | `check_confirmation` | **Confirmation** |
| 7 | `apply_behavior_profile` | **Topic Profile** (composition) |
| 8 | `route_and_dispatch` | **Routing** + **Action Router** outcome |

Supporting services **do not import each other** at runtime; only the Worker orchestrates them (`architecture.mdc`).

## Clarification loop

When step 3 cannot resolve a safe typed action (`ClassifierIntent` disambiguation, entity reference, missing field, multiple matches — see `ClarificationReason` in `src/types.ts`), the Worker **sends a clarification** outbound on the appropriate thread (immediate dispatch via Transport) instead of continuing the pipeline.

```
Participant input
      |
      v
  [Worker step 3 fails]
      |
      v
 Clarification outbound -----> participant replies
      ^                            |
      |                            v
      +------ new queue item (optional field: clarification_of -> original id)
```

- Follow-up participant messages enqueue as new `PendingQueueItem`s. When `clarification_of` is present, action resolution can bind referents (for example cancel/reschedule targets) to the **original** item’s identity.
- Processing traces may end with `outcome: "clarification_requested"` for the pass that sent the question; the later reply is a **new** queue item.

## Stale catch-up and conflict ordering

- **Stale items:** Queue startup reconciliation and Worker `dropped_stale` logic remove or store items that are too old for their relevance window — they are **not** dispatched late “as if fresh”.
- **Conflicting backlog (design rule):** When both **state-changing** actions (create / update / cancel) and **informational** actions (reminders, nudges) exist for the same entity during catch-up, **mutations win**: cancellations suppress stale reminders; reschedules shift reminder targets. Implementations apply this via ordering, suppression, and state reads during Worker processing (`hosting-model.mdc`).

## Idempotency

- `PendingQueueItem.idempotency_key` (optional) **deduplicates on enqueue** (same key → skip duplicate) and supports **startup backlog deduplication** (keep newest, drop duplicates) so flaky connectivity does not double-process.
- Cross-topic side effects use deterministic keys such as `${source_item_id}:${target_topic}` (`architecture.mdc`).
