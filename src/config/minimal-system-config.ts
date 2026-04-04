import {
  CollisionPrecedence,
  ConfirmationActionType,
  DataIngestSourceType,
  EscalationLevel,
  EscalationReassignmentPolicy,
  GrocerySection,
  TopicKey,
  WorkerAction,
  WorkerService,
  type SystemConfig,
  type SystemState,
} from "../index.js";

const defaultTopics: SystemConfig["topics"] = {
  calendar: {
    label: "Calendar",
    description: "Appointments, scheduling, conflicts, rescheduling.",
    routing: {
      personal_appointment: "private thread of the person involved",
      couple_event: "couple",
      family_event: "family",
    },
    behavior: {
      tone: "precise and logistical",
      format: "structured confirmation with date, time, location, participants",
      initiative: "event-driven: remind before, follow up after, alert on conflicts",
    },
    escalation: EscalationLevel.Medium,
    proactive: {
      reminder_before: "24h",
      follow_up_after: "2h",
      conflict_detection: true,
    },
    cross_topic_connections: [TopicKey.Health, TopicKey.Travel, TopicKey.School, TopicKey.Business],
  },
  chores: {
    label: "Chores",
    description: "Task assignment, completion tracking, follow-up, escalation.",
    routing: {
      assigned_task: "private thread of assigned person",
      escalation: "family",
      assignment_announcement: "family",
    },
    behavior: {
      tone: "direct and operational",
      format: "clear task, clear deadline, clear accountability",
      initiative:
        "structured: remind at assignment, follow up before deadline, escalate after deadline",
    },
    escalation: EscalationLevel.High,
    escalation_ladder: {
      first_reminder: "at assignment",
      follow_up: "1h before deadline",
      escalate_to_broader_thread: "1h after deadline",
      flag_in_digest: true,
    },
  },
  finances: {
    label: "Finances",
    description: "Bills, expenses, savings goals, milestones, financial overview.",
    routing: {
      default: "couple",
      never: ["participant_3_private", "family"],
    },
    behavior: {
      tone: "calm, factual, neutral",
      format: "numbers, deadlines, progress snapshots",
      initiative: "deadline-driven for bills, milestone-driven for savings",
    },
    escalation: EscalationLevel.High,
    escalation_ladder: {
      first_reminder: "3d before due",
      follow_up: "1d before due",
      escalate_to_broader_thread: null,
      flag_in_digest: true,
    },
    confirmation_required: true,
  },
  grocery: {
    label: "Grocery",
    description: "Shared household list. Add, organize, read back, mark purchased.",
    routing: {
      default: "family",
      response: "same thread as request",
    },
    behavior: {
      tone: "utilitarian, minimal commentary",
      format: "organized list by section, concise confirmations",
      initiative: "low: maintain list, read back when asked, optional pre-shopping-day reminder",
    },
    escalation: EscalationLevel.None,
    sections: [
      GrocerySection.Produce,
      GrocerySection.Dairy,
      GrocerySection.Meat,
      GrocerySection.Pantry,
      GrocerySection.Frozen,
      GrocerySection.Household,
      GrocerySection.Other,
    ],
    cross_topic_connections: [TopicKey.Meals],
  },
  health: {
    label: "Health",
    description: "Appointments, medications, wellness notes, provider info, follow-ups.",
    routing: {
      default: "private thread of the person involved",
      never_share_across_people: true,
    },
    behavior: {
      tone: "attentive and specific",
      format: "structured: appointments, medications, provider notes, follow-up items",
      initiative:
        "care-driven: remind before appointments, follow up after visits, medication reminders, overdue check-up flags",
    },
    escalation: EscalationLevel.Medium,
    proactive: {
      appointment_reminder: "24h",
      post_visit_follow_up: "2h",
      medication_reminder: "as configured per medication",
      routine_checkup_flag: "11 months since last visit",
    },
    cross_topic_connections: [TopicKey.Calendar],
  },
  pets: {
    label: "Pets",
    description: "Care logs, vet visits, medications, grooming, boarding, travel prep.",
    routing: {
      default: "responsible adult's private thread",
      shared_awareness: "family",
    },
    behavior: {
      tone: "warm but practical, caretaker",
      format: "care summaries, reminders, checklists",
      initiative:
        "gentle: periodic reminders for overdue care, pre-travel checklists, medication tracking",
    },
    escalation: EscalationLevel.Low,
    cross_topic_connections: [TopicKey.Calendar, TopicKey.Vendors],
  },
  school: {
    label: "School",
    description: "Assignments, deadlines, school communications, academic tracking.",
    routing: {
      student_tasks: "participant_3_private",
      parent_awareness: "relevant parent's private thread",
      escalation: "parent's private thread",
    },
    behavior: {
      tone_to_student: "organized and encouraging",
      tone_to_parent: "concise and actionable",
      format: "due dates, summaries, outstanding items",
      initiative:
        "deadline-driven: reminders as due dates approach, summaries of school comms, overdue flags",
    },
    escalation: EscalationLevel.Medium,
    escalation_ladder: {
      first_reminder: "2d before due",
      follow_up: "1d before due",
      escalate_to_parent: "day of deadline if not complete",
      flag_in_digest: true,
    },
    cross_topic_connections: [TopicKey.Calendar],
  },
  travel: {
    label: "Travel",
    description: "Trip planning, checklists, itineraries, reminders, cross-topic logistics.",
    routing: {
      family_trip: "family",
      couple_trip: "couple",
      individual_trip: "private thread of traveler",
    },
    behavior: {
      tone: "organized and anticipatory",
      format: "checklists, countdowns, connected reminders across topics",
      initiative:
        "countdown-driven: prep reminders before departure, checklist progress, post-trip follow-up",
    },
    escalation: EscalationLevel.Medium,
    cross_topic_connections: [
      TopicKey.Calendar,
      TopicKey.Pets,
      TopicKey.Finances,
      TopicKey.Grocery,
    ],
  },
  vendors: {
    label: "Vendors",
    description: "Contractor and service provider tracking. History, cost, follow-up.",
    routing: {
      default: "managing adult's private thread",
    },
    behavior: {
      tone: "businesslike",
      format: "records: who, what, cost, status, follow-up needed",
      initiative: "follow-up-driven: remind when a vendor hasn't responded within expected window",
    },
    escalation: EscalationLevel.None,
    cross_topic_connections: [TopicKey.Finances, TopicKey.Maintenance],
  },
  business: {
    label: "Business",
    description:
      "Per-entity service business tracking. Lead pipeline, inquiry management, draft replies, booking status.",
    routing: {
      default: "business owner's private thread",
    },
    behavior: {
      tone_internal: "professional and organized, business assistant",
      tone_client_drafts:
        "professional and adapted to business type - warm for client-facing services, specific for service-based businesses",
      format: "pipeline: new leads, follow-up timing, draft replies, booking status",
      initiative:
        "pipeline-driven: new lead alerts, follow-up reminders after quiet period, draft replies for approval",
    },
    escalation: EscalationLevel.None,
    confirmation_required_for_sends: true,
    cross_topic_connections: [TopicKey.Finances, TopicKey.Calendar],
  },
  relationship: {
    label: "Relationship",
    description:
      "Connection prompts, quality-time ideas, appreciation nudges, conversation starters.",
    routing: {
      default: "couple",
      never: ["participant_3_private", "family"],
    },
    behavior: {
      tone: "warm, brief, never clinical",
      format: "open-ended prompts, suggestions, appreciation exercises, conversation starters",
      initiative:
        "softest of any topic: occasional nudges during quiet windows, never during busy or stressful periods, easy to ignore",
      framework:
        "draws on Internal Family Systems Therapy, emotionally focused approaches, attachment-based connection prompts - small bids, not therapy",
    },
    escalation: EscalationLevel.Low,
    on_ignored:
      "quietly disappear, try again in a few days with something different, never follow up, never guilt",
    minimum_gap_between_nudges: "5d",
  },
  family_status: {
    label: "Family Status",
    description: "ETA updates, location check-ins, who is where and when.",
    routing: {
      personal_eta: "relevant shared thread",
      general_update: "family",
      readback: "same thread as request",
    },
    behavior: {
      tone: "brief and functional",
      format: "current snapshot, concise, old entries expire",
      initiative:
        "minimal: may ask for ETA if calendar suggests transit, otherwise records what is volunteered",
    },
    escalation: EscalationLevel.Low,
    status_expiry: "6h",
  },
  meals: {
    label: "Meals",
    description:
      "Meal planning, dinner decisions, dietary notes, and connecting meal choices to the grocery list.",
    routing: {
      meal_planning: "broadest shared thread",
      dietary_note: "relevant entity's private thread",
      readback: "same thread as request",
    },
    behavior: {
      tone: "collaborative and practical",
      format: "meal plans, suggestions, grocery list connections",
      initiative:
        "moderate: may surface meal planning before a typical grocery day or suggest repeating a recent meal the family liked, otherwise stays quiet",
    },
    escalation: EscalationLevel.None,
    grocery_linking: true,
    cross_topic_connections: [TopicKey.Grocery, TopicKey.Health],
  },
  maintenance: {
    label: "Maintenance",
    description:
      "Home, vehicle, and appliance maintenance tracking - what needs doing, when it was last done, when it's due next.",
    routing: {
      individual_item: "responsible adult's private thread",
      household_item: "relevant shared thread",
      readback: "same thread as request",
    },
    behavior: {
      tone: "practical and reminder-driven",
      format: "maintenance schedules, history logs, upcoming due items",
      initiative:
        "cycle-driven: reminders surface when maintenance is due based on last-performed date and configured interval, no nagging on items that aren't overdue",
    },
    escalation: EscalationLevel.Low,
    cross_topic_connections: [TopicKey.Vendors, TopicKey.Finances, TopicKey.Calendar],
  },
};

