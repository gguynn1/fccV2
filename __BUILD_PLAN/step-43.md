# Step 43 — Admin UI (System Configuration Dashboard)

## What to Build

A React single-page application served by Fastify that provides a clean, simple interface for viewing and editing all system configuration. The UI runs on the same localhost:3000 origin — Fastify serves the production bundle as static assets from a `/admin` route.

### Technology Choices

| Layer | Technology |
| ----- | --- |
| Framework | React 19 |
| Component library | shadcn/ui (Radix primitives + Tailwind CSS) |
| Build tool | Vite |
| Data fetching | TanStack Query |
| Form handling | React Hook Form + Zod resolvers (reuse existing Zod schemas from `src/`) |
| Routing | React Router (hash mode — single Fastify catch-all serves the SPA) |

### Project Structure

```
ui/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── routes/
│   ├── components/
│   ├── hooks/
│   └── lib/
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── components.json          ← shadcn/ui config
```

The `ui/` directory is a standalone Vite project at the workspace root, separate from the Node.js backend in `src/`. It has its own `package.json`, `tsconfig.json`, and build pipeline.

### API Layer

Fastify exposes a `/api/admin/*` route namespace with JSON endpoints for each configuration surface. Both the admin UI and the admin API are restricted to the local network — they must never be reachable through the ngrok tunnel. Fastify must reject requests to `/admin` and `/api/admin/*` that arrive via the ngrok `X-Forwarded-For` / `X-Forwarded-Host` headers. No authentication is required because the endpoints are only accessible from the local IP.

Endpoints to implement:

| Route | Purpose |
| ----- | --- |
| `GET/PUT /api/admin/config` | System-level configuration (threads, messaging identity, timezone, digest windows) |
| `GET/PUT /api/admin/entities` | Entity registry (participants, roles, permissions, thread membership) |
| `GET/PUT /api/admin/topics` | Topic profile settings (enabled/disabled, escalation profile, confirmation gates) |
| `GET/PUT /api/admin/budget` | Budget limits (daily caps, thread rate limits, collision precedence overrides) |
| `GET/PUT /api/admin/scheduler` | Scheduler timing (digest windows, reminder intervals, repeatable job schedules) |
| `GET /api/admin/state/queue` | Queue inspection (pending items, DLQ, recent completions) |
| `GET /api/admin/state/escalations` | Active escalation states |
| `GET /api/admin/state/confirmations` | Pending and recent confirmations |
| `GET /api/admin/state/dispatches` | Recently dispatched messages |

### UI Pages

1. **Dashboard** — system health overview: queue depth, active escalations, pending confirmations, messages dispatched today, budget usage
2. **Entities** — table of participants with inline editing of roles, permissions, thread assignments
3. **Threads** — thread configuration with participant membership visualization
4. **Topics** — card grid of 14 topic profiles with toggles, escalation profile selector, confirmation gate settings
5. **Budget** — daily cap sliders, thread rate limits, collision precedence ordering
6. **Scheduler** — digest window editor, reminder interval controls, repeatable job schedule viewer
7. **Queue** — live queue depth, recent items, DLQ viewer with retry/discard controls
8. **Activity** — recent dispatches, escalation history, confirmation history with filtering

### Development Workflow

- `npm run ui:dev` — starts Vite dev server on port 5173 with proxy to Fastify on port 3000
- `npm run ui:build` — builds production bundle to `ui/dist/`
- `npm run ui:preview` — preview production build locally

The Fastify server serves `ui/dist/` as static files under `/admin` in production. During development, the Vite dev server proxies API calls to Fastify.

## Dependencies

Steps 0–42 must be complete (all services implemented, all schemas finalized, barrel exports verified).

## Technologies

React 19, Vite, shadcn/ui (Radix + Tailwind CSS), TanStack Query, React Hook Form, Zod, React Router.

## Files to Create/Modify

- `ui/` — full React application directory
- `src/server.ts` — add static file serving for `ui/dist/` and admin API routes
- New Fastify route module for `/api/admin/*` endpoints
- `package.json` — add `ui:dev`, `ui:build`, `ui:preview` scripts

## Acceptance Criteria

- `npm run ui:build` produces a production bundle in `ui/dist/`
- Fastify serves the admin UI at `http://localhost:3000/admin`
- Requests to `/admin` and `/api/admin/*` through the ngrok tunnel are rejected (403)
- All configuration surfaces are readable and editable through the UI
- Form validation reuses Zod schemas from `src/` where applicable
- Queue, escalation, and confirmation state are viewable in real time
- Changes made through the UI persist to SQLite via the State Service
- The UI is clean, minimal, and responsive — no visual clutter
- `npm run typecheck` passes (both `src/` and `ui/` projects)
- `npm run lint` passes

---
