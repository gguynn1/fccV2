# Scheduler Service

Runs independently on a timer

Maintains scheduled events:

Implemented:
morning digests (BullMQ repeatable cron job)
evening check-ins (BullMQ repeatable cron job)

Design intent (not yet wired through this service):
reminder timers — currently managed by escalation service timers
follow-up windows — currently managed by escalation service timers
escalation deadlines — currently managed by escalation service timers
confirmation expiry — currently managed by confirmation service timers
relationship nudge cooldowns
financial due date alerts

When a trigger fires:
creates a queue item
drops it into THE QUEUE
tagged as scheduler-originated

## Daily Rhythm

```
MORNING
  Digest delivered to each person
  in their private thread
  What's ahead today
  What's due
  What's unresolved from yesterday

DAYTIME
  Quiet unless:
    Something immediate comes up
    Someone messages the assistant

EVENING
  Brief check-in if anything
  is still open
  Otherwise, nothing

DEFAULT STATE
  The assistant is quiet
  It earns the right to speak
  by being useful when it does
```