const defaultDispatch: SystemConfig["dispatch"] = {
  priority_levels: {
    immediate: {
      description: "Time-sensitive. Send now regardless of batching.",
      examples: [
        "pickup in 30 min",
        "bill due today",
        "calendar conflict detected",
        "response to a direct question",
      ],
    },
    batched: {
      description: "Important but not urgent. Hold for next digest or quiet window.",
      examples: [
        "chore reminder for later today",
        "savings update",
        "school deadline in a few days",
        "post-appointment follow-up",
      ],
    },
    silent: {
      description: "Tracked internally. Surface only when asked.",
      examples: ["completed task log", "vendor history", "pet care log", "general status entry"],
    },
  },
  outbound_budget: {
    max_unprompted_per_person_per_day: 5,
    max_messages_per_thread_per_hour: 2,
    batch_window_minutes: 30,
    description:
      "If multiple batched items are pending for the same person or thread within the batch window, combine them into one message.",
  },
  routing_rules: {
    rule_1:
      "Responses stay in context. If someone says something in a thread, the assistant replies in that same thread.",
    rule_2:
      "Proactive messages route to the narrowest appropriate thread. When the assistant initiates, it sends to the smallest thread that includes only the people who need the information.",
  },
  collision_avoidance: {
    description:
      "Before dispatching any outbound, check what else is pending or recently sent for the same person or thread. Batch if possible. Space out if not. Never stack multiple messages back to back.",
    precedence_order: [
      CollisionPrecedence.SafetyAndHealth,
      CollisionPrecedence.TimeSensitiveDeadline,
      CollisionPrecedence.ActiveConversation,
      CollisionPrecedence.ScheduledReminder,
      CollisionPrecedence.ProactiveOutbound,
    ],
    same_precedence_strategy:
      "When multiple items share the same precedence level, batch them into a single combined message. If batching is not possible (different threads), send the most time-sensitive first and hold others for the next quiet window.",
  },
};

