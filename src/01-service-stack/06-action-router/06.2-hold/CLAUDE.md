# Hold

Batch for next digest or quiet window

## Batched Priority

Important but not urgent. Collected and delivered at natural touchpoints: morning digest, evening check-in, or next quiet window. Chore reminders for later today, savings updates, school deadlines approaching, post-appointment follow-ups.

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
    Someone texts the assistant

EVENING
  Brief check-in if anything
  is still open
  Otherwise, nothing

DEFAULT STATE
  The assistant is quiet
  It earns the right to speak
  by being useful when it does
```

## Implementation

Held items are persisted into queue/state with a `hold_until` timestamp. Scheduler touchpoints later re-read those held rows, re-check relevance, and enqueue fresh outbound work when the hold window matures.

This is not a direct "one delayed BullMQ job per held item" path. The important truth is:

- Worker decides `hold`
- state persists `hold_until`
- scheduler windows release relevant held rows back into the main queue
- later composition may combine or summarize material, but the hold itself is state-driven first
