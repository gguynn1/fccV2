# Family Command Center

A locally-hosted Family Command Center that runs on a Mac Mini. It communicates via phone-native messaging (Twilio SMS/MMS), uses Twilio Conversations as the canonical substrate for real shared threads, processes inbound data from email and conversation, and serves a read-only CalDAV calendar endpoint that standard calendar apps subscribe to.

## Architecture

The system has two paid external dependencies and everything else runs locally:

| External         | Purpose                                                  |
| ---------------- | -------------------------------------------------------- |
| Twilio           | SMS/MMS messaging across five threads                    |
| Anthropic Claude | Classification, message composition, image/email parsing |

| Local                | Purpose                                                         |
| -------------------- | --------------------------------------------------------------- |
| Node.js + TypeScript | Application runtime                                             |
| Redis                | Queue (BullMQ), scheduling, rate-limiting counters              |
| SQLite               | All persistent state                                            |
| ngrok                | Tunnel from public URL to localhost:3000 (Twilio webhooks only) |

```
Internet
  │
  ├── Twilio webhook POST ──→ ngrok ──→ localhost:3000/webhook/twilio
  │
Local network only (never exposed through ngrok)
  ├── Calendar app GET ────────────────→ localhost:3001/caldav/*
  └── Browser ─────────────────────────→ localhost:3000/admin
                                         (system configuration dashboard)
Local machine (outbound)
  ├──→ Twilio REST API (send messages)
  ├──→ Anthropic Claude API (LLM)
  └──→ IMAP server (email polling)
```

## Prerequisites

### Host Environment

| Requirement | Value                           |
| ----------- | ------------------------------- |
| Machine     | Mac Mini (Apple Silicon, arm64) |
| OS          | macOS 26.3+ (Tahoe)             |
| Shell       | zsh                             |

### CLI Toolchain

