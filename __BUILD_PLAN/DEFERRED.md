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
- **Resolve at:** step-24+ (Worker integration, where topic state is read/written and per-topic schemas become actionable)
- **Action:** Replace the generic `topicRecordSchema` with per-topic Zod schemas. Profile steps (10–23) correctly defined TypeScript interfaces but not runtime validation. The Worker integration layer or State Service enhancement is the right place to add Zod schemas that validate topic state on read/write.

### D-05 — Scheduler hardcodes participant_1 fallback

- **Identified:** step-05 review
- **Severity:** Low
- **Description:** `BullSchedulerService.inferConcerningFromThread()` returns `["participant_1"]` as a hardcoded fallback when the thread ID doesn't match the `_private` suffix pattern. This is a silent assumption that produces wrong results for shared threads.
- **Resolve at:** step where real digest routing is built (depends on Routing Service integration)
- **Action:** Replace with a thread-membership lookup from the identity/routing service to determine which entities belong to the target thread.

### D-06 — Transport layer imports seed config at runtime

- **Identified:** step-07–10 review
- **Severity:** Medium
- **Description:** `src/01-service-stack/01-transport-layer/index.ts` imports `seedSystemConfig` from `../../_seed/system-config.js` and uses it in `initializeThreadParticipantMaps()` and `resolveParticipantsForThread()`. The seed-data rule says the running application reads from the database, never from seed files. Same anti-pattern as D-03.
- **Resolve at:** Worker wiring step (alongside D-03)
- **Action:** Accept entity/thread configuration via constructor injection from the State Service or system configuration loaded at boot. Remove the seed import.

### D-07 — HealthProfile.upcoming_appointments union type

- **Identified:** step-15 review
- **Severity:** Medium
- **Description:** `src/02-supporting-services/04-topic-profile-service/04.05-health/types.ts` defines `upcoming_appointments: Array<string | HealthAppointment>`. The union type forces every consumer to use runtime type guards before accessing appointment fields, propagating type unsafety to the Worker, composition logic, and state validation.
- **Resolve at:** step-24+ (health Worker integration, when health state is read/written)
- **Action:** Migrate to `HealthAppointment[]` as the single type. Update any seed data that uses plain strings to use `HealthAppointment` objects.

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

### A-14 — index.ts changes entangled with steps 21-23

- **Identified:** step-16–20 review
- **Severity:** Medium
- **Description:** The `index.ts` refactoring replaces all 8 inline profile definitions (topics 04.06–04.13) with imports from dedicated profile.ts modules. Topics 04.11-relationship, 04.12-family-status, and 04.13-meals are steps 21–23 (pending in PROGRESS.json). Steps 16–20 cannot be committed independently.
- **Decision:** Accepted — the profiles will be reviewed when steps 21–23 come up. The code compiles correctly as a whole.

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

### A-19 — suggestGroceryItemsFromMealDescription is a hardcoded placeholder

- **Identified:** step-23 review
- **Severity:** Low
- **Description:** `suggestGroceryItemsFromMealDescription()` in meals/profile.ts only handles "taco" and "pasta" keywords. The step spec says Claude API should interpret meal ideas and suggest grocery items.
- **Decision:** Accepted — placeholder fallback pattern. Real meal-to-grocery mapping will use Claude at Worker integration.

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
