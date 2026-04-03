# Step 8 — CalDAV Endpoint

> Source: src/01-service-stack/01-transport-layer/01.1-caldav/notes.txt

## What to Build

Build the read-only CalDAV endpoint that serves calendar data to external calendar apps.

- `src/01-service-stack/01-transport-layer/01.1-caldav/types.ts` — CalDAV resource types, VCALENDAR/VEVENT structures
- `src/01-service-stack/01-transport-layer/01.1-caldav/index.ts` — CalDAV endpoint implementation
- Fastify routes on `/caldav/*` path prefix
- PROPFIND on calendar collection — returns metadata and event list
- REPORT with calendar-query or calendar-multiget — returns VCALENDAR data
- GET on individual event resources — returns single VEVENT
- OPTIONS — advertises supported methods and DAV compliance
- Read calendar events from the State Service and format as iCalendar
- UID derived from internal event ID for correct update/delete propagation

## Dependencies

Step 0, Step 3 (State Service for calendar event data), Step 7 (shares Fastify server).

## Technologies

- Fastify routes on localhost:3000/caldav/*
- iCalendar formatting (ical.js or hand-rolled)
- ngrok tunnel for off-network access

## Files to Create/Modify

- `src/01-service-stack/01-transport-layer/01.1-caldav/types.ts`
- `src/01-service-stack/01-transport-layer/01.1-caldav/index.ts`

## Acceptance Criteria

- PROPFIND returns calendar metadata
- GET returns valid VCALENDAR/VEVENT data
- Events from all topics (health, school, calendar, pets, travel, business) appear
- Read-only: no writes accepted from calendar apps
- UIDs are stable across polls
- Standard calendar apps can subscribe and display events
- **Smoke test:** `curl` PROPFIND, REPORT, and GET against the running endpoint and validate response structure; or subscribe from a real calendar app and confirm events render
- `npm run typecheck` passes
