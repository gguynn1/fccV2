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
    and asks for approval in the same
    thread where the request was made
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

Confirmations happen in the thread where the request was made. They expire after a configured window. Expired confirmations never auto-execute. The assistant tells the user it expired and asks them to reissue.
