# Action Router

Three possible outcomes:

```
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

## Dispatch Priority Mapping

**Immediate → DISPATCH** — time-sensitive, send now.

**Batched → HOLD** — important but not urgent, collected and delivered at natural touchpoints.

**Silent → STORE** — tracked internally, surfaced only when asked.

## Outbound vs Silent Storage

```
     _____|_____
    |           |
    v           v
OUTBOUND      SILENT STORAGE
send to       record it but
the right     don't send
thread        anything —
              surface only
              when asked
```

## Final Guard

The Action Router decides `dispatch`, `hold`, or `store`, but the Worker still applies a final topic-delivery guard before transport. A dispatch result can be rerouted to a safer private thread or converted to store if the selected thread violates topic privacy policy.
