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
