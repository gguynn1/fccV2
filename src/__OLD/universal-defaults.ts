import {
  AssignmentStatus,
  BillStatus,
  BusinessLeadStatus,
  CalendarEventStatus,
  ChecklistItemStatus,
  ChoreEventType,
  ChoreStatus,
  ClassifierIntent,
  CollisionPrecedence,
  ConfirmationActionType,
  ConfirmationResult,
  DataIngestSourceType,
  DispatchPriority,
  EscalationLevel,
  EscalationReassignmentPolicy,
  GrocerySection,
  HealthProviderType,
  InputMethod,
  MaintenanceAssetType,
  MaintenanceInterval,
  MaintenanceStatus,
  MealPlanStatus,
  MealType,
  NudgeType,
  PaceStatus,
  QueueItemSource,
  QueueItemType,
  QueuePendingStatus,
  RecurringInterval,
  SchoolInputSource,
  TopicKey,
  TripStatus,
  VendorJobStatus,
  WorkerAction,
  WorkerService,
  type SystemConfig,
  type SystemState,
} from "../index.js";

// ── Config ──

export const seedTopics: SystemConfig["topics"] = {
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
        "professional and adapted to business type — warm for client-facing services, specific for service-based businesses",
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
        "draws on Internal Family Systems Therapy, emotionally focused approaches, attachment-based connection prompts — small bids, not therapy",
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
      "Home, vehicle, and appliance maintenance tracking — what needs doing, when it was last done, when it's due next.",
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

export const seedDispatch: SystemConfig["dispatch"] = {
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

export const seedEscalationProfiles: SystemConfig["escalation_profiles"] = {
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
      "flag in digest — no thread escalation unless hard deadline is imminent",
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

export const seedConfirmationGates: SystemConfig["confirmation_gates"] = {
  always_require_approval: [
    ConfirmationActionType.SendingOnBehalf,
    ConfirmationActionType.FinancialAction,
    ConfirmationActionType.SystemChange,
  ],
  expiry_minutes: 5,
  on_expiry:
    "Tell the user it expired. Ask them to reissue if they still want it. Never auto-execute.",
};

export const seedInputRecognition: SystemConfig["input_recognition"] = {
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
          "If the message is about what to eat, what to cook, meal planning, recipes, or dinner decisions → Meals. If the message is about items to buy, shopping lists, or store runs → Grocery. 'What should we have for dinner?' is Meals. 'We need ground beef' is Grocery — unless it's part of an active meal planning conversation, then Meals.",
      },
      {
        close_topics: ["maintenance", "vendors"],
        guidance:
          "If the message is about recurring upkeep, service intervals, or 'when did we last...' → Maintenance. If the message is about hiring or scheduling a specific service provider → Vendors. 'When was the oil changed last?' is Maintenance. 'The plumber is coming Tuesday' is Vendors.",
      },
      {
        close_topics: ["maintenance", "chores"],
        guidance:
          "If the task recurs on a cycle (seasonal, mileage, quarterly) and involves a home, vehicle, or appliance → Maintenance. If the task is a one-off household duty assigned to a person → Chores. 'Change the furnace filter' is Maintenance. 'Take out the trash' is Chores.",
      },
      {
        close_topics: ["business", "vendors"],
        guidance:
          "If the message is about YOUR clients, leads, inquiries, or draft replies to people seeking your services → Business. If the message is about someone YOU are hiring or scheduling to do work for you → Vendors. 'I got a new inquiry about a portrait session' is Business. 'The plumber can come Thursday' is Vendors.",
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
          "If the event or item is in the future and has not occurred yet, the participant wants to cancel it (Cancellation). If the event has already happened or the task has been performed, the participant is reporting it done (Completion). 'I'm done with the dentist' after the appointment time → Completion. 'I'm done with the dentist' before the appointment → Cancellation. When still ambiguous, ask for clarification.",
      },
      {
        close_intents: ["request", "update"],
        guidance:
          "If no matching item exists in state, treat as a new Request. If a matching item already exists, treat as an Update to that item. 'Schedule a dentist appointment' when none exists → Request. 'Move the dentist to Thursday' when one exists → Update. If multiple items match, request clarification before proceeding.",
      },
      {
        close_intents: ["cancellation", "update"],
        guidance:
          "If the participant wants to remove or stop something entirely → Cancellation. If they want to change details but keep it → Update. 'Cancel the dentist' → Cancellation. 'Move the dentist to Thursday' → Update. 'Never mind about the dentist' → Cancellation.",
      },
      {
        close_intents: ["query", "request"],
        guidance:
          "If the participant is asking about existing state → Query. If they are asking the system to create or do something new → Request. 'What's on the calendar Thursday?' → Query. 'Add a dentist appointment Thursday' → Request. 'Do we have anything Thursday?' → Query.",
      },
    ],
  },
};

