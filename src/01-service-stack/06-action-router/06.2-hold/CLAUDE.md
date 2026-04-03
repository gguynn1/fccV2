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

Held items are stored as BullMQ delayed jobs in shared Redis. When multiple held items are ready for the same participant at the same touchpoint, Anthropic Claude API merges them into a single natural-language digest message rather than dispatching back-to-back segments.
