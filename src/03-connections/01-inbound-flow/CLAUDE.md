# Inbound Flow

```
External world
    |
    |--- phone-native messages ---> TRANSPORT
    |--- emails -----------> DATA INGEST
    |--- calendar changes -> DATA INGEST
    |--- future sources ---> DATA INGEST
```

## What Enters the System

- Human messages from any thread
- Reactions on assistant messages (for example, positive or negative reactions)
- Images and attachments sent to the assistant
- Forwarded messages or emails
- Emails arriving in monitored inboxes
- Calendar events added or changed via connector
- Scheduled triggers (timers, reminder deadlines, follow-up windows expiring, digest times)
- Future integration events (financial alerts, school systems, care-provider systems, weather alerts, delivery updates)
