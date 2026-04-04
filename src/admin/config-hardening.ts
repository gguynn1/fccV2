import { type PendingQueueItem } from "../01-service-stack/04-queue/types.js";
import { ThreadType, type Thread } from "../02-supporting-services/05-routing-service/types.js";
import type { SystemConfig, SystemState } from "../index.js";
import { EntityType } from "../types.js";

const DEFAULT_ADULT_MORNING_DIGEST = "07:00";
const DEFAULT_CHILD_MORNING_DIGEST = "07:30";
const FAMILY_THREAD_DESCRIPTION =
  "Family thread. Chores, grocery, travel, pets, general household.";
const COUPLE_THREAD_DESCRIPTION =
  "Couple thread. Finances, relationship, couple-level coordination.";

export type ConfigEditSource = "entities" | "config" | "scheduler" | "budget" | "topics";

export class AdminConfigInvariantError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "AdminConfigInvariantError";
  }
}

export interface ConfigReconciliationReport {
  normalized_threads: boolean;
  normalized_scheduler_times: boolean;
  removed_thread_histories: string[];
  removed_state_thread_contexts: string[];
  removed_pending_queue_items: string[];
  updated_pending_queue_items: string[];
  removed_recent_dispatches: string[];
  updated_recent_dispatches: string[];
  removed_confirmations: string[];
  removed_escalations: string[];
  removed_digest_targets: number;
  removed_topic_records: number;
}

export interface HardenedConfigEditResult {
  config: SystemConfig;
  state: SystemState;
  report: ConfigReconciliationReport;
}

export interface HardenConfigEditOptions {
  current_config: SystemConfig;
  next_config: SystemConfig;
  current_state: SystemState;
  source: ConfigEditSource;
}

function defaultMorningDigestForEntityType(type: EntityType): string {
  return type === EntityType.Child ? DEFAULT_CHILD_MORNING_DIGEST : DEFAULT_ADULT_MORNING_DIGEST;
}

function buildPrivateThread(entityId: string, entityName: string): Thread {
  return {
    id: `${entityId}_private`,
    type: ThreadType.Private,
    participants: [entityId],
    description: `${entityName}'s private thread. Personal reminders, digests, drafts, review space.`,
  };
}

function buildFamilyThread(peopleIds: string[], conversationSid?: string): Thread {
  return {
    id: "family",
    type: ThreadType.Shared,
    participants: peopleIds,
    description: FAMILY_THREAD_DESCRIPTION,
    ...(conversationSid ? { conversation_sid: conversationSid } : {}),
  };
}

function buildCoupleThread(participants: string[], conversationSid?: string): Thread {
  return {
    id: "couple",
    type: ThreadType.Shared,
    participants,
    description: COUPLE_THREAD_DESCRIPTION,
    ...(conversationSid ? { conversation_sid: conversationSid } : {}),
  };
}

function cloneConfig(config: SystemConfig): SystemConfig {
  return structuredClone(config);
}

function cloneState(state: SystemState): SystemState {
  return structuredClone(state);
}

function normalizeEntities(config: SystemConfig, currentConfig: SystemConfig): void {
  const currentEntitiesById = new Map(currentConfig.entities.map((entity) => [entity.id, entity]));
  config.entities = config.entities.map((entity) => {
    if (entity.type === EntityType.Pet) {
      return {
        ...entity,
        messaging_identity: null,
        permissions: [],
        routes_to: (entity.routes_to ?? []).filter(Boolean),
      };
    }

    const currentEntity = currentEntitiesById.get(entity.id);
    return {
      ...entity,
      digest: {
        morning:
          entity.digest?.morning ??
          currentEntity?.digest?.morning ??
          defaultMorningDigestForEntityType(entity.type),
        evening: entity.digest?.evening ?? currentEntity?.digest?.evening ?? null,
      },
    };
  });
}

