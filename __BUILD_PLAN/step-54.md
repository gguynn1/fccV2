# Step 54 — Eval & Auto-Tuning Framework

> Source: eval/notes.txt

## What to Build

- **`eval/` directory structure** (outside `src/` — development/ops tool, not runtime):
  - `eval/vitest.config.ts` — separate Vitest config: 60s timeout, sequential execution (`pool: 'forks'`, `singleFork: true`), real API key required, custom reporter outputting score summary per topic/step with pass/fail/regression counts
  - `eval/scenarios/` — scenario definitions by category: classification, routing, composition, escalation, confirmation, cross-topic, multi-turn, budget, recovery, negative, pipeline
  - `eval/scenarios/schema.ts` — `EvalScenario` and `MultiStepScenario` TypeScript types (imports `TopicKey`, `ClassifierIntent`, `DispatchPriority`, `EscalationLevel`, `SystemState` from `src/`). Trigger includes `state_overrides?: Partial<SystemState>` for injecting specific state without modifying the base snapshot.
  - `eval/runners/` — `step.runner.ts` (single worker step), `pipeline.runner.ts` (full single-turn through all 8 steps), `multistep.runner.ts` (multi-step with simulated clock, state accumulation across steps, multi-participant sequencing, silence/reaction handling)
  - `eval/scorers/` — `deterministic.ts` (exact match: topic, intent, thread, priority, entities, confirmation, cross-topic side effects, must_not assertions), `qualitative.ts` (LLM-as-judge: tone, format, helpfulness scored 1–5 against topic profile CLAUDE.md, threshold ≥4 pass / 3 warning / ≤2 fail)
  - `eval/tuner/` — `diagnose.ts` (identify failing step by running steps in isolation), `correct.ts` (generate improved prompt/config with regression context), `verify.ts` (re-run failed + full regression, max 2 retry depth)
  - `eval/coverage/` — `matrix.ts` (per-topic × per-step coverage AND per-probe-family coverage), `gaps.ts` (untested combinations — blocks promotion of untested behavior)
  - `eval/probes/` — `families.ts` (probe family definitions with severity, blast_radius, detectability_penalty), `scoring.ts` (FRI/FCI/OPH computation), `gates.ts` (promotion eligibility checks)
  - `eval/prompts/` — `current/` (active prompts) and `candidates/` (corrections awaiting promotion)
  - `eval/reports/` (gitignored) — generated eval results including probe summary artifact
  - `eval/README.md` — how to run evals, interpret results, promote candidates

- **Scenario categories to implement:**
  - **Classification:** 14 topics × multiple inputs; topic disambiguation edge cases (meals vs grocery, maintenance vs vendors, maintenance vs chores, business vs vendors); **intent disambiguation** edge cases (cancellation vs completion, request vs update, cancellation vs update, query vs request)
  - **Action resolution:** typed action payload correctness — reschedule produces `event_id`, cancel requires `event_id`, expense log requires amount; **clarification triggers** — ambiguous reference (two events at 3pm), ambiguous intent (cancel vs complete), missing required field (reschedule with no target time), multiple matches
  - **Routing:** private vs shared, business owner-scoped, escalation thread widening, proactive narrowest-thread
  - **Composition:** per-topic voice, business_type adaptation, relationship non-clinical; negative (finances never in child thread)
  - **Escalation:** all four profiles × topic coverage; multi-step with thread widening; timed intervals
  - **Confirmation:** three gate types with approval, rejection, expiry flows, reaction handling
  - **Cross-topic:** meals→grocery; maintenance→vendors/finances/calendar; health→calendar; pets→calendar; business→finances/calendar; travel→calendar/pets/finances/grocery; **cross-topic retry idempotency** (retrying a Meals item must not produce duplicate Grocery items — deterministic idempotency key deduplicates)
  - **Multi-turn:** chore escalation chain, business lead pipeline, concurrent family coordination, confirmation expiry, **clarification round-trip** (ambiguous → clarification → response → resolved action), **escalation under reassignment** (chore reassigned mid-escalation — HIGH resets, MEDIUM transfers, LOW cancels)
  - **Budget:** outbound limits, thread rate limiting, batching, **collision precedence** (SafetyAndHealth > TimeSensitiveDeadline > ActiveConversation > ScheduledReminder > ProactiveOutbound), same-precedence batching strategy
  - **Digest:** **inclusion algorithm** (exclude already-dispatched, exclude stale beyond threshold, suppress repeats from previous digest, include unresolved from yesterday), digest correctness end-to-end
  - **Recovery:** stale items, expired confirmations, escalation reconciliation, budget reconstruction, **conflicting queued items** (cancel + reminder during downtime — cancel takes precedence, reminder suppressed), **idempotency** deduplication during startup backlog processing
  - **Context:** **topic context transition** (classifier correctly switches `active_topic_context` on new topic, resets after idle, handles explicit switch signals), no stale context drift across topic boundaries
  - **Confirmation threading:** approval from correct thread accepted; **approval from wrong thread rejected**; late reaction after expiry logged but not executed
  - **Conflict resolution:** near-simultaneous conflicting inputs (reschedule + cancel same event) — sequential processing provides total ordering, second item sees state from first
  - **Observability:** `ProcessingTrace` captures all 8 steps with input/output summaries and durations for every processed item
  - **Negative:** no financial data in child thread; no expired confirmation auto-execute; no stale dispatch; no low-accountability escalation; no budget overage; **no duplicate event creation from reschedule**; no action without clarification when reference is ambiguous; **no thread leakage** (simultaneous same-topic activity across threads cannot leak context); **no stale escalation targeting** after reassignment

