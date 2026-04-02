# Data Ingest Service

Watches external sources independently:
monitored inboxes
calendar connectors
future external feeds

When something relevant arrives:
extracts content
pre-classifies topic
creates a queue item
drops it into THE QUEUE
tagged as ingest-originated

## Data Ingest Layer

Outside information enters the same queue as human messages. No separate path.

```
MONITORED INBOX
  School emails, appointment confirmations,
  bill notifications, booking confirmations
  Extracted, classified, queued
         |
         v
    Same queue, same worker,
    same dispatch rules

CALENDAR CONNECTOR
  Events added or changed externally
  Detected, queued as a calendar topic item
         |
         v
    Same queue, same worker,
    same dispatch rules

FORWARDED MESSAGES
  A family member forwards a message or
  image to the assistant's messaging identity
  Parsed, classified, queued
         |
         v
    Same queue, same worker,
    same dispatch rules

FUTURE INTEGRATIONS
  Financial alerts
  School systems
  Care-provider systems
  Weather alerts
  Delivery updates
  Each one just produces queue items
         |
         v
    Same queue, same worker,
    same dispatch rules
```

Adding a new data source never requires rethinking the dispatch logic. It just feeds the queue.
