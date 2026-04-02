# Budget Service

Tracks outbound volume

Called by the Worker before dispatch

Knows:
messages sent per person today
messages sent per thread this hour
pending batched items
batch window timing

Returns:
send now
or batch with these other items
or hold until next digest

## Outbound Budget

The outbound budget limits unprompted messages per person per day. If multiple batched items are pending for the same person within a window, they combine into one message. The system never stacks multiple messages back to back.

## Dispatch Priority

Every outbound message is one of three priority levels:

**Immediate** — time-sensitive, send now. Pickup in 30 minutes, bill due today, calendar conflict detected, response to a direct question.

**Batched** — important but not urgent. Collected and delivered at natural touchpoints: morning digest, evening check-in, or next quiet window.

**Silent** — tracked internally, surfaced only when asked. Completed task logs, vendor history, pet care records, general status entries.
