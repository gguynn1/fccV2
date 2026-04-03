import { pino, type Logger } from "pino";
import { z } from "zod";

import { systemConfig as seedSystemConfig } from "../../_seed/system-config.js";
import type { SystemConfig } from "../../index.js";
import type { Thread } from "../../02-supporting-services/05-routing-service/types.js";
import { entitiesSchema, EntityType, type Entity, type IdentityResolutionResult } from "./types.js";

const DEFAULT_LOGGER = pino({ name: "identity-service" });

const threadSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["private", "shared"]),
  participants: z.array(z.string().min(1)).min(1),
  description: z.string().min(1),
});

const identityConfigSchema = z.object({
  entities: entitiesSchema,
  threads: z.array(threadSchema),
});

export interface IdentityServiceOptions {
  config?: Pick<SystemConfig, "entities" | "threads">;
  logger?: Logger;
}

export class IdentityService {
  private readonly logger: Logger;

  private readonly entitiesByMessagingIdentity: Map<string, Entity>;

  private readonly entitiesById: Map<string, Entity>;

  private readonly threadsByEntityId: Map<string, string[]>;

  public constructor(options?: IdentityServiceOptions) {
    const config = options?.config ?? seedSystemConfig;
    const parsed = identityConfigSchema.parse(config);

    this.logger = options?.logger ?? DEFAULT_LOGGER;
    this.entitiesByMessagingIdentity = new Map();
    this.entitiesById = new Map();
    this.threadsByEntityId = this.buildThreadMemberships(
      parsed.entities,
      parsed.threads as Thread[],
    );

    for (const entity of parsed.entities) {
      this.entitiesById.set(entity.id, entity);
      if (entity.messaging_identity !== null) {
        this.entitiesByMessagingIdentity.set(entity.messaging_identity, entity);
      }
    }
  }

  public resolveByMessagingIdentity(
    messagingIdentity: string,
    incomingThreadId: string,
  ): IdentityResolutionResult {
    const entity = this.entitiesByMessagingIdentity.get(messagingIdentity);
    if (!entity) {
      throw new Error(`No entity found for messaging identity: ${messagingIdentity}`);
    }

    const memberships = this.threadsByEntityId.get(entity.id) ?? [];
    if (!memberships.includes(incomingThreadId)) {
      throw new Error(
        `Entity ${entity.id} is not a participant of incoming thread ${incomingThreadId}.`,
      );
    }

    return {
      entity_id: entity.id,
      entity_type: entity.type,
      permissions: entity.permissions,
      thread_id: incomingThreadId,
      thread_memberships: memberships,
    };
  }

  public getEntity(entityId: string): Entity | null {
    return this.entitiesById.get(entityId) ?? null;
  }

  public getThreadMemberships(entityId: string): string[] {
    return this.threadsByEntityId.get(entityId) ?? [];
  }

  public assertPetMessagingIdentities(): void {
    for (const entity of this.entitiesById.values()) {
      if (entity.type === EntityType.Pet && entity.messaging_identity !== null) {
        throw new Error(`Pet entity ${entity.id} cannot have a messaging identity.`);
      }
    }
    this.logger.info("Pet messaging identity validation passed.");
  }

  private buildThreadMemberships(entities: Entity[], threads: Thread[]): Map<string, string[]> {
    const memberships = new Map<string, string[]>();
    for (const entity of entities) {
      memberships.set(entity.id, []);
    }

    for (const thread of threads) {
      for (const participant of thread.participants) {
        const existing = memberships.get(participant) ?? [];
        existing.push(thread.id);
        memberships.set(participant, existing);
      }
    }

    return memberships;
  }
}

export function createIdentityService(options?: IdentityServiceOptions): IdentityService {
  return new IdentityService(options);
}