- **Coverage matrix requirements:**
  - Every TopicKey: at least one classification, routing, composition, escalation profile, and negative scenario
  - Every disambiguation rule (topic AND intent): at least 4 scenarios (2 per side) + 1 context-dependent
  - Every cross_topic_connection: at least one scenario exercising the side-effect
  - Every escalation profile (high/medium/low/none): at least one multi-step scenario walking the full escalation sequence including silence and participant handoff
  - Every confirmation gate type: multi-step scenario covering approval, rejection, and expiry
  - Every worker step (1–8): tested in isolation AND as part of full pipeline runs
  - Probe-family coverage: every probe family must have at least one scenario tagged to it

- **Probe Quantification Layer** — risk-weighted scoring on top of pass/fail:
  - 13 probe families: permissions, thread_leakage, context_drift, cross_topic_side_effect_safety, confirmation_edge_cases, race_conditions, digest_correctness, escalation_reassignment, schema_evolution_resilience, observability_auditability, idempotency, outage_recovery, collision_policy
  - Each family has: `severity` (1–5), `blast_radius` (1–5), `detectability_penalty` (1–3), `scenario_ids`
  - Per-family metrics: `pass_rate` (0..1), `deterministic_pass_rate` (subset requiring exact checks), `regression_stability` (0..1 after full rerun)
  - Scoring: `FRI = (1 - pass_rate) * severity * blast_radius * detectability_penalty`, `FCI = pass_rate * regression_stability`, `OPH = 100 * (1 - total_risk / max_risk)`
  - **Promotion gates:** OPH ≥ 92, no family FRI > 1.0, critical families (idempotency, outage_recovery, thread_leakage, permissions, confirmation_edge_cases) require `deterministic_pass_rate == 1.0` and `regression_stability >= 0.98`, negative scenarios 100% pass
  - Each eval run writes a probe summary artifact (JSON: overall_probe_health, total_risk, max_risk, per-family metrics, blockers list)

- **Scenario generator** — combines random TopicKey + trigger type + participant set + complication (no response, conflicting events, multi-step, ambiguous input, cross-topic side effect, downtime recovery). Generated scenarios include expected outputs derived from topic config + routing rules + escalation profile. Human reviews before scenarios enter the suite.

- **Auto-correction loop** with depth limit (max 2 retry attempts)
- **Cost management:** cheapest model for scoring, caching deterministic inputs, incremental runs (only re-run scenarios affected by a prompt change)

### Eval Cost Estimate

A full suite of ~200 single-turn + ~30 multi-step scenarios produces ~600–900 Claude API calls per run. Approximate cost per full run:

| Model for scoring/judging | Cost per run (approx.) |
| ------------------------- | ---------------------- |
| Claude Haiku (cheapest)   | $2–5                   |
| Claude Sonnet             | $15–30                 |
| Claude Opus               | $50–100                |

**Recommendation:** Use the cheapest capable model (Haiku) for deterministic scoring and qualitative judging. Use the production model (Sonnet or Opus) only for the actual pipeline calls that generate the outputs being scored. Cache deterministic inputs to avoid redundant calls. Set a per-run budget ceiling in the eval config and abort with a warning if exceeded.

- **Package.json scripts** (owned by this step — Step 0 Part 1 defers eval script creation here):
  - `"eval": "vitest --config eval/vitest.config.ts"`
  - `"eval:run": "vitest run --config eval/vitest.config.ts"`
  - `"eval:coverage": "vitest run --config eval/vitest.config.ts -- coverage"`

## Dependencies

All implementation steps (0–53) should be complete so the eval framework can exercise the full system.

## Technologies

Vitest (separate config), Anthropic Claude API for scoring and correction, TypeScript types imported from `src/`.

## Files to Create/Modify

Full `eval/` directory tree as outlined above (including `eval/probes/` for probe family definitions, scoring, and promotion gates); `package.json` scripts.

## Setup Gate — Eval Readiness

Before running the eval suite, the following must be verified:

- [ ] `ANTHROPIC_API_KEY` is set and has sufficient quota for ~600-900 API calls per full run
- [ ] All scenario fixture files are loaded and compile against `src/` types
- [ ] Cost guardrails configured: cheapest capable model selected for scoring/judging calls, caching enabled for deterministic inputs
- [ ] Incremental run mode works (only re-runs scenarios affected by a prompt change)
- [ ] `eval/reports/` is in `.gitignore`
- [ ] Probe family definitions loaded with initial severity/blast_radius/detectability_penalty weights
- [ ] Promotion gate thresholds configured (OPH ≥ 92, FRI ceiling, critical family requirements)

## Acceptance Criteria

- Eval suite runs against the real system
- Deterministic and qualitative scoring works
- Tuner diagnoses failing steps and generates candidate corrections
- Coverage matrix reports gaps (topic × step AND probe-family coverage)
- Coverage matrix blocks promotion when a new TopicKey or enum value lacks corresponding scenarios
- Probe quantification layer computes FRI/FCI/OPH per run
- Probe summary artifact (JSON) is written to `eval/reports/`
- Promotion gates enforce: OPH threshold, FRI ceiling, critical-family pass rates, negative 100%
- Candidates generate and await promotion in `eval/prompts/candidates/`
- No eval code modifies `src/`

---
