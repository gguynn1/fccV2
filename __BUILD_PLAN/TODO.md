# TODO

This file is the single source of truth for remaining work. Historical `step-*.md` plan files were consolidated and removed.

## Current State

Completed:

- Core runtime and infrastructure
- Queue, scheduler, transport, CalDAV, classifier, and topic profiles
- Supporting services, worker pipeline, and action router
- Admin UI and connections documentation

Remaining work is limited to the items below.

## TODO-01 — Build Eval And Auto-Tuning Framework

**Status:** pending

**Goal:** create an `eval/` development and operations framework that exercises the real system, scores outputs, reports coverage and risk, and generates candidate prompt corrections without modifying `src/`.

### Deliverables

- `eval/vitest.config.ts`
  - 60s timeout
  - sequential execution
  - real API key required
  - custom reporter with score summary per topic and worker step
- `eval/scenarios/`
  - scenario definitions grouped by category
  - `schema.ts` for single-turn and multi-step scenario types
- `eval/runners/`
  - single-step runner
  - full pipeline runner
  - multi-step runner with simulated time and accumulated state
- `eval/scorers/`
  - deterministic scorer for exact behavioral assertions
  - qualitative scorer for tone, format, and helpfulness
- `eval/tuner/`
  - diagnose failing step
  - generate candidate correction
  - verify failed set plus regression set with max retry depth of 2
- `eval/coverage/`
  - topic x step coverage
  - probe-family coverage
  - gap reporting that blocks promotion when coverage is missing
- `eval/probes/`
  - probe family definitions
  - risk scoring
  - promotion gate checks
- `eval/prompts/current/`
- `eval/prompts/candidates/`
- `eval/reports/` (gitignored)
- `eval/README.md`
- `package.json` scripts:
  - `npm run eval`
  - `npm run eval:run`
  - `npm run eval:coverage`

### Scenario Coverage

Implement scenarios for:

- classification
- action resolution and clarification triggers
- routing
- composition
- escalation
- confirmation
- cross-topic side effects
- multi-turn flows
- budget and collision policy
- digest inclusion logic
- recovery and downtime reconciliation
- topic context transitions
- confirmation threading rules
- conflicting sequential inputs
- observability
- negative behavior

Required coverage:

- every `TopicKey` has classification, routing, composition, escalation-profile, and negative coverage
- every topic and intent disambiguation rule has targeted scenarios
- every cross-topic connection is exercised
- every escalation profile has at least one full multi-step walkthrough
- every confirmation gate type covers approval, rejection, and expiry
- every worker step is tested both in isolation and in full-pipeline runs
- every probe family has at least one scenario

### Probe And Promotion Model

Implement probe-family metrics and promotion gates:

- families include permissions, thread leakage, context drift, cross-topic side-effect safety, confirmation edge cases, race conditions, digest correctness, escalation reassignment, schema evolution resilience, observability/auditability, idempotency, outage recovery, and collision policy
- compute `FRI`, `FCI`, and `OPH`
- write a JSON probe summary artifact to `eval/reports/`
- promotion gates must enforce:
  - `OPH >= 92`
  - no family `FRI > 1.0`
  - critical families require deterministic pass rate of `1.0`
  - negative scenarios must pass at `100%`

### Cost And Execution Constraints

- use the cheapest capable model for scoring and judging
- keep production-model calls only where they are actually needed
- cache deterministic inputs
- support incremental reruns after prompt changes
- enforce a per-run budget ceiling
- no eval code may modify `src/`

### Setup Gate

Do not treat this item as complete until all of the following are true:

- [ ] `ANTHROPIC_API_KEY` is present and has enough quota for a full run
- [ ] scenario fixtures compile against `src/` types
- [ ] scoring and judging use the cheapest capable model
- [ ] deterministic-input caching is enabled
- [ ] incremental rerun mode works
- [ ] `eval/reports/` is ignored by git
- [ ] probe family definitions load with initial weights
- [ ] promotion thresholds are configured

### Acceptance Criteria

- [ ] eval suite runs against the real system
- [ ] deterministic and qualitative scoring both work
- [ ] tuner can diagnose failures and generate candidate corrections
- [ ] coverage matrix reports gaps and blocks under-covered promotions
- [ ] probe quantification computes `FRI`, `FCI`, and `OPH`
- [ ] probe summary artifact is written to `eval/reports/`
- [ ] promotion gates are enforced
- [ ] candidates are written to `eval/prompts/candidates/`
- [ ] eval code does not modify runtime source

## TODO-02 — Close Active Deferred Issues

**Status:** pending

Resolve the open items tracked in `__BUILD_PLAN/DEFERRED.md`:

- D-01 per-topic runtime state validation
- D-02 admin API config validation hardening
- D-03 meal-to-grocery extraction placeholder
- D-04 unused CalDAV type definitions
- D-05 CalDAV `ctag` derivation
- D-06 confirmation request typing cleanup

Done means the related code is fixed and each item is removed from `DEFERRED.md`.

## TODO-03 — Complete Manual And External Verification

**Status:** pending

### Infrastructure And Credentials

- [ ] Twilio verification is approved
- [ ] `.env` contains real IMAP credentials and live inbox verification is complete
- [ ] ngrok static domain is configured and confirmed
- [ ] launchd services are loaded and running
- [ ] crash restart behavior is confirmed
- [ ] reboot auto-start behavior is confirmed
- [ ] power and login settings required by the hosting model are confirmed
- [ ] SQLite backup job is scheduled and Redis AOF files are included in backup scope

### Runtime Verification

- [ ] inbound transport webhook flow is verified against the live provider
- [ ] outbound transport status callback flow is verified
- [ ] invalid webhook signatures are rejected
- [ ] IMAP reconnect behavior is verified after disconnect, sleep/wake, and provider timeout
- [ ] stale time-sensitive email is stored silently instead of dispatched late
- [ ] CalDAV `PROPFIND`, `REPORT`, and `GET` smoke tests pass
- [ ] local-network calendar subscription renders expected events

### Admin UI Verification

- [ ] `/admin` is served correctly after UI build
- [ ] forwarded-header requests to `/admin` and `/api/admin/*` are rejected
- [ ] all admin pages work against the running backend
- [ ] top navigation active state is correct across routes

## Working Rules

- Keep `__BUILD_PLAN/PROGRESS.json` lightweight and current-state only.
- Keep `__BUILD_PLAN/DEFERRED.md` limited to unresolved technical debt.
- Do not recreate step files or per-step audit history unless explicitly requested.
