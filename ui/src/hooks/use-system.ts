import { useQuery } from "@tanstack/react-query";

import { adminFetch } from "@/lib/api";

export interface SystemResponse {
  version: string;
  messaging_identity: string;
  entity_types: string[];
  permissions: string[];
  caldav: {
    port: number;
    path: string;
    local_only: boolean;
  };
}

export function useSystem() {
  return useQuery({
    queryKey: ["admin", "system"],
    queryFn: () => adminFetch<SystemResponse>("/system"),
  });
}
