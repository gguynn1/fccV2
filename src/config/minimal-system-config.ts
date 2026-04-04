import type { SystemConfig } from "../index.js";

export function createMinimalSystemConfig(): SystemConfig {
  return {
    system: {
      timezone: "America/Chicago",
      locale: "en-US",
      is_onboarded: false,
    },
    entities: [],
    threads: [],
    topics: {} as SystemConfig["topics"],
    escalation_profiles: {} as SystemConfig["escalation_profiles"],
    confirmation_gates: {
      always_require_approval: [],
      expiry_minutes: 30,
      on_expiry: "notify_and_offer_reissue",
    },
    dispatch: {
      priority_levels: {} as SystemConfig["dispatch"]["priority_levels"],
      outbound_budget: {} as SystemConfig["dispatch"]["outbound_budget"],
      routing_rules: {},
      collision_avoidance: {
        description: "Default collision policy",
        precedence_order: [],
        same_precedence_strategy: "batch",
      },
    },
    input_recognition: {
      text: { description: "Plain text messages" },
      structured_choice: { description: "Structured choices", formats: [] },
      reaction: { positive: "positive", negative: "negative" },
      image: { description: "Image attachments", examples: {} },
      forwarded_content: { description: "Forwarded messages" },
      silence: {
        high_accountability: "escalate",
        low_accountability: "disappear",
        never: "never_escalate",
      },
      topic_disambiguation: { description: "Topic disambiguation rules", rules: [] },
      intent_disambiguation: { description: "Intent disambiguation rules", rules: [] },
    },
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
    worker: {
      processing_sequence: [],
      max_thread_history_messages: 15,
      stale_after_hours: 24,
    },
    data_ingest: {
      sources: [],
      future: [],
    },
    scenario_testing: {
      description: "Default scenario testing configuration",
      parts: [],
    },
  };
}
