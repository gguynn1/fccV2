# Scheduler Service

Runs independently on a timer

Maintains all scheduled events:
morning digests
evening check-ins
reminder timers
follow-up windows
escalation deadlines
relationship nudge cooldowns
bill due date alerts

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