const defaultEscalationProfiles: SystemConfig["escalation_profiles"] = {
  high: {
    label: "High Accountability",
    applies_to: [TopicKey.Chores, TopicKey.Finances],
    steps: [
      "message to responsible person in private thread",
      "follow-up reminder after configured window",
      "escalate to broader thread so others can see",
      "flag as unresolved in next digest",
    ],
    on_reassignment: EscalationReassignmentPolicy.Reset,
  },
  medium: {
    label: "Medium Accountability",
    applies_to: [TopicKey.School, TopicKey.Health, TopicKey.Calendar, TopicKey.Travel],
    steps: [
      "message to responsible person",
      "one follow-up reminder",
      "flag in digest - no thread escalation unless hard deadline is imminent",
    ],
    on_reassignment: EscalationReassignmentPolicy.Transfer,
  },
  low: {
    label: "Low Accountability",
    applies_to: [TopicKey.Relationship, TopicKey.Pets, TopicKey.FamilyStatus, TopicKey.Maintenance],
    steps: [
      "send once",
      "if ignored, quietly disappear",
      "maybe try again in a few days with something different",
      "never pressure, never escalate, never follow up",
    ],
    on_reassignment: EscalationReassignmentPolicy.Cancel,
  },
  none: {
    label: "No Escalation",
    applies_to: [TopicKey.Grocery, TopicKey.Vendors, TopicKey.Business, TopicKey.Meals],
    steps: ["send once or store silently", "no follow-up"],
    on_reassignment: EscalationReassignmentPolicy.Cancel,
  },
};