Install via [Homebrew](https://brew.sh):

```bash
# Core — required for development
brew install node          # Node.js LTS (v22+)

# Infrastructure — required for production
brew install redis         # Queue, scheduling, rate-limiting counters
brew install --cask ngrok  # Tunnel from public URL to localhost:3000 (Twilio webhooks only)
```

Verify installed versions:

```bash
node --version       # v22.13.0+ (LTS required)
npm --version        # 10.9.2+
npx tsc --version    # 6.0.2+ (project-local, no global install)
git --version        # 2.50.1+
redis-server --version  # required for production
ngrok version           # required for production
```

Additional system tools (already present on macOS):

| Tool     | Purpose                                                |
| -------- | ------------------------------------------------------ |
| curl     | HTTP requests, API testing, webhook inspection         |
| Python 3 | Auxiliary scripting only — not the application runtime |
| Homebrew | Package management for all system-level dependencies   |

### Tool Usage Priorities

1. **Node/npm/npx** — all project commands. TypeScript, linting, formatting, testing run via `npx` or `npm run`. No global npm installs.
2. **Homebrew** — system packages (Redis, ngrok). Never compile from source.
3. **curl** — HTTP/API testing. Prefer over installing client tools.
4. **Python** — auxiliary scripting if Node isn't practical for a specific task. Never for core logic.
5. **git** — version control. All changes tracked.

### Package Scripts

All project tasks run through `npm run`. Never invoke tooling directly when a script exists.

```bash
# Application
npm start              # Run the compiled application
npm run dev            # Run in development with file watching
npm run dev:all        # Start Redis + backend + admin UI dev server in one terminal

# Build and verify
npm run build          # Compile backend TypeScript
npm run typecheck      # Type-check backend and admin UI
npm run lint           # Lint backend + admin UI and run Prettier check
npm run lint:fix       # Auto-fix backend + admin UI lint issues, then format
npm run format         # Format all files with Prettier
npm run format:check   # Check formatting without writing
npm test               # Run tests (Vitest)

# Admin UI
npm run ui:dev         # Vite dev server (port 5173, proxies API to :3000)
npm run ui:build       # Build production bundle to ui/dist/
npm run ui:preview     # Preview production build locally

# Infrastructure
npm run ngrok:auth     # Configure ngrok auth token from .env
npm run backup:local   # Snapshot SQLite + Redis AOF into data/backups/
```

### Practical Setup Notes

- Keep only one `npm run dev`, one `npm run ui:dev`, and one `ngrok` session running at a time. Duplicate backend watchers will fight for port `3000`, and duplicate ngrok sessions on the same static URL will fail with `ERR_NGROK_334`.
- The app requires `ANTHROPIC_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_IDENTITY`, `REDIS_URL`, and `DATABASE_PATH` to start. If Twilio or IMAP are not ready yet, placeholder Twilio values are enough for local admin, CalDAV, build, and eval work.
- IMAP is optional for local development. If IMAP credentials are missing, startup logs a deferred-monitoring message and continues.
- Build the UI before testing `/admin` from the Fastify server: `npm run ui:build`. The dev server at `npm run ui:dev` is only for local frontend development.
- The app rejects forwarded-header requests to `/admin` and `/api/admin/*` by design. If you test with `curl`, expect `403` when sending `X-Forwarded-For` or `X-Forwarded-Host`.

Typical first-boot workflow:

```bash
npm run typecheck      # backend + admin UI types clean?
npm run lint           # backend + admin UI lint clean?
npm run build          # compile backend to dist/
npm run ui:build       # build admin UI to ui/dist/
npm run bootstrap      # first boot — create minimal persisted config/state
npm start              # serve backend + /admin
```

Subsequent boots use `npm start` — the database is already initialized.

`npm run bootstrap` initializes SQLite only. If you want a truly fresh local reset, clear the app's BullMQ queues in Redis as well; wiping `data/fcc.db` alone does not remove pending scheduler, timer, or queue jobs preserved by Redis AOF.

## Development Setup

### 1. Clone and install

```bash
git clone https://github.com/gguynn1/fccV2.git && cd fccV2
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials (see `.env.example` for required variables).

### 3. Start Redis

```bash
redis-server
```

### 4. Start ngrok (development)

```bash
npm run ngrok:auth
ngrok http 3000 --url=your-subdomain.ngrok-free.dev
```

Notes:

- Newer ngrok versions prefer `--url` instead of `--domain`.
- If the static endpoint is already online elsewhere, ngrok exits with `ERR_NGROK_334`. Stop the other session first.
- If ngrok says authentication is required, re-run `npm run ngrok:auth` and verify the authtoken was written to `~/Library/Application Support/ngrok/ngrok.yml`.
- Configure the public URL as your Twilio webhook only after the local backend is healthy on `http://127.0.0.1:3000/health`.

### 5. Verify, build, and run

```bash
npm run typecheck     # verify backend + admin UI types compile clean
npm run lint          # verify backend + admin UI lint + formatting
npm run build         # compile backend to dist/
npm run ui:build      # build admin UI bundle to ui/dist/
npm run bootstrap     # first boot — create minimal persisted config/state
npm start             # start server
```

For subsequent runs after the database is initialized:

```bash
npm run dev:all       # start Redis + backend + admin UI in one terminal (recommended)
npm start             # start server with existing database
npm run dev           # start with file watching (development)
npm run ui:dev        # admin UI dev server on :5173 with API proxy to :3000
```

## Production Deployment (Mac Mini)

### macOS System Settings

1. **Prevent sleep**: System Settings → Energy Saver → "Prevent automatic sleeping when the display is off"
2. **Auto-restart after power failure**: System Settings → Energy Saver → "Start up automatically after a power failure"
3. **Auto-login**: System Settings → Users & Groups → Automatic Login (so services start without manual login after reboot)

### Redis Configuration

Edit the Redis config to enable persistence:

```bash
# Find the config file
redis-cli CONFIG GET dir
```

Add to `redis.conf` (or create one):

```
appendonly yes
appendfsync everysec
```

Start Redis with the config:

```bash
redis-server /usr/local/etc/redis.conf
```

### ngrok Static Domain

A paid ngrok plan provides a stable subdomain that survives restarts:

```bash
npm run ngrok:auth
ngrok http 3000 --url=your-subdomain.ngrok-free.dev
```

Set your Twilio webhook URL to `https://your-subdomain.ngrok-free.dev/webhook/twilio` once. It won't change.

### launchd Service Files

Create plist files in `~/Library/LaunchAgents/` so all three processes auto-start on login and restart on crash.

#### Redis (`~/Library/LaunchAgents/com.fcc.redis.plist`)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.fcc.redis</string>
  <key>ProgramArguments</key>
  <array>
    <string>/opt/homebrew/bin/redis-server</string>
    <string>/opt/homebrew/etc/redis.conf</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/fcc-redis.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/fcc-redis.err</string>
</dict>
</plist>
```

#### ngrok (`~/Library/LaunchAgents/com.fcc.ngrok.plist`)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.fcc.ngrok</string>
  <key>ProgramArguments</key>
  <array>
    <string>/opt/homebrew/bin/ngrok</string>
    <string>http</string>
    <string>3000</string>
    <string>--url=your-subdomain.ngrok-free.dev</string>
    <string>--config=/Users/YOU/Library/Application Support/ngrok/ngrok.yml</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key>
    <string>/Users/YOU</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/fcc-ngrok.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/fcc-ngrok.err</string>
</dict>
</plist>
```

#### App (`~/Library/LaunchAgents/com.fcc.app.plist`)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.fcc.app</string>
  <key>ProgramArguments</key>
  <array>
    <string>/path/from-which-node</string>
    <string>/Users/YOU/Desktop/FCCv2/dist/server.js</string>
  </array>
  <key>WorkingDirectory</key>
  <string>/Users/YOU/Desktop/FCCv2</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>EnvironmentVariables</key>
  <dict>
    <key>NODE_ENV</key>
    <string>production</string>
  </dict>
  <key>StandardOutPath</key>
  <string>/tmp/fcc-app.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/fcc-app.err</string>
</dict>
</plist>
```

Notes:

- Do not assume the Node binary is `/opt/homebrew/bin/node`. Use `which node` and put that exact path in the plist. On this machine it resolved to `/usr/local/bin/node`.
- Use an absolute path to `dist/server.js`, not a relative path.
- Keep `WorkingDirectory` pointed at the repo root so `dotenv` can load `.env` at startup.

#### Load all services

```bash
launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/com.fcc.redis.plist
launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/com.fcc.ngrok.plist
launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/com.fcc.app.plist
```

#### Check status

```bash
launchctl list | rg "com.fcc|redis"
```

#### Restart a service

```bash
launchctl kickstart -k "gui/$(id -u)/com.fcc.app"
```

#### Unload (stop) a service

```bash
launchctl bootout "gui/$(id -u)/com.fcc.app"
```

### Backup

SQLite and Redis data should be backed up regularly:

```bash
# Project backup helper
npm run backup:local
```

The helper writes a SQLite snapshot and a copy of Redis AOF data into `data/backups/`.

- SQLite snapshot: `data/backups/fcc-YYYYMMDD-HHMMSS.db`
- Redis AOF copy: `data/backups/redis-aof-YYYYMMDD-HHMMSS/`

If your Redis install stores AOF files somewhere other than `/opt/homebrew/var/db/redis`, update `scripts/sqlite-backup.sh` to match your local layout.

Time Machine covers the full machine. For off-site backup, consider `restic` to an encrypted cloud target (B2, S3).

### Helpful Verification Commands

```bash
# Backend health
curl http://127.0.0.1:3000/health

# Admin UI served from Fastify after ui build
curl -I http://127.0.0.1:3000/admin

# Admin local-only guardrails
curl -i -H "X-Forwarded-For: 1.2.3.4" http://127.0.0.1:3000/admin
curl -i -H "X-Forwarded-Host: example.ngrok.app" http://127.0.0.1:3000/api/admin/config

# CalDAV smoke checks
curl -X PROPFIND http://127.0.0.1:3001/caldav
curl -X REPORT http://127.0.0.1:3001/caldav
curl http://127.0.0.1:3001/caldav/events/<event-id>.ics
```

## Environment Variables

See `.env.example` for the full list. Key variables:

| Variable                                    | Purpose                                              |
| ------------------------------------------- | ---------------------------------------------------- |
| `TWILIO_ACCOUNT_SID`                        | Twilio account identifier                            |
| `TWILIO_AUTH_TOKEN`                         | Twilio API authentication                            |
| `TWILIO_MESSAGING_IDENTITY`                 | The shared messaging identity for all threads        |
| `ANTHROPIC_API_KEY`                         | Claude API key                                       |
| `IMAP_HOST` / `IMAP_USER` / `IMAP_PASSWORD` | Email inbox monitoring                               |
| `NGROK_DOMAIN`                              | Static ngrok subdomain                               |
| `NGROK_AUTHTOKEN`                           | ngrok auth token used by `npm run ngrok:auth`        |
| `DATABASE_PATH`                             | SQLite database file location                        |
| `REDIS_URL`                                 | Redis connection (default: `redis://localhost:6379`) |
| `PORT`                                      | Fastify server port (default: `3000`)                |
| `CALDAV_PORT`                               | CalDAV server port, local only (default: `3001`)     |

## Project Structure

```
src/
├── 01-service-stack/       Core pipeline (Transport → Identity → Queue → Worker → Action Router)
├── 02-supporting-services/ Services called by the Worker or feeding the Queue
├── 03-connections/         Documentation only — how services interact
├── admin/                  Admin API route handlers (served at /api/admin)
├── config/                 Runtime system configuration loader
├── lib/                    Shared utilities (Redis helpers, etc.)
├── server.ts               Fastify server entry point — wires all services, starts listeners
├── bootstrap.ts            Database initialization and first-run persistence bootstrap
├── env.ts                  Environment variable loading and validation
├── types.ts                Shared vocabulary enums (TopicKey, EscalationLevel, etc.)
└── index.ts                Barrel exports + SystemConfig interface

ui/                         Admin UI — React SPA served by Fastify at /admin
├── src/                    Components, routes, hooks
├── vite.config.ts          Vite build config (base: /admin/, proxies /api to Fastify in dev)
└── package.json            Separate dependency tree (pins own TypeScript version)
```

Each numbered folder under `src/` is a bounded service with its own `CLAUDE.md` (behavior docs) and `types.ts` (owned types).

The `ui/` directory is a standalone React project. In production, Fastify serves the built bundle as static files at `/admin`. During development, the Vite dev server runs on port 5173 and proxies API calls to Fastify on port 3000.

## Scripts

| Script               | Purpose                                        |
| -------------------- | ---------------------------------------------- |
| `npm run build`      | Compile backend TypeScript to `dist/`          |
| `npm run typecheck`  | Type check backend and admin UI                |
| `npm run lint`       | Lint backend and admin UI, then run Prettier   |
| `npm run lint:fix`   | Auto-fix backend and admin UI lint issues      |
| `npm run dev:all`    | Start Redis + backend + admin UI in one shot   |
| `npm run format`     | Format with Prettier                           |
| `npm test`           | Run tests (Vitest)                             |
| `npm run ui:dev`     | Start admin UI dev server (Vite, port 5173)    |
| `npm run ui:build`   | Build admin UI production bundle to `ui/dist/` |
| `npm run ui:preview` | Preview admin UI production build              |
| `npm run ngrok:auth` | Configure ngrok auth token from `.env`         |
