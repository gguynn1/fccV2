import { Queue } from "bullmq";
import { pino, type Logger } from "pino";
import { assign, createActor, setup } from "xstate";

import type { StackQueueItem } from "../../01-service-stack/types.js";
import { ClassifierIntent, EscalationLevel, QueueItemSource, TopicKey } from "../../types.js";
import { toRedisConnection } from "../../lib/redis.js";
import type { EscalationDecision, EscalationService, StateService } from "../types.js";
import {
  type ActiveEscalation,
  EscalationReassignmentPolicy,
  type EscalationStatus,
  EscalationStepAction,
} from "./types.js";

const DEFAULT_LOGGER = pino({ name: "escalation-service" });
const DEFAULT_QUEUE_NAME = "fcc-escalation-timers";
const DEFAULT_DELAY_MINUTES = 60;
const LOW_DISAPPEAR_DELAY_HOURS = 72;

interface MachineContext {
  current_step: number;
  responsible_entity: string;
  resolved: boolean;
  cancelled: boolean;
}

type MachineEvent =
  | { type: "TIMER_EXPIRED" }
  | { type: "SILENCE" }
  | { type: "RESOLVED" }
  | { type: "REASSIGNED"; new_responsible: string };

interface EscalationProfileRuntime {
  level: EscalationLevel;
  steps: EscalationStepAction[];
  reassignment_policy: EscalationReassignmentPolicy;
}

const PROFILE_BY_LEVEL: Record<EscalationLevel, EscalationProfileRuntime> = {
  [EscalationLevel.High]: {
    level: EscalationLevel.High,
    steps: [
      EscalationStepAction.ReminderSent,
      EscalationStepAction.FollowUpSent,
      EscalationStepAction.EscalateToBroaderThread,
      EscalationStepAction.FlaggedInDigest,
    ],
    reassignment_policy: EscalationReassignmentPolicy.Reset,
  },
  [EscalationLevel.Medium]: {
    level: EscalationLevel.Medium,
    steps: [
      EscalationStepAction.ReminderSent,
      EscalationStepAction.FollowUpSent,
      EscalationStepAction.FlaggedInDigest,
    ],
    reassignment_policy: EscalationReassignmentPolicy.Transfer,
  },
  [EscalationLevel.Low]: {
    level: EscalationLevel.Low,
    steps: [EscalationStepAction.ReminderSent],
    reassignment_policy: EscalationReassignmentPolicy.Cancel,
  },
  [EscalationLevel.None]: {
    level: EscalationLevel.None,
    steps: [],
    reassignment_policy: EscalationReassignmentPolicy.Cancel,
  },
};

const TOPIC_LEVEL_MAP: Record<TopicKey, EscalationLevel> = {
  [TopicKey.Chores]: EscalationLevel.High,
  [TopicKey.Finances]: EscalationLevel.High,
  [TopicKey.School]: EscalationLevel.Medium,
  [TopicKey.Health]: EscalationLevel.Medium,
  [TopicKey.Calendar]: EscalationLevel.Medium,
  [TopicKey.Travel]: EscalationLevel.Medium,
  [TopicKey.Relationship]: EscalationLevel.Low,
  [TopicKey.Pets]: EscalationLevel.Low,
  [TopicKey.FamilyStatus]: EscalationLevel.Low,
  [TopicKey.Maintenance]: EscalationLevel.Low,
  [TopicKey.Grocery]: EscalationLevel.None,
  [TopicKey.Vendors]: EscalationLevel.None,
  [TopicKey.Business]: EscalationLevel.None,
  [TopicKey.Meals]: EscalationLevel.None,
};

export interface EscalationServiceOptions {
  redis_url: string;
  state_service: StateService;
  step_delay_minutes?: number;
  logger?: Logger;
}

