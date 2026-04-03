import { pino, type Logger } from "pino";

import { ClassifierIntent, QueueItemSource, TopicKey } from "../../types.js";
import type {
  ActionRouterContract,
  ActionRouterResult,
  CollisionPolicy,
  DispatchAction,
  HoldAction,
  StoreAction,
  WorkerDecision,
} from "../types.js";
import { SamePrecedenceStrategy } from "../types.js";
import { validateDispatchAction } from "./06.1-dispatch/index.js";
import { validateHoldAction } from "./06.2-hold/index.js";
import { validateStoreAction } from "./06.3-store/index.js";
import { CollisionPrecedence, DispatchPriority } from "./types.js";

const DEFAULT_LOGGER = pino({ name: "action-router" });
const DEFAULT_HOLD_WINDOW_MINUTES = 30;

export interface ActionRouterOptions {
  logger?: Logger;
  default_hold_window_minutes?: number;
}

export class ActionRouter implements ActionRouterContract {
  private readonly logger: Logger;

  private readonly defaultHoldWindowMinutes: number;

  public constructor(options: ActionRouterOptions = {}) {
    this.logger = options.logger ?? DEFAULT_LOGGER;
    this.defaultHoldWindowMinutes =
      options.default_hold_window_minutes ?? DEFAULT_HOLD_WINDOW_MINUTES;
  }

  public route(
    decision: WorkerDecision,
    collision_policy: CollisionPolicy,
  ): Promise<ActionRouterResult> {
    const action = decision.action;
    if (action.decision !== "dispatch") {
      return Promise.resolve(this.validateAndLog(action, decision));
    }

    const precedence = this.resolvePrecedence(decision);
    const topPrecedence = collision_policy.precedence_order[0];
    const hasCollisionPressure =
      decision.queue_item.priority === DispatchPriority.Batched ||
      decision.queue_item.priority === DispatchPriority.Silent;

    if (hasCollisionPressure && precedence !== topPrecedence) {
      if (decision.queue_item.priority === DispatchPriority.Silent) {
        return Promise.resolve(
          this.validateAndLog(
            {
              decision: "store",
              queue_item: decision.queue_item,
              reason: "Silent-priority item is stored without outbound delivery.",
            },
            decision,
          ),
        );
      }
      return Promise.resolve(
        this.validateAndLog(
          {
            decision: "hold",
            queue_item: decision.queue_item,
            hold_until: new Date(
              decision.queue_item.created_at.getTime() + this.defaultHoldWindowMinutes * 60_000,
            ),
            reason: "Collision policy deferred non-urgent outbound to hold window.",
          },
          decision,
        ),
      );
    }

    if (
      decision.queue_item.priority === DispatchPriority.Immediate &&
      collision_policy.same_precedence_strategy === SamePrecedenceStrategy.Batch &&
      this.isBatchableImmediate(decision)
    ) {
      return Promise.resolve(
        this.validateAndLog(
          {
            decision: "hold",
            queue_item: decision.queue_item,
            hold_until: new Date(
              decision.queue_item.created_at.getTime() + this.defaultHoldWindowMinutes * 60_000,
            ),
            reason: "Immediate item batched due to same-precedence collision strategy.",
          },
          decision,
        ),
      );
    }

    return Promise.resolve(this.validateAndLog(action, decision));
  }

  private validateAndLog(
    action: DispatchAction | HoldAction | StoreAction,
    decision: WorkerDecision,
  ): ActionRouterResult {
    if (action.decision === "dispatch") {
      const validated = validateDispatchAction(action);
      this.logger.info(
        {
          queue_item_id: decision.queue_item.id,
          result: validated.decision,
          target_thread: validated.outbound.target_thread,
        },
        "Action router resolved dispatch.",
      );
      return validated;
    }
    if (action.decision === "hold") {
      const validated = validateHoldAction(action);
      this.logger.info(
        {
          queue_item_id: decision.queue_item.id,
          result: validated.decision,
          hold_until: validated.hold_until.toISOString(),
        },
        "Action router resolved hold.",
      );
      return validated;
    }
    const validated = validateStoreAction(action);
    this.logger.info(
      {
        queue_item_id: decision.queue_item.id,
        result: validated.decision,
      },
      "Action router resolved store.",
    );
    return validated;
  }

  private resolvePrecedence(decision: WorkerDecision): CollisionPrecedence {
    const { classification } = decision;
    if ([TopicKey.Health, TopicKey.Pets].includes(classification.topic)) {
      return CollisionPrecedence.SafetyAndHealth;
    }
    if ([TopicKey.Calendar, TopicKey.School, TopicKey.Finances].includes(classification.topic)) {
      return CollisionPrecedence.TimeSensitiveDeadline;
    }
    if (classification.intent === ClassifierIntent.Query) {
      return CollisionPrecedence.ActiveConversation;
    }
    if (decision.queue_item.source === QueueItemSource.ScheduledTrigger) {
      return CollisionPrecedence.ScheduledReminder;
    }
    return CollisionPrecedence.ProactiveOutbound;
  }

  private isBatchableImmediate(decision: WorkerDecision): boolean {
    return (
      decision.queue_item.source === QueueItemSource.ScheduledTrigger &&
      decision.classification.intent !== ClassifierIntent.Query
    );
  }
}

export function createActionRouter(options?: ActionRouterOptions): ActionRouter {
  return new ActionRouter(options);
}
