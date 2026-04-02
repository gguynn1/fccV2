# Escalation Service

Tracks escalation state per item

Called by the Worker and by the Scheduler

Knows:
which step we're on
when the next step fires
what the escalation path is
for this topic's accountability level

Returns:
current step action
next step timing
or "no escalation for this topic"
