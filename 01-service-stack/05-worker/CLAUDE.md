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
