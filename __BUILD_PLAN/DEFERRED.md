# Deferred Items

Flags identified during code review that were accepted or deferred for resolution in later steps. Each entry records the flag, the decision, and when it should be revisited.

---

## Active Deferrals

### D-01 — ~~process.env double-read in server.ts~~ MOVED TO RESOLVED (R-17)

### D-03 — ~~IdentityService defaults to seed config import~~ CONSOLIDATED INTO D-14

### D-04 — Shallow topic state validation in State Service

- **Identified:** step-03 review
- **Severity:** Low
- **Description:** `validateStateSlices()` casts topic states through `as unknown as Record<string, unknown>` and validates with `topicRecordSchema` which is `z.record(z.string(), z.unknown())`. This validates that topic states are objects but nothing about their shape. Has slipped twice (step-10-23, then step-24+). The Worker now reads/writes topic state without shape validation.
- **Resolve at:** step-33 (third window — no further deferrals)
- **Action:** Replace the generic `topicRecordSchema` with per-topic Zod schemas derived from the TypeScript interfaces defined in steps 10–24. Add runtime validation on State Service read/write paths.

### D-05 — ~~Scheduler hardcodes participant_1 fallback~~ MOVED TO RESOLVED (R-26)

- **Identified:** step-05 review
- **Severity:** Low
- **Description:** `BullSchedulerService.inferConcerningFromThread()` returns `["participant_1"]` as a hardcoded fallback when the thread ID doesn't match the `_private` suffix pattern. This is a silent assumption that produces wrong results for shared threads.
- **Resolve at:** step-33
- **Action:** Replace with a thread-membership lookup from system configuration or the Routing Service to determine which entities belong to the target thread.

### D-06 — ~~Transport layer imports seed config at runtime~~ CONSOLIDATED INTO D-14

### D-07 — ~~HealthProfile.upcoming_appointments union type~~ MOVED TO RESOLVED (R-22)

### D-08 — ~~Routing and budget services import seed config at runtime~~ CONSOLIDATED INTO D-14

### D-09 — ~~Cross-boundary runtime enum imports (EntityType, DispatchPriority, QueueItemSource, QueueItemType)~~ MOVED TO RESOLVED (R-27)

- **Identified:** step-24–27 review (updated step-28, step-29–32 reviews, and step-0–32 reassessment)
- **Severity:** Medium
- **Description:** Four enums are imported across the 01↔02 service boundary as runtime values in 8+ files: `EntityType` from `02-identity-service/types.js` (routing service, data ingest service), `DispatchPriority` from `06-action-router/types.js` (budget service, data ingest service, scheduler service, stack types.ts, supporting-services types.ts), `QueueItemSource` from `04-queue/types.js` (escalation service, confirmation service, data ingest service, stack types.ts), and `QueueItemType` from `04-queue/types.js` (confirmation service). Includes all imports previously tracked separately in D-12.
- **Resolve at:** step-33
- **Action:** Move `EntityType`, `DispatchPriority`, `QueueItemSource`, and `QueueItemType` to `src/types.ts`. Update all imports across the codebase to reference the shared location.

### D-10 — ~~Unsafe type casts in routing, budget, and escalation services~~ MOVED TO RESOLVED (R-23)

### D-11 — ~~Worker and Data Ingest import systemConfig from seed at runtime~~ CONSOLIDATED INTO D-14

### D-12 — ~~Data Ingest cross-boundary runtime enum imports~~ MERGED INTO D-09

### D-13 — ~~resolveRoutingDecision uses duck-typing cast~~ MOVED TO RESOLVED (R-24)

### D-14 — ~~Seed config imported at runtime across 7 files~~ MOVED TO RESOLVED (R-28)