const defaultConfirmationGates: SystemConfig["confirmation_gates"] = {
  always_require_approval: [
    ConfirmationActionType.SendingOnBehalf,
    ConfirmationActionType.FinancialAction,
    ConfirmationActionType.SystemChange,
  ],
  expiry_minutes: 5,
  on_expiry:
    "Tell the user it expired. Ask them to reissue if they still want it. Never auto-execute.",
};

const defaultInputRecognition: SystemConfig["input_recognition"] = {
  text: {
    description:
      "Natural language interpreted in context of the thread and most recent topic discussed.",
  },
  structured_choice: {
    description: "Numbered options or yes/no. Reply with a number, letter, or yes/no to select.",
    formats: ["1/2/3", "a/b/c", "yes/no"],
  },
  reaction: {
    positive: "approve or mark done",
    negative: "reject or decline",
  },
  image: {
    description: "Extract visible information. Ask one clarifying question if intent is unclear.",
    examples: {
      receipt_photo: "log as expense after confirmation",
      school_image: "extract and track after confirmation",
      maintenance_photo: "log work completed, extract cost if visible, update maintenance item",
    },
  },
  forwarded_content: {
    description: "Parse forwarded text or email. Extract details, classify topic, ask what to do.",
  },
  silence: {
    high_accountability: "feeds escalation ladder",
    low_accountability: "means not now, respected, no follow-up",
    never: "treated as approval",
  },
  topic_disambiguation: {
    description: "Guidance for the classifier when input could match multiple topics.",
    rules: [
      {
        close_topics: ["meals", "grocery"],
        guidance:
          "If the message is about what to eat, what to cook, meal planning, recipes, or dinner decisions -> Meals. If the message is about items to buy, shopping lists, or store runs -> Grocery. 'What should we have for dinner?' is Meals. 'We need ground beef' is Grocery - unless it's part of an active meal planning conversation, then Meals.",
      },
      {
        close_topics: ["maintenance", "vendors"],
        guidance:
          "If the message is about recurring upkeep, service intervals, or 'when did we last...' -> Maintenance. If the message is about hiring or scheduling a specific service provider -> Vendors. 'When was the oil changed last?' is Maintenance. 'The plumber is coming Tuesday' is Vendors.",
      },
      {
        close_topics: ["maintenance", "chores"],
        guidance:
          "If the task recurs on a cycle (seasonal, mileage, quarterly) and involves a home, vehicle, or appliance -> Maintenance. If the task is a one-off household duty assigned to a person -> Chores. 'Change the furnace filter' is Maintenance. 'Take out the trash' is Chores.",
      },
      {
        close_topics: ["business", "vendors"],
        guidance:
          "If the message is about YOUR clients, leads, inquiries, or draft replies to people seeking your services -> Business. If the message is about someone YOU are hiring or scheduling to do work for you -> Vendors. 'I got a new inquiry about a portrait session' is Business. 'The plumber can come Thursday' is Vendors.",
      },
    ],
  },
  intent_disambiguation: {
    description:
      "Guidance for the classifier when the participant's intent could match multiple ClassifierIntent values.",
    rules: [
      {
        close_intents: ["cancellation", "completion"],
        guidance:
          "If the event or item is in the future and has not occurred yet, the participant wants to cancel it (Cancellation). If the event has already happened or the task has been performed, the participant is reporting it done (Completion). 'I'm done with the dentist' after the appointment time -> Completion. 'I'm done with the dentist' before the appointment -> Cancellation. When still ambiguous, ask for clarification.",
      },
      {
        close_intents: ["request", "update"],
        guidance:
          "If no matching item exists in state, treat as a new Request. If a matching item already exists, treat as an Update to that item. 'Schedule a dentist appointment' when none exists -> Request. 'Move the dentist to Thursday' when one exists -> Update. If multiple items match, request clarification before proceeding.",
      },
      {
        close_intents: ["cancellation", "update"],
        guidance:
          "If the participant wants to remove or stop something entirely -> Cancellation. If they want to change details but keep it -> Update. 'Cancel the dentist' -> Cancellation. 'Move the dentist to Thursday' -> Update. 'Never mind about the dentist' -> Cancellation.",
      },
      {
        close_intents: ["query", "request"],
        guidance:
          "If the participant is asking about existing state -> Query. If they are asking the system to create or do something new -> Request. 'What's on the calendar Thursday?' -> Query. 'Add a dentist appointment Thursday' -> Request. 'Do we have anything Thursday?' -> Query.",
      },
    ],
  },
};

