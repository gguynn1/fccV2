import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { adminFetch } from "@/lib/api";

export interface ConfigPayload {
  system: { timezone: string; locale: string; is_onboarded: boolean };
  threads: Array<{
    id: string;
    type: string;
    participants: string[];
    description: string;
  }>;
  daily_rhythm: Record<string, unknown>;
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
      adminFetch("/config", {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "config"] });
    },
  });
}
