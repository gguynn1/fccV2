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
4. Check the outbound budget (what else has been sent to this person or thread recently)
5. Apply the topic's behavior profile (tone, format, initiative style)
6. Route to the correct thread
7. Dispatch, hold for batching, or store silently
