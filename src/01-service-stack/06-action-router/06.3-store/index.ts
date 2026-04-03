import { z } from "zod";

import type { StoreAction } from "../../types.js";

const storeActionSchema = z.object({
  decision: z.literal("store"),
  queue_item: z.object({
    target_thread: z.string().min(1),
    concerning: z.array(z.string().min(1)).min(1),
    created_at: z.date(),
  }),
  reason: z.string().min(1),
});

export type ValidatedStoreAction = StoreAction;

export function validateStoreAction(action: StoreAction): ValidatedStoreAction {
  storeActionSchema.parse(action);
  return action;
}
