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

1. **Classifier** — what topic is this?
2. **Identity** — who does it concern?
3. **Budget** — within outbound limits? collision avoidance, batching decisions
4. **Escalation** — is this a follow-up? what step are we on? should we escalate to a broader thread?
5. **Confirmation** — does this action require approval? is there a pending confirmation to resolve?
6. **Topic Profile** — what tone, format, initiative style?
7. **Routing** — which thread does the output go to?
8. **State** — read from or write to persistent data throughout and after decisions are made
