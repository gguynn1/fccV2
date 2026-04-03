import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { adminFetch } from "@/lib/api";

export interface TopicConfigPayload {
  label: string;
  description: string;
  routing: Record<string, string | boolean | string[]>;
  behavior: Record<string, string>;
  escalation: string;
  proactive?: Record<string, string | boolean>;
  escalation_ladder?: Record<string, string | boolean | null>;
  confirmation_required?: boolean;
  sections?: string[];
  cross_topic_connections?: string[];
  confirmation_required_for_sends?: boolean;
  follow_up_quiet_period_days?: number;
  on_ignored?: string;
  minimum_gap_between_nudges?: string;
  status_expiry?: string;
  grocery_linking?: boolean;
}

export interface EscalationProfilePayload {
  label: string;
  applies_to: string[];
  steps: string[];
  on_reassignment: string;
}

export interface ConfirmationGatesPayload {
  always_require_approval: string[];
  expiry_minutes: number;
  on_expiry: string;
}

export interface TopicsResponse {
  topics: Record<string, TopicConfigPayload>;
  escalation_profiles: Record<string, EscalationProfilePayload>;
  confirmation_gates: ConfirmationGatesPayload;
}

export function useTopics() {
  return useQuery({
    queryKey: ["admin", "topics"],
    queryFn: () => adminFetch<TopicsResponse>("/topics"),
  });
}

export function useUpdateTopics() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: TopicsResponse) =>
      adminFetch("/topics", {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "topics"] });
    },
  });
}
