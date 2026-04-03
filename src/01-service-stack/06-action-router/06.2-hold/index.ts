import { z } from "zod";

import type { HoldAction } from "../../types.js";

const holdActionSchema = z.object({
  decision: z.literal("hold"),
  queue_item: z.object({
    target_thread: z.string().min(1),
    concerning: z.array(z.string().min(1)).min(1),
    created_at: z.date(),
  }),
  hold_until: z.date(),
  reason: z.string().min(1),
});

export type ValidatedHoldAction = HoldAction;

export function validateHoldAction(action: HoldAction): ValidatedHoldAction {
  holdActionSchema.parse(action);
  return action;
}
