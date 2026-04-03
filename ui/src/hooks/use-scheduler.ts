import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { adminFetch } from "@/lib/api";

export interface DigestScheduleBlockPayload {
  description: string;
  times: Record<string, string | null>;
}

export interface DigestEligibilityPayload {
  exclude_already_dispatched: boolean;
  exclude_stale: boolean;
  staleness_threshold_hours: number;
  suppress_repeats_from_previous_digest: boolean;
  include_unresolved_from_yesterday: boolean;
}

export interface DailyRhythmPayload {
  morning_digest: DigestScheduleBlockPayload;
  evening_checkin: DigestScheduleBlockPayload;
  default_state: string;
  digest_eligibility: DigestEligibilityPayload;
}

export interface SchedulerResponse {
  daily_rhythm: DailyRhythmPayload;
}

export function useScheduler() {
  return useQuery({
    queryKey: ["admin", "scheduler"],
    queryFn: () => adminFetch<SchedulerResponse>("/scheduler"),
  });
}

export function useUpdateScheduler() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SchedulerResponse) =>
      adminFetch("/scheduler", {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "scheduler"] });
    },
  });
}
