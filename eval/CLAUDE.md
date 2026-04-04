# Eval

This folder contains the current eval implementation. It is a local sequential runner, not a runtime service and not yet a full real-system eval framework.

## What Exists

- `cli.ts` is the entrypoint. Valid commands are `run`, `list`, and `generate-set`. Used by `npm run eval`, `npm run eval:run`, `npm run eval:run:worker`, `npm run eval:run:fixture`, `npm run eval:list`, and `npm run eval:generate-set`. The `watch` and `coverage` commands are not yet implemented and throw with a clear message.
- `runners/sequential-runner.ts` runs one scenario at a time, persists JSON run state, appends structured logs, and writes the final markdown artifact.
- `scenarios/` contains the current scenario schema and the default scenario set, including trust-focused cases for private health routing, scoped relationship behavior, and other thread-sensitive flows.
- `scenarios/SCENARIO_SETS.md` explains how to author realistic scenario sets and where generated scaffolds should live.
- `scenarios/generate-set.ts` creates UI-generated scaffolds in `eval/scenarios/generated/` with 18 templates per file covering all 14 topics plus 4 cross-domain variants. Each generation varies messages via a hash-based variant selector.
- `tuner/diagnose.ts` decides whether a failure is prompt-fixable or needs investigation.
- `tuner/correct.ts` generates an embedded prompt suggestion for prompt-fixable failures.
- `reporting/write-run-artifacts.ts` writes `eval/results/<run-id>.json` and `eval/results/<run-id>.prompt.md`. The `.prompt.md` includes a pasteable prompt with artifact file paths, the scenario source file, the re-run command, and reconciliation instructions. When all scenarios pass, the prompt shifts to coverage-expansion mode.

## Fidelity levels

Each run records a **fidelity** value on `EvalRunState` and surfaces it in JSON and markdown artifacts (for example a `Fidelity:` line in the prompt markdown). There are three levels:

| Fidelity        | Typical modes                      | What it approximates                                                        |
| --------------- | ---------------------------------- | --------------------------------------------------------------------------- |
| `simulation`    | `simulator`, `fixture-interpreter` | Fast, deterministic paths without live model classification.                |
| `worker-replay` | `worker` (default)                 | Worker pipeline with in-memory services and real persisted config behavior. |
| `high-fidelity` | `live-classifier`                  | Live Anthropic classification (and downstream behavior for that path).      |

Mode-to-fidelity mapping is defined in `runners/sequential-runner.ts` when constructing run state.

## Execution modes

- **`simulator`**: Deterministic keyword matching via `inferTopic()` for classification-style behavior; reads configuration from the persisted SQLite-backed state service.
- **`worker`** (CLI default): Worker replay harness over the real Worker orchestration, real routing service, real topic-profile service, and the active runtime config. Supporting services such as budget, escalation, confirmation, state, and transport are **in-memory replay doubles**, not the full production Redis/BullMQ/SQLite stack.
- **`fixture-interpreter`**: Deterministic interpreter fixtures for structured action expectations (`simulation.interpreter_fixture`).
- **`live-classifier`**: Live Anthropic API for classification (high-fidelity; non-deterministic).

Multi-turn scenarios use worker replay when `worker` or `fixture-interpreter` mode is active; otherwise they use the simulator path.

## Current Behavior

- Runs are sequential only.
- The current statuses are `queued`, `running`, `passed`, `prompt_fix_suggested`, `investigation_needed`, `failed`, and `regressed`.
- `prompt_fix_suggested` means the tuner decided the failure was prompt-fixable and embedded a prompt suggestion in the run artifact.
- `investigation_needed` means the failure touches structural behavior like topic, routing, priority, or confirmation.
- `failed` is assigned when every expected dimension has a failure (total miss).
- `regressed` is assigned when a previously-passing scenario now fails (requires prior run results for comparison).

### Current Gaps

- Worker replay is the default path but is still not equivalent to full production integration replay (e.g. full Redis/BullMQ stack).
- Fixture interpreter mode is deterministic by design and does not exercise live model variance.
- Worker replay uses in-memory doubles for budget, escalation, confirmation, and transport, so service-level timing and persistence behavior can still diverge from the live stack.

## UI Integration

- The backend does not import eval code into runtime services.
- `src/admin/eval-runs.ts` starts eval by spawning `npm run eval:run` and reads artifacts back from `eval/results/`.
- The UI polls those persisted artifacts through `/api/admin/eval/*`.

## Editing Guidance

- Treat `eval/results/` as generated output.
- Treat `eval/scenarios/generated/` as editable scaffolding, then register finished sets in `eval/scenarios/index.ts`.
- Prefer changing scenario definitions, runner logic, tuner logic, or artifact generation instead of editing generated files.
- When behavior depends on configured topic profiles, dispatch rules, confirmation gates, or input disambiguation, inspect `src/config/minimal-system-config.ts` and `src/config/runtime-system-config.ts`.
- Do not describe this implementation as full pipeline eval unless the code actually runs the real pipeline.
