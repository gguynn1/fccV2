# Eval

This folder contains the current eval implementation. It is a local sequential runner, not a runtime service and not yet a full real-system eval framework.

## What Exists

- `cli.ts` is the entrypoint used by `npm run eval`, `npm run eval:run`, and `npm run eval:coverage`.
- `runners/sequential-runner.ts` runs one scenario at a time, persists JSON run state, appends structured logs, and writes the final markdown artifact.
- `scenarios/` contains the current scenario schema and the default scenario set.
- `scenarios/SCENARIO_SETS.md` explains how to author realistic scenario sets and where generated scaffolds should live.
- `scenarios/generate-set.ts` creates UI-generated scaffolds in `eval/scenarios/generated/` with 10 scenarios covering Calendar, Grocery, Finances, Business, Vendors, School, Health, Meals, Chores, and Maintenance. Each generation varies messages via a hash-based variant selector.
- `tuner/diagnose.ts` decides whether a failure is prompt-fixable or needs investigation.
- `tuner/correct.ts` generates an embedded prompt suggestion for prompt-fixable failures.
- `reporting/write-run-artifacts.ts` writes `eval/results/<run-id>.json` and `eval/results/<run-id>.prompt.md`. The `.prompt.md` includes a pasteable prompt with artifact file paths, the scenario source file, the re-run command, and reconciliation instructions. When all scenarios pass, the prompt shifts to coverage-expansion mode.

## Current Behavior

- Runs are sequential only.
- The runner uses deterministic keyword matching in `inferTopic()` to classify messages into all 14 `TopicKey` values, and reads configuration from the persisted SQLite-backed state service.
- Fresh bootstrap defaults now live in `src/config/default-system-config.ts` and are assembled by `src/config/minimal-system-config.ts`. If an eval failure looks like a config/routing/tone mismatch, inspect those files before assuming the scenario is wrong.
- The current statuses are `queued`, `running`, `passed`, `prompt_fix_suggested`, `investigation_needed`, `failed`, and `regressed`.
- `prompt_fix_suggested` means the tuner decided the failure was prompt-fixable and embedded a prompt suggestion in the run artifact.
- `investigation_needed` means the failure touches structural behavior like topic, routing, priority, or confirmation.

## UI Integration

- The backend does not import eval code into runtime services.
- `src/admin/eval-runs.ts` starts eval by spawning `npm run eval:run` and reads artifacts back from `eval/results/`.
- The UI polls those persisted artifacts through `/api/admin/eval/*`.

## Editing Guidance

- Treat `eval/results/` as generated output.
- Treat `eval/scenarios/generated/` as editable scaffolding, then register finished sets in `eval/scenarios/index.ts`.
- Prefer changing scenario definitions, runner logic, tuner logic, or artifact generation instead of editing generated files.
- When behavior depends on configured topic profiles, dispatch rules, confirmation gates, or input disambiguation, inspect `src/config/default-system-config.ts`, `src/config/minimal-system-config.ts`, and `src/config/runtime-system-config.ts`.
- Do not describe this implementation as full pipeline eval unless the code actually runs the real pipeline.
