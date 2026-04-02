# Processing Flow

```
TRANSPORT -----> IDENTITY -----> CLASSIFIER
                                      |
DATA INGEST -------------------------+
                                      |
SCHEDULER ----------------------------+
                                      |
                                      v
                                 THE QUEUE
                                      |
                                      v
                                   WORKER
                                      |
                     calls:           |
                     Topic Profile ---+
                     Routing ---------+
                     Budget ----------+
                     Escalation ------+
                     Confirmation ----+
                     State -----------+
```

## Worker Processing Sequence

1. Classify the topic
2. Identify the entities involved
3. Determine the action type (response, proactive outbound, or silent storage)
4. Check the outbound budget (priority, collision avoidance, batching)
5. Check escalation (is this a follow-up? what step? should we escalate?)
6. Check confirmation (does this action require approval?)
7. Apply the topic's behavior profile (tone, format, initiative style)
8. Route and dispatch (target thread, then dispatch, hold, or store)
