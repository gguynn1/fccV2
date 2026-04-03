# Deferred Items

Flags identified during code review that were accepted or deferred for resolution in later steps. Each entry records the flag, the decision, and when it should be revisited.

---

## Active Deferrals

### D-01 — process.env double-read in server.ts

- **Identified:** step-00-part-3 review
- **Severity:** Medium
- **Description:** `src/server.ts` passes raw `process.env` to `startImapListener()` instead of the already-validated env object from `loadEnv()`. Two different env access paths coexist.
- **Resolve at:** step-29 (IMAP credentials join the validated `AppEnv` schema)
- **Action:** Refactor `startImapListener` to accept `AppEnv` with optional IMAP fields instead of raw `process.env`.

### D-02 — Fastify logger disabled

- **Identified:** step-00-part-3 review
- **Severity:** Low
- **Description:** `src/server.ts` creates Fastify with `{ logger: false }` and uses a standalone pino instance. Fastify natively integrates with pino — passing the existing logger would give automatic request/response logging for free.
- **Resolve at:** step-07+ (when real Twilio webhook and CalDAV routes are added)
- **Action:** Pass the pino logger instance to Fastify constructor: `Fastify({ logger })`.

### D-03 — IdentityService defaults to seed config import

- **Identified:** step-06 review
- **Severity:** Medium
- **Description:** `IdentityService` constructor falls back to `seedSystemConfig` at runtime: `const config = options?.config ?? seedSystemConfig;`. This couples the identity service to seed data files. In production, entity configuration should come from the State Service / database.
- **Resolve at:** step-07+ (when the Worker wires services together)
- **Action:** Remove the seed import fallback. Require `config` to be passed explicitly by the Worker during service wiring.

### D-04 — Shallow topic state validation in State Service

- **Identified:** step-03 review
- **Severity:** Low
- **Description:** `validateStateSlices()` casts topic states through `as unknown as Record<string, unknown>` and validates with `topicRecordSchema` which is `z.record(z.string(), z.unknown())`. This validates that topic states are objects but nothing about their shape.
- **Resolve at:** steps 10–23 (topic profile implementation steps)
- **Action:** Replace the generic `topicRecordSchema` with per-topic Zod schemas as each topic profile is built. Each step should add its topic's schema to the validation function.

### D-05 — Scheduler hardcodes participant_1 fallback

- **Identified:** step-05 review
- **Severity:** Low
- **Description:** `BullSchedulerService.inferConcerningFromThread()` returns `["participant_1"]` as a hardcoded fallback when the thread ID doesn't match the `_private` suffix pattern. This is a silent assumption that produces wrong results for shared threads.
- **Resolve at:** step where real digest routing is built (depends on Routing Service integration)
- **Action:** Replace with a thread-membership lookup from the identity/routing service to determine which entities belong to the target thread.

---

## Accepted (no action needed)

### A-01 — Build plan files modified by build agent

- **Identified:** step-01–06 review
- **Severity:** High (rule violation), accepted by user
- **Description:** The build agent rewrote 13 files in `__BUILD_PLAN/` — steps 43–54 restructured, step-55 added, prompt updated. Step 43 changed from "Connections Documentation" to "Admin UI" spec. Steps 44–53 shifted by one position. The hard rule says "NEVER modify any file in `__BUILD_PLAN/`" except `PROGRESS.json`.
- **Decision:** Accepted — the Admin UI addition and reshuffling were approved by the user.

### A-02 — README documents unimplemented Admin UI

- **Identified:** step-01–06 review
- **Severity:** Medium
- **Description:** `README.md` was updated to document the Admin UI (`ui/` directory, `ui:dev`/`ui:build`/`ui:preview` scripts, `/admin` route) that does not exist yet.
- **Decision:** Accepted — forward-looking documentation, consistent with the accepted Admin UI plan.

### A-03 — Steps 04–06 share identical completion timestamp

- **Identified:** step-01–06 review
- **Severity:** Low
- **Description:** Steps 04, 05, and 06 all have `completed_at: "2026-04-03T14:42:01Z"`, suggesting they were completed in a single agent session instead of one-step-per-invocation.
- **Decision:** Accepted — code quality is fine; the human review happened during this review session.

### A-04 — __BUILD_AGENT_PROMPT.md modified

- **Identified:** step-00-part-3 review
- **Severity:** Low (rule violation, harmless)
- **Description:** Added `src-commenting.mdc` reference and updated rule count from 10 to 11. Technically violates the "never modify `__BUILD_PLAN/`" rule.
- **Decision:** Accepted — the correction is accurate and reverting would leave the prompt inaccurate.

---

## Resolved

### R-01 — sqlite-backup.sh hardcoded real path

- **Identified:** step-00-part-3 review
- **Resolved:** same session
- **Description:** `scripts/sqlite-backup.sh` hardcoded `/Users/garrettguynn/Desktop/FCCv2` violating PID-and-bias rule.
- **Fix:** Replaced with `$(cd "$(dirname "$0")/.." && pwd)` for dynamic path resolution.

### R-02 — dotenv not in technology-stack.mdc

- **Identified:** step-00-part-3 review
- **Resolved:** same session
- **Description:** `dotenv` was added as a runtime dependency but not listed in the technology stack rule.
- **Fix:** Added `dotenv` to the Local Infrastructure table in `technology-stack.mdc`.

### R-03 — toRedisConnection() duplicated in three files

- **Identified:** step-01–06 review
- **Resolved:** same session
- **Description:** Identical 11-line function copy-pasted in `src/server.ts`, `src/01-service-stack/04-queue/index.ts`, and `src/02-supporting-services/01-scheduler-service/index.ts`.
- **Fix:** Extracted to `src/lib/redis.ts`. All three consumers updated to import from the shared utility.

### R-04 — Dual source enum (StackQueueItemSource + QueueItemSource)

- **Identified:** step-01–06 review
- **Resolved:** same session
- **Description:** Two nearly identical enums with a 25-line `mapSource()` switch translating between them on every enqueue.
- **Fix:** Removed `StackQueueItemSource`. `QueueItemSource` is now the single enum used everywhere. Removed `mapSource()` and `inferItemType()` from the queue service.
