# Step 29 — Data Ingest Service

> Source: src/02-supporting-services/02-data-ingest-service/notes.txt

## What to Build

- `src/02-supporting-services/02-data-ingest-service/types.ts` — connector types for inboxes, calendar connectors, forwarded content
- `src/02-supporting-services/02-data-ingest-service/index.ts` — DataIngestService implementation
- IMAP email monitoring via imapflow: watch configured inboxes, extract content, pre-classify topic, create queue items
- Calendar input through email parsing (.ics attachments) or conversation — no external calendar API consumed
- Claude API for email extraction and image parsing before queueing normalized items
- Forwarded message parsing and classification
- Queue item production tagged as ingest-originated
- Email-sender-to-entity resolution: the system configuration maps monitored inbox addresses to entities (e.g., participant_1's inbox is monitored for their school emails, appointment confirmations, etc.). Emails are attributed to the entity whose inbox they arrived in, not by parsing the sender address. Emails that arrive in a shared/generic inbox are attributed based on content extraction by Claude, with a fallback to "unattributed" requiring manual classification
- Network outage: IMAP reconnects automatically on restore; emails accumulated during outage processed on reconnection
- Backlog processing with staleness awareness: time-sensitive items past their window stored silently, not dispatched as urgent

## Dependencies

Step 0, Step 2, Step 3 (State Service), Step 4 (Queue for item production), Step 9 (Classifier for pre-classification).

## Technologies

imapflow (IMAP), Claude API for extraction, BullMQ queue production

## Files to Create/Modify

`types.ts` and `index.ts` in `02-data-ingest-service/`

## Acceptance Criteria

IMAP connects and monitors inboxes, emails extracted and queued, .ics parsed, stale backlog handled, auto-reconnect after network outage

## Setup Gate — IMAP

Before considering this step complete, the following must be verified:

- [ ] IMAP credentials from `.env` connect successfully to the configured inbox
- [ ] Fetch one known email, extract its content, and produce a valid queue item
- [ ] Parse a `.ics` attachment and produce a calendar-topic queue item
- [ ] Disconnect and reconnect — verify imapflow auto-reconnects and processes emails that arrived during the gap
- [ ] Send a time-sensitive test email, wait past its relevance window, then process — verify it is stored silently, not dispatched as urgent
- [ ] **IMAP stress test:** verify reconnection behavior against the specific email provider being used — test with ISP drop simulation (disconnect network adapter), machine sleep/wake cycle, and IMAP server timeout. imapflow's auto-reconnect may behave differently across Gmail, Outlook, and self-hosted IMAP servers
