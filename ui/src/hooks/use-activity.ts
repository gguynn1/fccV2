import { useQuery } from "@tanstack/react-query";

import { adminFetch } from "@/lib/api";
import type { DispatchMetadata } from "@/hooks/use-queue";

export interface ActiveEscalationPayload {
  id: string;
  topic: string;
  item_ref: string;
  profile: string;
  responsible_entity: string;
  concerning: string[];
  current_step: number;
  next_action: string;
  next_action_at: string;
  target_thread_for_escalation: string;
  history: Array<{
    step: number;
    action: string;
    thread: string;
    at: string;
  }>;
}

export interface EscalationsResponse {
  active: ActiveEscalationPayload[];
}

export interface ConfirmationPayload {
  id: string;
  type: string;
  action: string;
  requested_by: string;
  requested_in_thread: string;
  requested_at: string;
  expires_at?: string;
  status?: string;
  result?: string;
  resolved_at?: string;
  expired_at?: string;
  resolved_in_thread?: string;
}

export interface ConfirmationsResponse {
  pending: ConfirmationPayload[];
  recent: ConfirmationPayload[];
}

export interface DispatchesResponse {
  recent: DispatchMetadata[];
}

export function useDispatches() {
  return useQuery({
    queryKey: ["admin", "dispatches"],
    queryFn: () => adminFetch<DispatchesResponse>("/state/dispatches"),
    refetchInterval: 5_000,
  });
}

export function useEscalations() {
  return useQuery({
    queryKey: ["admin", "escalations"],
    queryFn: () => adminFetch<EscalationsResponse>("/state/escalations"),
    refetchInterval: 5_000,
  });
}

export function useConfirmations() {
  return useQuery({
    queryKey: ["admin", "confirmations"],
    queryFn: () => adminFetch<ConfirmationsResponse>("/state/confirmations"),
    refetchInterval: 5_000,
  });
}
