import {
  EscalationLevel,
  EscalationStepAction,
  ThreadType,
  TopicKey,
  type SystemConfig,
  type SystemState,
} from "../../index.js";

// ── Config ──

export const seedThreads: SystemConfig["threads"] = [
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
      "PARTICIPANT 2's private thread. Business leads, morning check-in, digests, drafts, review space.",
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
];

export const seedDailyRhythm: SystemConfig["daily_rhythm"] = {
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
  digest_eligibility: {
    exclude_already_dispatched: true,
    exclude_stale: true,
    staleness_threshold_hours: 24,
    suppress_repeats_from_previous_digest: true,
    include_unresolved_from_yesterday: true,
  },
};

// ── State ──

export const seedThreadHistories: SystemState["threads"] = {
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
        content: "Thanks. Can you mark the internet bill as paid? I just did it",
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
    active_topic_context: "business",
    last_activity: new Date("2026-04-02T10:05:12-07:00"),
    recent_messages: [
      {
        id: "msg_201",
        from: "assistant",
        content:
          "Good morning. Here's your update:\n- PET vet checkup April 14 at 10am\n- Business: new lead from Mark and Dana — draft reply ready for review\n- Business: Jessica M. follow-up due tomorrow\n- Grocery list has 6 items",
        at: new Date("2026-04-02T07:00:00-07:00"),
        topic_context: "digest",
        dispatch_ref: "digest_p2",
      },
      {
        id: "msg_202",
        from: "participant_2",
        content: "Show me the draft for Mark and Dana",
        at: new Date("2026-04-02T10:04:00-07:00"),
        topic_context: "business",
      },
      {
        id: "msg_203",
        from: "assistant",
        content:
          "Here's the draft:\n\n\"Hi Mark and Dana! Thank you so much for reaching out. I'd love to hear more about what you're envisioning for your engagement session. Do you have a preferred location or timeframe in mind?\"\n\nWant me to send it, edit it, or hold off?",
        at: new Date("2026-04-02T10:04:06-07:00"),
        topic_context: "business",
        state_ref: "biz_002",
      },
      {
        id: "msg_204",
        from: "participant_2",
        content: "Hold off for now, I want to tweak the wording later",
        at: new Date("2026-04-02T10:05:12-07:00"),
        topic_context: "business",
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
        content: "Got it. I've assigned trash to PARTICIPANT 3 with a 5pm deadline.",
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
        content: "Added. Unload dishwasher assigned to PARTICIPANT 3, due tomorrow by 10am.",
        at: new Date("2026-04-02T08:00:20-07:00"),
        topic_context: "chores",
        state_ref: "chore_002",
      },
    ],
  },
};

export const seedOutboundBudgetTracker: SystemState["outbound_budget_tracker"] = {
  date: new Date("2026-04-02"),
  by_person: {
    participant_1: {
      unprompted_sent: 1,
      max: 5,
      messages: [
        {
          id: "q_000a",
          topic: TopicKey.Calendar,
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
          topic: TopicKey.Chores,
          at: new Date("2026-04-02T15:00:00-07:00"),
        },
        {
          id: "q_001",
          topic: TopicKey.Chores,
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
};

export const seedEscalationStatus: SystemState["escalation_status"] = {
  active: [
    {
      id: "esc_001",
      topic: TopicKey.Chores,
      item_ref: "chore_001",
      profile: EscalationLevel.High,
      responsible_entity: "participant_3",
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
};

export const seedDigests: SystemState["digests"] = {
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
            "Business: new lead from Mark and Dana — draft reply ready for review",
            "Business: Jessica M. follow-up due tomorrow",
            "Grocery list has 6 items",
          ],
        },
        participant_3: {
          delivered_at: new Date("2026-04-02T07:30:00-07:00"),
          thread: "participant_3_private",
          included: ["Math homework chapter 7 due tomorrow", "Trash needs to go out by 5pm today"],
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
            "New business inquiry from Mark and Dana",
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
          included: ["Business draft reply for Mark and Dana ready for review"],
        },
      },
    },
  ],
};
