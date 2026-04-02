# How They All Connect

```
External world
    |
    |--- phone messages ---> TRANSPORT
    |--- emails -----------> DATA INGEST
    |--- calendar changes -> DATA INGEST
    |--- future sources ---> DATA INGEST
    |
    v
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
                                      |
                                      v
                                ACTION ROUTER
                                      |
                          ____________|____________
                         |            |            |
                      DISPATCH      HOLD        STORE
                         |            |            |
                         v            v            v
                     TRANSPORT    SCHEDULER     STATE
                     (send it)   (batch it)   (save it)
```

Every source of information flows through the same queue, same worker, same dispatch logic.

Adding a new data source never requires rethinking the dispatch logic. It just feeds the queue.
