# Worker Calls Routing Service

Which thread does the output go to?

## Step 2 — Who Does It Concern?

```
One entity --------> their private thread
Multiple entities -> narrowest shared thread
                     that includes all of them
A pet -------------> responsible adult's thread
```

## Step 3 — Response or Proactive?

```
Response ----------> reply in the same
                     thread it came from
Proactive ----------> send to the narrowest
                      thread that fits
                      the audience
```

## Routing Rules

Two rules govern every message:

**Rule 1 — Responses stay in context unless topic policy makes that unsafe.** If someone says something in a thread, the assistant replies in that same thread whenever the topic allows it. If the origin thread violates topic privacy policy, the worker reroutes to the safest allowed thread instead of leaking the topic.

**Rule 2 — Proactive messages route to the narrowest appropriate thread allowed by topic policy.** When the assistant initiates, it sends to the smallest allowed thread that includes only the entities who need the information. A chore reminder for an assigned entity goes to their private thread. A financial alert stays in the adults-only shared thread. A health follow-up stays private.

When both rules apply to the same event — someone says something in a group thread that will later need a proactive follow-up — Rule 1 handles the immediate reply and Rule 2 handles any future outbound.

After routing, the worker still applies a final topic-delivery guard before transport. That last check can reroute to a safe private thread or store instead of dispatching if the selected thread is not allowed for the topic.