function extractQueueItemId(queueItem: StackQueueItem): string {
  if (queueItem.id) {
    return queueItem.id;
  }
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildMachine(profile: EscalationProfileRuntime, initialContext?: Partial<MachineContext>) {
  return setup({
    types: {
      context: {} as MachineContext,
      events: {} as MachineEvent,
    },
    actions: {
      advanceStep: assign(({ context }) => ({
        current_step: context.current_step + 1,
      })),
      resolve: assign({
        resolved: true,
      }),
      cancel: assign({
        cancelled: true,
      }),
      transferResponsible: assign(({ event }) => {
        if (event.type !== "REASSIGNED") {
          return {};
        }
        return {
          responsible_entity: event.new_responsible,
        };
      }),
      resetForReassignment: assign(({ event }) => {
        if (event.type !== "REASSIGNED") {
          return {};
        }
        return {
          responsible_entity: event.new_responsible,
          current_step: 1,
        };
      }),
    },
    guards: {
      hasMoreSteps: ({ context }) => context.current_step < profile.steps.length,
      isLowOrNone: () =>
        profile.level === EscalationLevel.Low || profile.level === EscalationLevel.None,
      reassignmentResets: () => profile.reassignment_policy === EscalationReassignmentPolicy.Reset,
      reassignmentTransfers: () =>
        profile.reassignment_policy === EscalationReassignmentPolicy.Transfer,
    },
  }).createMachine({
    id: "escalation",
    initial: "active",
    context: {
      current_step: initialContext?.current_step ?? 1,
      responsible_entity: initialContext?.responsible_entity ?? "participant_1",
      resolved: false,
      cancelled: false,
    },
    states: {
      active: {
        on: {
          TIMER_EXPIRED: [
            { guard: "hasMoreSteps", actions: "advanceStep" },
            { actions: "resolve", target: "resolved" },
          ],
          SILENCE: [
            { guard: "isLowOrNone", actions: "resolve", target: "resolved" },
            { guard: "hasMoreSteps", actions: "advanceStep" },
            { actions: "resolve", target: "resolved" },
          ],
          RESOLVED: {
            actions: "resolve",
            target: "resolved",
          },
          REASSIGNED: [
            { guard: "reassignmentResets", actions: "resetForReassignment" },
            { guard: "reassignmentTransfers", actions: "transferResponsible" },
            { actions: "cancel", target: "cancelled" },
          ],
        },
      },
      resolved: {
        type: "final",
      },
      cancelled: {
        type: "final",
      },
    },
  });
}

export class XStateEscalationService implements EscalationService {
  private readonly logger: Logger;

  private readonly stateService: StateService;

  private readonly timerQueue: Queue;

  private readonly stepDelayMinutes: number;

  public constructor(options: EscalationServiceOptions) {
    this.logger = options.logger ?? DEFAULT_LOGGER;
    this.stateService = options.state_service;
    this.timerQueue = new Queue(DEFAULT_QUEUE_NAME, {
      connection: toRedisConnection(options.redis_url),
    });
    this.stepDelayMinutes = options.step_delay_minutes ?? DEFAULT_DELAY_MINUTES;
  }

  public async getStatus(): Promise<EscalationStatus> {
    const state = await this.stateService.getSystemState();
    return state.escalation_status;
  }

  public async evaluate(
    queue_item: StackQueueItem,
    target_thread: string,
  ): Promise<EscalationDecision> {
    const topic = queue_item.topic ?? TopicKey.FamilyStatus;
    const level = TOPIC_LEVEL_MAP[topic] ?? EscalationLevel.None;
    if (level === EscalationLevel.None) {
      return { should_escalate: false };
    }

    const state = await this.stateService.getSystemState();
    const itemRef = extractQueueItemId(queue_item);
    const existing = state.escalation_status.active.find((entry) => entry.item_ref === itemRef);
    if (existing) {
      return {
        should_escalate: true,
        current: existing,
        next_action_at: existing.next_action_at,
        next_target_thread: this.nextTargetThread(existing, target_thread),
      };
    }

    const profile = PROFILE_BY_LEVEL[level];
    const nextAction = this.computeNextAction(profile, 1);
    const now = new Date();
    const active: ActiveEscalation = {
      id: `esc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      topic,
      item_ref: itemRef,
      profile: level,
      responsible_entity: queue_item.concerning[0] ?? "participant_1",
      concerning: queue_item.concerning,
      current_step: 1,
      history: [
        {
          step: 1,
          action: EscalationStepAction.ReminderSent,
          thread: target_thread,
          at: now,
        },
      ],
      next_action: nextAction,
      next_action_at: this.computeNextActionAt(level, now),
      target_thread_for_escalation: this.resolveBroaderThread(target_thread),
    };

    state.escalation_status.active.push(active);
    await this.stateService.saveSystemState(state);
    await this.scheduleTimer(active);

    return {
      should_escalate: true,
      current: active,
      next_action_at: active.next_action_at,
      next_target_thread: this.nextTargetThread(active, target_thread),
    };
  }

  public async reconcileOnStartup(now: Date): Promise<StackQueueItem[]> {
    const state = await this.stateService.getSystemState();
    const generated: StackQueueItem[] = [];
    const retained: ActiveEscalation[] = [];

    for (const escalation of state.escalation_status.active) {
      let current = escalation;
      while (current.next_action_at <= now) {
        const advanced = this.advanceEscalation(current, "TIMER_EXPIRED", now);
        if (advanced.emittedAction) {
          generated.push(this.toEscalationQueueItem(current, advanced.emittedAction, now));
        }
        if (!advanced.next) {
          current = escalation;
          break;
        }
        current = advanced.next;
      }

      if (current.id !== escalation.id && current.next_action_at > now) {
        retained.push(current);
      } else if (current.next_action_at > now) {
        retained.push(escalation);
      }
    }

    state.escalation_status.active = retained;
    await this.stateService.saveSystemState(state);
    return generated;
  }

  public async close(): Promise<void> {
    await this.timerQueue.close();
  }

  private nextTargetThread(active: ActiveEscalation, currentTarget: string): string {
    return active.next_action === EscalationStepAction.EscalateToBroaderThread
      ? active.target_thread_for_escalation
      : currentTarget;
  }

  private computeNextAction(
    profile: EscalationProfileRuntime,
    currentStep: number,
  ): EscalationStepAction {
    const stepAction = profile.steps[currentStep];
    if (stepAction) {
      return stepAction;
    }
    if (profile.level === EscalationLevel.Low) {
      return EscalationStepAction.Resolved;
    }
    return EscalationStepAction.Resolved;
  }

  private computeNextActionAt(level: EscalationLevel, base: Date): Date {
    if (level === EscalationLevel.Low) {
      return new Date(base.getTime() + LOW_DISAPPEAR_DELAY_HOURS * 60 * 60 * 1000);
    }
    return new Date(base.getTime() + this.stepDelayMinutes * 60_000);
  }

  private async scheduleTimer(active: ActiveEscalation): Promise<void> {
    const delay = Math.max(0, active.next_action_at.getTime() - Date.now());
    await this.timerQueue.add(
      "escalation_step",
      {
        escalation_id: active.id,
        item_ref: active.item_ref,
      },
      {
        delay,
        jobId: `${active.id}:${active.current_step}`,
      },
    );
  }

  private resolveBroaderThread(currentThread: string): string {
    if (currentThread.endsWith("_private")) {
      return "family";
    }
    if (currentThread === "couple") {
      return "family";
    }
    return currentThread;
  }

  private advanceEscalation(
    active: ActiveEscalation,
    eventType: MachineEvent["type"],
    at: Date,
  ): { next: ActiveEscalation | null; emittedAction?: EscalationStepAction } {
    const profile = PROFILE_BY_LEVEL[active.profile];
    const machine = buildMachine(profile, {
      current_step: active.current_step,
      responsible_entity: active.responsible_entity,
    }).provide({
      actions: {},
    });
    const actor = createActor(machine, {
      input: undefined,
      snapshot: undefined,
    });
    actor.start();
    actor.send({
      type: eventType,
    } as MachineEvent);
    const snapshot = actor.getSnapshot();
    actor.stop();

    const emittedAction = active.next_action;
    if (snapshot.status === "done" || emittedAction === EscalationStepAction.Resolved) {
      return { next: null, emittedAction };
    }

    const nextStep = snapshot.context.current_step;
    const nextAction = this.computeNextAction(profile, nextStep);
    const nextActionAt = this.computeNextActionAt(active.profile, at);
    const history = [
      ...active.history,
      {
        step: nextStep,
        action: emittedAction,
        thread:
          emittedAction === EscalationStepAction.EscalateToBroaderThread
            ? active.target_thread_for_escalation
            : `${active.responsible_entity}_private`,
        at,
      },
    ];
    return {
      emittedAction,
      next: {
        ...active,
        responsible_entity: snapshot.context.responsible_entity,
        current_step: nextStep,
        history,
        next_action: nextAction,
        next_action_at: nextActionAt,
      },
    };
  }

  private toEscalationQueueItem(
    escalation: ActiveEscalation,
    action: EscalationStepAction,
    now: Date,
  ): StackQueueItem {
    const targetThread =
      action === EscalationStepAction.EscalateToBroaderThread
        ? escalation.target_thread_for_escalation
        : `${escalation.responsible_entity}_private`;
    return {
      source: QueueItemSource.ScheduledTrigger,
      content: `Escalation step: ${action}`,
      concerning: escalation.concerning,
      target_thread: targetThread,
      created_at: now,
      topic: escalation.topic,
      intent: ClassifierIntent.Query,
      idempotency_key: `${escalation.id}:${action}:${now.toISOString()}`,
    };
  }
}

export function createEscalationService(
  options: EscalationServiceOptions,
): XStateEscalationService {
  return new XStateEscalationService(options);
}