- **Identified:** step-06 through step-29–32 reviews (consolidates D-03, D-06, D-08, D-11)
- **Severity:** Medium
- **Description:** Seven files import `systemConfig` (or `seedSystemConfig`) from `_seed/system-config.js` at runtime. The seed-data rule says "The running application reads from the database, never from seed files." Affected files: `src/server.ts`, `src/01-service-stack/01-transport-layer/index.ts`, `src/01-service-stack/02-identity-service/index.ts`, `src/01-service-stack/05-worker/index.ts`, `src/02-supporting-services/02-data-ingest-service/index.ts`, `src/02-supporting-services/05-routing-service/index.ts`, `src/02-supporting-services/06-budget-service/index.ts`. The pattern was never reduced — each new service copied it. This is the largest structural debt item.
- **Resolve at:** step-33
- **Action:** Load system configuration once at boot in `server.ts` from the State Service / database, then pass it via constructor injection to every service. Remove all 7 `_seed/` imports from runtime code. Seed files remain for `npm run start:seed` only.

### D-15 — Unused scaffolding types (7 definitions)

- **Identified:** step-24–27 and step-28 reviews (upgraded from A-21 + A-25 during step-0–32 reassessment)
- **Severity:** Low
- **Description:** Seven type definitions were created as scaffolding for Worker integration but remain unused after steps 30-32 wired the Worker: `MaintenanceCrossTopicLinks` (maintenance/types.ts), `BudgetDecisionTyped`, `BudgetCounterSnapshot`, `BudgetCollisionCheck` (budget/types.ts), `AccountabilityLevel`, `EscalationTransitionResult` (escalation/types.ts), `ConfirmationMatchOutcome` (confirmation/types.ts).
- **Resolve at:** step-33+
- **Action:** For each type: either wire it into the service/Worker implementation where it was intended, or remove it. Do not leave dead type definitions.

### D-16 — suggestGroceryItemsFromMealDescription is a hardcoded placeholder

- **Identified:** step-23 review (upgraded from A-19 during step-0–32 reassessment)
- **Severity:** Low
- **Description:** `suggestGroceryItemsFromMealDescription()` in `04.13-meals/profile.ts` only handles "taco" and "pasta" keywords. The Worker's Meals→Grocery cross-topic path calls this function. The step spec says Claude API should interpret meal ideas and suggest grocery items.
- **Resolve at:** step-35+ (action router / composition refinement)
- **Action:** Replace the hardcoded keyword matching with a Claude API call that extracts grocery items from meal descriptions. Wire through the Worker's composition step.

### D-17 — D-04 still unresolved after step-42

- **Identified:** step-42 review
- **Severity:** High
- **Description:** D-04 (shallow topic state validation in `src/02-supporting-services/03-state-service/index.ts`) remained unresolved past its `Resolve at: step-33` target. State validation still relies on broad `topicRecordSchema` parsing with `as unknown as Record<string, unknown>` casts for each topic slice.
- **Resolve at:** step-43 (state-validation hardening pass)
- **Action:** Replace broad topic-record validation with per-topic runtime schemas and validate each topic state slice without `as unknown as` casts.

### D-18 — Admin API config routes use unsafe type casts

- **Identified:** step-43-part-1 review
- **Severity:** Medium
- **Description:** Admin routes in `src/admin/routes.ts` use `as unknown as typeof nextConfig.X` casts on lines 153, 154, 178, 198-201, 226-228, 249 to bypass Zod validation and force-cast parsed payloads to full config types. The Zod schemas use `.passthrough()` and `z.unknown()` extensively, making them permissive by design and allowing incomplete or extra fields.
- **Resolve at:** step-43-part-2 (inline editing with strict validation)
- **Action:** Replace permissive Zod schemas with strict per-field schemas for all config surfaces (entities, threads, topics, budget, scheduler). Remove unsafe casts and rely on Zod validation to enforce shape correctness.

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

### A-04 — \_\_BUILD_AGENT_PROMPT.md modified

- **Identified:** step-00-part-3 review
- **Severity:** Low (rule violation, harmless)
- **Description:** Added `src-commenting.mdc` reference and updated rule count from 10 to 11. Technically violates the "never modify `__BUILD_PLAN/`" rule.
- **Decision:** Accepted — the correction is accurate and reverting would leave the prompt inaccurate.

