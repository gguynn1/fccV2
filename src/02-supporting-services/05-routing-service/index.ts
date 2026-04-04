import { pino, type Logger } from "pino";

import { runtimeSystemConfig } from "../../config/runtime-system-config.js";
import { EntityType } from "../../types.js";
import type { RoutingRequest, RoutingService } from "../types.js";
import {
  RoutingRule,
  ThreadType,
  type ContextTransitionPolicy,
  type RoutingDecision,
  type RoutingDecisionInput,
  type Thread,
  type ThreadHistory,
  type ThreadTarget,
} from "./types.js";

const DEFAULT_LOGGER = pino({ name: "routing-service" });

const DEFAULT_CONTEXT_TRANSITION_POLICY: ContextTransitionPolicy = {
  switch_on_new_topic: true,
  idle_reset_minutes: 90,
  explicit_switch_signals: ["switch topic", "new topic", "different topic", "unrelated"],
};

export interface RoutingServiceOptions {
  context_transition_policy?: ContextTransitionPolicy;
  logger?: Logger;
}

function toResponsibleAdultIdForPet(entityId: string): string | null {
  const petEntity = runtimeSystemConfig.entities.find((entity) => entity.id === entityId);
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
  private readonly contextPolicy: ContextTransitionPolicy;

  private readonly logger: Logger;

  public constructor(options?: RoutingServiceOptions) {
    this.contextPolicy = options?.context_transition_policy ?? DEFAULT_CONTEXT_TRANSITION_POLICY;
    this.logger = options?.logger ?? DEFAULT_LOGGER;
  }

  public getThreadDefinitions(): Promise<Thread[]> {
    return Promise.resolve(this.getThreads());
  }

  public resolveTargetThread(request: RoutingRequest): Promise<string> {
    return Promise.resolve(this.resolveRoutingDecision(request).target.thread_id);
  }

  public resolveRoutingDecision(input: RoutingDecisionInput): RoutingDecision {
    if (input.is_response) {
      return {
        target: this.buildResponseTarget(input.origin_thread),
        reply_policy: {
          action: "reply_here",
          reason: "Participant-initiated response remains in origin thread.",
        },
      };
    }

    return {
      target: this.buildProactiveTarget(input.topic, input.concerning, input.origin_thread),
      reply_policy: {
        action: "notify_there",
        dedupe_key: `${input.topic}:${[...input.concerning].sort().join(",")}`,
        cooldown_seconds: 20 * 60,
        reason: "Proactive item may notify another thread when audience differs.",
      },
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
    const threads = this.getThreads();
    const threadById = new Map(threads.map((thread) => [thread.id, thread]));
    const fallbackThread = threads[0]?.id ?? originThread;
    const targetThread = threadById.has(originThread) ? originThread : fallbackThread;
    return {
      thread_id: targetThread,
      rule_applied: RoutingRule.ResponseInPlace,
      reason: "Rule 1: response stays in the origin thread.",
    };
  }

  private buildProactiveTarget(
    topic: RoutingDecisionInput["topic"],
    concerning: string[],
    originThread: string,
  ): ThreadTarget {
    const normalizedConcerning = this.normalizeConcerning(concerning);
    const privateIfSingle = this.tryResolveSingleEntityThread(normalizedConcerning);
    if (privateIfSingle && this.isThreadAllowedByTopic(topic, privateIfSingle.thread_id)) {
      return privateIfSingle;
    }

    const threads = this.getThreads();
    const topicRouting = runtimeSystemConfig.topics[topic]?.routing ?? {};
    const defaultThreadHint =
      typeof topicRouting.default === "string" ? topicRouting.default : undefined;
    const hintedThread = defaultThreadHint
      ? threads.find((thread) => thread.id === defaultThreadHint)
      : undefined;
    if (
      hintedThread &&
      this.isThreadAllowedByTopic(topic, hintedThread.id) &&
      normalizedConcerning.every((entity) => hintedThread.participants.includes(entity))
    ) {
      return {
        thread_id: hintedThread.id,
        rule_applied: RoutingRule.ProactiveNarrowest,
        reason: "Rule 2: proactive message followed topic default routing hint.",
      };
    }

    const candidates = threads
      .filter((thread) => thread.type === ThreadType.Shared)
      .filter((thread) =>
        normalizedConcerning.every((entity) => thread.participants.includes(entity)),
      )
      .filter((thread) => this.isThreadAllowedByTopic(topic, thread.id))
      .sort((a, b) => a.participants.length - b.participants.length);
    const selected =
      candidates[0] ??
      threads.find(
        (thread) => thread.id === "family" && this.isThreadAllowedByTopic(topic, thread.id),
      ) ??
      threads.find(
        (thread) => thread.id === originThread && this.isThreadAllowedByTopic(topic, thread.id),
      );
    if (!selected) {
      throw new Error("No routing thread available for proactive message.");
    }

    return {
      thread_id: selected.id,
      rule_applied: RoutingRule.ProactiveNarrowest,
      reason: "Rule 2: proactive message routed to the narrowest shared thread.",
    };
  }

  private isThreadAllowedByTopic(topic: RoutingDecisionInput["topic"], threadId: string): boolean {
    const routing = runtimeSystemConfig.topics[topic]?.routing;
    if (!routing) {
      return true;
    }
    const neverThreads = Array.isArray(routing.never)
      ? routing.never.filter((value): value is string => typeof value === "string")
      : [];
    return !neverThreads.includes(threadId);
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
    const existing = this.getThreads().find((thread) => thread.id === privateThreadId);
    if (existing && existing.type === ThreadType.Private) {
      return {
        thread_id: existing.id,
        rule_applied: RoutingRule.ProactiveNarrowest,
        reason: "Rule 2: one entity routes to private thread.",
      };
    }

    return null;
  }

  private getThreads(): Thread[] {
    return runtimeSystemConfig.threads;
  }
}

export function createRoutingService(options?: RoutingServiceOptions): StaticRoutingService {
  return new StaticRoutingService(options);
}
