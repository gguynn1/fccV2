# Worker Service Integration

```
WORKER
    |
    calls:
    Topic Profile ---+
    Routing ---------+
    Budget ----------+
    Escalation ------+
    Confirmation ----+
    State -----------+
```

Worker orchestrates the decision sequence
Calls out to other services for each step

## Service Call Sequence

1. **Topic Profile** — what tone, format, initiative style?
2. **Routing** — which thread does the output go to?
3. **Budget** — has this person or thread been messaged too recently? should this batch with other pending items?
4. **Escalation** — is this a follow-up? what step are we on? should we escalate to a broader thread?
5. **Confirmation** — does this action require approval? is there a pending confirmation to resolve?
6. **State** — read from or write to persistent data after decisions are made