### A-05 — Unused types in CalDAV types.ts

- **Identified:** step-07–10 review
- **Severity:** Low
- **Description:** `CalDAVCalendar`, `VEventPayload`, `VCalendarPayload`, and `calDavQuerySchema` are defined in `src/01-service-stack/01-transport-layer/01.1-caldav/types.ts` but not consumed by any implementation file.
- **Decision:** Accepted — may serve as protocol surface documentation and could be consumed during step-41 CalDAV integration.

### A-06 — Steps 07–10 share identical completion timestamp

- **Identified:** step-07–10 review
- **Severity:** Low
- **Description:** Steps 07, 08, 09, and 10 all have `completed_at: "2026-04-03T15:04:50Z"`, indicating they were completed in a single Build Agent session.
- **Decision:** Accepted — code quality is fine; human review happened during this review session.

### A-07 — CalDAV ctag hardcoded to "1"

- **Identified:** step-07–10 review
- **Severity:** Low
- **Description:** `src/01-service-stack/01-transport-layer/01.1-caldav/index.ts` sets `ctag: "1"` as a static value. Calendar apps use ctag to detect when to re-fetch. A static value prevents cache invalidation.
- **Decision:** Accepted — full CalDAV compliance is deferred to step-41. The ctag should be derived from the most recent event modification timestamp when real data flows through.

### A-08 — CalendarEvent has 5 optional date-related fields

- **Identified:** step-11 review
- **Severity:** Low
- **Description:** `CalendarEvent` in `04.01-calendar/types.ts` has `normalized_start`, `normalized_end`, `date`, `date_start`, `date_end` — all optional. Conflict detection uses a 3-level fallback chain (`normalized_start ?? date_start ?? date`).
- **Decision:** Accepted — the normalized fields provide a canonical resolution point. The Worker should populate `normalized_start/end` during event creation, making the fallback chain a safety net rather than the primary access path.

### A-09 — Hardcoded thread naming conventions in finance and health helpers

- **Identified:** step-13/15 review
- **Severity:** Low
- **Description:** `FINANCES_ALLOWED_THREADS = ["couple"]` in `04.03-finances/profile.ts` and `isHealthPrivateThread()` checking `${entity_id}_private` in `04.05-health/profile.ts` encode thread-naming assumptions.
- **Decision:** Accepted — stable convention for a single-deployment system. Thread IDs are defined in system config and are unlikely to change. The Worker can inject thread config if needed.

### A-10 — FinanceAction requires_confirmation literal redundant with helper

- **Identified:** step-13 review
- **Severity:** Low
- **Description:** Every mutating `FinanceAction` variant includes `requires_confirmation: true` as a literal type field. The `requiresFinanceConfirmation()` helper already derives this from `action.type !== "query_finances"`.
- **Decision:** Accepted — the literal type serves as compile-time documentation that financial mutations always require confirmation. The helper provides runtime convenience. Mild redundancy but not harmful.

### A-11 — D-04 per-topic Zod schemas not addressed in steps 11-15

- **Identified:** step-11–15 review
- **Severity:** Low
- **Description:** D-04's resolve-at range (steps 10–23) includes these steps, but no per-topic Zod validation schemas were added. Profile steps define behavior and TypeScript interfaces — not state validation. Per-topic Zod schemas belong in the State Service or Worker integration layer.
- **Decision:** Accepted — the deferral's resolve-at range is broad. Steps 11-15 are the wrong place for State Service validation changes. D-04 remains active and will be addressed during Worker integration.

### A-12 — Steps 11-15 share identical completion timestamp

- **Identified:** step-11–15 review
- **Severity:** Low
- **Description:** All five steps have `completed_at: "2026-04-03T15:16:08Z"`, indicating they were completed in a single Build Agent session.
- **Decision:** Accepted — consistent with prior decisions A-03 (steps 04-06) and A-06 (steps 07-10). Code quality is fine; human review happened during this review session.

