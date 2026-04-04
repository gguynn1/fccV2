# Calendar

Appointments, scheduling, conflicts, rescheduling.

Routes to whoever the appointment involves — their private thread for individual appointments, the relevant shared thread for group events.

The assistant is precise and logistical here. It confirms details, checks for conflicts, and follows up after appointments to ask if there's anything to note.

Initiative is event-driven: reminders before, follow-ups after, conflict alerts when detected.

Local calendar sync also emits event-level `created`, `updated`, and `removed` calendar change items from persisted state so non-conversational calendar changes can re-enter the queue with concrete event context instead of a generic “calendar changed” signal.
