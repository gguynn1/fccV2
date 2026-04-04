# Scheduler Service

Runs independently on a timer

Maintains scheduled events:

Implemented:
morning digests (BullMQ repeatable cron job)
evening check-ins (BullMQ repeatable cron job)
policy-driven proactive queue items from topic configuration (follow-ups, nudges, reminders)
stale/relevance filtering before enqueue
relationship quiet-window suppression before nudge emission

Owned by other services:
escalation deadlines and step timers — escalation service
confirmation expiry timers — confirmation service

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

## Policy-driven items

The scheduler currently produces more than digests:

- held-item release back into the main queue when `hold_until` matures
- calendar follow-up windows
- health post-visit follow-ups
- relationship nudges when `next_nudge_eligible` is reached **and** the relationship quiet window is not marked busy or stressful
