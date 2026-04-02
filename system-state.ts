import { SystemState } from "./system-state-types";

export const systemState: SystemState = {
  metadata: {
    snapshot_time: "2026-04-02T17:05:00-07:00",
    description:
      "Current state of all tracked items, pending actions, and active records.",
  },

  queue: {
    pending: [
      {
        id: "q_002",
        source: "scheduled_trigger",
        type: "outbound",
        topic: "health",
        concerning: ["participant_1"],
        content:
          "Post-appointment follow-up: any notes from today's dentist visit?",
        priority: "batched",
        target_thread: "participant_1_private",
        created_at: "2026-04-02T14:00:00-07:00",
        hold_until: "2026-04-02T16:00:00-07:00",
      },
      {
        id: "q_003",
        source: "email_monitor",
        type: "inbound",
        topic: "school",
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
        created_at: "2026-04-02T13:45:00-07:00",
        status: "pending_classification",
      },
    ],

    recently_dispatched: [
      {
        id: "q_000a",
        topic: "calendar",
        target_thread: "participant_1_private",
        content: "Reminder: dentist appointment today at 2pm at Smile Dental",
        dispatched_at: "2026-04-02T08:00:00-07:00",
        priority: "batched",
        included_in: "morning_digest",
      },
      {
        id: "q_000b",
        topic: "chores",
        target_thread: "participant_3_private",
        content: "Trash needs to go out by 5pm today",
        dispatched_at: "2026-04-02T15:00:00-07:00",
        priority: "immediate",
        response_received: false,
        escalation_step: 1,
      },
      {
        id: "q_001",
        topic: "chores",
        target_thread: "participant_3_private",
        content: "Follow-up: trash was due by 5pm, not marked complete",
        dispatched_at: "2026-04-02T17:01:00-07:00",
        priority: "immediate",
        response_received: false,
        escalation_step: 2,
      },
    ],
  },

  outbound_budget_tracker: {
    date: "2026-04-02",
    by_person: {
      participant_1: {
        unprompted_sent: 1,
        max: 5,
        messages: [
          {
            id: "q_000a",
            topic: "calendar",
            at: "2026-04-02T08:00:00-07:00",
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
            at: "2026-04-02T07:00:00-07:00",
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
            at: "2026-04-02T07:30:00-07:00",
            included_in: "morning_digest",
          },
          {
            id: "q_000b",
            topic: "chores",
            at: "2026-04-02T15:00:00-07:00",
          },
          {
            id: "q_001",
            topic: "chores",
            at: "2026-04-02T17:01:00-07:00",
          },
        ],
      },
    },
    by_thread: {
      participant_1_private: {
        last_hour_count: 0,
        max_per_hour: 2,
        last_sent_at: "2026-04-02T12:30:05-07:00",
      },
      participant_2_private: {
        last_hour_count: 0,
        max_per_hour: 2,
        last_sent_at: "2026-04-02T10:04:06-07:00",
      },
      participant_3_private: {
        last_hour_count: 1,
        max_per_hour: 2,
        last_sent_at: "2026-04-02T17:01:00-07:00",
      },
      couple: {
        last_hour_count: 0,
        max_per_hour: 2,
        last_sent_at: "2026-04-02T14:15:05-07:00",
      },
      family: {
        last_hour_count: 0,
        max_per_hour: 2,
        last_sent_at: "2026-04-02T08:00:20-07:00",
      },
    },
  },

  escalation_status: {
    active: [
      {
        id: "esc_001",
        topic: "chores",
        item_ref: "chore_001",
        profile: "high",
        concerning: ["participant_3"],
        current_step: 2,
        history: [
          {
            step: 1,
            action: "reminder_sent",
            thread: "participant_3_private",
            at: "2026-04-02T15:00:00-07:00",
          },
          {
            step: 2,
            action: "follow_up_sent",
            thread: "participant_3_private",
            at: "2026-04-02T17:01:00-07:00",
          },
        ],
        next_action: "escalate_to_broader_thread",
        next_action_at: "2026-04-02T18:01:00-07:00",
        target_thread_for_escalation: "family",
      },
    ],
  },

  calendar: {
    events: [
      {
        id: "cal_001",
        title: "Dentist appointment",
        date: "2026-04-02",
        time: "14:00",
        location: "Smile Dental",
        concerning: ["participant_1"],
        topic: "health",
        status: "completed",
        follow_up_due: "2026-04-02T16:00:00-07:00",
        follow_up_sent: false,
        created_by: "participant_2",
        created_in_thread: "couple",
        created_at: "2026-03-28T09:00:00-07:00",
      },
      {
        id: "cal_002",
        title: "Science project — topic selection",
        date: "2026-04-05",
        time: null,
        location: null,
        concerning: ["participant_3"],
        topic: "school",
        status: "upcoming",
        created_by: "email_monitor",
        created_at: "2026-04-02T13:45:00-07:00",
      },
      {
        id: "cal_003",
        title: "Family dinner at Grandma's",
        date: "2026-04-06",
        time: "17:00",
        location: "Grandma's house",
        concerning: ["participant_1", "participant_2", "participant_3"],
        topic: "calendar",
        status: "upcoming",
        created_by: "participant_1",
        created_in_thread: "family",
        created_at: "2026-04-01T19:00:00-07:00",
      },
      {
        id: "cal_004",
        title: "PET annual vet checkup",
        date: "2026-04-14",
        time: "10:00",
        location: "Pawsome Vet Clinic",
        concerning: ["pet_1"],
        topic: "pets",
        responsible: "participant_2",
        status: "upcoming",
        created_by: "participant_2",
        created_in_thread: "participant_2_private",
        created_at: "2026-04-01T10:00:00-07:00",
      },
      {
        id: "cal_005",
        title: "Family vacation",
        date_start: "2026-06-15",
        date_end: "2026-06-22",
        concerning: ["participant_1", "participant_2", "participant_3"],
        topic: "travel",
        status: "planning",
        created_by: "participant_1",
        created_in_thread: "family",
        created_at: "2026-03-15T20:00:00-07:00",
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
        due: "2026-04-02T17:00:00-07:00",
        status: "overdue",
        escalation_step: 2,
        history: [
          { event: "assigned", at: "2026-04-02T08:00:00-07:00" },
          {
            event: "reminder_sent",
            at: "2026-04-02T15:00:00-07:00",
            thread: "participant_3_private",
          },
          { event: "deadline_passed", at: "2026-04-02T17:00:00-07:00" },
          {
            event: "follow_up_sent",
            at: "2026-04-02T17:01:00-07:00",
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
        due: "2026-04-03T10:00:00-07:00",
        status: "pending",
        escalation_step: 0,
      },
    ],
    completed_recent: [
      {
        id: "chore_000",
        task: "Mow the lawn",
        assigned_to: "participant_1",
        completed_at: "2026-03-30T16:30:00-07:00",
        completed_via: "text",
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
        due_date: "2026-04-15",
        status: "upcoming",
        reminder_sent: false,
        recurring: "monthly",
      },
      {
        id: "bill_002",
        name: "Electric bill",
        amount: 187.5,
        due_date: "2026-04-08",
        status: "upcoming",
        reminder_sent: false,
        recurring: "monthly",
      },
      {
        id: "bill_003",
        name: "Internet",
        amount: 79.99,
        due_date: "2026-04-05",
        status: "upcoming",
        reminder_sent: true,
        reminder_sent_at: "2026-04-02T07:00:00-07:00",
        recurring: "monthly",
      },
    ],
    expenses_recent: [
      {
        id: "exp_001",
        description: "Household supplies",
        amount: 47.32,
        date: "2026-04-01",
        logged_by: "participant_2",
        logged_via: "image",
        confirmed: true,
      },
      {
        id: "exp_002",
        description: "Gas station",
        amount: 62.1,
        date: "2026-03-31",
        logged_by: "participant_1",
        logged_via: "text",
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
        deadline: "2026-06-01",
        last_contribution: {
          amount: 500.0,
          date: "2026-03-28",
          logged_by: "participant_1",
        },
        pace_status: "on_track",
      },
      {
        id: "savings_002",
        name: "Emergency fund",
        target: 10000.0,
        current: 6200.0,
        percent: 62,
        deadline: null,
        pace_status: "steady",
      },
    ],
  },

  grocery: {
    list: [
      {
        id: "groc_001",
        item: "Milk",
        section: "dairy",
        added_by: "participant_2",
        added_at: "2026-04-01T18:00:00-07:00",
      },
      {
        id: "groc_002",
        item: "Eggs",
        section: "dairy",
        added_by: "participant_1",
        added_at: "2026-04-02T07:30:00-07:00",
      },
      {
        id: "groc_003",
        item: "Chicken breast",
        section: "meat",
        added_by: "participant_2",
        added_at: "2026-04-01T18:00:00-07:00",
      },
      {
        id: "groc_004",
        item: "Bananas",
        section: "produce",
        added_by: "participant_3",
        added_at: "2026-04-02T08:00:00-07:00",
      },
      {
        id: "groc_005",
        item: "Bread",
        section: "pantry",
        added_by: "participant_2",
        added_at: "2026-04-02T10:00:00-07:00",
      },
      {
        id: "groc_006",
        item: "Dish soap",
        section: "household",
        added_by: "participant_1",
        added_at: "2026-04-02T12:00:00-07:00",
      },
    ],
    recently_purchased: [
      {
        item: "Pasta",
        purchased_by: "participant_2",
        purchased_at: "2026-03-30T14:00:00-07:00",
      },
      {
        item: "Tomato sauce",
        purchased_by: "participant_2",
        purchased_at: "2026-03-30T14:00:00-07:00",
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
            type: "dentist",
            name: "Dr. Chen",
            location: "Smile Dental",
            last_visit: "2026-04-02",
          },
          {
            type: "primary",
            name: "Dr. Patel",
            location: "Family Medical Group",
            last_visit: "2025-11-15",
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
            type: "primary",
            name: "Dr. Rivera",
            location: "Wellness Clinic",
            last_visit: "2026-01-20",
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
        last_vet_visit: "2025-05-10",
        medications: [],
        care_log_recent: [
          {
            activity: "walk",
            by: "participant_1",
            at: "2026-04-02T06:30:00-07:00",
          },
          {
            activity: "fed breakfast",
            by: "participant_3",
            at: "2026-04-02T07:00:00-07:00",
          },
          {
            activity: "walk",
            by: "participant_2",
            at: "2026-04-01T17:00:00-07:00",
          },
          {
            activity: "grooming",
            by: "participant_2",
            at: "2026-03-29T10:00:00-07:00",
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
            due_date: "2026-04-05",
            status: "not_started",
            source: "email_monitor",
            parent_notified: false,
          },
          {
            id: "school_002",
            title: "Science fair project — full project",
            due_date: "2026-04-10",
            status: "not_started",
            source: "email_monitor",
            parent_notified: false,
          },
          {
            id: "school_003",
            title: "Math homework chapter 7",
            due_date: "2026-04-03",
            status: "in_progress",
            source: "participant_3",
            parent_notified: false,
          },
        ],
        completed_recent: [
          {
            title: "English essay — personal narrative",
            completed_at: "2026-03-31T20:00:00-07:00",
            completed_via: "text",
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
        dates: { start: "2026-06-15", end: "2026-06-22" },
        travelers: ["participant_1", "participant_2", "participant_3"],
        status: "planning",
        checklist: [
          {
            item: "Book flights",
            status: "done",
            completed_at: "2026-03-20T12:00:00-07:00",
          },
          {
            item: "Book hotel",
            status: "done",
            completed_at: "2026-03-22T15:00:00-07:00",
          },
          {
            item: "Arrange pet boarding for PET",
            status: "not_started",
            topic_link: "pets",
          },
          {
            item: "Request time off work",
            status: "done",
            completed_at: "2026-03-18T09:00:00-07:00",
          },
          {
            item: "Pack sunscreen and snorkel gear",
            status: "not_started",
          },
          { item: "Set up mail hold", status: "not_started" },
          { item: "Confirm car rental", status: "not_started" },
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
            date: "2026-02-10",
            cost: 275.0,
            status: "completed",
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
            date: "2026-03-25",
            cost: null,
            status: "waiting_for_quote",
            notes: "Said they'd send quote by end of week",
          },
        ],
        contact: "555-0234",
        managed_by: "participant_1",
        follow_up_pending: true,
        follow_up_due: "2026-04-04",
      },
    ],
  },

  photography: {
    leads: [
      {
        id: "photo_001",
        client_name: "Jessica M.",
        inquiry_date: "2026-03-28",
        event_type: "family portrait session",
        event_date: "2026-05-10",
        status: "awaiting_reply",
        last_contact: "2026-03-29T10:00:00-07:00",
        draft_reply: null,
        follow_up_due: "2026-04-03",
        notes: "Wants outdoor location, 2 kids under 5",
      },
      {
        id: "photo_002",
        client_name: "Mark and Dana",
        inquiry_date: "2026-04-01",
        event_type: "engagement shoot",
        event_date: null,
        status: "new",
        last_contact: "2026-04-01T14:00:00-07:00",
        draft_reply:
          "Hi Mark and Dana! Thank you so much for reaching out. I'd love to hear more about what you're envisioning for your engagement session. Do you have a preferred location or timeframe in mind?",
        draft_approved: false,
        notes: "Found via social media",
      },
    ],
  },

  relationship: {
    last_nudge: {
      date: "2026-03-27",
      thread: "couple",
      content: "Busy week — what's one thing you appreciated about each other?",
      response_received: true,
    },
    next_nudge_eligible: "2026-04-01",
    nudge_history: [
      {
        date: "2026-03-27",
        type: "appreciation_prompt",
        responded: true,
      },
      {
        date: "2026-03-20",
        type: "date_night_suggestion",
        responded: false,
      },
      {
        date: "2026-03-13",
        type: "conversation_starter",
        responded: true,
      },
    ],
  },

  family_status: {
    current: [
      {
        entity: "participant_1",
        status: "At dentist appointment",
        updated_at: "2026-04-02T13:45:00-07:00",
        expires_at: "2026-04-02T19:45:00-07:00",
      },
    ],
  },

  confirmations: {
    pending: [],
    recent: [
      {
        id: "confirm_001",
        type: "financial_action",
        action: "Mark internet bill ($79.99) as paid",
        requested_by: "participant_1",
        requested_in_thread: "couple",
        requested_at: "2026-04-02T14:15:00-07:00",
        expired_at: "2026-04-02T14:20:00-07:00",
        result: "expired",
      },
      {
        id: "confirm_000",
        type: "sending_on_behalf",
        action: "Send draft reply to Mark and Dana (photography inquiry)",
        requested_by: "participant_2",
        result: "not_yet_approved",
        requested_at: "2026-04-01T15:00:00-07:00",
      },
    ],
  },

  threads: {
    participant_1_private: {
      active_topic_context: "vendors",
      last_activity: "2026-04-02T12:30:05-07:00",
      recent_messages: [
        {
          id: "msg_101",
          from: "assistant",
          content:
            "Good morning. Here's what's ahead today:\n- Dentist at 2pm at Smile Dental\n- Internet bill due April 5 ($79.99)\n- Vendor follow-up: Green Thumb Landscaping quote still pending\n- Vacation savings at 74% — on track",
          at: "2026-04-02T07:00:00-07:00",
          topic_context: "digest",
          dispatch_ref: "q_000a",
        },
        {
          id: "msg_102",
          from: "participant_1",
          content:
            "Thanks. Can you mark the internet bill as paid? I just did it",
          at: "2026-04-02T09:15:00-07:00",
          topic_context: "finances",
        },
        {
          id: "msg_103",
          from: "assistant",
          content:
            "Got it. Since finances route through the couple thread, I'll send the confirmation there.",
          at: "2026-04-02T09:15:08-07:00",
          topic_context: "finances",
        },
        {
          id: "msg_104",
          from: "participant_1",
          content: "Landscaping guy still hasn't sent the quote",
          at: "2026-04-02T12:30:00-07:00",
          topic_context: "vendors",
        },
        {
          id: "msg_105",
          from: "assistant",
          content:
            "Noted — they said end of week. I'll flag it for follow-up Friday if nothing comes in.",
          at: "2026-04-02T12:30:05-07:00",
          topic_context: "vendors",
          state_ref: "vendor_002",
        },
      ],
    },
    participant_2_private: {
      active_topic_context: "photography",
      last_activity: "2026-04-02T10:05:12-07:00",
      recent_messages: [
        {
          id: "msg_201",
          from: "assistant",
          content:
            "Good morning. Here's your update:\n- PET vet checkup April 14 at 10am\n- Photography: new lead from Mark and Dana — draft reply ready for review\n- Photography: Jessica M. follow-up due tomorrow\n- Grocery list has 6 items",
          at: "2026-04-02T07:00:00-07:00",
          topic_context: "digest",
          dispatch_ref: "digest_p2",
        },
        {
          id: "msg_202",
          from: "participant_2",
          content: "Show me the draft for Mark and Dana",
          at: "2026-04-02T10:04:00-07:00",
          topic_context: "photography",
        },
        {
          id: "msg_203",
          from: "assistant",
          content:
            "Here's the draft:\n\n\"Hi Mark and Dana! Thank you so much for reaching out. I'd love to hear more about what you're envisioning for your engagement session. Do you have a preferred location or timeframe in mind?\"\n\nWant me to send it, edit it, or hold off?",
          at: "2026-04-02T10:04:06-07:00",
          topic_context: "photography",
          state_ref: "photo_002",
        },
        {
          id: "msg_204",
          from: "participant_2",
          content: "Hold off for now, I want to tweak the wording later",
          at: "2026-04-02T10:05:12-07:00",
          topic_context: "photography",
        },
      ],
    },
    participant_3_private: {
      active_topic_context: "chores",
      last_activity: "2026-04-02T17:01:00-07:00",
      recent_messages: [
        {
          id: "msg_301",
          from: "assistant",
          content:
            "Good morning. Two things today:\n- Math homework chapter 7 due tomorrow\n- Trash needs to go out by 5pm today",
          at: "2026-04-02T07:30:00-07:00",
          topic_context: "digest",
          dispatch_ref: "digest_p3",
        },
        {
          id: "msg_302",
          from: "participant_3",
          content: "Working on math now",
          at: "2026-04-02T08:10:00-07:00",
          topic_context: "school",
        },
        {
          id: "msg_303",
          from: "assistant",
          content: "Got it. I'll mark math homework as in progress.",
          at: "2026-04-02T08:10:04-07:00",
          topic_context: "school",
          state_ref: "school_003",
        },
        {
          id: "msg_304",
          from: "assistant",
          content: "Reminder: trash needs to go out by 5pm today.",
          at: "2026-04-02T15:00:00-07:00",
          topic_context: "chores",
          dispatch_ref: "q_000b",
        },
        {
          id: "msg_305",
          from: "assistant",
          content: "Follow-up: trash was due by 5pm, not marked complete.",
          at: "2026-04-02T17:01:00-07:00",
          topic_context: "chores",
          dispatch_ref: "q_001",
          escalation_ref: "esc_001",
        },
      ],
    },
    couple: {
      active_topic_context: "finances",
      last_activity: "2026-04-02T14:15:00-07:00",
      recent_messages: [
        {
          id: "msg_401",
          from: "participant_1",
          content: "Just paid the internet bill",
          at: "2026-04-02T14:15:00-07:00",
          topic_context: "finances",
        },
        {
          id: "msg_402",
          from: "assistant",
          content: "Got it. Marking internet bill ($79.99) as paid — confirm?",
          at: "2026-04-02T14:15:05-07:00",
          topic_context: "finances",
          confirmation_ref: "confirm_001",
        },
      ],
    },
    family: {
      active_topic_context: "chores",
      last_activity: "2026-04-02T08:00:15-07:00",
      recent_messages: [
        {
          id: "msg_501",
          from: "participant_1",
          content: "Trash day today. Can someone take it out by 5?",
          at: "2026-04-02T08:00:00-07:00",
          topic_context: "chores",
        },
        {
          id: "msg_502",
          from: "assistant",
          content:
            "Got it. I've assigned trash to PARTICIPANT 3 with a 5pm deadline.",
          at: "2026-04-02T08:00:10-07:00",
          topic_context: "chores",
          state_ref: "chore_001",
        },
        {
          id: "msg_503",
          from: "participant_2",
          content: "Also dishwasher needs unloading tomorrow morning",
          at: "2026-04-02T08:00:15-07:00",
          topic_context: "chores",
        },
        {
          id: "msg_504",
          from: "assistant",
          content:
            "Added. Unload dishwasher assigned to PARTICIPANT 3, due tomorrow by 10am.",
          at: "2026-04-02T08:00:20-07:00",
          topic_context: "chores",
          state_ref: "chore_002",
        },
      ],
    },
  },

  data_ingest_state: {
    email_monitor: {
      active: false,
      last_poll: "2026-04-02T14:25:00-07:00",
      last_poll_result: "1 new item",
      processed: [
        {
          source_id: "email_8831",
          from: "teacher@school.edu",
          subject: "Science project due April 10",
          received_at: "2026-04-02T13:40:00-07:00",
          processed_at: "2026-04-02T13:45:00-07:00",
          queue_item_created: "q_003",
          topic_classified: "school",
        },
      ],
      watermark: "2026-04-02T14:25:00-07:00",
    },
    calendar_sync: {
      active: false,
      last_sync: null,
      processed: [],
      watermark: null,
    },
    forwarded_messages: {
      active: true,
      last_received: "2026-04-01T14:00:00-07:00",
      processed: [
        {
          source_id: "fwd_001",
          from: "participant_2",
          content_type: "photography_inquiry",
          received_at: "2026-04-01T14:00:00-07:00",
          processed_at: "2026-04-01T14:00:05-07:00",
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
        date: "2026-04-02",
        morning: {
          participant_1: {
            delivered_at: "2026-04-02T07:00:00-07:00",
            thread: "participant_1_private",
            included: [
              "Dentist at 2pm today at Smile Dental",
              "Internet bill due April 5 ($79.99)",
              "Vendor follow-up: Green Thumb Landscaping quote still pending",
              "Vacation savings at 74% — on track",
            ],
          },
          participant_2: {
            delivered_at: "2026-04-02T07:00:00-07:00",
            thread: "participant_2_private",
            included: [
              "PET vet checkup April 14 at 10am",
              "Photography: new lead from Mark and Dana — draft reply ready for review",
              "Photography: Jessica M. follow-up due tomorrow",
              "Grocery list has 6 items",
            ],
          },
          participant_3: {
            delivered_at: "2026-04-02T07:30:00-07:00",
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
        date: "2026-04-01",
        morning: {
          participant_1: {
            delivered_at: "2026-04-01T07:00:00-07:00",
            thread: "participant_1_private",
            included: [
              "Dentist appointment tomorrow at 2pm",
              "Family dinner Sunday at 5pm",
              "Vacation savings update: $3700 of $5000",
            ],
          },
          participant_2: {
            delivered_at: "2026-04-01T07:00:00-07:00",
            thread: "participant_2_private",
            included: [
              "New photography inquiry from Mark and Dana",
              "Jessica M. follow-up: no response yet (inquiry 3 days ago)",
              "PET vet checkup in 13 days",
            ],
          },
          participant_3: {
            delivered_at: "2026-04-01T07:30:00-07:00",
            thread: "participant_3_private",
            included: [
              "Math homework chapter 7 due Thursday",
              "English essay due today — is it done?",
            ],
          },
        },
        evening: {
          participant_1: {
            delivered_at: "2026-04-01T20:00:00-07:00",
            thread: "participant_1_private",
            included: [
              "Reminder: dentist tomorrow, 2pm",
              "Landscaping quote still pending — follow up Friday if no response",
            ],
          },
          participant_2: {
            delivered_at: "2026-04-01T20:00:00-07:00",
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
