import { useQuery } from "@tanstack/react-query";

import { adminFetch } from "@/lib/api";
import type { QueueResponse } from "@/hooks/use-queue";
import type {
  EscalationsResponse,
  ConfirmationsResponse,
  DispatchesResponse,
} from "@/hooks/use-activity";
import type { BudgetResponse } from "@/hooks/use-budget";

export interface DashboardData {
  queue: QueueResponse;
  escalations: EscalationsResponse;
  confirmations: ConfirmationsResponse;
  dispatches: DispatchesResponse;
  budget: BudgetResponse;
}

export function useDashboard() {
  return useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: async (): Promise<DashboardData> => {
      const [queue, escalations, confirmations, dispatches, budget] = await Promise.all([
        adminFetch<QueueResponse>("/state/queue"),
        adminFetch<EscalationsResponse>("/state/escalations"),
        adminFetch<ConfirmationsResponse>("/state/confirmations"),
        adminFetch<DispatchesResponse>("/state/dispatches"),
        adminFetch<BudgetResponse>("/budget"),
      ]);

      return { queue, escalations, confirmations, dispatches, budget };
    },
    refetchInterval: 5_000,
  });
}
