# Scheduled Triggers

SCHEDULER ----> THE QUEUE

Scheduler runs independently on a timer

When a trigger fires:
creates a queue item
drops it into THE QUEUE
with source = "scheduled"
