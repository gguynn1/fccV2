# Step 11 — Calendar Topic Profile

> Source: src/02-supporting-services/04-topic-profile-service/04.01-calendar/notes.txt

## What to Build

- `src/02-supporting-services/04-topic-profile-service/04.01-calendar/types.ts` — Calendar-specific types: appointments, reschedules, conflict checks, follow-ups, date/time normalization
- `src/02-supporting-services/04-topic-profile-service/04.01-calendar/profile.ts` — Calendar behavior profile: precise and logistical tone, structured confirmation format, event-driven initiative, medium escalation, cross-topic to CalDAV endpoint
- Conflict detection for overlapping appointments
- Reminder and post-appointment follow-up scheduling via BullMQ
- Inbound calendar data from email parsing (.ics attachments) or conversation — no external calendar API

## Dependencies

Step 0, Step 3 (State Service), Step 10 (Topic Profile Service).

> **Note on Scheduler (Step 5):** This profile declares behavior like "event-driven reminders" and "post-appointment follow-ups" — it does not directly create BullMQ jobs. The Scheduler Service (Step 5) reads these profile parameters at runtime and creates the actual scheduled jobs. The profile defines _what_ should happen; the Scheduler implements _when_. No build-order dependency on Step 5, but the two must be integration-tested together.

## Technologies

SQLite persistence via State Service, BullMQ scheduling for reminders, iCalendar parsing

## Files to Create/Modify

- `types.ts` and `profile.ts` in `04.01-calendar/`

### Eval Scenario Specifications

Per the eval-first principle, define the following scenario specifications as part of this step (scenarios run once the eval framework exists in Step 54):

- **Classification:** "dentist appointment Tuesday 3pm" → calendar; "when is the vet?" → calendar (not pets — appointment scheduling is calendar's domain)
- **Routing:** individual appointment → private thread; family event → broadest shared thread
- **Composition:** precise, logistical tone; structured confirmation format
- **Escalation:** MEDIUM — one follow-up reminder, flagged in digest, no thread escalation unless deadline imminent
- **Cross-topic:** appointment creates CalDAV event; health appointment → health topic cross-link
- **Negative:** reminder that expired during downtime is logged, not dispatched late

## Acceptance Criteria

Calendar profile registers in service, conflict detection works, reminders schedule correctly, stale reminders logged not dispatched after downtime

---
