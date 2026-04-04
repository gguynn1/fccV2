# Outbound flow

```
                         ACTION ROUTER
                               |
               _______________|_______________
              |               |               |
           DISPATCH         HOLD            STORE
              |               |               |
              v               v               v
         TRANSPORT       SCHEDULER         STATE
    (immediate outbound) (batch / delay)  (silent persist)
```

## Three paths

| Route        | When                                        | Side effects                                                                       |
| ------------ | ------------------------------------------- | ---------------------------------------------------------------------------------- |
| **Dispatch** | Send now through Transport                  | Provider REST send + status callback path; updates dispatch audit / thread history |
| **Hold**     | Batched / collision / quiet-window batching | Encodes `hold_until` / scheduler hand-off for a future touchpoint                  |
| **Store**    | Silent / halted / stale capture             | SQLite via State only — no Transport send                                          |

## Priority mapping (`DispatchPriority` in `src/types.ts`)

| Priority    | Typical Action Router outcome | Notes                                          |
| ----------- | ----------------------------- | ---------------------------------------------- |
| `immediate` | **Dispatch** → Transport      | Time-sensitive, direct replies, clarifications |
| `batched`   | **Hold** → Scheduler          | Digest windows, collision merge, rate limits   |
| `silent`    | **Store** → State             | Logging, audit-only, or non-messaging outcomes |

Exact mapping is implemented in Action Router + Budget collision rules; this table is the conceptual contract.

After the Action Router returns, the Worker still enforces final topic-delivery policy before transport. The Worker can also emit small secondary notices, such as shared-awareness or paired-thread follow-up notices, when policy allows them.

See sub-pages: `03.1-dispatch-to-transport`, `03.2-hold-to-scheduler`, `03.3-store-to-state`.
