# Scenario Sets Guide

This guide explains how to create scenario sets for the eval runner, where they should live, and what makes a scenario valid for this application.

## Where Scenario Sets Live

- Runnable scenario sets are discovered from `eval/scenarios/default.ts` and `eval/scenarios/generated/*.ts`.
- Reusable scenario definitions live in `.ts` files under `eval/scenarios/`.
- UI-generated scaffolds are written to `eval/scenarios/generated/`.

Recommended workflow:

1. Generate a scaffold from the Eval page.
2. Edit the generated file until the scenarios reflect real application behavior.
3. Run `npm run eval:run` against the new set.

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
- aligned with topic boundaries already defined in the bootstrap defaults under `src/config/default-system-config.ts` and the persisted runtime config
- written with expectations that match the app's actual rules

Bad scenarios are:

- impossible thread/entity combinations
- made-up topics or thread IDs
- messages that do not resemble how a person would actually ask
- expectations that contradict the configured routing, confirmation, or priority behavior

## Authoring Checklist

Before adding a scenario set, verify:

- The `prompt_input.origin_thread` is a real thread from persisted config.
- The `prompt_input.concerning` entities are real persisted entities.
- Any expectation based on topic behavior, routing, confirmation, priority, or disambiguation matches the config defaults in `src/config/default-system-config.ts` plus any persisted overrides.
- The message is realistic for the topic.
- The expected topic and intent are defensible under the configured disambiguation rules.
- The expected target thread is one the application would actually choose.
- The expected priority makes sense for the scenario.
- `confirmation_required` is true only when the action should require approval.
- `tone_markers` and `format_markers` are observable in output text, not abstract ideas.
- When using `simulation.interpreter_fixture`, keep `action_type` valid for the fixture topic.
- Use `simulation.parity_assertion` to enforce worker-vs-simulator parity on critical fields.

## File Shape

Scenario files export an `EvalScenarioDefinition[]`.

Typical pattern:

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

It is a starting point, not an automatically trusted scenario suite.
