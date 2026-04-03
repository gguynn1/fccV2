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

## Escalation Paths

Different topics escalate differently. Some push hard. Some don't push at all.

```
HIGH ACCOUNTABILITY — chores, finances

  First:   message to the responsible person
           in their private thread
  Then:    follow-up reminder after a
           configured window
  Then:    escalate to a broader thread
           so others can see it
  Finally: flagged as unresolved in the
           next digest

MEDIUM ACCOUNTABILITY — school, health, calendar, travel

  First:   message to the responsible person
  Then:    one follow-up reminder
  Finally: flagged in digest
           no thread escalation unless
           a hard deadline is imminent

LOW ACCOUNTABILITY — relationship, pets, family status, maintenance

  First:   send once
  Then:    if ignored, quietly disappear
           maybe try again in a few days
           with something different
           never pressure, never escalate
           never follow up

NO ESCALATION — grocery, vendors, business, meals

  Send once or store silently
  No follow-up
```

## Silence Handling

Silence feeds escalation for high-accountability topics. Means "not now" for low-accountability topics. Never treated as approval.
