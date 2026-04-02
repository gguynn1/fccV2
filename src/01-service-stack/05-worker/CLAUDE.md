# Worker

Pulls one item at a time
Orchestrates the decision sequence
Calls out to other services for each step:

```
|--- calls TOPIC PROFILE SERVICE
|      what tone, format,
|      initiative style?
|
|--- calls ROUTING SERVICE
|      which thread does the
|      output go to?
|
|--- calls BUDGET SERVICE
|      has this person or thread
|      been messaged too recently?
|      should this batch with
|      other pending items?
|
|--- calls ESCALATION SERVICE
|      is this a follow-up?
|      what step are we on?
|      should we escalate to
|      a broader thread?
|
|--- calls CONFIRMATION SERVICE
|      does this action require
|      approval? is there a
|      pending confirmation
|      to resolve?
```

Once all decisions are made, passes to Action Router.

## Fixed Processing Sequence

The worker pulls one item at a time and runs it through a fixed sequence:

1. Classify the topic
2. Identify the entities involved
3. Determine the action type (response, proactive outbound, or silent storage)
4. Check the outbound budget (priority, collision avoidance, batching)
5. Check escalation (is this a follow-up? what step? should we escalate?)
6. Check confirmation (does this action require approval?)
7. Apply the topic's behavior profile (tone, format, initiative style)
8. Route and dispatch (target thread, then dispatch, hold, or store)

## Decision Flow

Each item gets walked through this sequence before anything is sent.

```
An item arrives in the queue
         |
         v
STEP 1 — What topic is this?
         Calendar
         Chores
         Finances
         Grocery
         Health
         Pets
         School
         Travel
         Vendors
         Photography
         Relationship
         Family Status
         |
         v
STEP 2 — Who does it concern?
         One entity --------> their private thread
         Multiple entities -> narrowest shared thread
                              that includes all of them
         A pet -------------> responsible adult's thread
         |
         v
STEP 3 — Is this a response or proactive?
         Response ----------> reply in the same
                              thread it came from
         Proactive ----------> send to the narrowest
                               thread that fits
                               the audience
         |
         v
STEP 4 — Check outbound budget
         What priority?
         Immediate ----------> send now, skip batching
         Batched ------------> hold for next digest
                               or quiet window
         Silent -------------> store only, no send

         Collision check
         Nothing else pending --> proceed
         Other items queued
         for same person -------> batch into one
                                  message or space
                                  them out
         |
         v
STEP 5 — Check escalation
         Is this a follow-up?
         What step are we on?
         Should we escalate
         to a broader thread?
         |
         v
STEP 6 — Check confirmation
         Does this action require
         approval before executing?
         Is there a pending
         confirmation to resolve?
         |
         v
STEP 7 — Apply the topic behavior profile
         Tone ---------> direct, warm, factual,
                          professional, gentle
         Format -------> list, snapshot, prompt,
                          confirmation, open question
         Initiative ---> structured reminder,
                          gentle nudge, factual
                          alert, soft suggestion
         |
         v
STEP 8 — Route and dispatch
         Determine the target thread
         then dispatch immediately,
         hold for later,
         or store silently
```
