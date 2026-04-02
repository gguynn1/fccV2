# The Service Stack

```
TRANSPORT LAYER
         |
         |  inbound messages flow down
         |  outbound messages flow up
         |
         v
IDENTITY SERVICE
         |
         |  "garrett said this
         |   in the couple thread"
         |
         v
CLASSIFIER SERVICE
         |
         |  "this is a calendar request
         |   about a vet appointment
         |   involving tucker"
         |
         v
THE QUEUE
         |
         |  items wait here until
         |  the worker pulls them
         |
         v
WORKER
         |
         |--- calls TOPIC PROFILE SERVICE
         |--- calls ROUTING SERVICE
         |--- calls BUDGET SERVICE
         |--- calls ESCALATION SERVICE
         |--- calls CONFIRMATION SERVICE
         |
         |  once all decisions are made
         |
         v
ACTION ROUTER
         |
    _____|______________
   |          |         |
   v          v         v
DISPATCH   HOLD      STORE
send now   batch     record in
via the    for next  state but
Transport  digest    send nothing
Layer      or quiet  — surface
(back up   window    only when
to top)              asked
```
