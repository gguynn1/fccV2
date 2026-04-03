import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { adminFetch } from "@/lib/api";

export interface OutboundBudgetPayload {
  max_unprompted_per_person_per_day: number;
  max_messages_per_thread_per_hour: number;
  batch_window_minutes: number;
  description: string;
}

export interface CollisionPolicyPayload {
  description: string;
  precedence_order: string[];
  same_precedence_strategy: string;
}

export interface BudgetResponse {
  dispatch: {
    outbound_budget: OutboundBudgetPayload;
    collision_avoidance: CollisionPolicyPayload;
  };
}

export function useBudget() {
  return useQuery({
    queryKey: ["admin", "budget"],
    queryFn: () => adminFetch<BudgetResponse>("/budget"),
  });
}

export function useUpdateBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: BudgetResponse) =>
      adminFetch("/budget", {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "budget"] });
    },
  });
}
