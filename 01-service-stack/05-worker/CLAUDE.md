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
4. Check the outbound budget (what else has been sent to this person or thread recently)
5. Apply the topic's behavior profile (tone, format, initiative style)
6. Route to the correct thread
7. Dispatch, hold for batching, or store silently

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
         One adult ---------> their private thread
         One child ---------> their private thread
         The couple --------> couple thread
         The whole family --> family thread
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
STEP 4 — What priority?
         Immediate ----------> send now, skip batching
         Batched ------------> hold for next digest
                               or quiet window
         Silent -------------> store only, no send
         |
         v
STEP 5 — Collision check
         Nothing else pending --> dispatch
         Other items queued
         for same person -------> batch into one
                                  message or space
                                  them out — never
                                  stack multiple
                                  messages back
                                  to back
         |
         v
STEP 6 — Apply the topic behavior profile
         Tone ---------> direct, warm, factual,
                          professional, gentle
         Format -------> list, snapshot, prompt,
                          confirmation, open question
         Initiative ---> structured reminder,
                          gentle nudge, factual
                          alert, soft suggestion
         |
         v
STEP 7 — Dispatch the message to the thread
         or hold it for later
         or store it silently
```
