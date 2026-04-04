# Scenario Sets Guide

This guide explains how to create scenario sets for the eval runner, where they should live, and what makes a scenario valid for this application.

## Where Scenario Sets Live

- Runnable scenario sets are discovered from `eval/scenarios/default.ts` and `eval/scenarios/generated/*.ts`.
- Reusable scenario definitions live in `.ts` files under `eval/scenarios/`.
- UI-generated scaffolds are written to `eval/scenarios/generated/`.

Each generated scaffold uses **18 templates** covering **all 14 topics** plus **cross-domain variants**. Generated sets are **immediately runnable** once written (loader picks them up without manual registration beyond the generated export shape).

Recommended workflow:

1. Generate a scaffold from the Eval page.
2. Edit the generated file until the scenarios reflect real application behavior.
3. Run `npm run eval:run` against the new set.

## Scenario Classes

Not every scenario shape is equally valid under every eval fidelity.

- **Worker-replay-safe single-turn scenarios**:
  good for routing, priority, confirmation gates, private-vs-shared thread truth, and current state-backed copy
- **Simulator-safe multi-turn scenarios**:
  good for pronoun carry-forward, corrections, and dialogue continuity when the test depends on transcript state more than persisted runtime state
- **Worker-replay-safe multi-turn scenarios**:
  only appropriate when the harness preserves enough context and when the expectation is really about the participant turns, not scripted assistant reminders
- **State-primed system-triggered scenarios**:
  use when the thing you are proving is scheduler-, ingest-, or state-driven rather than just a participant message
- **Negative safety/privacy scenarios**:
  use to prove what the system must not do, such as leaking private topics into disallowed threads

## What A Valid Scenario Looks Like

Every scenario should describe something that could realistically happen in this application.

Use real application vocabulary:

- Entities: `participant_1`, `participant_2`, `participant_3`
- Threads: `family`, `couple`, `participant_1_private`, `participant_2_private`, `participant_3_private`
- Topics: values from `TopicKey`
- Intents: values from `ClassifierIntent`
- Priorities: values from `DispatchPriority`

Good scenarios are:

- plausible phone-native messages a participant would actually send
- routed to threads that exist in the persisted system configuration
- aligned with topic boundaries already defined in the bootstrap defaults under `src/config/minimal-system-config.ts` and the persisted runtime config
- written with expectations that match the app's actual rules
- explicit about which harness fidelity they are safe under

Bad scenarios are:

- impossible thread/entity combinations
- made-up topics or thread IDs
- messages that do not resemble how a person would actually ask
- expectations that contradict the configured routing, confirmation, or priority behavior

## Authoring Checklist

Before adding a scenario set, verify:

- The `prompt_input.origin_thread` is a real thread from persisted config.
- The `prompt_input.concerning` entities are real persisted entities.
- Any expectation based on topic behavior, routing, confirmation, priority, or disambiguation matches the config defaults in `src/config/minimal-system-config.ts` plus any persisted overrides.
- The message is realistic for the topic.
- The expected topic and intent are defensible under the configured disambiguation rules.
- The expected target thread is one the application would actually choose.
- The expected priority makes sense for the scenario.
- `confirmation_required` is true only when the action should require approval.
- `tone_markers` and `format_markers` are observable in output text, not abstract ideas.
- When using `simulation.interpreter_fixture`, keep `action_type` valid for the fixture topic.
- Use `simulation.parity_assertion` to enforce worker-vs-simulator parity on critical fields.
- If this is multi-turn, ask whether later participant turns depend on preserved conversation context.
- If this is multi-turn worker replay, verify that you are asserting the primary outbound, not an auxiliary follow-up-thread notice.
- If the scenario assumes a scheduled reminder, digest, or passive ingest event, seed the relevant state or classify it as a system-triggered scenario instead of hardcoding assistant transcript turns.
- Prefer negative cases that prove privacy, denial, stale suppression, quiet-hour behavior, or governor restraint when those are the real product risk.

## File Shape

Scenario files export an `EvalScenarioDefinition[]`.

Typical pattern (worker-safe single-turn):

```ts
import { ClassifierIntent, DispatchPriority, TopicKey } from "../../src/index.js";
import type { EvalScenarioDefinition } from "../types.js";

export const myScenarioSetName = "my-scenario-set";

export const myScenarios: EvalScenarioDefinition[] = [
  {
    id: "calendar-query-example",
    title: "Calendar query stays in the family thread",
    category: "classification",
    prompt_input: {
      message: "What's on the calendar Thursday?",
      concerning: ["participant_1", "participant_2"],
      origin_thread: "family",
    },
    expected: {
      topic: TopicKey.Calendar,
      intent: ClassifierIntent.Query,
      target_thread: "family",
      priority: DispatchPriority.Immediate,
      confirmation_required: false,
      tone_markers: ["schedule", "Thursday"],
      format_markers: ["summary"],
    },
  },
];
```

For a smoke suite, add a comment explaining scope explicitly, for example: “small worker-replay smoke set, not full topic coverage.”

## Making A Set Runnable

Generated scaffolds are automatically runnable as soon as they exist in `eval/scenarios/generated/` and export:

- `<baseName>Name` as the scenario set name
- `<baseName>Scenarios` as `EvalScenarioDefinition[]`

The eval loader scans every generated `.ts` file and adds discovered sets to the CLI and Eval page.

## What The UI Generator Does

The Eval page's `Generate Scenario Set` action creates a scaffold in `eval/scenarios/generated/`.

That scaffold:

- uses valid persisted entities and threads when available
- uses realistic application messages
- follows the `EvalScenarioDefinition` shape
- is meant to be edited and then run directly (no manual registration)

It is a starting point, not an automatically trusted scenario suite. Generated files are broad happy-path scaffolds; they do not replace curated worker-safe, simulator-safe, or state-primed scenario design.
