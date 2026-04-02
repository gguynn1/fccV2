# Confirmation Service

Manages approval gates

Called by the Worker when an action requires confirmation

Tracks:
pending confirmations
expiry timers
which thread to confirm in

When a response arrives that matches a pending confirmation:
resolves it as approved or rejected

When a timer expires:
marks it expired
queues a notification that it lapsed