### A-13 — Steps 16-20 share identical completion timestamp

- **Identified:** step-16–20 review
- **Severity:** Low
- **Description:** All five steps have `completed_at: "2026-04-03T15:26:59Z"`, indicating they were completed in a single Build Agent session.
- **Decision:** Accepted — consistent with prior decisions A-03, A-06, A-12. Code quality is fine; human review happened during this review session.

### A-14 — ~~index.ts changes entangled with steps 21-23~~ MOVED TO RESOLVED (R-25)

### A-15 — BusinessLead has many optional CRM-critical fields

- **Identified:** step-20 review
- **Severity:** Low
- **Description:** `BusinessLead` in `04.10-business/types.ts` has `status`, `pipeline_stage`, `booking_status`, `contact`, and `client_name` all optional. CRM tracking is weakened when pipeline stage is unknown.
- **Decision:** Accepted — progressive data capture is a valid CRM pattern. A lead starts as just an inquiry date and owner; fields populate as the pipeline advances. The Worker can enforce required fields at transition boundaries.

### A-16 — businessClientDraftToneHint hardcodes "photo"/"portrait" check

- **Identified:** step-20 review
- **Severity:** Low
- **Description:** `businessClientDraftToneHint()` in `04.10-business/profile.ts` checks if `business_type` contains "photo" or "portrait" to select a warm client-facing tone, otherwise returns a generic professional tone.
- **Decision:** Accepted — acceptable for a single-deployment system. The Worker or composition logic can add more nuanced mapping later.

### A-17 — Steps 21-23 share identical completion timestamp

- **Identified:** step-21–23 review
- **Severity:** Low
- **Description:** All three steps have `completed_at: "2026-04-03T15:29:19Z"`, indicating they were completed in a single Build Agent session.
- **Decision:** Accepted — consistent with prior decisions A-03, A-06, A-12, A-13. Code quality is fine; human review happened during this review session.

### A-18 — Two trivial identity functions in relationship and family-status profiles

- **Identified:** step-21–23 review
- **Severity:** Low
- **Description:** `shouldRelationshipNudgeDisappearWhenIgnored(ignored) → ignored` (relationship/profile.ts) and `shouldRequestTransitEta(is_calendar_transit_window) → is_calendar_transit_window` (family-status/profile.ts) are identity functions.
- **Decision:** Accepted — they communicate design intent and serve as natural extension points if the logic becomes conditional later.

### A-19 — ~~suggestGroceryItemsFromMealDescription is a hardcoded placeholder~~ UPGRADED TO DEFERRAL (D-16)

### A-20 — Steps 24–27 share identical completion timestamp

- **Identified:** step-24–27 review
- **Severity:** Low
- **Description:** All four steps have `completed_at: "2026-04-03T16:07:54Z"`, indicating they were completed in a single Build Agent session.
- **Decision:** Accepted — consistent with prior decisions A-03, A-06, A-12, A-13, A-17. Code quality is fine; human review happened during this review session.

### A-21 — ~~Six unused type definitions (scaffolding)~~ UPGRADED TO DEFERRAL (D-15)

### A-22 — Hardcoded "family" thread ID as fallback

- **Identified:** step-24–27 review
- **Severity:** Low
- **Description:** Routing service (line 129), budget service (line 351), and escalation service (line 349) hardcode `"family"` as a fallback thread ID rather than deriving it from thread configuration.
- **Decision:** Accepted — stable convention for a single-deployment system. Consistent with A-09.

### A-24 — `as OpenConfirmationRequest` type cast in confirmation service

- **Identified:** step-28 review
- **Severity:** Low
- **Description:** `BullConfirmationService.openConfirmation()` in `08-confirmation-service/index.ts` (line 177) casts the `ConfirmationRequest` parameter to `OpenConfirmationRequest` to access optional fields (`requested_at`, `reply_options`, `expiry_message`) not on the declared interface. All additional fields are optional, so the cast is safe in practice.
- **Decision:** Accepted — documents that callers may provide extra fields. The interface can be expanded during Worker wiring when actual callers are known.

