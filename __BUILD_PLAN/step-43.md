# Step 43 — Admin UI (System Configuration & State Management)

Step 43 is broken into four sub-steps. Each sub-step is a complete, independently reviewable deliverable that typechecks and lints clean.

See `.cursor/rules/admin-ui.mdc` for all design decisions, component quality standards, and build agent guardrails.

---

## Step 43-part-1: Scaffold + API Layer

### What to Build

Bootstrap the `ui/` Vite project and implement all Fastify admin API endpoints.

#### Frontend Scaffold

- Initialize Vite + React 19 + TypeScript project in `ui/`
- Install and configure shadcn/ui (Radix + Tailwind CSS) with dark mode only (no light mode, no toggle)
- Configure TanStack Query client with default `refetchInterval` for polling
- Configure React Router in hash mode
- Configure TypeScript path aliases: `@backend/*` → `../src/*` in both `tsconfig.json` and `vite.config.ts`
- Create API client utility in `ui/src/lib/api.ts` for fetching `/api/admin/*` endpoints
- Build top navigation bar layout shell with links to all 8 pages (Dashboard, Entities, Threads, Topics, Budget, Scheduler, Queue, Activity)
- Register hash routes to empty placeholder pages

#### Fastify Admin API

Add a Fastify route module for `/api/admin/*` with local-network-only enforcement (reject requests with ngrok `X-Forwarded-For` / `X-Forwarded-Host` headers with 403).

| Route                                    | Method   | Purpose                                                                         |
| ---------------------------------------- | -------- | ------------------------------------------------------------------------------- |
| `/api/admin/config`                      | GET, PUT | System-level config (threads, messaging identity, timezone, digest windows)     |
| `/api/admin/entities`                    | GET, PUT | Entity registry (participants, roles, permissions, thread membership)           |
| `/api/admin/topics`                      | GET, PUT | Topic profile settings (enabled, tone, format, escalation, confirmation gates)  |
| `/api/admin/budget`                      | GET, PUT | Budget limits (daily caps, thread rate limits, collision precedence)            |
| `/api/admin/scheduler`                   | GET, PUT | Scheduler timing (digest windows, reminder intervals, repeatable job schedules) |
| `/api/admin/state/queue`                 | GET      | Queue inspection (pending items, DLQ, recent completions)                       |
| `/api/admin/state/escalations`           | GET      | Active escalation states                                                        |
| `/api/admin/state/confirmations`         | GET      | Pending and recent confirmations                                                |
| `/api/admin/state/dispatches`            | GET      | Recently dispatched messages (metadata only, no message bodies)                 |
| `/api/admin/state/queue/dlq/:id/retry`   | POST     | Retry a DLQ item                                                                |
| `/api/admin/state/queue/dlq/:id/discard` | POST     | Discard a DLQ item                                                              |

#### Development Workflow

- `npm run ui:dev` — Vite dev server on port 5173 with proxy to Fastify on 3000
- `npm run ui:build` — production bundle to `ui/dist/`
- `npm run ui:preview` — preview production build
- Fastify serves `ui/dist/` as static files under `/admin` in production

### Dependencies

Steps 0–42 complete (all services implemented, schemas finalized, barrel exports verified).

### Technologies

React 19, Vite, shadcn/ui, Tailwind CSS, TanStack Query, React Router, Zod.

### Files to Create/Modify

- `ui/` — full project scaffold (package.json, tsconfig.json, vite.config.ts, tailwind.config.ts, components.json, src/main.tsx, src/App.tsx, src/lib/api.ts, src/routes/\*.tsx, src/components/layout.tsx)
- `src/server.ts` — add static file serving for `ui/dist/` under `/admin`, register admin API routes
- New Fastify route module for `/api/admin/*` endpoints
- `package.json` — add `ui:dev`, `ui:build`, `ui:preview` scripts

### Acceptance Criteria

- `npm run ui:dev` starts the Vite dev server and proxies API calls to Fastify
- `npm run ui:build` produces a production bundle in `ui/dist/`
- Fastify serves the admin UI at `http://localhost:3000/admin`
- Requests to `/admin` and `/api/admin/*` through the ngrok tunnel are rejected (403)
- Top nav renders with links to all 8 pages
- All admin API endpoints return valid JSON (even if the data is minimal/seed-level)
- `npm run typecheck` passes (both `src/` and `ui/`)
- `npm run lint` passes

---

## Step 43-part-2: Config Management Pages

### What to Build

The four config management pages — the write-heavy core of the UI. All editing is inline: click a value, edit in place, auto-save on blur/Enter. No modals, no edit pages, no save/discard bars, no confirmation dialogs.

#### Entities Page

- Table of participants with inline-editable columns: roles, permissions, thread assignments
- Pet entity shown but messaging identity field locked (enforces pet-no-messaging invariant)

#### Threads Page

- Thread list with participant membership visualization
- Inline editing of thread configuration and participant assignments

