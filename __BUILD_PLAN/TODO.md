# TODO

This file is the single source of truth for remaining work.

## TODO-03 — Complete Manual And External Verification

**Status:** in progress

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
