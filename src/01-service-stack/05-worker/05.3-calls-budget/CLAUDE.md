# Worker Calls Budget Service

Has this person or thread been messaged too recently?
Should this batch with other pending items?

## Step 4 — What Priority?

```
Immediate ----------> send now, skip batching
Batched ------------> hold for next digest
                      or quiet window
Silent -------------> store only, no send
```

## Collision Check (part of step 4 + action router at step 8)

```
Nothing else pending --> dispatch
Other items queued
for same person -------> batch into one
                         message or space
                         them out — never
                         stack multiple
                         messages back
                         to back
```

## Dispatch Priority

Every outbound message is one of three priority levels:

**Immediate** — time-sensitive, send now. Pickup in 30 minutes, bill due today, calendar conflict detected, response to a direct question.

**Batched** — important but not urgent. Collected and delivered at natural touchpoints: morning digest, evening check-in, or next quiet window. Chore reminders for later today, savings updates, school deadlines approaching, post-appointment follow-ups.

**Silent** — tracked internally, surfaced only when asked. Completed task logs, vendor history, pet care records, general status entries.

## Outbound Budget

The outbound budget limits unprompted messages per person per day. If multiple batched items are pending for the same person within a window, they combine into one message. The system never stacks multiple messages back to back.

## Governor Semantics

The budget step is the system-wide outbound governor. In addition to priority and collision pressure, it now considers:

- quiet hours from runtime config
- thread and participant quiet windows refreshed by human activity
- pause signals such as `not now`, `quiet`, or `stop`
- per-topic quotas and cooldown hints from topic delivery policy
- pending confirmations and active escalations as additional suppression pressure

The goal is not just rate limiting. The goal is to keep the assistant useful without teaching the family to ignore it.
