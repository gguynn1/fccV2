# Family Coordination System

A locally-hosted coordination assistant that runs on a Mac Mini. It communicates via phone-native messaging (Twilio SMS/MMS), processes inbound data from email and conversation, and serves a CalDAV calendar endpoint that standard calendar apps subscribe to.

## Architecture

The system has two paid external dependencies and everything else runs locally:

| External         | Purpose                                                  |
| ---------------- | -------------------------------------------------------- |
| Twilio           | SMS/MMS messaging across five threads                    |
| Anthropic Claude | Classification, message composition, image/email parsing |

| Local                | Purpose                                            |
| -------------------- | -------------------------------------------------- |
| Node.js + TypeScript | Application runtime                                |
| Redis                | Queue (BullMQ), scheduling, rate-limiting counters |
| SQLite               | All persistent state                               |
| ngrok                | Tunnel from public URL to local Fastify server     |

```
Internet
  │
  ├── Twilio webhook POST ──→ ngrok ──→ localhost:3000/webhook/twilio
  ├── Calendar app GET ──────→ ngrok ──→ localhost:3000/caldav/*
  │
Local machine (outbound)
  ├──→ Twilio REST API (send messages)
  ├──→ Anthropic Claude API (LLM)
  └──→ IMAP server (email polling)
```

## Prerequisites

Install via [Homebrew](https://brew.sh):

```bash
brew install node redis
brew install --cask ngrok
```

Verify:

```bash
node --version   # LTS (v22+)
redis-server --version
ngrok version
```

## Development Setup

### 1. Clone and install

```bash
git clone <repo-url> && cd FCCv2
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

### 5. Build and run

```bash
npm run build
npm start
```

Or for development with type checking:

```bash
npm run typecheck
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
ngrok config add-authtoken <your-auth-token>
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
| `DATABASE_PATH`                             | SQLite database file location                        |
| `REDIS_URL`                                 | Redis connection (default: `redis://localhost:6379`) |
| `PORT`                                      | Fastify server port (default: `3000`)                |

## Project Structure

```
src/
├── 01-service-stack/       Core pipeline (Transport → Identity → Classifier → Queue → Worker → Action Router)
├── 02-supporting-services/ Services called by the Worker or feeding the Queue
├── 03-connections/         Documentation only — how services interact
├── types.ts                Shared vocabulary enums (TopicKey, EscalationLevel, etc.)
└── index.ts                Barrel exports + SystemConfig interface
```

Each numbered folder is a bounded service with its own `CLAUDE.md` (behavior docs), `types.ts` (owned types), and `notes.txt` (technology notes).

## Scripts

| Script              | Purpose                             |
| ------------------- | ----------------------------------- |
| `npm run build`     | Compile TypeScript to `dist/`       |
| `npm run typecheck` | Type check without emitting         |
| `npm run lint`      | ESLint + Prettier check             |
| `npm run lint:fix`  | Auto-fix lint issues                |
| `npm run format`    | Format with Prettier                |
| `npm test`          | Run tests (Vitest, once configured) |
