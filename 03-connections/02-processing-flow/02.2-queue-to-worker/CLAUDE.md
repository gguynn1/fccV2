# Queue to Worker

```
THE QUEUE
    |
    v
 WORKER
```

The Queue is the single intake point
Accepts items from: Transport/Identity/Classifier pipeline, Data Ingest, Scheduler
Each item tagged with: source, entity, thread, topic, intent, timestamp

Worker pulls one item at a time