#### Topics Page

- Card grid of 14 topic profiles
- Inline-editable fields per card: enabled/disabled toggle, tone, format, escalation profile selector, confirmation gate settings
- Cross-topic connections and framework grounding displayed as read-only (structural decisions, not operational knobs)

#### Budget Page

- Inline-editable daily cap values per entity
- Inline-editable thread rate limits
- Collision precedence ordering (drag-to-reorder or inline number input)

#### Scheduler Page

- Digest window editor with inline time pickers
- Reminder interval controls
- Repeatable job schedule viewer with inline timing adjustments

### Dependencies

Step 43-part-1 complete (scaffold, API layer, layout shell).

### Technologies

React Hook Form + Zod resolvers for inline validation, TanStack Query mutations for auto-save.

### Files to Create/Modify

- `ui/src/routes/entities.tsx`
- `ui/src/routes/threads.tsx`
- `ui/src/routes/topics.tsx`
- `ui/src/routes/budget.tsx`
- `ui/src/routes/scheduler.tsx`
- `ui/src/components/` — shared inline-edit components (editable cell, toggle, select, etc.)
- `ui/src/hooks/` — TanStack Query hooks for each config surface (useEntities, useTopics, useBudget, etc.)

### Acceptance Criteria

- All five config pages render with real data from the admin API
- Inline editing works: click → edit → blur/Enter → auto-save → API call → optimistic update
- Validation errors shown inline (Zod via React Hook Form)
- Topic cards show all 14 topics with correct profile data
- Pet entity messaging identity is not editable
- Cross-topic connections and framework grounding are read-only on topic cards
- `npm run typecheck` passes
- `npm run lint` passes

---

## Step 43-part-3: State Inspection Pages

### What to Build

The two state inspection pages — read-heavy with targeted actions (retry/discard).

#### Queue Page

- Current queue depth and pending item count
- Recent completed items list (metadata only — no message bodies)
- DLQ viewer with per-item retry and discard buttons
- Polling via TanStack Query `refetchInterval`

#### Activity Page

- Recent dispatches table (metadata: timestamp, topic, thread, entity, status)
- Escalation history table (timestamp, topic, entity, profile, current step)
- Confirmation history table (timestamp, type, status, resolved/expired)
- Date range filter: default 24h, expandable to 7 days or custom range
- Filtering by topic, thread, entity across all tables
- Paginated tables, not infinite scroll

### Dependencies

Step 43-part-1 complete (scaffold, API layer).

### Technologies

TanStack Query polling, shadcn/ui Table and Pagination components.

### Files to Create/Modify

- `ui/src/routes/queue.tsx`
- `ui/src/routes/activity.tsx`
- `ui/src/components/` — shared table, pagination, date-range-filter components
- `ui/src/hooks/` — TanStack Query hooks for state endpoints (useQueue, useDispatches, useEscalations, useConfirmations)

### Acceptance Criteria

- Queue page shows current depth, recent items, and DLQ with retry/discard controls
- Activity page shows dispatches, escalations, and confirmations with date range filtering
- No message body content is ever displayed — metadata only
- Tables paginate correctly
- Data refreshes on polling interval
- `npm run typecheck` passes
- `npm run lint` passes

---

## Step 43-part-4: Dashboard + Final Polish

### What to Build

The dashboard landing page with visual health indicators, plus final integration polish.

#### Dashboard

- Status cards with visual indicators:
  - Queue depth (green/yellow/red based on thresholds)
  - Active escalations count (with badge if any are stuck)
  - Pending confirmations count
  - Messages dispatched today
  - Budget usage per entity (with warning when approaching cap)
  - DLQ depth (red badge if > 0)
- Cards link to their respective detail pages

#### Final Polish

- Verify all 8 pages work end-to-end with the running backend
- Verify Fastify serves `ui/dist/` correctly at `/admin` after `npm run ui:build`
- Verify ngrok rejection works for both `/admin` and `/api/admin/*`
- Verify top nav active-state highlighting works on all routes

### Dependencies

Steps 43-part-1 through 43-part-3 complete.

### Technologies

shadcn/ui Card, Badge components. TanStack Query for aggregated polling.

### Files to Create/Modify

- `ui/src/routes/dashboard.tsx`
- `ui/src/hooks/use-dashboard.ts` — aggregated health query
- Minor polish to existing pages as needed

### Acceptance Criteria

- Dashboard renders with real data and correct visual indicators
- DLQ > 0 shows a red badge
- Budget approaching cap shows a yellow/amber warning
- Stuck escalations show a warning badge
- All status cards link to their detail pages
- Full build pipeline works: `npm run ui:build` → Fastify serves at `/admin`
- ngrok requests to `/admin` and `/api/admin/*` return 403
- All pages functional with the running backend
- `npm run typecheck` passes (both `src/` and `ui/`)
- `npm run lint` passes

---