function normalizeThreads(config: SystemConfig, currentConfig: SystemConfig): boolean {
  const previousThreadsJson = JSON.stringify(config.threads);
  const people = config.entities.filter((entity) => entity.type !== EntityType.Pet);
  const peopleIds = people.map((entity) => entity.id);
  const adultIds = new Set(
    config.entities
      .filter((entity) => entity.type === EntityType.Adult && entity.messaging_identity !== null)
      .map((entity) => entity.id),
  );
  const requestedFamily = config.threads.find((thread) => thread.id === "family");
  const requestedCouple = config.threads.find((thread) => thread.id === "couple");
  const currentFamily = currentConfig.threads.find((thread) => thread.id === "family");
  const currentCouple = currentConfig.threads.find((thread) => thread.id === "couple");
  const normalizedCoupleParticipants = (requestedCouple?.participants ?? []).filter((participant) =>
    adultIds.has(participant),
  );

  config.threads = [
    ...people.map((entity) => buildPrivateThread(entity.id, entity.name)),
    buildFamilyThread(
      peopleIds,
      requestedFamily?.conversation_sid ?? currentFamily?.conversation_sid,
    ),
    ...(normalizedCoupleParticipants.length >= 2
      ? [
          buildCoupleThread(
            [...new Set(normalizedCoupleParticipants)],
            requestedCouple?.conversation_sid ?? currentCouple?.conversation_sid,
          ),
        ]
      : []),
  ];

  return JSON.stringify(config.threads) !== previousThreadsJson;
}

function syncDailyRhythmFromEntityDigests(config: SystemConfig): boolean {
  const previous = JSON.stringify(config.daily_rhythm);
  const people = config.entities.filter((entity) => entity.type !== EntityType.Pet);

  config.daily_rhythm.morning_digest.times = Object.fromEntries(
    people.map((entity) => [
      entity.id,
      entity.digest?.morning ?? defaultMorningDigestForEntityType(entity.type),
    ]),
  );
  config.daily_rhythm.evening_checkin.times = Object.fromEntries(
    people.map((entity) => [entity.id, entity.digest?.evening ?? null]),
  );

  return JSON.stringify(config.daily_rhythm) !== previous;
}

function syncEntityDigestsFromDailyRhythm(config: SystemConfig): boolean {
  const previous = JSON.stringify(config.entities);
  config.entities = config.entities.map((entity) => {
    if (entity.type === EntityType.Pet) {
      return entity;
    }

    return {
      ...entity,
      digest: {
        morning:
          config.daily_rhythm.morning_digest.times[entity.id] ??
          entity.digest?.morning ??
          defaultMorningDigestForEntityType(entity.type),
        evening:
          config.daily_rhythm.evening_checkin.times[entity.id] ?? entity.digest?.evening ?? null,
      },
    };
  });

  return JSON.stringify(config.entities) !== previous;
}