### A-25 — ~~ConfirmationMatchOutcome type unused~~ UPGRADED TO DEFERRAL (D-15)

### A-26 — Steps 29-32 share identical completion timestamp

- **Identified:** step-29–32 review
- **Severity:** Low
- **Description:** All four steps have `completed_at: "2026-04-03T17:02:30Z"`, indicating they were completed in a single Build Agent session.
- **Decision:** Accepted — consistent with prior decisions A-03, A-06, A-12, A-13, A-17, A-20. Code quality is fine; human review happened during this review session.

### A-23 — BullMQ Queue used solely for Redis client access in budget service

- **Identified:** step-24–27 review
- **Severity:** Low
- **Description:** `RedisBudgetService` creates `Queue("fcc-budget-counters")` but never adds jobs — only uses `this.queue.client` to access the underlying ioredis connection. Creates unnecessary BullMQ metadata keys in Redis.
- **Decision:** Accepted — pragmatic reuse of BullMQ's connection management via the shared `toRedisConnection` utility.

### A-27 — Architecture rule update in `.cursor/rules/architecture.mdc`

- **Identified:** step-42 review
- **Severity:** High (rule violation), accepted by user
- **Description:** The build change set modifies `.cursor/rules/architecture.mdc`, which normally violates build-plan integrity restrictions for build-agent output.
- **Decision:** Accepted — step-41 explicitly requires correcting the pipeline wording to reflect the implemented flow (Classifier runs inside Worker step 1).

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

### R-05 — Fastify logger disabled (D-02)

- **Identified:** step-00-part-3 review
- **Resolved:** step-07–10 review
- **Description:** `src/server.ts` created Fastify with `{ logger: false }` while a standalone pino instance existed. No automatic request/response logging for webhook and CalDAV routes.
- **Fix:** Changed `Fastify({ logger: false })` to `Fastify({ logger })` so Fastify uses the shared pino logger.

### R-06 — TopicClarificationRequest used string literals instead of ClarificationReason enum

- **Identified:** step-07–10 review
- **Resolved:** same session
- **Description:** `TopicClarificationRequest.reason` in `src/02-supporting-services/04-topic-profile-service/types.ts` used a string literal union instead of the `ClarificationReason` enum from `src/types.ts`.
- **Fix:** Replaced the string literal union with `ClarificationReason` via `import type`.

### R-07 — SchoolAction source union widened to `SchoolInputSource | string`

- **Identified:** step-17 review
- **Resolved:** same session
- **Description:** `Assignment.source` and `add_assignment` action `source` in `04.07-school/types.ts` were typed as `SchoolInputSource | string`. The `| string` subsumes the enum, making the type constraint meaningless.
- **Fix:** Removed `| string` from both locations. Updated seed data to use `SchoolInputSource.EmailParsing` and `SchoolInputSource.Conversation` instead of raw strings.

### R-08 — VendorJob.notes union type `string | string[]`

- **Identified:** step-19 review
- **Resolved:** same session
- **Description:** `VendorJob.notes` in `04.09-vendors/types.ts` was typed as `string | string[]`, forcing consumers to handle both shapes with runtime type guards. Same anti-pattern as D-07.
- **Fix:** Normalized to `string[]`. Updated seed data to wrap single note strings in arrays.

### R-09 — Pets cross_topic_connections dropped Vendors

- **Identified:** step-16 review
- **Resolved:** same session
- **Description:** `PETS_TOPIC_PROFILE` in `04.06-pets/profile.ts` had `cross_topic_connections: [TopicKey.Calendar]`, dropping `TopicKey.Vendors` from the previous inline definition. Vet appointments can create vendor relationships.
- **Fix:** Restored `TopicKey.Vendors` to the pets profile cross-topic connections.

