# Worker Calls Confirmation Service

Does this action require approval?
Is there a pending confirmation to resolve?

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

By default, confirmations are exact-thread approvals. For specific flows such as sending-on-behalf requested from a shared thread, the worker can allow approval from the requester's private thread through an explicit `approval_thread_policy`. Expired confirmations never auto-execute. The assistant tells the user it expired and asks them to reissue.