function assertConfigInvariants(config: SystemConfig, source: ConfigEditSource): void {
  // Pre-onboarding: no entities have been configured yet. Non-entity edits
  // (timezone, locale, scheduler, budget) are valid in this state. Only block
  // an explicit entity submission that empties the roster.
  if (config.entities.length === 0) {
    if (source === "entities") {
      throw new AdminConfigInvariantError("At least one entity is required.");
    }
    return;
  }

  const adults = config.entities.filter(
    (entity) => entity.type === EntityType.Adult && entity.messaging_identity !== null,
  );
  const people = config.entities.filter((entity) => entity.type !== EntityType.Pet);
  const peopleIds = new Set(people.map((entity) => entity.id));
  const adultIds = new Set(adults.map((entity) => entity.id));
  const petIds = new Set(
    config.entities.filter((entity) => entity.type === EntityType.Pet).map((entity) => entity.id),
  );

  const messagingIdentities = config.entities
    .filter((entity) => entity.type !== EntityType.Pet && entity.messaging_identity !== null)
    .map((entity) => entity.messaging_identity!);
  if (new Set(messagingIdentities).size !== messagingIdentities.length) {
    throw new AdminConfigInvariantError("Two or more entities share the same messaging identity.");
  }

  if (people.length === 0) {
    throw new AdminConfigInvariantError("At least one non-pet entity is required.");
  }
  if (adults.length === 0) {
    throw new AdminConfigInvariantError("At least one adult entity is required.");
  }
  if (config.threads.length === 0) {
    throw new AdminConfigInvariantError("At least one thread is required.");
  }

  for (const person of people) {
    if (!person.digest?.morning) {
      throw new AdminConfigInvariantError(`Entity ${person.id} is missing a morning digest time.`);
    }
  }

  for (const pet of config.entities.filter((entity) => entity.type === EntityType.Pet)) {
    const routesTo = pet.routes_to ?? [];
    if (routesTo.length === 0) {
      throw new AdminConfigInvariantError(`Pet ${pet.id} must route to at least one person.`);
    }
    if (routesTo.some((entityId) => !peopleIds.has(entityId))) {
      throw new AdminConfigInvariantError(`Pet ${pet.id} routes to an unknown person.`);
    }
  }

  const familyThread = config.threads.find((thread) => thread.id === "family");
  if (!familyThread) {
    throw new AdminConfigInvariantError("The family thread is required.");
  }
  if (familyThread.type !== ThreadType.Shared) {
    throw new AdminConfigInvariantError("The family thread must be shared.");
  }
  if (familyThread.participants.length !== people.length) {
    throw new AdminConfigInvariantError("The family thread must include every person.");
  }
  for (const participant of familyThread.participants) {
    if (!peopleIds.has(participant)) {
      throw new AdminConfigInvariantError("The family thread contains an unknown participant.");
    }
  }

  const privateThreads = config.threads.filter((thread) => thread.type === ThreadType.Private);
  if (privateThreads.length !== people.length) {
    throw new AdminConfigInvariantError("Each person must have exactly one private thread.");
  }
  for (const person of people) {
    const expectedId = `${person.id}_private`;
    const thread = privateThreads.find((candidate) => candidate.id === expectedId);
    if (!thread) {
      throw new AdminConfigInvariantError(`Missing private thread for ${person.id}.`);
    }
    if (thread.participants.length !== 1 || thread.participants[0] !== person.id) {
      throw new AdminConfigInvariantError(
        `Private thread ${expectedId} must contain only ${person.id}.`,
      );
    }
  }

  const coupleThread = config.threads.find((thread) => thread.id === "couple");
  if (coupleThread) {
    if (coupleThread.type !== ThreadType.Shared) {
      throw new AdminConfigInvariantError("The couple thread must be shared.");
    }
    if (coupleThread.participants.length < 2) {
      throw new AdminConfigInvariantError("The couple thread must include at least two adults.");
    }
    if (coupleThread.participants.some((participant) => !adultIds.has(participant))) {
      throw new AdminConfigInvariantError("The couple thread may only include adults.");
    }
  }

  for (const thread of config.threads) {
    for (const participant of thread.participants) {
      if (!peopleIds.has(participant)) {
        throw new AdminConfigInvariantError(
          `Thread ${thread.id} references unknown participant ${participant}.`,
        );
      }
      if (petIds.has(participant)) {
        throw new AdminConfigInvariantError(
          `Thread ${thread.id} cannot include pet ${participant}.`,
        );
      }
    }
  }

  if (source === "topics") {
    const validEscalationLevels = new Set(Object.keys(config.escalation_profiles));
    for (const [topicKey, topicConfig] of Object.entries(config.topics) as Array<
      [string, { label?: string; escalation?: string }]
    >) {
      if (!topicConfig.label || typeof topicConfig.label !== "string") {
        throw new AdminConfigInvariantError(`Topic "${topicKey}" must have a label.`);
      }
      if (
        topicConfig.escalation &&
        typeof topicConfig.escalation === "string" &&
        !validEscalationLevels.has(topicConfig.escalation)
      ) {
        throw new AdminConfigInvariantError(
          `Topic "${topicKey}" references unknown escalation level "${String(topicConfig.escalation)}".`,
        );
      }
    }
    if (Object.keys(config.topics).length === 0) {
      throw new AdminConfigInvariantError("At least one topic is required.");
    }
  }
}

function normalizeConcerningForRouting(concerning: string[], config: SystemConfig): string[] {
  const entitiesById = new Map(config.entities.map((entity) => [entity.id, entity]));
  const normalized = concerning.flatMap((entityId) => {
    const entity = entitiesById.get(entityId);
    if (!entity) {
      return [];
    }
    if (entity.type !== EntityType.Pet) {
      return [entity.id];
    }
    return (entity.routes_to ?? []).filter(Boolean);
  });
  return [...new Set(normalized)];
}

function resolveThreadForConcerning(concerning: string[], config: SystemConfig): string | null {
  const normalized = normalizeConcerningForRouting(concerning, config);
  if (normalized.length === 1) {
    const privateThreadId = `${normalized[0]}_private`;
    if (config.threads.some((thread) => thread.id === privateThreadId)) {
      return privateThreadId;
    }
  }

  const shared = config.threads
    .filter((thread) => thread.type === ThreadType.Shared)
    .filter((thread) => normalized.every((entityId) => thread.participants.includes(entityId)))
    .sort((left, right) => left.participants.length - right.participants.length);
  return shared[0]?.id ?? config.threads.find((thread) => thread.id === "family")?.id ?? null;
}

