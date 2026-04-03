# CalDAV Endpoint

Serves calendar data to external calendar apps over the CalDAV protocol.

Runs on a dedicated Fastify instance on a separate port (default 3001), accessible only on the local network. Not tunneled through ngrok — unauthenticated calendar data stays off the public internet. Calendar apps on the home network subscribe to a URL and poll for changes — the system is the authoritative calendar source.

## What It Serves

The endpoint presents all calendar events from the State service as VCALENDAR/VEVENT resources. Single-day events, multi-day ranges, and all-day events are represented. Each event carries a UID derived from the internal event ID so updates and deletions propagate correctly.

Events from any topic appear here — a dentist appointment (health), a school deadline (school), a family dinner (calendar), a vet visit (pets), a trip (travel). The CalDAV view is topic-agnostic: it serves everything that has a date.

## What It Does Not Do

- Does not consume external calendar APIs. The system is the calendar source, not a calendar subscriber.
- Does not accept writes from calendar apps. Events enter the system through email parsing, conversational input, or scheduled triggers — never through CalDAV PUT or POST.
- Does not sync bidirectionally. This is a read-only endpoint.

## Protocol Surface

Minimum CalDAV compliance for read-only calendar subscriptions:

- **PROPFIND** on the calendar collection — returns calendar metadata and the list of event resources.
- **REPORT** with `calendar-query` or `calendar-multiget` — returns VCALENDAR data for requested events.
- **GET** on individual event resources — returns a single VCALENDAR/VEVENT.
- **OPTIONS** — advertises supported methods and DAV compliance classes.

No authentication layer exists yet. Access control is enforced by keeping the endpoint on the local network only — it is never exposed through the ngrok tunnel. If off-network access is needed in the future, an authentication layer (e.g., HTTP Basic over TLS, or a bearer token) must be added before moving CalDAV behind the tunnel.

## Data Flow

```
State Service (calendar events across all topics)
         |
         v
CalDAV Endpoint (formats as VCALENDAR/VEVENT)
         |
         v
Dedicated Fastify instance on localhost:3001/caldav/*
         |
         v  (local network only — no ngrok tunnel)
Calendar app (subscribes, polls periodically)
```
