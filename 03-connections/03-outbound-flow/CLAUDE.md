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
