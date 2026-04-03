# Step 54 — Eval & Auto-Tuning Framework

> Source: eval/notes.txt

## What to Build

- **`eval/` directory structure** (outside `src/` — development/ops tool, not runtime):
  - `eval/vitest.config.ts` — separate Vitest config: 60s timeout, sequential execution, real API key required
  - `eval/scenarios/` — scenario definitions by category: classification, routing, composition, escalation, confirmation, cross-topic, multi-turn, budget, recovery, negative, pipeline
  - `eval/scenarios/schema.ts` — `EvalScenario` and `MultiStepScenario` TypeScript types
  - `eval/runners/` — `step.runner.ts` (single worker step), `pipeline.runner.ts` (full single-turn), `multistep.runner.ts` (multi-step with simulated clock)
  - `eval/scorers/` — `deterministic.ts` (exact match: topic, thread, priority, entities, confirmation), `qualitative.ts` (LLM-as-judge: tone, format, helpfulness scored 1–5)
  - `eval/tuner/` — `diagnose.ts` (identify failing step), `correct.ts` (generate improved prompt), `verify.ts` (re-run + regression)
  - `eval/coverage/` — `matrix.ts` (per-topic × per-step coverage), `gaps.ts` (untested combinations)
  - `eval/prompts/` — `current/` (active prompts) and `candidates/` (corrections awaiting promotion)
  - `eval/reports/` (gitignored) — generated eval results
  - `eval/README.md` — how to run evals, interpret results, promote candidates

- **Scenario categories to implement:**
  - **Classification:** 14 topics × multiple inputs; disambiguation edge cases (meals vs grocery, maintenance vs vendors, maintenance vs chores, business vs vendors)
  - **Routing:** private vs shared, business owner-scoped, escalation thread widening, proactive narrowest-thread
  - **Composition:** per-topic voice, business_type adaptation, relationship non-clinical; negative (finances never in child thread)
  - **Escalation:** all four profiles × topic coverage; multi-step with thread widening; timed intervals
  - **Confirmation:** three gate types with approval, rejection, expiry flows, reaction handling
  - **Cross-topic:** meals→grocery; maintenance→vendors/finances/calendar; health→calendar; pets→calendar; business→finances/calendar; travel→calendar/pets/finances/grocery
  - **Multi-turn:** chore escalation chain, business lead pipeline, concurrent family coordination, confirmation expiry
  - **Budget:** outbound limits, thread rate limiting, batching, collision avoidance
  - **Recovery:** stale items, expired confirmations, escalation reconciliation, budget reconstruction
  - **Negative:** no financial data in child thread; no expired confirmation auto-execute; no stale dispatch; no low-accountability escalation; no budget overage

- **Coverage matrix:** every TopicKey, every disambiguation rule, every escalation profile, every cross-topic connection, every confirmation gate type must have scenarios
- **Auto-correction loop** with depth limit (max 2 retry attempts)
- **Cost management:** cheapest model for scoring, caching deterministic inputs, incremental runs

- **Package.json scripts:** `eval`, `eval:run`, `eval:coverage`

## Dependencies

All implementation steps (0–53) should be complete so the eval framework can exercise the full system.

## Technologies

Vitest (separate config), Anthropic Claude API for scoring and correction, TypeScript types imported from `src/`.

## Files to Create/Modify

Full `eval/` directory tree as outlined above; `package.json` scripts.

## Setup Gate — Eval Readiness

Before running the eval suite, the following must be verified:

- [ ] `ANTHROPIC_API_KEY` is set and has sufficient quota for ~600-900 API calls per full run
- [ ] All scenario fixture files are loaded and compile against `src/` types
- [ ] Cost guardrails configured: cheapest capable model selected for scoring/judging calls, caching enabled for deterministic inputs
- [ ] Incremental run mode works (only re-runs scenarios affected by a prompt change)
- [ ] `eval/reports/` is in `.gitignore`

## Acceptance Criteria

- Eval suite runs against the real system
- Deterministic and qualitative scoring works
- Tuner diagnoses failing steps
- Coverage matrix reports gaps
- Candidates generate and await promotion
- No eval code modifies `src/`

---
