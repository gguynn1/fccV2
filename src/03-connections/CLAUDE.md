# How They All Connect

Documentation only — no runtime code in this folder.

## Physical pipeline (implemented)

End-to-end order matches the service stack: inbound normalization and sender resolution happen **before** enqueue; **classification runs inside the Worker** as step 1 (except ingest/scheduled items that arrive pre-classified).

```
External world
    |
    |--- phone-native channel ---> TRANSPORT ---> IDENTITY ---> THE QUEUE
    |--- email / ingest --------> DATA INGEST ----------------> THE QUEUE
    |--- scheduled triggers ----> SCHEDULER -----------------> THE QUEUE
    |
    v
                               THE QUEUE  (BullMQ / Redis, AOF persistence)
                                    |
                                    v
                                 WORKER
                         (step 1: Classifier, unless preclassified)
                                    |
                     calls / reads:  |
                     Classifier -----+  (step 1)
                     Identity -------+  (step 2)
                     (action resolve, step 3 — worker-internal)
                     Budget ---------+  (step 4)
                     Escalation -----+  (step 5)
                     Confirmation ---+  (step 6)
                     Topic Profile --+  (step 7)
                     Routing --------+  (step 8; then Action Router)
                     State ----------+  (reads throughout; writes after decisions)
                                    |
                                    v
                              ACTION ROUTER
                                    |
                    ________________|________________
                   |                |                |
                DISPATCH          HOLD            STORE
                   |                |                |
                   v                v                v
              TRANSPORT       SCHEDULER          STATE
            (send now)      (batch / delay)   (silent persist)
```

## Logical vs physical (classification)

- **Logical story:** “What was said → who sent it → what topic/intent is it?” mirrors how people think about a message.
- **Physical story:** Transport normalizes inbound payload → Identity resolves sender to an entity and thread → a `PendingQueueItem` is enqueued with **`topic` and `intent` optional** (typical for `QueueItemSource.HumanMessage`). The Worker dequeues the item and runs the **Classifier in step 1**, producing a typed `ClassificationResult` (`TopicKey`, `ClassifierIntent`, `concerning`). Data Ingest and Scheduler may enqueue items with `topic` / `intent` already set (`preclassified_email` / `preclassified_scheduled` trust path in the Worker).

Shared vocabulary for enums and queue fields lives in `src/types.ts` and `src/01-service-stack/04-queue/types.ts`.

## Outbound

The Action Router chooses **Dispatch**, **Hold**, or **Store**, driven in part by `DispatchPriority` (`immediate`, `batched`, `silent`). See `03-outbound-flow/CLAUDE.md`.

Routing and Action Router are not the whole outbound story. The Worker also enforces executable topic delivery policy before transport and may emit small secondary notices such as shared-awareness or paired-thread follow-up notices when policy allows them.

## Principle

Every source feeds **the same queue**, **the same Worker**, and **the same Action Router** outcomes. Adding a new data source means enqueueing queue items (and optional pre-classification); it does not require new dispatch logic.
