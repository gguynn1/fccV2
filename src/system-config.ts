import {
  type SystemConfig,
  EntityType,
  Permission,
  ThreadType,
  EscalationLevel,
  TopicKey,
  GrocerySection,
  ConfirmationActionType,
  DataIngestSourceType,
  WorkerAction,
  WorkerService,
} from "./index.js";

export const systemConfig: SystemConfig = {
  metadata: {
    snapshot_time: new Date("2026-04-02T17:05:00-07:00"),
    description:
      "Static system definition — entities, threads, topics, behavior profiles, dispatch rules, escalation paths, and all configuration that governs how the system operates.",
  },

  system: {
    timezone: "America/Denver",
    locale: "en-US",
    version: "0.1.0",
  },

  assistant: {
    messaging_identity: "+15551000000",
    name: null,
    description:
      "Family coordination assistant. No name. One messaging identity. Identified as a contact in each family member's phone.",
  },

  entities: [
    {
      id: "participant_1",
      type: EntityType.Adult,
      name: "PARTICIPANT 1",
      messaging_identity: "+15551000001",
      permissions: [
        Permission.ApproveFinancial,
        Permission.ApproveSends,
        Permission.ModifySystem,
        Permission.AssignTasks,
        Permission.ViewAllTopics,
      ],
      digest: {
        morning: "07:00",
        evening: "20:00",
      },
    },
    {
      id: "participant_2",
      type: EntityType.Adult,
      name: "PARTICIPANT 2",
      messaging_identity: "+15551000002",
      permissions: [
        Permission.ApproveFinancial,
        Permission.ApproveSends,
        Permission.ModifySystem,
        Permission.AssignTasks,
        Permission.ViewAllTopics,
      ],
      digest: {
        morning: "07:00",
        evening: "20:00",
      },
    },
    {
      id: "participant_3",
      type: EntityType.Child,
      name: "PARTICIPANT 3",
      messaging_identity: "+15551000003",
      permissions: [Permission.CompleteTasks, Permission.AddItems, Permission.AskQuestions],
      digest: {
        morning: "07:30",
        evening: null,
      },
    },
    {
      id: "pet_1",
      type: EntityType.Pet,
      name: "PET",
      messaging_identity: null,
      permissions: [],
      profile: {
        species: "dog",
        breed: null,
        vet: null,
        medications: [],
        care_schedule: [],
      },
      routes_to: ["participant_1", "participant_2"],
    },
  ],

  threads: [
    {
      id: "participant_1_private",
      type: ThreadType.Private,
      participants: ["participant_1"],
      description:
        "PARTICIPANT 1's private thread with the assistant. Health, personal reminders, digests, drafts, review space.",
    },
    {
      id: "participant_2_private",
      type: ThreadType.Private,
      participants: ["participant_2"],
      description:
        "PARTICIPANT 2's private thread. Photography, morning check-in, digests, drafts, review space.",
    },
    {
      id: "participant_3_private",
      type: ThreadType.Private,
      participants: ["participant_3"],
      description: "PARTICIPANT 3's thread. Chore reminders, school nudges, tasks.",
    },
    {
      id: "couple",
      type: ThreadType.Shared,
      participants: ["participant_1", "participant_2"],
      description: "Couple thread. Finances, relationship, couple-level coordination.",
    },
    {
      id: "family",
      type: ThreadType.Shared,
      participants: ["participant_1", "participant_2", "participant_3"],
      description: "Family thread. Chores, grocery, travel, pets, general household.",
    },
  ],

  topics: {
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
        initiative:
          "follow-up-driven: remind when a vendor hasn't responded within expected window",
      },
      escalation: EscalationLevel.None,
    },

    photography: {
      label: "Photography",
      description: "Lead tracking, inquiry management, draft replies, booking status.",
      routing: {
        default: "participant_2_private",
      },
      behavior: {
        tone_internal: "professional and organized, business assistant",
        tone_client_drafts: "professional and warm, client-facing",
        format: "pipeline: new leads, follow-up timing, draft replies, booking status",
        initiative:
          "pipeline-driven: new lead alerts, follow-up reminders after quiet period, draft replies for approval",
      },
      escalation: EscalationLevel.None,
      confirmation_required_for_sends: true,
      follow_up_quiet_period: "48h",
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
  },

  dispatch: {
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
    },
  },

  confirmation_gates: {
    always_require_approval: [
      ConfirmationActionType.SendingOnBehalf,
      ConfirmationActionType.FinancialAction,
      ConfirmationActionType.SystemChange,
    ],
    expiry_minutes: 5,
    on_expiry:
      "Tell the user it expired. Ask them to reissue if they still want it. Never auto-execute.",
  },

  input_recognition: {
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
      },
    },
    forwarded_content: {
      description:
        "Parse forwarded text or email. Extract details, classify topic, ask what to do.",
    },
    silence: {
      high_accountability: "feeds escalation ladder",
      low_accountability: "means not now, respected, no follow-up",
      never: "treated as approval",
    },
  },

  data_ingest: {
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
  },

  daily_rhythm: {
    morning_digest: {
      description:
        "Delivered to each person in their private thread. What's ahead, what's due, what's unresolved.",
      times: {
        participant_1: "07:00",
        participant_2: "07:00",
        participant_3: "07:30",
      },
    },
    evening_checkin: {
      description: "Brief check-in if anything is still open. Otherwise, nothing.",
      times: {
        participant_1: "20:00",
        participant_2: "20:00",
        participant_3: null,
      },
    },
    default_state: "quiet",
  },

  worker: {
    processing_sequence: [
      {
        step: 1,
        action: WorkerAction.ClassifyTopic,
        service: WorkerService.Classifier,
        description: "Determine which of the 12 topics this item belongs to.",
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
        action: WorkerAction.ApplyBehaviorProfile,
        service: WorkerService.TopicProfile,
        description:
          "Apply tone, format, initiative style, and framework from the topic's behavior profile.",
      },
      {
        step: 7,
        action: WorkerAction.RouteAndDispatch,
        service: WorkerService.Routing,
        description:
          "Determine target thread, then dispatch (immediate), hold (batched), or store (silent).",
      },
    ],
  },

  escalation_profiles: {
    high: {
      label: "High Accountability",
      applies_to: [TopicKey.Chores, TopicKey.Finances],
      steps: [
        "message to responsible person in private thread",
        "follow-up reminder after configured window",
        "escalate to broader thread so others can see",
        "flag as unresolved in next digest",
      ],
    },
    medium: {
      label: "Medium Accountability",
      applies_to: [TopicKey.School, TopicKey.Health, TopicKey.Calendar, TopicKey.Travel],
      steps: [
        "message to responsible person",
        "one follow-up reminder",
        "flag in digest — no thread escalation unless hard deadline is imminent",
      ],
    },
    low: {
      label: "Low Accountability",
      applies_to: [TopicKey.Relationship, TopicKey.Pets, TopicKey.FamilyStatus],
      steps: [
        "send once",
        "if ignored, quietly disappear",
        "maybe try again in a few days with something different",
        "never pressure, never escalate, never follow up",
      ],
    },
    none: {
      label: "No Escalation",
      applies_to: [TopicKey.Grocery, TopicKey.Vendors, TopicKey.Photography],
      steps: ["send once or store silently", "no follow-up"],
    },
  },

  scenario_testing: {
    description: "Every scenario has five parts. Used for design validation and model refinement.",
    parts: [
      "trigger — what initiates the scenario",
      "expected_dispatch — what gets sent, to whom, when, how",
      "expected_input_handling — what happens when the person responds or does not",
      "escalation_check — does escalation apply, and at what level",
      "collision_check — does this conflict with anything already pending or recently sent",
    ],
  },
};
