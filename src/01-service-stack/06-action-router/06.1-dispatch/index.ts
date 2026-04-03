import { z } from "zod";

import type { DispatchAction } from "../../types.js";
import { DispatchPriority } from "../types.js";

const outboundSchema = z.object({
  target_thread: z.string().min(1),
  content: z.string().min(1),
  priority: z.nativeEnum(DispatchPriority),
  concerning: z.array(z.string().min(1)).min(1),
});

const dispatchActionSchema = z.object({
  decision: z.literal("dispatch"),
  outbound: outboundSchema,
});

export type ValidatedDispatchAction = DispatchAction;

export function validateDispatchAction(action: DispatchAction): ValidatedDispatchAction {
  dispatchActionSchema.parse(action);
  return action;
}
