# Family Command Center

A locally-hosted Family Command Center that runs on a Mac Mini. It communicates via phone-native messaging (Twilio SMS/MMS), processes inbound data from email and conversation, and serves a CalDAV calendar endpoint that standard calendar apps subscribe to.

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
npm run start:seed     # Run and populate database from src/_seed/
npm run dev            # Run in development with file watching

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
```

Typical first-boot workflow:

```bash
npm run typecheck      # backend + admin UI types clean?
npm run lint           # backend + admin UI lint clean?
npm run build          # compile backend to dist/
npm run ui:build       # build admin UI to ui/dist/
npm run start:seed     # first boot — seed database, then serve backend + /admin
```

Subsequent boots use `npm start` — the database is already populated.

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
ngrok http 3000
```

Note the forwarding URL (e.g., `https://abc123.ngrok-free.app`) and configure it as your Twilio webhook URL.

### 5. Verify, build, and run

```bash
npm run typecheck     # verify backend + admin UI types compile clean
npm run lint          # verify backend + admin UI lint + formatting
npm run build         # compile backend to dist/
npm run ui:build      # build admin UI bundle to ui/dist/
npm run start:seed    # first boot — seed database and start server
```

For subsequent runs after the database is seeded:

```bash
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
ngrok http 3000 --domain=your-subdomain.ngrok-free.app
```

Set your Twilio webhook URL to `https://your-subdomain.ngrok-free.app/webhook/twilio` once. It won't change.

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
    <string>--domain=your-subdomain.ngrok-free.app</string>
  </array>
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
    <string>/opt/homebrew/bin/node</string>
    <string>dist/server.js</string>
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

#### Load all services

```bash
launchctl load ~/Library/LaunchAgents/com.fcc.redis.plist
launchctl load ~/Library/LaunchAgents/com.fcc.ngrok.plist
launchctl load ~/Library/LaunchAgents/com.fcc.app.plist
```

#### Check status

```bash
launchctl list | grep com.fcc
```

#### Unload (stop) a service

```bash
launchctl unload ~/Library/LaunchAgents/com.fcc.app.plist
```

### Backup

SQLite and Redis data should be backed up regularly:

```bash
# SQLite backup (run via cron or launchd on a schedule)
sqlite3 /path/to/fcc.db ".backup '/path/to/backup/fcc-$(date +%Y%m%d).db'"

# Redis AOF is already persistent; include the appendonly.aof file in backups
```

Time Machine covers the full machine. For off-site backup, consider `restic` to an encrypted cloud target (B2, S3).

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
├── _seed/                  Seed data for database bootstrapping (system-config.ts, system-state.ts)
├── admin/                  Admin API route handlers (served at /api/admin)
├── config/                 Runtime system configuration loader
├── lib/                    Shared utilities (Redis helpers, etc.)
├── server.ts               Fastify server entry point — wires all services, starts listeners
├── bootstrap.ts            Database initialization and seed loading (--seed flag)
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
| `npm run format`     | Format with Prettier                           |
| `npm test`           | Run tests (Vitest)                             |
| `npm run ui:dev`     | Start admin UI dev server (Vite, port 5173)    |
| `npm run ui:build`   | Build admin UI production bundle to `ui/dist/` |
| `npm run ui:preview` | Preview admin UI production build              |
| `npm run ngrok:auth` | Configure ngrok auth token from `.env`         |