const defaultWorker: SystemConfig["worker"] = {
  processing_sequence: [
    {
      step: 1,
      action: WorkerAction.ClassifyTopic,
      service: WorkerService.Classifier,
      description: "Determine which of the 14 topics this item belongs to.",
    },
    {
      step: 2,
      action: WorkerAction.IdentifyEntities,
      service: WorkerService.Identity,
      description: "Identify which people or pets are involved.",
    },
    {
      step: 3,
      action: WorkerAction.DetermineActionType,
      description: "Is this a response, a proactive message, or internal storage?",
    },
    {
      step: 4,
      action: WorkerAction.CheckOutboundBudget,
      service: WorkerService.Budget,
      description: "Check if sending is within budget limits. If not, hold or batch.",
    },
    {
      step: 5,
      action: WorkerAction.CheckEscalation,
      service: WorkerService.Escalation,
      description: "Determine if this item requires escalation based on topic profile.",
    },
    {
      step: 6,
      action: WorkerAction.CheckConfirmation,
      service: WorkerService.Confirmation,
      description: "Does this action require approval? Is there a pending confirmation to resolve?",
    },
    {
      step: 7,
      action: WorkerAction.ApplyBehaviorProfile,
      service: WorkerService.TopicProfile,
      description:
        "Apply tone, format, initiative style, and framework from the topic's behavior profile.",
    },
    {
      step: 8,
      action: WorkerAction.RouteAndDispatch,
      service: WorkerService.Routing,
      description:
        "Determine target thread, then dispatch (immediate), hold (batched), or store (silent).",
    },
  ],
};

