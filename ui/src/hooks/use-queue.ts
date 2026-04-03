import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { adminFetch } from "@/lib/api";

export interface QueueItemMetadata {
  id: string;
  source: string;
  type: string;
  topic: string | null;
  intent: string | null;
  concerning: string[];
  target_thread: string;
  created_at: string;
  hold_until: string | null;
  status: string | null;
  content_kind: "text" | "structured";
}

export interface DeadLetterEntry {
  dead_letter_job_id: string;
  failed_at: string | null;
  item: QueueItemMetadata;
}

export interface DispatchMetadata {
  id: string;
  topic: string;
  target_thread: string;
  dispatched_at: string;
  priority: string;
  included_in: string | null;
  response_received: boolean | null;
  escalation_step: number | null;
}

export interface QueueDepthSnapshot {
  waiting: number;
  delayed: number;
  active: number;
  dead_letter: number;
}

export interface QueueResponse {
  depth: QueueDepthSnapshot;
  pending_items: QueueItemMetadata[];
  dead_letter_items: DeadLetterEntry[];
  recent_completions: DispatchMetadata[];
}

export function useQueue() {
  return useQuery({
    queryKey: ["admin", "queue"],
    queryFn: () => adminFetch<QueueResponse>("/state/queue"),
    refetchInterval: 5_000,
  });
}

export function useRetryDlq() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      adminFetch(`/state/queue/dlq/${encodeURIComponent(id)}/retry`, {
        method: "POST",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "queue"] });
    },
  });
}

export function useDiscardDlq() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      adminFetch(`/state/queue/dlq/${encodeURIComponent(id)}/discard`, {
        method: "POST",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "queue"] });
    },
  });
}
