import { useQuery } from "@tanstack/react-query";

import type {
  ConfirmationsResponse,
  DispatchesResponse,
  EscalationsResponse,
} from "@/hooks/use-activity";
import type { BudgetResponse } from "@/hooks/use-budget";
import type { QueueResponse } from "@/hooks/use-queue";
import { adminFetch } from "@/lib/api";

export interface DashboardData {
  queue: QueueResponse;
  escalations: EscalationsResponse;
  confirmations: ConfirmationsResponse;
  dispatches: DispatchesResponse;
  budget: BudgetResponse;
  config: {
    assistant: {
      messaging_identity: string;
      name: string | null;
      description: string;
    };
  };
  system: {
    caldav: {
      port: number;
      path: string;
      local_only: boolean;
    };
  };
}

export function useDashboard() {
  return useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: async (): Promise<DashboardData> => {
      const [queue, escalations, confirmations, dispatches, budget, config, system] =
        await Promise.all([
          adminFetch<QueueResponse>("/state/queue"),
          adminFetch<EscalationsResponse>("/state/escalations"),
          adminFetch<ConfirmationsResponse>("/state/confirmations"),
          adminFetch<DispatchesResponse>("/state/dispatches"),
          adminFetch<BudgetResponse>("/budget"),
          adminFetch<DashboardData["config"]>("/config"),
          adminFetch<DashboardData["system"]>("/system"),
        ]);

      return { queue, escalations, confirmations, dispatches, budget, config, system };
    },
    refetchInterval: 5_000,
  });
}