const defaultDataIngest: SystemConfig["data_ingest"] = {
  sources: [
    {
      id: "email_monitor",
      type: DataIngestSourceType.Email,
      description: "Watch configured inboxes. Extract, classify, queue.",
      active: false,
      config: {
        inboxes: [],
        poll_interval_minutes: 5,
      },
    },
    {
      id: "calendar_sync",
      type: DataIngestSourceType.Calendar,
      description: "Detect calendar changes. Queue as calendar topic items.",
      active: false,
      config: {
        calendars: [],
        sync_interval_minutes: 10,
      },
    },
    {
      id: "forwarded_messages",
      type: DataIngestSourceType.Forwarded,
      description:
        "Family member forwards a text or email to the assistant's messaging identity. Parse, classify, queue.",
      active: true,
    },
  ],
  future: [
    "bank_notifications",
    "school_portal",
    "vet_system",
    "weather_service",
    "delivery_tracking",
  ],
};

function createEmptyIngestSourceState() {
  return {
    active: false,
    last_poll: null,
    last_sync: null,
    watermark: null,
    processed: [],
    total_processed: 0,
  };
}

export function createMinimalSystemConfig(): SystemConfig {
  return {
    system: {
      timezone: "America/Chicago",
      locale: "en-US",
      is_onboarded: false,
    },
    entities: [],
    threads: [],
    topics: structuredClone(defaultTopics),
    escalation_profiles: structuredClone(defaultEscalationProfiles),
    confirmation_gates: structuredClone(defaultConfirmationGates),
    dispatch: structuredClone(defaultDispatch),
    input_recognition: structuredClone(defaultInputRecognition),
    daily_rhythm: {
      morning_digest: { times: {} },
      evening_checkin: { times: {} },
      default_state: "quiet",
      digest_eligibility: {
        exclude_already_dispatched: true,
        exclude_stale: true,
        staleness_threshold_hours: 24,
        suppress_repeats_from_previous_digest: true,
        include_unresolved_from_yesterday: true,
      },
    },
    worker: structuredClone(defaultWorker),
    data_ingest: structuredClone(defaultDataIngest),
    scenario_testing: {
      parts: [],
    },
  };
}

export function createMinimalSystemState(now: Date): SystemState {
  return {
    queue: {
      pending: [],
      recently_dispatched: [],
    },
    outbound_budget_tracker: {
      date: now,
      by_person: {},
      by_thread: {},
    },
    escalation_status: {
      active: [],
    },
    calendar: {
      events: [],
    },
    chores: {
      active: [],
      completed_recent: [],
    },
    finances: {
      bills: [],
      expenses_recent: [],
      savings_goals: [],
    },
    grocery: {
      list: [],
      recently_purchased: [],
    },
    health: {
      profiles: [],
    },
    pets: {
      profiles: [],
    },
    school: {
      students: [],
      communications: [],
    },
    travel: {
      trips: [],
    },
    vendors: {
      records: [],
    },
    business: {
      profiles: [],
      leads: [],
    },
    relationship: {
      last_nudge: {
        date: now,
        thread: "",
        content: "",
        response_received: false,
      },
      next_nudge_eligible: now,
      nudge_history: [],
    },
    family_status: {
      current: [],
    },
    meals: {
      planned: [],
      dietary_notes: [],
    },
    maintenance: {
      assets: [],
      items: [],
    },
    confirmations: {
      pending: [],
      recent: [],
    },
    threads: {},
    data_ingest_state: {
      email_monitor: createEmptyIngestSourceState(),
      calendar_sync: createEmptyIngestSourceState(),
      forwarded_messages: createEmptyIngestSourceState(),
    },
    digests: {
      history: [],
    },
  };
}
