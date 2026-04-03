import { z } from "zod";

export const evalScenarioCategorySchema = z.enum([
  "classification",
  "routing",
  "composition",
  "confirmation",
  "pipeline",
]);

export const evalScenarioPromptInputSchema = z.object({
  message: z.string().min(1),
  concerning: z.array(z.string().min(1)).min(1),
  origin_thread: z.string().min(1),
});

export const evalScenarioExpectationSchema = z.object({
  topic: z.string().min(1),
  intent: z.string().min(1),
  target_thread: z.string().min(1),
  priority: z.string().min(1),
  confirmation_required: z.boolean(),
  tone_markers: z.array(z.string().min(1)).optional(),
  format_markers: z.array(z.string().min(1)).optional(),
  must_not: z.array(z.string().min(1)).optional(),
});

export const evalScenarioSimulationSchema = z.object({
  actual_overrides: z.record(z.string(), z.unknown()).optional(),
  tuning_scope: z.enum(["prompt", "structural"]).optional(),
});

export const evalScenarioDefinitionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  category: evalScenarioCategorySchema,
  prompt_input: evalScenarioPromptInputSchema,
  expected: evalScenarioExpectationSchema,
  notes: z.string().min(1).optional(),
  simulation: evalScenarioSimulationSchema.optional(),
});