### R-10 — BusinessProfile.follow_up_quiet_period typed as string, parsed as int

- **Identified:** step-20 review
- **Resolved:** same session
- **Description:** `BusinessProfile.follow_up_quiet_period` was typed as `string` but `isBusinessLeadQuiet()` parsed it with `Number.parseInt()`. The format was undocumented and type-unsafe.
- **Fix:** Renamed to `follow_up_quiet_period_days: number`. Removed `parseInt` from `isBusinessLeadQuiet()`. Updated seed data from `"48h"` to `2`.

### R-11 — D-04 resolve-at window passed without resolution

- **Identified:** step-21–23 review
- **Resolved:** same session
- **Description:** D-04 (shallow topic state validation) had `Resolve at: steps 10–23`. Profile steps correctly built TypeScript interfaces but not Zod runtime schemas. The window passed without resolution.
- **Fix:** Updated D-04's resolve-at to `step-24+` (Worker integration, where topic state is read/written and per-topic schemas become actionable).

### R-12 — selectNextRelationshipNudgeType only cycled 3 of 5 NudgeType values

- **Identified:** step-21 review
- **Resolved:** same session
- **Description:** The selection function only rotated through AppreciationPrompt, ConversationStarter, and ConnectionPrompt. DateNightSuggestion and GratitudeExercise were defined in the enum but unreachable.
- **Fix:** Replaced if-chain with array-based rotation over all 5 `NudgeType` values via `NUDGE_ROTATION` array and modular index.

### R-13 — routeMealsPlanningThread sorted by string length instead of participant count

- **Identified:** step-23 review
- **Resolved:** same session
- **Description:** `routeMealsPlanningThread()` took `string[]` thread IDs and sorted by `b.length - a.length` (string character count), a flawed proxy for "broadest thread."
- **Fix:** Changed to accept `MealThreadCandidate[]` objects (with `id`, `participants`, `is_shared`), filter to shared threads, and sort by `participants.length` descending. Matches the pattern used by `routeTravelThread()`.

### R-14 — Meals cross_topic_connections dropped Health

- **Identified:** step-23 review
- **Resolved:** same session
- **Description:** `MEALS_TOPIC_PROFILE` had `cross_topic_connections: [TopicKey.Grocery]`, dropping `TopicKey.Health` from the previous inline definition. Dietary notes connect meals to health awareness.
- **Fix:** Restored `TopicKey.Health` to the meals profile cross-topic connections. Same pattern as R-09 (Pets/Vendors).

### R-15 — XState machine ignored persisted escalation state

- **Identified:** step-27 review
- **Resolved:** same session
- **Description:** `buildMachine()` in `07-escalation-service/index.ts` created the XState machine with hardcoded `context: { current_step: 1 }`, ignoring the actual `ActiveEscalation.current_step`. This caused `advanceEscalation()` to always compute the next step from step 1, producing incorrect progression during `reconcileOnStartup()`.
- **Fix:** Added `initialContext` parameter to `buildMachine()`. `advanceEscalation()` now passes `{ current_step: active.current_step, responsible_entity: active.responsible_entity }` so the machine starts from the actual persisted state.

### R-16 — ConfirmationService interface missing reconcileOnStartup and close

- **Identified:** step-28 review
- **Resolved:** same session
- **Description:** `ConfirmationService` interface in `src/02-supporting-services/types.ts` was missing `reconcileOnStartup(now: Date)` and `close()` methods that `BullConfirmationService` implements. The `EscalationService` interface already includes `reconcileOnStartup`.
- **Fix:** Added `reconcileOnStartup(now: Date): Promise<ConfirmationRecoveryResult>` and `close(): Promise<void>` to the `ConfirmationService` interface. Added `ConfirmationRecoveryResult` to the import.

### R-17 — D-01: process.env double-read in server.ts

