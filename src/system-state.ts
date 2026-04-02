import {
  type SystemState,
  TopicKey,
  EscalationLevel,
  DispatchPriority,
  GrocerySection,
  ConfirmationActionType,
  QueueItemType,
  QueueItemSource,
  QueuePendingStatus,
  CalendarEventStatus,
  ChoreStatus,
  ChoreEventType,
  BillStatus,
  RecurringInterval,
  InputMethod,
  PaceStatus,
  AssignmentStatus,
  ChecklistItemStatus,
  TripStatus,
  VendorJobStatus,
  PhotoLeadStatus,
  NudgeType,
  ConfirmationResult,
  EscalationStepAction,
  HealthProviderType,
} from "./types.js";

export const systemState: SystemState = {
  metadata: {
    snapshot_time: new Date("2026-04-02T17:05:00-07:00"),
    description:
      "Current state of all tracked items, pending actions, and active records.",
  },

  queue: {
    pending: [
      {
        id: "q_002",
        source: QueueItemSource.ScheduledTrigger,
        type: QueueItemType.Outbound,
        topic: TopicKey.Health,
        concerning: ["participant_1"],
        content:
          "Post-appointment follow-up: any notes from today's dentist visit?",
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
  },

  outbound_budget_tracker: {
    date: new Date("2026-04-02"),
    by_person: {
      participant_1: {
        unprompted_sent: 1,
        max: 5,
        messages: [
          {
            id: "q_000a",
            topic: "calendar",
            at: new Date("2026-04-02T08:00:00-07:00"),
            included_in: "morning_digest",
          },
        ],
      },
      participant_2: {
        unprompted_sent: 1,
        max: 5,
        messages: [
          {
            id: "digest_p2",
            topic: "digest",
            at: new Date("2026-04-02T07:00:00-07:00"),
            included_in: "morning_digest",
          },
        ],
      },
      participant_3: {
        unprompted_sent: 3,
        max: 5,
        messages: [
          {
            id: "digest_p3",
            topic: "digest",
            at: new Date("2026-04-02T07:30:00-07:00"),
            included_in: "morning_digest",
          },
          {
            id: "q_000b",
            topic: "chores",
            at: new Date("2026-04-02T15:00:00-07:00"),
          },
          {
            id: "q_001",
            topic: "chores",
            at: new Date("2026-04-02T17:01:00-07:00"),
          },
        ],
      },
    },
    by_thread: {
      participant_1_private: {
        last_hour_count: 0,
        max_per_hour: 2,
        last_sent_at: new Date("2026-04-02T12:30:05-07:00"),
      },
      participant_2_private: {
        last_hour_count: 0,
        max_per_hour: 2,
        last_sent_at: new Date("2026-04-02T10:04:06-07:00"),
      },
      participant_3_private: {
        last_hour_count: 1,
        max_per_hour: 2,
        last_sent_at: new Date("2026-04-02T17:01:00-07:00"),
      },
      couple: {
        last_hour_count: 0,
        max_per_hour: 2,
        last_sent_at: new Date("2026-04-02T14:15:05-07:00"),
      },
      family: {
        last_hour_count: 0,
        max_per_hour: 2,
        last_sent_at: new Date("2026-04-02T08:00:20-07:00"),
      },
    },
  },

  escalation_status: {
    active: [
      {
        id: "esc_001",
        topic: TopicKey.Chores,
        item_ref: "chore_001",
        profile: EscalationLevel.High,
        concerning: ["participant_3"],
        current_step: 2,
        history: [
          {
            step: 1,
            action: EscalationStepAction.ReminderSent,
            thread: "participant_3_private",
            at: new Date("2026-04-02T15:00:00-07:00"),
          },
          {
            step: 2,
            action: EscalationStepAction.FollowUpSent,
            thread: "participant_3_private",
            at: new Date("2026-04-02T17:01:00-07:00"),
          },
        ],
        next_action: EscalationStepAction.EscalateToBroaderThread,
        next_action_at: new Date("2026-04-02T18:01:00-07:00"),
        target_thread_for_escalation: "family",
      },
    ],
  },

  calendar: {
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
  },

  chores: {
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
  },

  finances: {
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
  },

  grocery: {
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
  },

  health: {
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
  },

  pets: {
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
  },

  school: {
    students: [
      {
        entity: "participant_3",
        assignments: [
          {
            id: "school_001",
            title: "Science fair project — topic selection",
            due_date: new Date("2026-04-05"),
            status: AssignmentStatus.NotStarted,
            source: "email_monitor",
            parent_notified: false,
          },
          {
            id: "school_002",
            title: "Science fair project — full project",
            due_date: new Date("2026-04-10"),
            status: AssignmentStatus.NotStarted,
            source: "email_monitor",
            parent_notified: false,
          },
          {
            id: "school_003",
            title: "Math homework chapter 7",
            due_date: new Date("2026-04-03"),
            status: AssignmentStatus.InProgress,
            source: "participant_3",
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
  },

  travel: {
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
        notes: [
          "PARTICIPANT 3 wants to try surfing lessons",
          "Check if hotel has airport shuttle",
        ],
      },
    ],
  },

  vendors: {
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
            notes: "Good work, arrived on time",
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
            notes: "Said they'd send quote by end of week",
          },
        ],
        contact: "555-0234",
        managed_by: "participant_1",
        follow_up_pending: true,
        follow_up_due: new Date("2026-04-04"),
      },
    ],
  },

  photography: {
    leads: [
      {
        id: "photo_001",
        client_name: "Jessica M.",
        inquiry_date: new Date("2026-03-28"),
        event_type: "family portrait session",
        event_date: new Date("2026-05-10"),
        status: PhotoLeadStatus.AwaitingReply,
        last_contact: new Date("2026-03-29T10:00:00-07:00"),
        draft_reply: null,
        follow_up_due: new Date("2026-04-03"),
        notes: "Wants outdoor location, 2 kids under 5",
      },
      {
        id: "photo_002",
        client_name: "Mark and Dana",
        inquiry_date: new Date("2026-04-01"),
        event_type: "engagement shoot",
        event_date: null,
        status: PhotoLeadStatus.New,
        last_contact: new Date("2026-04-01T14:00:00-07:00"),
        draft_reply:
          "Hi Mark and Dana! Thank you so much for reaching out. I'd love to hear more about what you're envisioning for your engagement session. Do you have a preferred location or timeframe in mind?",
        draft_approved: false,
        notes: "Found via social media",
      },
    ],
  },

  relationship: {
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
  },

  family_status: {
    current: [
      {
        entity: "participant_1",
        status: "At dentist appointment",
        updated_at: new Date("2026-04-02T13:45:00-07:00"),
        expires_at: new Date("2026-04-02T19:45:00-07:00"),
      },
    ],
  },

  confirmations: {
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
        action: "Send draft reply to Mark and Dana (photography inquiry)",
        requested_by: "participant_2",
        result: ConfirmationResult.NotYetApproved,
        requested_at: new Date("2026-04-01T15:00:00-07:00"),
      },
    ],
  },

  threads: {
    participant_1_private: {
      active_topic_context: "vendors",
      last_activity: new Date("2026-04-02T12:30:05-07:00"),
      recent_messages: [
        {
          id: "msg_101",
          from: "assistant",
          content:
            "Good morning. Here's what's ahead today:\n- Dentist at 2pm at Smile Dental\n- Internet bill due April 5 ($79.99)\n- Vendor follow-up: Green Thumb Landscaping quote still pending\n- Vacation savings at 74% — on track",
          at: new Date("2026-04-02T07:00:00-07:00"),
          topic_context: "digest",
          dispatch_ref: "q_000a",
        },
        {
          id: "msg_102",
          from: "participant_1",
          content:
            "Thanks. Can you mark the internet bill as paid? I just did it",
          at: new Date("2026-04-02T09:15:00-07:00"),
          topic_context: "finances",
        },
        {
          id: "msg_103",
          from: "assistant",
          content:
            "Got it. Since finances route through the couple thread, I'll send the confirmation there.",
          at: new Date("2026-04-02T09:15:08-07:00"),
          topic_context: "finances",
        },
        {
          id: "msg_104",
          from: "participant_1",
          content: "Landscaping guy still hasn't sent the quote",
          at: new Date("2026-04-02T12:30:00-07:00"),
          topic_context: "vendors",
        },
        {
          id: "msg_105",
          from: "assistant",
          content:
            "Noted — they said end of week. I'll flag it for follow-up Friday if nothing comes in.",
          at: new Date("2026-04-02T12:30:05-07:00"),
          topic_context: "vendors",
          state_ref: "vendor_002",
        },
      ],
    },
    participant_2_private: {
      active_topic_context: "photography",
      last_activity: new Date("2026-04-02T10:05:12-07:00"),
      recent_messages: [
        {
          id: "msg_201",
          from: "assistant",
          content:
            "Good morning. Here's your update:\n- PET vet checkup April 14 at 10am\n- Photography: new lead from Mark and Dana — draft reply ready for review\n- Photography: Jessica M. follow-up due tomorrow\n- Grocery list has 6 items",
          at: new Date("2026-04-02T07:00:00-07:00"),
          topic_context: "digest",
          dispatch_ref: "digest_p2",
        },
        {
          id: "msg_202",
          from: "participant_2",
          content: "Show me the draft for Mark and Dana",
          at: new Date("2026-04-02T10:04:00-07:00"),
          topic_context: "photography",
        },
        {
          id: "msg_203",
          from: "assistant",
          content:
            "Here's the draft:\n\n\"Hi Mark and Dana! Thank you so much for reaching out. I'd love to hear more about what you're envisioning for your engagement session. Do you have a preferred location or timeframe in mind?\"\n\nWant me to send it, edit it, or hold off?",
          at: new Date("2026-04-02T10:04:06-07:00"),
          topic_context: "photography",
          state_ref: "photo_002",
        },
        {
          id: "msg_204",
          from: "participant_2",
          content: "Hold off for now, I want to tweak the wording later",
          at: new Date("2026-04-02T10:05:12-07:00"),
          topic_context: "photography",
        },
      ],
    },
    participant_3_private: {
      active_topic_context: "chores",
      last_activity: new Date("2026-04-02T17:01:00-07:00"),
      recent_messages: [
        {
          id: "msg_301",
          from: "assistant",
          content:
            "Good morning. Two things today:\n- Math homework chapter 7 due tomorrow\n- Trash needs to go out by 5pm today",
          at: new Date("2026-04-02T07:30:00-07:00"),
          topic_context: "digest",
          dispatch_ref: "digest_p3",
        },
        {
          id: "msg_302",
          from: "participant_3",
          content: "Working on math now",
          at: new Date("2026-04-02T08:10:00-07:00"),
          topic_context: "school",
        },
        {
          id: "msg_303",
          from: "assistant",
          content: "Got it. I'll mark math homework as in progress.",
          at: new Date("2026-04-02T08:10:04-07:00"),
          topic_context: "school",
          state_ref: "school_003",
        },
        {
          id: "msg_304",
          from: "assistant",
          content: "Reminder: trash needs to go out by 5pm today.",
          at: new Date("2026-04-02T15:00:00-07:00"),
          topic_context: "chores",
          dispatch_ref: "q_000b",
        },
        {
          id: "msg_305",
          from: "assistant",
          content: "Follow-up: trash was due by 5pm, not marked complete.",
          at: new Date("2026-04-02T17:01:00-07:00"),
          topic_context: "chores",
          dispatch_ref: "q_001",
          escalation_ref: "esc_001",
        },
      ],
    },
    couple: {
      active_topic_context: "finances",
      last_activity: new Date("2026-04-02T14:15:00-07:00"),
      recent_messages: [
        {
          id: "msg_401",
          from: "participant_1",
          content: "Just paid the internet bill",
          at: new Date("2026-04-02T14:15:00-07:00"),
          topic_context: "finances",
        },
        {
          id: "msg_402",
          from: "assistant",
          content: "Got it. Marking internet bill ($79.99) as paid — confirm?",
          at: new Date("2026-04-02T14:15:05-07:00"),
          topic_context: "finances",
          confirmation_ref: "confirm_001",
        },
      ],
    },
    family: {
      active_topic_context: "chores",
      last_activity: new Date("2026-04-02T08:00:15-07:00"),
      recent_messages: [
        {
          id: "msg_501",
          from: "participant_1",
          content: "Trash day today. Can someone take it out by 5?",
          at: new Date("2026-04-02T08:00:00-07:00"),
          topic_context: "chores",
        },
        {
          id: "msg_502",
          from: "assistant",
          content:
            "Got it. I've assigned trash to PARTICIPANT 3 with a 5pm deadline.",
          at: new Date("2026-04-02T08:00:10-07:00"),
          topic_context: "chores",
          state_ref: "chore_001",
        },
        {
          id: "msg_503",
          from: "participant_2",
          content: "Also dishwasher needs unloading tomorrow morning",
          at: new Date("2026-04-02T08:00:15-07:00"),
          topic_context: "chores",
        },
        {
          id: "msg_504",
          from: "assistant",
          content:
            "Added. Unload dishwasher assigned to PARTICIPANT 3, due tomorrow by 10am.",
          at: new Date("2026-04-02T08:00:20-07:00"),
          topic_context: "chores",
          state_ref: "chore_002",
        },
      ],
    },
  },

  data_ingest_state: {
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
          content_type: "photography_inquiry",
          received_at: new Date("2026-04-01T14:00:00-07:00"),
          processed_at: new Date("2026-04-01T14:00:05-07:00"),
          topic_classified: "photography",
          state_ref: "photo_002",
        },
      ],
      total_processed: 4,
    },
  },

  digests: {
    history: [
      {
        date: new Date("2026-04-02"),
        morning: {
          participant_1: {
            delivered_at: new Date("2026-04-02T07:00:00-07:00"),
            thread: "participant_1_private",
            included: [
              "Dentist at 2pm today at Smile Dental",
              "Internet bill due April 5 ($79.99)",
              "Vendor follow-up: Green Thumb Landscaping quote still pending",
              "Vacation savings at 74% — on track",
            ],
          },
          participant_2: {
            delivered_at: new Date("2026-04-02T07:00:00-07:00"),
            thread: "participant_2_private",
            included: [
              "PET vet checkup April 14 at 10am",
              "Photography: new lead from Mark and Dana — draft reply ready for review",
              "Photography: Jessica M. follow-up due tomorrow",
              "Grocery list has 6 items",
            ],
          },
          participant_3: {
            delivered_at: new Date("2026-04-02T07:30:00-07:00"),
            thread: "participant_3_private",
            included: [
              "Math homework chapter 7 due tomorrow",
              "Trash needs to go out by 5pm today",
            ],
          },
        },
        evening: null,
      },
      {
        date: new Date("2026-04-01"),
        morning: {
          participant_1: {
            delivered_at: new Date("2026-04-01T07:00:00-07:00"),
            thread: "participant_1_private",
            included: [
              "Dentist appointment tomorrow at 2pm",
              "Family dinner Sunday at 5pm",
              "Vacation savings update: $3700 of $5000",
            ],
          },
          participant_2: {
            delivered_at: new Date("2026-04-01T07:00:00-07:00"),
            thread: "participant_2_private",
            included: [
              "New photography inquiry from Mark and Dana",
              "Jessica M. follow-up: no response yet (inquiry 3 days ago)",
              "PET vet checkup in 13 days",
            ],
          },
          participant_3: {
            delivered_at: new Date("2026-04-01T07:30:00-07:00"),
            thread: "participant_3_private",
            included: [
              "Math homework chapter 7 due Thursday",
              "English essay due today — is it done?",
            ],
          },
        },
        evening: {
          participant_1: {
            delivered_at: new Date("2026-04-01T20:00:00-07:00"),
            thread: "participant_1_private",
            included: [
              "Reminder: dentist tomorrow, 2pm",
              "Landscaping quote still pending — follow up Friday if no response",
            ],
          },
          participant_2: {
            delivered_at: new Date("2026-04-01T20:00:00-07:00"),
            thread: "participant_2_private",
            included: [
              "Photography draft reply for Mark and Dana ready for review",
            ],
          },
        },
      },
    ],
  },
};