export function reconcilePendingQueueItemForConfig(
  item: PendingQueueItem,
  config: SystemConfig,
): PendingQueueItem | null {
  const validEntityIds = new Set(config.entities.map((entity) => entity.id));
  const concerning = item.concerning.filter((entityId) => validEntityIds.has(entityId));
  if (concerning.length === 0) {
    return null;
  }

  const targetThreadExists = config.threads.some((thread) => thread.id === item.target_thread);
  const targetThread = targetThreadExists
    ? item.target_thread
    : resolveThreadForConcerning(concerning, config);
  if (!targetThread) {
    return null;
  }

  return {
    ...item,
    concerning,
    target_thread: targetThread,
  };
}

function reconcileTopicState(state: SystemState, config: SystemConfig): number {
  const validEntityIds = new Set(config.entities.map((entity) => entity.id));
  let removed = 0;

  const originalCalendarCount = state.calendar.events.length;
  state.calendar.events = state.calendar.events
    .map((event) => ({
      ...event,
      concerning: event.concerning.filter((entityId) => validEntityIds.has(entityId)),
    }))
    .filter((event) => event.concerning.length > 0);
  removed += originalCalendarCount - state.calendar.events.length;

  const originalHealthProfiles = state.health.profiles.length;
  state.health.profiles = state.health.profiles.filter((profile) =>
    validEntityIds.has(profile.entity),
  );
  removed += originalHealthProfiles - state.health.profiles.length;

  const originalPetProfiles = state.pets.profiles.length;
  state.pets.profiles = state.pets.profiles.filter((profile) => validEntityIds.has(profile.entity));
  removed += originalPetProfiles - state.pets.profiles.length;

  const originalStudents = state.school.students.length;
  state.school.students = state.school.students
    .map((student) => ({
      ...student,
      parent_entity:
        student.parent_entity && validEntityIds.has(student.parent_entity)
          ? student.parent_entity
          : undefined,
    }))
    .filter((student) => validEntityIds.has(student.entity));
  removed += originalStudents - state.school.students.length;

  const originalCommunications = state.school.communications.length;
  state.school.communications = state.school.communications.filter((entry) =>
    validEntityIds.has(entry.student_entity),
  );
  removed += originalCommunications - state.school.communications.length;

  const originalTrips = state.travel.trips.length;
  state.travel.trips = state.travel.trips
    .map((trip) => ({
      ...trip,
      travelers: trip.travelers.filter((entityId) => validEntityIds.has(entityId)),
    }))
    .filter((trip) => trip.travelers.length > 0);
  removed += originalTrips - state.travel.trips.length;

  const originalVendorRecords = state.vendors.records.length;
  state.vendors.records = state.vendors.records.filter((record) =>
    validEntityIds.has(record.managed_by),
  );
  removed += originalVendorRecords - state.vendors.records.length;

  const originalBusinessProfiles = state.business.profiles.length;
  state.business.profiles = state.business.profiles.filter((profile) =>
    validEntityIds.has(profile.entity),
  );
  removed += originalBusinessProfiles - state.business.profiles.length;

  const originalBusinessLeads = state.business.leads.length;
  state.business.leads = state.business.leads.filter((lead) => validEntityIds.has(lead.owner));
  removed += originalBusinessLeads - state.business.leads.length;

  if (!config.threads.some((thread) => thread.id === state.relationship.last_nudge.thread)) {
    state.relationship.last_nudge = {
      date: state.relationship.next_nudge_eligible,
      thread: config.threads.find((thread) => thread.id === "couple")?.id ?? "family",
      content: "",
      response_received: false,
    };
    removed += 1;
  }

  const originalStatuses = state.family_status.current.length;
  state.family_status.current = state.family_status.current.filter((entry) =>
    validEntityIds.has(entry.entity),
  );
  removed += originalStatuses - state.family_status.current.length;

  const originalDietaryNotes = state.meals.dietary_notes.length;
  state.meals.dietary_notes = state.meals.dietary_notes.filter((entry) =>
    validEntityIds.has(entry.entity),
  );
  removed += originalDietaryNotes - state.meals.dietary_notes.length;

  const originalMaintenanceItems = state.maintenance.items.length;
  state.maintenance.items = state.maintenance.items.filter((item) =>
    validEntityIds.has(item.responsible),
  );
  removed += originalMaintenanceItems - state.maintenance.items.length;

  return removed;
}

