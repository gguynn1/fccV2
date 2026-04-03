# Eval

This folder contains the current eval implementation. It is a local sequential runner, not a runtime service and not yet a full real-system eval framework.

## What Exists

- `cli.ts` is the entrypoint used by `npm run eval`, `npm run eval:run`, and `npm run eval:coverage`.
- `runners/sequential-runner.ts` runs one scenario at a time, persists JSON run state, appends structured logs, and writes the final markdown artifact.
- `scenarios/` contains the current scenario schema and the default scenario set.
- `tuner/diagnose.ts` decides whether a failure is prompt-fixable or needs investigation.
- `tuner/correct.ts` generates an embedded prompt suggestion for prompt-fixable failures.
- `reporting/write-run-artifacts.ts` writes `eval/results/<run-id>.json` and `eval/results/<run-id>.prompt.md`.

## Current Behavior

- Runs are sequential only.
- The runner uses simple deterministic inference plus seeded config from `src/_seed/system-config.ts`.
- The current statuses are `queued`, `running`, `passed`, `prompt_fix_suggested`, `investigation_needed`, `failed`, and `regressed`.
- `prompt_fix_suggested` means the tuner decided the failure was prompt-fixable and embedded a prompt suggestion in the run artifact.
- `investigation_needed` means the failure touches structural behavior like topic, routing, priority, or confirmation.

## UI Integration

- The backend does not import eval code into runtime services.
- `src/admin/eval-runs.ts` starts eval by spawning `npm run eval:run` and reads artifacts back from `eval/results/`.
- The UI polls those persisted artifacts through `/api/admin/eval/*`.

## Editing Guidance

- Treat `eval/results/` as generated output.
- Prefer changing scenario definitions, runner logic, tuner logic, or artifact generation instead of editing generated files.
- Do not describe this implementation as full pipeline eval unless the code actually runs the real pipeline.
