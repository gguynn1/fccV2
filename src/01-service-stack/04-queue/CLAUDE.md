# The Queue

Single intake point
Accepts items from every source

Each item tagged with: source, entity, thread, topic, intent, timestamp

Also receives items from:
Scheduler Service
Data Ingest Service

Items wait here until the worker pulls them

## What Feeds the Queue

All of these produce the same kind of queue item. The system doesn't care where it came from. Same funnel, same rules.

```
Human text message ----------->|
                               |
Reaction on a message -------->|
                               |
Forwarded text or email ------>|
                               |
Image or attachment ---------->|  THE QUEUE
                               |
Email arriving in a ---------->|
monitored inbox                |
                               |
Calendar event added or ------>|
changed                        |
                               |
Scheduled trigger firing ----->|
(cron, timer, reminder due)    |
                               |
Future integrations ---------->|
(bank, school, vet, weather)   |
```

Everything flows through a single queue. There is no separate path for human input versus system-generated events. One funnel, one worker, one set of rules.

Every queue item carries: source, raw content, who it involves, which thread it originated from (if applicable), and a timestamp.
