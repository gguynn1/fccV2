# Outbound Flow

```
ACTION ROUTER
    |
    |______________|____________
    |              |            |
 DISPATCH       HOLD        STORE
    |              |            |
    v              v            v
TRANSPORT    SCHEDULER     STATE
(send it)    (batch it)   (save it)
```

## Dispatch Priority Mapping

**Immediate → DISPATCH → TRANSPORT** — time-sensitive, send now.

**Batched → HOLD → SCHEDULER** — important but not urgent, collected and delivered at natural touchpoints.

**Silent → STORE → STATE** — tracked internally, surfaced only when asked.
