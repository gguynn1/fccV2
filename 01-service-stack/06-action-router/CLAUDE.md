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
