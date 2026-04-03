import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { adminFetch } from "@/lib/api";

export interface ConfigPayload {
  system: { timezone: string; locale: string; version: string };
  assistant: { messaging_identity: string; name: string | null; description: string };
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
    mutationFn: (payload: Partial<ConfigPayload>) =>
      adminFetch("/config", {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "config"] });
    },
  });
}
