import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { adminFetch } from "@/lib/api";

export interface DomainStateResponse {
  outbound_budget_tracker: {
    date: string;
    by_person: Record<
      string,
      {
        unprompted_sent: number;
        max: number;
        messages: Array<{ id: string; topic: string; at: string; included_in?: string }>;
      }
    >;
    by_thread: Record<
      string,
      { last_hour_count: number; max_per_hour: number; last_sent_at: string | null }
    >;
  };
  calendar: { events: Array<Record<string, unknown>> };
  chores: {
    active: Array<Record<string, unknown>>;
    completed_recent: Array<Record<string, unknown>>;
  };
  finances: {
    bills: Array<Record<string, unknown>>;
    expenses_recent: Array<Record<string, unknown>>;
    savings_goals: Array<Record<string, unknown>>;
  };
  grocery: {
    list: Array<Record<string, unknown>>;
    recently_purchased: Array<Record<string, unknown>>;
  };
  health: { profiles: Array<Record<string, unknown>> };
  pets: { profiles: Array<Record<string, unknown>> };
  school: {
    students: Array<Record<string, unknown>>;
    communications: Array<Record<string, unknown>>;
  };
  travel: { trips: Array<Record<string, unknown>> };
  vendors: { records: Array<Record<string, unknown>> };
  business: {
    profiles: Array<Record<string, unknown>>;
    leads: Array<Record<string, unknown>>;
  };
  relationship: {
    last_nudge: {
      date: string;
      thread: string;
      content_recorded: boolean;
      response_received: boolean;
    };
    next_nudge_eligible: string;
    nudge_history: Array<Record<string, unknown>>;
  };
  family_status: { current: Array<Record<string, unknown>> };
  meals: {
    planned: Array<Record<string, unknown>>;
    dietary_notes: Array<Record<string, unknown>>;
  };
  maintenance: {
    assets: Array<Record<string, unknown>>;
    items: Array<Record<string, unknown>>;
  };
  data_ingest_state: {
    email_monitor: IngestSourcePayload;
    calendar_sync: IngestSourcePayload;
    forwarded_messages: IngestSourcePayload;
  };
  digests: { history: Array<Record<string, unknown>> };
  threads: Record<
    string,
    {
      active_topic_context: string;
      last_activity: string;
      recent_messages: Array<{
        id: string;
        from: string;
        at: string;
        topic_context: string;
      }>;
    }
  >;
}

interface IngestSourcePayload {
  active: boolean;
  last_poll: string | null;
  last_poll_result?: string;
  last_sync: string | null;
  last_received?: string;
  processed: Array<Record<string, unknown>>;
  watermark: string | null;
  total_processed: number;
}

export function useDomainState() {
  return useQuery({
    queryKey: ["admin", "domain-state"],
    queryFn: () => adminFetch<DomainStateResponse>("/state/domain"),
    refetchInterval: 10_000,
  });
}

export interface DomainStateMutationRequest {
  category: string;
  collection?: string;
  row_id?: string;
  row_key?: string;
}

export function useMutateDomainState() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: DomainStateMutationRequest) =>
      adminFetch<{ ok: true; cleared: number }>("/state/domain/mutate", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "domain-state"] });
    },
  });
}
