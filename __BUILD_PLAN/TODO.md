# TODO

This file is the single source of truth for remaining work.

## TODO-03 — Complete Manual And External Verification

**Status:** in progress

### Infrastructure And Credentials

- [ ] Twilio verification is approved
- [ ] `.env` contains real IMAP credentials and live inbox verification is complete
- [ ] ngrok static domain is configured and confirmed
- [ ] launchd services are loaded and running
- [ ] reboot auto-start behavior is confirmed
- [ ] power and login settings required by the hosting model are confirmed

### Runtime Verification

- [ ] inbound transport webhook flow is verified against the live provider
- [ ] outbound transport status callback flow is verified
- [ ] IMAP reconnect behavior is verified after disconnect, sleep/wake, and provider timeout
- [ ] stale time-sensitive email is stored silently instead of dispatched late
- [ ] local-network calendar subscription renders expected events

## Working Rules

- Keep `__BUILD_PLAN/PROGRESS.json` lightweight and current-state only.
- Keep `__BUILD_PLAN/DEFERRED.md` limited to unresolved technical debt.
- Do not recreate step files or per-step audit history unless explicitly requested.