- **Identified:** step-00-part-3 review
- **Resolved:** step-29–32 review
- **Description:** `src/server.ts` passed raw `process.env` to `startImapListener()` instead of the validated env object. Steps 29-32 removed `startImapListener()` entirely and replaced it with `DataIngestService.startMonitoring()`, which receives IMAP credentials from the validated `AppEnv` object via constructor injection.
- **Fix:** IMAP startup now flows through `createDataIngestService()` with validated `env.IMAP_HOST`, `env.IMAP_USER`, `env.IMAP_PASSWORD` from `loadEnv()`. No raw `process.env` access remains.

### R-18 — TypeScript typecheck failure in worker test mock

- **Identified:** step-29–32 review
- **Resolved:** same session
- **Description:** `src/01-service-stack/05-worker/index.test.ts` line 188: `mockImplementation` passed a function returning `Promise<ThreadHistory | null>` but `vi.fn()` inferred the mock's return type as `Promise<ThreadHistory>` because `state.threads[threadId]` indexes a `Record<string, ThreadHistory>`.
- **Fix:** Added explicit return type annotation `Promise<ThreadHistory | null>` to the function passed to `vi.fn()` at the mock creation site.

### R-19 — Unnecessary unsafe cast in extractQueueItemId

- **Identified:** step-29–32 review
- **Resolved:** same session
- **Description:** `src/01-service-stack/05-worker/index.ts` cast `queueItem as Record<string, unknown>` to access `.id`, even though `StackQueueItem` now has `id?: string` added in the same change set.
- **Fix:** Replaced `(queueItem as Record<string, unknown>).id` with direct `queueItem.id` access.

### R-20 — `as TopicAction` cast in grocery action resolution

- **Identified:** step-29–32 review
- **Resolved:** same session
- **Description:** `src/01-service-stack/05-worker/index.ts` grocery branch used a ternary with spread and `as TopicAction` to construct either `remove_items` or `add_items`. The cast bypassed type safety.
- **Fix:** Split into two explicit `if`/`return` branches, each returning a properly typed object without any cast.

### R-21 — confirmationTypeForAction indexed systemConfig arrays by position

- **Identified:** step-29–32 review
- **Resolved:** same session
- **Description:** `confirmationTypeForAction()` used `systemConfig.confirmation_gates.always_require_approval[0]` and `[1]` to select confirmation types. Array reordering would silently break behavior.
- **Fix:** Replaced with direct `ConfirmationActionType.FinancialAction` and `ConfirmationActionType.SendingOnBehalf` enum references. Added `ConfirmationActionType` import.

### R-25 — A-14: index.ts entanglement with steps 21-23

- **Identified:** step-16–20 review
- **Resolved:** step-0–32 reassessment
- **Description:** Steps 16-20 refactored `index.ts` to import profiles from modules that were part of steps 21-23 (then pending). The concern was that steps 16-20 could not be committed independently.
- **Fix:** Steps 21-23 completed, all profiles now exist. The entanglement concern is moot.

### R-22 — D-07: HealthProfile.upcoming_appointments union type

- **Identified:** step-15 review
- **Resolved:** step-29–32 review (reassessment)
- **Description:** `upcoming_appointments: Array<string | HealthAppointment>` forced runtime type guards on every consumer. Audit confirmed no code or seed data uses plain strings — all usages are `HealthAppointment[]` or empty arrays.
- **Fix:** Changed type to `HealthAppointment[]` in `04.05-health/types.ts`.

### R-23 — D-10: Unsafe type casts in routing, budget, escalation, and state services

- **Identified:** step-24–27 review
- **Resolved:** step-29–32 review (reassessment)
- **Description:** Four services used `as` casts to access properties that now exist on the declared types. Steps 29-32 added `id?: string` and `priority?: DispatchPriority` to `StackQueueItem`, and `Entity` already declared `routes_to?: string[]`.
- **Fix:** Removed all four casts: routing service `petEntity` cast (line 36), budget service `queue_item` cast for `.priority` (line 200), escalation service `extractQueueItemId` cast (line 98), state service `extractQueueItemId` cast (line 122). All now use direct property access.