export const seedWorker: SystemConfig["worker"] = {
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

export const seedDataIngest: SystemConfig["data_ingest"] = {
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

export const seedScenarioTesting: SystemConfig["scenario_testing"] = {
  description: "Every scenario has five parts. Used for design validation and model refinement.",
  parts: [
    "trigger — what initiates the scenario",
    "expected_dispatch — what gets sent, to whom, when, how",
    "expected_input_handling — what happens when the person responds or does not",
    "escalation_check — does escalation apply, and at what level",
    "collision_check — does this conflict with anything already pending or recently sent",
  ],
};

// ── State ──

export const seedQueue: SystemState["queue"] = {
  pending: [
    {
      id: "q_002",
      source: QueueItemSource.ScheduledTrigger,
      type: QueueItemType.Outbound,
      topic: TopicKey.Health,
      intent: ClassifierIntent.Query,
      concerning: ["participant_1"],
      content: "Post-appointment follow-up: any notes from today's dentist visit?",
      priority: DispatchPriority.Batched,
      target_thread: "participant_1_private",
      created_at: new Date("2026-04-02T14:00:00-07:00"),
      hold_until: new Date("2026-04-02T16:00:00-07:00"),
    },
    {
      id: "q_003",
      source: QueueItemSource.EmailMonitor,
      type: QueueItemType.Inbound,
      topic: TopicKey.School,
      intent: ClassifierIntent.ForwardedData,
      concerning: ["participant_3"],
      content: {
        from: "teacher@school.edu",
        subject: "Science project due April 10",
        extracted: {
          assignment: "Science fair project — research phase",
          due_date: "2026-04-10",
          details: "Topic selection due by April 5, full project April 10",
        },
      },
      target_thread: "participant_3_private",
      created_at: new Date("2026-04-02T13:45:00-07:00"),
      status: QueuePendingStatus.PendingClassification,
    },
  ],

  recently_dispatched: [
    {
      id: "q_000a",
      topic: TopicKey.Calendar,
      target_thread: "participant_1_private",
      content: "Reminder: dentist appointment today at 2pm at Smile Dental",
      dispatched_at: new Date("2026-04-02T08:00:00-07:00"),
      priority: DispatchPriority.Batched,
      included_in: "morning_digest",
    },
    {
      id: "q_000b",
      topic: TopicKey.Chores,
      target_thread: "participant_3_private",
      content: "Trash needs to go out by 5pm today",
      dispatched_at: new Date("2026-04-02T15:00:00-07:00"),
      priority: DispatchPriority.Immediate,
      response_received: false,
      escalation_step: 1,
    },
    {
      id: "q_001",
      topic: TopicKey.Chores,
      target_thread: "participant_3_private",
      content: "Follow-up: trash was due by 5pm, not marked complete",
      dispatched_at: new Date("2026-04-02T17:01:00-07:00"),
      priority: DispatchPriority.Immediate,
      response_received: false,
      escalation_step: 2,
    },
  ],
};

export const seedCalendar: SystemState["calendar"] = {
  events: [
    {
      id: "cal_001",
      title: "Dentist appointment",
      date: new Date("2026-04-02"),
      time: "14:00",
      location: "Smile Dental",
      concerning: ["participant_1"],
      topic: TopicKey.Health,
      status: CalendarEventStatus.Completed,
      follow_up_due: new Date("2026-04-02T16:00:00-07:00"),
      follow_up_sent: false,
      created_by: "participant_2",
      created_in_thread: "couple",
      created_at: new Date("2026-03-28T09:00:00-07:00"),
    },
    {
      id: "cal_002",
      title: "Science project — topic selection",
      date: new Date("2026-04-05"),
      time: null,
      location: null,
      concerning: ["participant_3"],
      topic: TopicKey.School,
      status: CalendarEventStatus.Upcoming,
      created_by: "email_monitor",
      created_at: new Date("2026-04-02T13:45:00-07:00"),
    },
    {
      id: "cal_003",
      title: "Family dinner at Grandma's",
      date: new Date("2026-04-06"),
      time: "17:00",
      location: "Grandma's house",
      concerning: ["participant_1", "participant_2", "participant_3"],
      topic: TopicKey.Calendar,
      status: CalendarEventStatus.Upcoming,
      created_by: "participant_1",
      created_in_thread: "family",
      created_at: new Date("2026-04-01T19:00:00-07:00"),
    },
    {
      id: "cal_004",
      title: "PET annual vet checkup",
      date: new Date("2026-04-14"),
      time: "10:00",
      location: "Pawsome Vet Clinic",
      concerning: ["pet_1"],
      topic: TopicKey.Pets,
      responsible: "participant_2",
      status: CalendarEventStatus.Upcoming,
      created_by: "participant_2",
      created_in_thread: "participant_2_private",
      created_at: new Date("2026-04-01T10:00:00-07:00"),
    },
    {
      id: "cal_005",
      title: "Family vacation",
      date_start: new Date("2026-06-15"),
      date_end: new Date("2026-06-22"),
      concerning: ["participant_1", "participant_2", "participant_3"],
      topic: TopicKey.Travel,
      status: CalendarEventStatus.Planning,
      created_by: "participant_1",
      created_in_thread: "family",
      created_at: new Date("2026-03-15T20:00:00-07:00"),
    },
  ],
};

export const seedChores: SystemState["chores"] = {
  active: [
    {
      id: "chore_001",
      task: "Take out the trash",
      assigned_to: "participant_3",
      assigned_by: "participant_1",
      assigned_in_thread: "family",
      due: new Date("2026-04-02T17:00:00-07:00"),
      status: ChoreStatus.Overdue,
      escalation_step: 2,
      history: [
        {
          event: ChoreEventType.Assigned,
          at: new Date("2026-04-02T08:00:00-07:00"),
        },
        {
          event: ChoreEventType.ReminderSent,
          at: new Date("2026-04-02T15:00:00-07:00"),
          thread: "participant_3_private",
        },
        {
          event: ChoreEventType.DeadlinePassed,
          at: new Date("2026-04-02T17:00:00-07:00"),
        },
        {
          event: ChoreEventType.FollowUpSent,
          at: new Date("2026-04-02T17:01:00-07:00"),
          thread: "participant_3_private",
        },
      ],
    },
    {
      id: "chore_002",
      task: "Unload dishwasher",
      assigned_to: "participant_3",
      assigned_by: "participant_2",
      assigned_in_thread: "family",
      due: new Date("2026-04-03T10:00:00-07:00"),
      status: ChoreStatus.Pending,
      escalation_step: 0,
    },
  ],
  completed_recent: [
    {
      id: "chore_000",
      task: "Mow the lawn",
      assigned_to: "participant_1",
      completed_at: new Date("2026-03-30T16:30:00-07:00"),
      completed_via: InputMethod.Text,
      response: "Done",
    },
  ],
};

export const seedFinances: SystemState["finances"] = {
  bills: [
    {
      id: "bill_001",
      name: "Mortgage",
      amount: 2450.0,
      due_date: new Date("2026-04-15"),
      status: BillStatus.Upcoming,
      reminder_sent: false,
      recurring: RecurringInterval.Monthly,
    },
    {
      id: "bill_002",
      name: "Electric bill",
      amount: 187.5,
      due_date: new Date("2026-04-08"),
      status: BillStatus.Upcoming,
      reminder_sent: false,
      recurring: RecurringInterval.Monthly,
    },
    {
      id: "bill_003",
      name: "Internet",
      amount: 79.99,
      due_date: new Date("2026-04-05"),
      status: BillStatus.Upcoming,
      reminder_sent: true,
      reminder_sent_at: new Date("2026-04-02T07:00:00-07:00"),
      recurring: RecurringInterval.Monthly,
    },
  ],
  expenses_recent: [
    {
      id: "exp_001",
      description: "Household supplies",
      amount: 47.32,
      date: new Date("2026-04-01"),
      logged_by: "participant_2",
      logged_via: InputMethod.Image,
      confirmed: true,
    },
    {
      id: "exp_002",
      description: "Gas station",
      amount: 62.1,
      date: new Date("2026-03-31"),
      logged_by: "participant_1",
      logged_via: InputMethod.Text,
      confirmed: true,
    },
  ],
  savings_goals: [
    {
      id: "savings_001",
      name: "Family vacation fund",
      target: 5000.0,
      current: 3700.0,
      percent: 74,
      deadline: new Date("2026-06-01"),
      last_contribution: {
        amount: 500.0,
        date: new Date("2026-03-28"),
        logged_by: "participant_1",
      },
      pace_status: PaceStatus.OnTrack,
    },
    {
      id: "savings_002",
      name: "Emergency fund",
      target: 10000.0,
      current: 6200.0,
      percent: 62,
      deadline: null,
      pace_status: PaceStatus.Steady,
    },
  ],
};

export const seedGrocery: SystemState["grocery"] = {
  list: [
    {
      id: "groc_001",
      item: "Milk",
      section: GrocerySection.Dairy,
      added_by: "participant_2",
      added_at: new Date("2026-04-01T18:00:00-07:00"),
    },
    {
      id: "groc_002",
      item: "Eggs",
      section: GrocerySection.Dairy,
      added_by: "participant_1",
      added_at: new Date("2026-04-02T07:30:00-07:00"),
    },
    {
      id: "groc_003",
      item: "Chicken breast",
      section: GrocerySection.Meat,
      added_by: "participant_2",
      added_at: new Date("2026-04-01T18:00:00-07:00"),
    },
    {
      id: "groc_004",
      item: "Bananas",
      section: GrocerySection.Produce,
      added_by: "participant_3",
      added_at: new Date("2026-04-02T08:00:00-07:00"),
    },
    {
      id: "groc_005",
      item: "Bread",
      section: GrocerySection.Pantry,
      added_by: "participant_2",
      added_at: new Date("2026-04-02T10:00:00-07:00"),
    },
    {
      id: "groc_006",
      item: "Dish soap",
      section: GrocerySection.Household,
      added_by: "participant_1",
      added_at: new Date("2026-04-02T12:00:00-07:00"),
    },
  ],
  recently_purchased: [
    {
      item: "Pasta",
      purchased_by: "participant_2",
      purchased_at: new Date("2026-03-30T14:00:00-07:00"),
    },
    {
      item: "Tomato sauce",
      purchased_by: "participant_2",
      purchased_at: new Date("2026-03-30T14:00:00-07:00"),
    },
  ],
};

export const seedHealth: SystemState["health"] = {
  profiles: [
    {
      entity: "participant_1",
      medications: [
        {
          name: "Vitamin D",
          dosage: "2000 IU",
          frequency: "daily",
          reminder: false,
        },
      ],
      allergies: ["penicillin"],
      providers: [
        {
          type: HealthProviderType.Dentist,
          name: "Dr. Chen",
          location: "Smile Dental",
          last_visit: new Date("2026-04-02"),
        },
        {
          type: HealthProviderType.Primary,
          name: "Dr. Patel",
          location: "Family Medical Group",
          last_visit: new Date("2025-11-15"),
        },
      ],
      upcoming_appointments: [],
      notes: [],
    },
    {
      entity: "participant_2",
      medications: [],
      allergies: [],
      providers: [
        {
          type: HealthProviderType.Primary,
          name: "Dr. Rivera",
          location: "Wellness Clinic",
          last_visit: new Date("2026-01-20"),
        },
      ],
      upcoming_appointments: [],
      notes: [],
    },
  ],
};

export const seedPets: SystemState["pets"] = {
  profiles: [
    {
      entity: "pet_1",
      species: "dog",
      vet: "Pawsome Vet Clinic",
      last_vet_visit: new Date("2025-05-10"),
      medications: [],
      care_log_recent: [
        {
          activity: "walk",
          by: "participant_1",
          at: new Date("2026-04-02T06:30:00-07:00"),
        },
        {
          activity: "fed breakfast",
          by: "participant_3",
          at: new Date("2026-04-02T07:00:00-07:00"),
        },
        {
          activity: "walk",
          by: "participant_2",
          at: new Date("2026-04-01T17:00:00-07:00"),
        },
        {
          activity: "grooming",
          by: "participant_2",
          at: new Date("2026-03-29T10:00:00-07:00"),
        },
      ],
      upcoming: ["cal_004"],
      notes: ["Needs flea treatment before summer"],
    },
  ],
};

export const seedSchool: SystemState["school"] = {
  students: [
    {
      entity: "participant_3",
      assignments: [
        {
          id: "school_001",
          title: "Science fair project — topic selection",
          due_date: new Date("2026-04-05"),
          status: AssignmentStatus.NotStarted,
          source: SchoolInputSource.EmailParsing,
          parent_notified: false,
        },
        {
          id: "school_002",
          title: "Science fair project — full project",
          due_date: new Date("2026-04-10"),
          status: AssignmentStatus.NotStarted,
          source: SchoolInputSource.EmailParsing,
          parent_notified: false,
        },
        {
          id: "school_003",
          title: "Math homework chapter 7",
          due_date: new Date("2026-04-03"),
          status: AssignmentStatus.InProgress,
          source: SchoolInputSource.Conversation,
          parent_notified: false,
        },
      ],
      completed_recent: [
        {
          title: "English essay — personal narrative",
          completed_at: new Date("2026-03-31T20:00:00-07:00"),
          completed_via: InputMethod.Text,
        },
      ],
    },
  ],
};

export const seedTravel: SystemState["travel"] = {
  trips: [
    {
      id: "trip_001",
      name: "Family vacation",
      dates: { start: new Date("2026-06-15"), end: new Date("2026-06-22") },
      travelers: ["participant_1", "participant_2", "participant_3"],
      status: TripStatus.Planning,
      checklist: [
        {
          item: "Book flights",
          status: ChecklistItemStatus.Done,
          completed_at: new Date("2026-03-20T12:00:00-07:00"),
        },
        {
          item: "Book hotel",
          status: ChecklistItemStatus.Done,
          completed_at: new Date("2026-03-22T15:00:00-07:00"),
        },
        {
          item: "Arrange pet boarding for PET",
          status: ChecklistItemStatus.NotStarted,
          topic_link: "pets",
        },
        {
          item: "Request time off work",
          status: ChecklistItemStatus.Done,
          completed_at: new Date("2026-03-18T09:00:00-07:00"),
        },
        {
          item: "Pack sunscreen and snorkel gear",
          status: ChecklistItemStatus.NotStarted,
        },
        { item: "Set up mail hold", status: ChecklistItemStatus.NotStarted },
        {
          item: "Confirm car rental",
          status: ChecklistItemStatus.NotStarted,
        },
      ],
      budget_link: "savings_001",
      notes: ["PARTICIPANT 3 wants to try surfing lessons", "Check if hotel has airport shuttle"],
    },
  ],
};

export const seedVendors: SystemState["vendors"] = {
  records: [
    {
      id: "vendor_001",
      name: "Mike's Plumbing",
      type: "plumber",
      jobs: [
        {
          description: "Fixed kitchen sink leak",
          date: new Date("2026-02-10"),
          cost: 275.0,
          status: VendorJobStatus.Completed,
          notes: ["Good work, arrived on time"],
        },
      ],
      contact: "555-0199",
      managed_by: "participant_1",
      follow_up_pending: false,
    },
    {
      id: "vendor_002",
      name: "Green Thumb Landscaping",
      type: "landscaper",
      jobs: [
        {
          description: "Spring yard cleanup quote",
          date: new Date("2026-03-25"),
          cost: null,
          status: VendorJobStatus.WaitingForQuote,
          notes: ["Said they'd send quote by end of week"],
        },
      ],
      contact: "555-0234",
      managed_by: "participant_1",
      follow_up_pending: true,
      follow_up_due: new Date("2026-04-04"),
    },
  ],
};

export const seedBusiness: SystemState["business"] = {
  profiles: [
    {
      entity: "participant_2",
      business_type: "photography",
      business_name: "Portrait & event photography",
      follow_up_quiet_period_days: 2,
    },
  ],
  leads: [
    {
      id: "biz_001",
      owner: "participant_2",
      client_name: "Jessica M.",
      inquiry_date: new Date("2026-03-28"),
      event_type: "family portrait session",
      event_date: new Date("2026-05-10"),
      status: BusinessLeadStatus.AwaitingReply,
      last_contact: new Date("2026-03-29T10:00:00-07:00"),
      draft_reply: null,
      follow_up_due: new Date("2026-04-03"),
      notes: "Wants outdoor location, 2 kids under 5",
    },
    {
      id: "biz_002",
      owner: "participant_2",
      client_name: "Mark and Dana",
      inquiry_date: new Date("2026-04-01"),
      event_type: "engagement shoot",
      event_date: null,
      status: BusinessLeadStatus.New,
      last_contact: new Date("2026-04-01T14:00:00-07:00"),
      draft_reply:
        "Hi Mark and Dana! Thank you so much for reaching out. I'd love to hear more about what you're envisioning for your engagement session. Do you have a preferred location or timeframe in mind?",
      draft_approved: false,
      notes: "Found via social media",
    },
  ],
};

export const seedRelationship: SystemState["relationship"] = {
  last_nudge: {
    date: new Date("2026-03-27"),
    thread: "couple",
    content: "Busy week — what's one thing you appreciated about each other?",
    response_received: true,
  },
  next_nudge_eligible: new Date("2026-04-01"),
  nudge_history: [
    {
      date: new Date("2026-03-27"),
      type: NudgeType.AppreciationPrompt,
      responded: true,
    },
    {
      date: new Date("2026-03-20"),
      type: NudgeType.DateNightSuggestion,
      responded: false,
    },
    {
      date: new Date("2026-03-13"),
      type: NudgeType.ConversationStarter,
      responded: true,
    },
  ],
};

export const seedFamilyStatus: SystemState["family_status"] = {
  current: [
    {
      entity: "participant_1",
      status: "At dentist appointment",
      updated_at: new Date("2026-04-02T13:45:00-07:00"),
      expires_at: new Date("2026-04-02T19:45:00-07:00"),
    },
  ],
};

export const seedMeals: SystemState["meals"] = {
  planned: [
    {
      id: "meal_001",
      date: new Date("2026-04-02"),
      meal_type: MealType.Dinner,
      description: "Tacos — ground beef, tortillas, cheese, salsa",
      planned_by: "participant_2",
      status: MealPlanStatus.Planned,
      grocery_items_linked: ["ground beef", "tortillas", "shredded cheese", "salsa"],
    },
    {
      id: "meal_002",
      date: new Date("2026-04-03"),
      meal_type: MealType.Dinner,
      description: "Pasta with marinara and garlic bread",
      planned_by: "participant_1",
      status: MealPlanStatus.Planned,
    },
  ],
  dietary_notes: [
    {
      entity: "participant_3",
      note: "No mushrooms",
      added_at: new Date("2026-03-15T10:00:00-07:00"),
    },
  ],
};

export const seedMaintenance: SystemState["maintenance"] = {
  assets: [
    {
      id: "asset_001",
      type: MaintenanceAssetType.Vehicle,
      name: "Family SUV",
      details: { year: "2022", make: "Toyota", model: "Highlander" },
    },
    {
      id: "asset_002",
      type: MaintenanceAssetType.Home,
      name: "Primary residence",
      details: {},
    },
  ],
  items: [
    {
      id: "maint_001",
      asset_id: "asset_001",
      task: "Oil change",
      interval: MaintenanceInterval.Quarterly,
      last_performed: new Date("2026-01-15"),
      next_due: new Date("2026-04-15"),
      responsible: "participant_1",
      status: MaintenanceStatus.DueSoon,
      history: [
        {
          date: new Date("2026-01-15"),
          performed_by: "participant_1",
          cost: 75,
          notes: "Full synthetic at dealership",
        },
      ],
    },
    {
      id: "maint_002",
      asset_id: "asset_002",
      task: "HVAC filter replacement",
      interval: MaintenanceInterval.Quarterly,
      last_performed: new Date("2025-12-01"),
      next_due: new Date("2026-03-01"),
      responsible: "participant_1",
      status: MaintenanceStatus.Overdue,
      history: [],
    },
  ],
};

export const seedConfirmations: SystemState["confirmations"] = {
  pending: [],
  recent: [
    {
      id: "confirm_001",
      type: ConfirmationActionType.FinancialAction,
      action: "Mark internet bill ($79.99) as paid",
      requested_by: "participant_1",
      requested_in_thread: "couple",
      requested_at: new Date("2026-04-02T14:15:00-07:00"),
      expired_at: new Date("2026-04-02T14:20:00-07:00"),
      result: ConfirmationResult.Expired,
    },
    {
      id: "confirm_000",
      type: ConfirmationActionType.SendingOnBehalf,
      action: "Send draft reply to Mark and Dana (business inquiry)",
      requested_by: "participant_2",
      requested_in_thread: "participant_2_private",
      result: ConfirmationResult.NotYetApproved,
      requested_at: new Date("2026-04-01T15:00:00-07:00"),
    },
  ],
};

export const seedDataIngestState: SystemState["data_ingest_state"] = {
  email_monitor: {
    active: false,
    last_poll: new Date("2026-04-02T14:25:00-07:00"),
    last_poll_result: "1 new item",
    processed: [
      {
        source_id: "email_8831",
        from: "teacher@school.edu",
        subject: "Science project due April 10",
        received_at: new Date("2026-04-02T13:40:00-07:00"),
        processed_at: new Date("2026-04-02T13:45:00-07:00"),
        queue_item_created: "q_003",
        topic_classified: "school",
      },
    ],
    watermark: new Date("2026-04-02T14:25:00-07:00"),
  },
  calendar_sync: {
    active: false,
    last_sync: null,
    processed: [],
    watermark: null,
  },
  forwarded_messages: {
    active: true,
    last_received: new Date("2026-04-01T14:00:00-07:00"),
    processed: [
      {
        source_id: "fwd_001",
        from: "participant_2",
        content_type: "business_inquiry",
        received_at: new Date("2026-04-01T14:00:00-07:00"),
        processed_at: new Date("2026-04-01T14:00:05-07:00"),
        topic_classified: "business",
        state_ref: "biz_002",
      },
    ],
    total_processed: 4,
  },
};
