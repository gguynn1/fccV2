import { useQuery } from "@tanstack/react-query";

import type {
  ConfirmationsResponse,
  DispatchesResponse,
  EscalationsResponse,
} from "@/hooks/use-activity";
import type { BudgetResponse } from "@/hooks/use-budget";
import type { QueueResponse } from "@/hooks/use-queue";
import type { SystemResponse } from "@/hooks/use-system";
import { adminFetch } from "@/lib/api";

export interface BudgetUsageResponse {
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
      {
        last_hour_count: number;
        max_per_hour: number;
        last_sent_at: string | null;
      }
    >;
  };
}

export interface DashboardData {
  queue: QueueResponse;
  escalations: EscalationsResponse;
  confirmations: ConfirmationsResponse;
  dispatches: DispatchesResponse;
  budget_usage: BudgetUsageResponse;
  budget: BudgetResponse;
  system: SystemResponse;
}

export function useDashboard() {
  return useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: async (): Promise<DashboardData> => {
      const [queue, escalations, confirmations, dispatches, budget_usage, budget, system] =
        await Promise.all([
          adminFetch<QueueResponse>("/state/queue"),
          adminFetch<EscalationsResponse>("/state/escalations"),
          adminFetch<ConfirmationsResponse>("/state/confirmations"),
          adminFetch<DispatchesResponse>("/state/dispatches"),
          adminFetch<BudgetUsageResponse>("/state/budget-usage"),
          adminFetch<BudgetResponse>("/budget"),
          adminFetch<DashboardData["system"]>("/system"),
        ]);

      return { queue, escalations, confirmations, dispatches, budget_usage, budget, system };
    },
    refetchInterval: 5_000,
  });
}
