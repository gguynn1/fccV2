import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { AdminMutationResponseBase } from "@/hooks/admin-mutations";
import { adminFetch } from "@/lib/api";

export interface EntityPayload {
  id: string;
  type: string;
  name: string;
  messaging_identity: string | null;
  permissions: string[];
  digest?: { morning: string; evening: string | null };
  profile?: {
    species: string;
    breed: string | null;
    vet: string | null;
    medications: string[];
    care_schedule: string[];
  };
  routes_to?: string[];
}

export interface ThreadPayload {
  id: string;
  type: string;
  participants: string[];
  description: string;
}

export interface EntitiesResponse {
  entities: EntityPayload[];
  threads: ThreadPayload[];
  daily_rhythm: {
    morning_digest: { times: Record<string, string | null> };
    evening_checkin: { times: Record<string, string | null> };
  };
}

export interface UpdateEntitiesResponse extends AdminMutationResponseBase {
  entities: EntityPayload[];
  threads: ThreadPayload[];
  daily_rhythm: EntitiesResponse["daily_rhythm"];
}

export function useEntities() {
  return useQuery({
    queryKey: ["admin", "entities"],
    queryFn: () => adminFetch<EntitiesResponse>("/entities"),
  });
}

export function useUpdateEntities() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (entities: EntityPayload[]) =>
      adminFetch<UpdateEntitiesResponse>("/entities", {
        method: "PUT",
        body: JSON.stringify({ entities }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "entities"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "config"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "scheduler"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
  });
}
