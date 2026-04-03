# Data Ingest Service

Watches external sources independently:
monitored inboxes (IMAP polling)
forwarded messages (parsed by transport, classified here)

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

FORWARDED MESSAGES
  A family member forwards a message or
  image to the assistant's messaging identity
  Parsed, classified, queued
         |
         v
    Same queue, same worker,
    same dispatch rules

FUTURE DATA SOURCES
  Any new source feeds the queue via
  email parsing, conversational input,
  or a local adapter — never a paid
  third-party API without explicit discussion
         |
         v
    Same queue, same worker,
    same dispatch rules
```

Adding a new data source never requires rethinking the dispatch logic. It just feeds the queue.
