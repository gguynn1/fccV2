# Step 0 Part 1 — Developer Tools & Dependencies

> Source: src/notes.txt

## What to Build

This is the foundation step. It covers installing and configuring all developer tooling and runtime dependencies before any application code is written.

- Install runtime dependencies: fastify, bullmq, better-sqlite3 (or drizzle-orm + better-sqlite3), zod, pino, xstate (v5), imapflow, twilio, @anthropic-ai/sdk
- Install dev dependencies: vitest, @types/better-sqlite3
- Configure Vitest in package.json scripts
- Add dev script using tsx or node --watch for development
- Verify Redis is installed (`brew install redis`) and AOF config is ready
- Verify ngrok is installed (`brew install --cask ngrok`), authenticate with `ngrok config add-authtoken`, and reserve a static subdomain on the ngrok dashboard
- Create `data/` directory for SQLite database with `.gitignore` entry
- Update package.json with all new scripts (eval, eval:run, eval:coverage)
- Verify `tsconfig.json` strict mode, ESM, NodeNext module resolution
- Verify ESLint and Prettier configurations are correct

## Dependencies

None — this is the first step.

## Technologies

- Node.js v22 LTS, TypeScript 6, ESM
- Fastify (HTTP server)
- BullMQ + Redis (queue, scheduling, rate-limiting)
- better-sqlite3 (persistence), optional Drizzle ORM
- Zod (validation)
- pino (structured logging)
- XState v5 (escalation state machines)
- imapflow (IMAP email monitoring)
- twilio (phone-native messaging API)
- Vitest (testing)
- @anthropic-ai/sdk (Claude API)

## Files to Create/Modify

- `package.json` (add dependencies and scripts)
- `data/.gitkeep`
- `.gitignore` (add `data/` directory)
- Verify `tsconfig.json`
- Verify `eslint.config.js`
- Verify `prettier.config.js`

## Setup Gate — Credentials & Infrastructure

Before proceeding to Step 1, the following must be verified:

- [ ] `.env` file created from `.env.example` with real credentials
- [ ] `ANTHROPIC_API_KEY` set and valid (smoke test: `curl` to Claude API returns 200)
- [ ] `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_IDENTITY` set (smoke test: `twilio api` or `curl` to Twilio REST API)
- [ ] `IMAP_HOST`, `IMAP_USER`, `IMAP_PASSWORD` set (validation deferred to Step 29)
- [ ] `REDIS_URL` set, Redis running with AOF persistence: `redis-cli CONFIG GET appendonly` returns `yes`
- [ ] `NGROK_DOMAIN` set, ngrok authenticated, static subdomain reserved and confirmed on ngrok dashboard
- [ ] `DATABASE_PATH` set, `data/` directory exists

### Redis AOF Verification

```bash
redis-cli CONFIG GET appendonly    # must return "yes"
redis-cli CONFIG GET appendfsync   # should return "everysec"
```

If not configured, edit `redis.conf` and restart Redis before continuing. Without AOF, a crash loses the queue, all scheduled jobs, and budget counters.

## Acceptance Criteria

- `npm install` completes without errors
- `npm run typecheck` passes
- `npm run lint` passes
- `npm run build` compiles to `dist/`
- Redis is available, responding to `redis-cli ping`, and running with `appendonly yes`
- ngrok tunnel starts and static subdomain resolves
- All package scripts from the README are functional
- All environment variables from `.env.example` have real values in `.env`
