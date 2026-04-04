# Admin UI

This directory contains the local operator UI for Family Command Center.

It is a React + TypeScript + Vite app served by the backend at `/admin` in production, and by Vite during development.

## Purpose

The admin UI is an operator surface for:

- configuration editing
- queue and activity visibility
- eval run start, progress polling, and artifact review

It is intentionally not a participant-facing interface and does not expose raw participant message bodies.

## Local Development

From repo root:

```bash
npm run ui:dev
```

This starts Vite on port `5173` and proxies API requests to backend `:3000`.

## Production Build

From repo root:

```bash
npm run ui:build
```

The compiled assets are emitted to `ui/dist/` and served by Fastify at `/admin`.

## Constraints

- Local-network operator surface only.
- Polling-based live updates (`refetchInterval`), no websocket or SSE transport.
- Dark mode only.
- shadcn/ui primitives for interactive UI controls.
