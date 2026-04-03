import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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
      adminFetch("/entities", {
        method: "PUT",
        body: JSON.stringify({ entities }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "entities"] });
    },
  });
}
