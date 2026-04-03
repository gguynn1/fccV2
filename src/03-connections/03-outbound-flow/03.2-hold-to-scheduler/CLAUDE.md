# Hold → Scheduler

```
ACTION ROUTER (decision: hold)
        |
        v
 HOLD handler (validates hold_until + queue metadata)
        |
        v
 SCHEDULER / BullMQ delayed / repeatable jobs
        |
        v
 Future queue item(s) at natural touchpoints
```

## Batched priority (`DispatchPriority.Batched`)

- Important but not urgent — digests, evening check-ins, spaced reminders after collision detection, or budget-driven spacing.
- **Hold** persists `hold_until` (and reason metadata) through State so recovery after downtime can still understand what was deferred.

## Combining multiple items

- When several **batched** items target the same participant inside a merge window, composition logic is expected to **collapse** them into a single outbound segment instead of back-to-back spam. Budget + hold handlers cooperate to keep collisions from producing duplicate pings.

## Missed windows

- If the machine was offline past `hold_until`, startup reconciliation (Scheduler + queue stale rules) **re-evaluates relevance** before emitting a replacement item — the system does not blindly fire an outdated digest at the wrong hour.

## Relation to digest jobs

- Morning digest / evening check-in **repeatable jobs** also originate items directly (inbound door #3). **Hold** is the outbound path when the Worker already decided “not now” and handed timing off to the scheduler subsystem.
