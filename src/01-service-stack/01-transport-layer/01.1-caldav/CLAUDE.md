# CalDAV Endpoint

Serves calendar data to external calendar apps over the CalDAV protocol.

Runs on the same Fastify server as the Twilio webhook (localhost:3000), exposed to the internet via the ngrok tunnel. Calendar apps subscribe to a URL and poll for changes — the system is the authoritative calendar source.

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

No authentication layer is required for the initial deployment — the ngrok URL is the access control. Authentication can be added later if the endpoint needs to distinguish between calendar subscribers.

## Data Flow

```
State Service (calendar events across all topics)
         |
         v
CalDAV Endpoint (formats as VCALENDAR/VEVENT)
         |
         v
Fastify route on localhost:3000/caldav/*
         |
         v
ngrok tunnel
         |
         v
Calendar app (subscribes, polls periodically)
```