export function hardenConfigEdit(options: HardenConfigEditOptions): HardenedConfigEditResult {
  const nextConfig = cloneConfig(options.next_config);
  const nextState = cloneState(options.current_state);
  const report: ConfigReconciliationReport = {
    normalized_threads: false,
    normalized_scheduler_times: false,
    removed_thread_histories: [],
    removed_state_thread_contexts: [],
    removed_pending_queue_items: [],
    updated_pending_queue_items: [],
    removed_recent_dispatches: [],
    updated_recent_dispatches: [],
    removed_confirmations: [],
    removed_escalations: [],
    removed_digest_targets: 0,
    removed_topic_records: 0,
  };

  normalizeEntities(nextConfig, options.current_config);
  report.normalized_threads = normalizeThreads(nextConfig, options.current_config);

  if (options.source === "scheduler") {
    report.normalized_scheduler_times = syncEntityDigestsFromDailyRhythm(nextConfig);
  } else {
    report.normalized_scheduler_times = syncDailyRhythmFromEntityDigests(nextConfig);
  }

  assertConfigInvariants(nextConfig, options.source);

  const validThreadIds = new Set(nextConfig.threads.map((thread) => thread.id));

  for (const threadId of Object.keys(nextState.threads)) {
    if (validThreadIds.has(threadId)) {
      continue;
    }
    delete nextState.threads[threadId];
    report.removed_state_thread_contexts.push(threadId);
    report.removed_thread_histories.push(threadId);
  }

  nextState.queue.pending = nextState.queue.pending.flatMap((item) => {
    const reconciled = reconcilePendingQueueItemForConfig(item, nextConfig);
    if (!reconciled) {
      report.removed_pending_queue_items.push(item.id);
      return [];
    }
    if (
      reconciled.target_thread !== item.target_thread ||
      JSON.stringify(reconciled.concerning) !== JSON.stringify(item.concerning)
    ) {
      report.updated_pending_queue_items.push(item.id);
    }
    return [reconciled];
  });

  nextState.queue.recently_dispatched = nextState.queue.recently_dispatched.flatMap((item) => {
    const targetThread = validThreadIds.has(item.target_thread)
      ? item.target_thread
      : resolveThreadForConcerning(configureConcerningFromDispatched(item, nextConfig), nextConfig);
    if (!targetThread) {
      report.removed_recent_dispatches.push(item.id);
      return [];
    }
    if (targetThread !== item.target_thread) {
      report.updated_recent_dispatches.push(item.id);
    }
    return [{ ...item, target_thread: targetThread }];
  });

  nextState.confirmations.pending = nextState.confirmations.pending.filter((confirmation) => {
    const keep =
      validThreadIds.has(confirmation.requested_in_thread) &&
      nextConfig.entities.some((entity) => entity.id === confirmation.requested_by);
    if (!keep) {
      report.removed_confirmations.push(confirmation.id);
    }
    return keep;
  });
  nextState.confirmations.recent = nextState.confirmations.recent.filter((confirmation) => {
    const keep =
      nextConfig.entities.some((entity) => entity.id === confirmation.requested_by) &&
      (confirmation.requested_in_thread === undefined ||
        validThreadIds.has(confirmation.requested_in_thread));
    if (!keep) {
      report.removed_confirmations.push(confirmation.id);
    }
    return keep;
  });

  nextState.escalation_status.active = nextState.escalation_status.active.flatMap((escalation) => {
    if (
      !nextConfig.entities.some((entity) => entity.id === escalation.responsible_entity) ||
      !validThreadIds.has(escalation.target_thread_for_escalation)
    ) {
      report.removed_escalations.push(escalation.id);
      return [];
    }
    const concerning = escalation.concerning.filter((entityId) =>
      nextConfig.entities.some((entity) => entity.id === entityId),
    );
    if (concerning.length === 0) {
      report.removed_escalations.push(escalation.id);
      return [];
    }
    return [{ ...escalation, concerning }];
  });

  nextState.digests.history = nextState.digests.history.map((day) => {
    const morning = Object.fromEntries(
      Object.entries(day.morning).filter(([threadId]) => validThreadIds.has(threadId)),
    );
    const evening = day.evening
      ? Object.fromEntries(
          Object.entries(day.evening).filter(([threadId]) => validThreadIds.has(threadId)),
        )
      : null;
    report.removed_digest_targets +=
      Object.keys(day.morning).length -
      Object.keys(morning).length +
      (day.evening ? Object.keys(day.evening).length - Object.keys(evening ?? {}).length : 0);
    return {
      ...day,
      morning,
      evening,
    };
  });

  report.removed_topic_records = reconcileTopicState(nextState, nextConfig);

  return {
    config: nextConfig,
    state: nextState,
    report,
  };
}

function configureConcerningFromDispatched(
  item: SystemState["queue"]["recently_dispatched"][number],
  config: SystemConfig,
): string[] {
  const thread = config.threads.find((candidate) => candidate.id === item.target_thread);
  return thread?.participants ?? [];
}
