# Step 0 Part 3 — Application Entry Point, Process Management & Deployment

> Source: Derived from hosting-model.mdc, architecture.mdc, and gaps identified during build plan review. No single notes.txt — this step addresses infrastructure requirements documented in cursor rules that had no corresponding build plan step.

## What to Build

### Application Entry Point

- `src/server.ts` — the runtime entry point that wires together all services and starts the application:
  1. Validate all required environment variables (fail fast with clear error messages)
  2. Initialize SQLite database (WAL mode, run migrations if needed)
  3. Connect to Redis and verify AOF is enabled
  4. Start the Fastify server (Twilio webhook routes + CalDAV routes) on `PORT`
  5. Start the BullMQ Worker (pulls from queue, runs 8-step processing sequence)
  6. Start the Scheduler Service (repeatable and delayed jobs)
  7. Start the IMAP listener (Data Ingest email monitoring)
  8. Register graceful shutdown handlers
- Update `package.json`: `"start": "node dist/server.js"` (not `dist/index.js` — that file is barrel exports)

### Graceful Shutdown

- Handle SIGTERM and SIGINT signals for launchd-managed process lifecycle:
  1. Stop accepting new Fastify connections, drain in-flight requests
  2. Pause the BullMQ Worker (finish current job, don't pull new ones)
  3. Close the IMAP connection cleanly
  4. Flush and close the SQLite connection
  5. Disconnect from Redis
  6. Exit with code 0
- Log shutdown sequence via pino so launchd restarts are traceable

### Stale Catch-Up on Startup

- After connecting to Redis and SQLite, before starting the Worker:
  1. Scan pending queue items for staleness — items past their relevance window are logged silently, never dispatched
  2. Reconcile active escalations — timers that expired during downtime advance to the next step, don't fire the missed step late
  3. Scan pending confirmations — any whose `expires_at` has passed are marked expired, user is notified, never auto-executed
  4. Check Redis budget counters — if lost despite AOF, reconstruct from `recently_dispatched` records in SQLite
  5. Check Scheduler repeatable jobs — missed digest windows are adapted or skipped, not sent as-is

### launchd Process Supervision

Create plist files in `~/Library/LaunchAgents/` for auto-start and auto-restart:

- `com.fcc.redis.plist` — Redis with config pointing to AOF-enabled `redis.conf`
- `com.fcc.ngrok.plist` — ngrok with `--domain=<NGROK_DOMAIN>` flag
- `com.fcc.app.plist` — Node.js app with `WorkingDirectory` set to project root, `NODE_ENV=production`

All three with `RunAtLoad: true` and `KeepAlive: true`.

```bash
# Load all services
launchctl load ~/Library/LaunchAgents/com.fcc.redis.plist
launchctl load ~/Library/LaunchAgents/com.fcc.ngrok.plist
launchctl load ~/Library/LaunchAgents/com.fcc.app.plist

# Verify
launchctl list | grep com.fcc
```

### macOS System Preferences

- Energy Saver → "Prevent automatic sleeping when the display is off" — **enabled**
- Energy Saver → "Start up automatically after a power failure" — **enabled**
- Users & Groups → Automatic Login — **enabled** (so launchd services start without manual login after reboot)

### SQLite Backup Job

- Create a scheduled backup using launchd or cron:
  ```bash
  sqlite3 $DATABASE_PATH ".backup '/path/to/backup/fcc-$(date +%Y%m%d).db'"
  ```
- Include Redis AOF files in backup scope
- Time Machine covers the full machine; for off-site, consider `restic` to an encrypted cloud target (B2, S3)

## Dependencies

Step 0 Part 1 and Part 2 must be complete. This step can be built incrementally — the entry point and shutdown handler should exist before any service is implemented (even as stubs), then services are wired in as they're built in subsequent steps.

## Technologies

- Fastify server startup and shutdown lifecycle
- BullMQ Worker and Scheduler lifecycle
- imapflow connection lifecycle
- better-sqlite3 connection lifecycle
- pino for startup/shutdown logging
- launchd for process supervision (macOS-specific)

## Files to Create/Modify

- `src/server.ts` — application entry point
- `src/env.ts` — environment variable validation (imported by server.ts)
- `package.json` — update `start` script to `node dist/server.js`
- `~/Library/LaunchAgents/com.fcc.redis.plist`
- `~/Library/LaunchAgents/com.fcc.ngrok.plist`
- `~/Library/LaunchAgents/com.fcc.app.plist`

## Setup Gate — Process Supervision

Before considering deployment ready, verify:

- [ ] `npm start` launches the application, Fastify binds to PORT, logs show all services initialized
- [ ] Sending SIGTERM causes a clean shutdown logged via pino (no orphaned connections)
- [ ] All three launchd plists are loaded and `launchctl list | grep com.fcc` shows PIDs
- [ ] Killing the Node.js process causes launchd to restart it automatically
- [ ] Rebooting the Mac Mini causes all three services to start without manual login
- [ ] macOS Energy Saver and Automatic Login settings are confirmed

## Acceptance Criteria

- Application starts from a single entry point (`src/server.ts`)
- Missing environment variables produce a clear error listing what's absent
- SIGTERM/SIGINT triggers orderly shutdown: Fastify drains, Worker pauses, IMAP closes, SQLite flushes, Redis disconnects
- Stale catch-up runs before Worker starts processing new items
- launchd restarts crashed processes automatically
- SQLite backup job runs on schedule
- Machine survives power failure and auto-restarts all services
