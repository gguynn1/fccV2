# Confirmation Service

Manages approval gates

Called by the Worker when an action requires confirmation

Tracks:
pending confirmations
expiry timers
which thread to confirm in

When a response arrives that matches a pending confirmation:
resolves it as approved or rejected
prefers exact-thread matching, with an explicit requester-private fallback only when policy allows it

When a timer expires:
marks it expired
queues a notification that it lapsed

## Confirmation Flow

```
Does this action involve:

  Sending a message on someone's behalf?
  Taking a financial action?
  Changing the system's rules?

  If yes to any:

    The assistant states what it understood
    and asks for approval in the display
    thread chosen for that action
             |
        _____|_____
       |           |
       v           v
    Approved    No response
       |           |
       v           v
    Execute     Expires after
    the         a configured
    action      window
                   |
                   v
                "This expired.
                 Want to try
                 again?"
```

## Confirmation Gates

Three categories always require explicit approval before the assistant acts:

- **Sending on behalf** — the assistant never sends a message, email, or reply as a family member without approval of the exact wording.
- **Financial actions** — logging payments, marking bills paid, adjusting savings goals, recording expenses.
- **System changes** — adding data sources, modifying dispatch rules, changing escalation timing, adding entities.

Confirmations default to exact-thread approval. For specific flows such as sending-on-behalf requested from a shared thread, the worker may set `approval_thread_policy: requester_private_allowed`, which lets the requester approve from their private thread. Expired confirmations never auto-execute. The assistant tells the user it expired and asks them to reissue.

## Implementation

Confirmation records persist through the state service into SQLite. Expiry timers use BullMQ delayed jobs backed by shared Redis.
