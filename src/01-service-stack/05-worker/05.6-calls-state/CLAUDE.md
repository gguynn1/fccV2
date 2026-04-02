# Worker Calls State Service

Read from or write to persistent data after decisions are made.

Called by the Worker after all other service calls have resolved. Every other service also reads from or writes to State.

## What the Worker Reads

During the processing sequence, the Worker reads state to inform its decisions:

- **Thread history** — recent messages in the originating thread, active topic context, last activity timestamp. Used during classification to resolve ambiguous topics and during routing to determine response context.
- **Escalation status** — active escalations for the item's topic and entities. Used by the escalation check (step 5) to determine which step we're on and what happens next.
- **Confirmation records** — pending confirmations for the originating entity. Used by the confirmation check (step 6) to determine if an incoming message resolves a pending confirmation.
- **Outbound budget tracker** — messages sent per person and per thread. Used by the budget check (step 4) to decide whether to send, batch, or hold.
- **Per-topic records** — calendar events, chore assignments, bills, grocery list, health profiles, school assignments, travel plans, vendor records, photography leads, relationship nudge history, family status snapshots. Used by the behavior profile step (step 7) to compose contextually accurate messages.
- **Digest history** — what was included in the last digest for each person. Used to avoid repeating information and to build the next digest.

## What the Worker Writes

After the processing sequence completes, the Worker writes back:

- **Queue state** — moves the processed item from pending to recently_dispatched (if dispatched) or removes it (if stored silently).
- **Topic records** — creates or updates the relevant topic record (new chore, updated bill status, new calendar event, etc.).
- **Escalation state** — creates new escalation entries, advances steps, or resolves active escalations.
- **Confirmation state** — creates pending confirmations or resolves existing ones based on incoming responses.
- **Thread history** — appends the assistant's outbound message to the thread's recent_messages.
- **Budget tracker** — increments the outbound counters for the target person and thread.

## State Is the System's Memory

The Worker never holds state in memory between items. Every decision is made by reading current state, and every outcome is persisted back to state before the next item is pulled. If the process crashes between items, nothing is lost.
