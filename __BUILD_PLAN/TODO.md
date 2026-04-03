# TODO

This file is the single source of truth for remaining work. Historical `step-*.md` plan files were consolidated and removed.

## Current State

Completed:

- Core runtime and infrastructure
- Queue, scheduler, transport, CalDAV, classifier, and topic profiles
- Supporting services, worker pipeline, and action router
- Admin UI and connections documentation

Remaining work is limited to the items below.

## TODO-02 — Close Active Deferred Issues

**Status:** pending

Resolve the open items tracked in `__BUILD_PLAN/DEFERRED.md`:

- D-01 per-topic runtime state validation
- D-02 admin API config validation hardening
- D-03 meal-to-grocery extraction placeholder
- D-04 unused CalDAV type definitions
- D-05 CalDAV `ctag` derivation
- D-06 confirmation request typing cleanup

Done means the related code is fixed and each item is removed from `DEFERRED.md`.

## TODO-03 — Complete Manual And External Verification

**Status:** pending

### Infrastructure And Credentials

- [ ] Twilio verification is approved
- [ ] `.env` contains real IMAP credentials and live inbox verification is complete
- [ ] ngrok static domain is configured and confirmed
- [ ] launchd services are loaded and running
- [ ] crash restart behavior is confirmed
- [ ] reboot auto-start behavior is confirmed
- [ ] power and login settings required by the hosting model are confirmed
- [ ] SQLite backup job is scheduled and Redis AOF files are included in backup scope

### Runtime Verification

- [ ] inbound transport webhook flow is verified against the live provider
- [ ] outbound transport status callback flow is verified
- [ ] invalid webhook signatures are rejected
- [ ] IMAP reconnect behavior is verified after disconnect, sleep/wake, and provider timeout
- [ ] stale time-sensitive email is stored silently instead of dispatched late
- [ ] CalDAV `PROPFIND`, `REPORT`, and `GET` smoke tests pass
- [ ] local-network calendar subscription renders expected events

### Admin UI Verification

- [ ] `/admin` is served correctly after UI build
- [ ] forwarded-header requests to `/admin` and `/api/admin/*` are rejected
- [ ] all admin pages work against the running backend
- [ ] top navigation active state is correct across routes

## Working Rules

- Keep `__BUILD_PLAN/PROGRESS.json` lightweight and current-state only.
- Keep `__BUILD_PLAN/DEFERRED.md` limited to unresolved technical debt.
- Do not recreate step files or per-step audit history unless explicitly requested.