### R-24 — D-13: resolveRoutingDecision duck-typing cast

- **Identified:** step-29–32 review
- **Resolved:** same session (reassessment)
- **Description:** Worker cast `routingService` to `RoutingService & { resolveRoutingDecision?: ... }` to check for an optional method. The method already existed on `StaticRoutingService` but was not declared on the `RoutingService` interface.
- **Fix:** Added `resolveRoutingDecision(request: RoutingRequest): RoutingDecision` to the `RoutingService` interface. Removed the cast, the fallback path (~20 lines), and the unused `RoutingRule` runtime import from the Worker. Method changed from async to sync.

### R-26 — D-05: Scheduler fallback now derives from configuration

- **Identified:** step-03 review
- **Resolved:** step-42 review
- **Description:** `inferConcerningFromThread()` in scheduler defaulted shared/unknown threads to `["participant_1"]`.
- **Fix:** Replaced hardcoded fallback with thread-membership lookup from `runtimeSystemConfig.threads`, with a non-hardcoded entity fallback when the thread is unknown.

### R-27 — D-09: Shared enums moved to src/types

- **Identified:** step-24–27 review
- **Resolved:** step-42 review
- **Description:** Cross-boundary runtime enums (`EntityType`, `DispatchPriority`, `QueueItemSource`, `QueueItemType`) were owned by service-local modules and imported across boundaries.
- **Fix:** Moved enum ownership to `src/types.ts` and updated runtime consumers across stack/supporting services to import from the shared location.

### R-28 — D-14: Runtime modules no longer import `_seed/system-config.js` directly

- **Identified:** step-06 through step-29–32 reviews
- **Resolved:** step-42 review
- **Description:** Seven runtime modules imported configuration directly from `_seed/system-config.js`.
- **Fix:** Introduced `src/config/runtime-system-config.ts` as the single configuration bridge and migrated all seven previous direct imports to use the bridge.

### R-29 — Cross-service import contract test now handles multiline imports

- **Identified:** step-42 review
- **Resolved:** same session
- **Description:** `contract.test.ts` import scan used a single-line regex, missing multiline imports and under-reporting violations.
- **Fix:** Updated scanning to parse import statements with multiline support, while still excluding `import type` statements from runtime-boundary checks.

### R-30 — State Service runtime seed import removed

- **Identified:** step-43-part-1 review
- **Resolved:** same session
- **Description:** State Service imported `systemConfig` from `_seed/system-config.js` at runtime and used it in `createDefaultSystemConfig()` and three `loadSnapshot()` calls. This violated the seed-data rule and reintroduced the pattern that D-14 claimed to have resolved.
- **Fix:** Replaced `createDefaultSystemConfig()` with `createMinimalSystemConfig()` that returns a minimal valid config without importing seed. Updated `loadSnapshot()` to dynamically import seed config only when explicitly loading seed/scenario/empty snapshots during bootstrap.

### R-31 — Queue service unnecessary type cast removed

- **Identified:** step-43-part-1 review
- **Resolved:** same session
- **Description:** `extractQueueItemId()` in `src/01-service-stack/04-queue/index.ts` cast `item as Record<string, unknown>` to access `.id`, even though `StackQueueItem` has `id?: string`. This was previously resolved as R-19 but the cast remained.
- **Fix:** Replaced `(item as Record<string, unknown>).id` with direct `item.id` access.

### R-32 — Shared pino logger restored in Fastify instances

- **Identified:** step-43-part-1 review
- **Resolved:** same session
- **Description:** `src/server.ts` changed `Fastify({ logger })` to `Fastify({ logger: { name: 'fcc-server' } })` for both main and CalDAV servers, replacing the shared pino instance with Fastify-internal loggers. This reversed R-05 from step-07-10 review.
- **Fix:** Restored `Fastify({ logger })` for both instances to use the shared pino logger.
