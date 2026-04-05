# TODO

This file is the single source of truth for remaining work.

## TODO-01 — Complete Manual And External Verification

**Status:** LATER

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

### Ideas

- [ ] Ror "immediately deliver" items in queue, while processing, would be nice to see the agent "typing" back animation
