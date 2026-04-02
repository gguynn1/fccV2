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
with source = "scheduled"
