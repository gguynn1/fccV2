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
