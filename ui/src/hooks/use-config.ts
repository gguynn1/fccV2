import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { AdminMutationResponseBase } from "@/hooks/admin-mutations";
import { adminFetch } from "@/lib/api";

export interface ConfigPayload {
  system: { timezone: string; locale: string; is_onboarded: boolean };
  threads: Array<{
    id: string;
    type: string;
    participants: string[];
    description: string;
  }>;
}

export interface UpdateConfigResponse extends AdminMutationResponseBase {
  config: ConfigPayload;
}

export function useConfig() {
  return useQuery({
    queryKey: ["admin", "config"],
    queryFn: () => adminFetch<ConfigPayload>("/config"),
  });
}

export function useUpdateConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ConfigPayload) =>
      adminFetch<UpdateConfigResponse>("/config", {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "config"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "entities"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "scheduler"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
  });
}
