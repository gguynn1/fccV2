import { pino, type Logger } from "pino";

import { systemConfig } from "../../_seed/system-config.js";
import { EntityType } from "../../01-service-stack/02-identity-service/types.js";
import type { RoutingRequest, RoutingService } from "../types.js";
import type {
  ContextTransitionPolicy,
  RoutingDecision,
  RoutingDecisionInput,
  Thread,
  ThreadHistory,
  ThreadTarget,
} from "./types.js";
import { RoutingRule, ThreadType } from "./types.js";

const DEFAULT_LOGGER = pino({ name: "routing-service" });

const DEFAULT_CONTEXT_TRANSITION_POLICY: ContextTransitionPolicy = {
  switch_on_new_topic: true,
  idle_reset_minutes: 90,
  explicit_switch_signals: ["switch topic", "new topic", "different topic", "unrelated"],
};

export interface RoutingServiceOptions {
  threads?: Thread[];
  context_transition_policy?: ContextTransitionPolicy;
  logger?: Logger;
}

function toResponsibleAdultIdForPet(entityId: string): string | null {
  const petEntity = systemConfig.entities.find((entity) => entity.id === entityId);
  if (!petEntity || petEntity.type !== EntityType.Pet) {
    return null;
  }

  const routesTo = petEntity.routes_to;
  if (!Array.isArray(routesTo) || routesTo.length === 0) {
    return null;
  }

  return routesTo[0] ?? null;
}

export class StaticRoutingService implements RoutingService {
  private readonly threads: Thread[];

  private readonly threadById: Map<string, Thread>;

  private readonly contextPolicy: ContextTransitionPolicy;

  private readonly logger: Logger;

  public constructor(options?: RoutingServiceOptions) {
    this.threads = options?.threads ?? systemConfig.threads;
    this.threadById = new Map(this.threads.map((thread) => [thread.id, thread]));
    this.contextPolicy = options?.context_transition_policy ?? DEFAULT_CONTEXT_TRANSITION_POLICY;
    this.logger = options?.logger ?? DEFAULT_LOGGER;
  }

  public getThreadDefinitions(): Promise<Thread[]> {
    return Promise.resolve(this.threads);
  }

  public resolveTargetThread(request: RoutingRequest): Promise<string> {
    return Promise.resolve(this.resolveRoutingDecision(request).target.thread_id);
  }

  public resolveRoutingDecision(input: RoutingDecisionInput): RoutingDecision {
    if (input.is_response) {
      return {
        target: this.buildResponseTarget(input.origin_thread),
      };
    }

    return {
      target: this.buildProactiveTarget(input.concerning),
    };
  }

  public shouldResetActiveTopicContext(
    history: ThreadHistory | null,
    next_topic: string,
    now: Date = new Date(),
    message?: string,
  ): boolean {
    if (!history) {
      return false;
    }

    if (this.contextPolicy.switch_on_new_topic && history.active_topic_context !== next_topic) {
      return true;
    }

    const idleMs = now.getTime() - history.last_activity.getTime();
    if (idleMs > this.contextPolicy.idle_reset_minutes * 60_000) {
      return true;
    }

    if (!message) {
      return false;
    }
    const normalized = message.toLowerCase();
    return this.contextPolicy.explicit_switch_signals.some((signal) => normalized.includes(signal));
  }

  private buildResponseTarget(originThread: string): ThreadTarget {
    const fallbackThread = this.threads[0]?.id ?? originThread;
    const targetThread = this.threadById.has(originThread) ? originThread : fallbackThread;
    return {
      thread_id: targetThread,
      rule_applied: RoutingRule.ResponseInPlace,
      reason: "Rule 1: response stays in the origin thread.",
    };
  }

  private buildProactiveTarget(concerning: string[]): ThreadTarget {
    const normalizedConcerning = this.normalizeConcerning(concerning);
    const privateIfSingle = this.tryResolveSingleEntityThread(normalizedConcerning);
    if (privateIfSingle) {
      return privateIfSingle;
    }

    const candidates = this.threads
      .filter((thread) => thread.type === ThreadType.Shared)
      .filter((thread) =>
        normalizedConcerning.every((entity) => thread.participants.includes(entity)),
      )
      .sort((a, b) => a.participants.length - b.participants.length);
    const selected = candidates[0] ?? this.threads.find((thread) => thread.id === "family");
    if (!selected) {
      throw new Error("No routing thread available for proactive message.");
    }

    return {
      thread_id: selected.id,
      rule_applied: RoutingRule.ProactiveNarrowest,
      reason: "Rule 2: proactive message routed to the narrowest shared thread.",
    };
  }

  private normalizeConcerning(concerning: string[]): string[] {
    const expanded = concerning.map((entityId) => {
      if (entityId === "pet" || entityId.startsWith("pet_")) {
        return toResponsibleAdultIdForPet(entityId) ?? entityId;
      }
      return entityId;
    });
    return [...new Set(expanded)];
  }

  private tryResolveSingleEntityThread(concerning: string[]): ThreadTarget | null {
    if (concerning.length !== 1) {
      return null;
    }

    const only = concerning[0];
    if (!only) {
      return null;
    }

    const privateThreadId = `${only}_private`;
    const existing = this.threadById.get(privateThreadId);
    if (existing && existing.type === ThreadType.Private) {
      return {
        thread_id: existing.id,
        rule_applied: RoutingRule.ProactiveNarrowest,
        reason: "Rule 2: one entity routes to private thread.",
      };
    }

    return null;
  }
}

export function createRoutingService(options?: RoutingServiceOptions): StaticRoutingService {
  return new StaticRoutingService(options);
}
