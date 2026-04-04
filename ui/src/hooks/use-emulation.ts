import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { adminFetch } from "@/lib/api";

export interface EmulationMessage {
  id: string;
  thread_id: string;
  sender: string;
  content: string;
  preview_label: string;
  direction: "inbound" | "outbound";
  source_type: "text" | "reaction" | "image";
  created_at: string;
}

export interface EmulationSessionResponse {
  active: boolean;
}

export interface EmulationMessagesResponse {
  messages: EmulationMessage[];
}

export interface SendEmulationMessageInput {
  entity_id: string;
  thread_id: string;
  content: string;
  source_type?: "text" | "reaction" | "image";
}

export function useEmulationSession() {
  return useQuery({
    queryKey: ["admin", "emulation", "session"],
    queryFn: () => adminFetch<EmulationSessionResponse>("/emulation/session"),
    refetchInterval: 2_000,
  });
}

export function useEmulationMessages(threadId: string | null) {
  return useQuery({
    queryKey: ["admin", "emulation", "messages", threadId],
    queryFn: () =>
      adminFetch<EmulationMessagesResponse>(
        `/emulation/messages?thread_id=${encodeURIComponent(threadId ?? "")}`,
      ),
    enabled: threadId !== null,
    refetchInterval: 1_000,
  });
}

export function useStartEmulationSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      adminFetch<{ ok: true }>("/emulation/session/start", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "emulation", "session"] });
    },
  });
}

export function useStopEmulationSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      adminFetch<{ ok: true }>("/emulation/session/stop", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "emulation", "session"] });
    },
  });
}

export function useSendEmulationMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SendEmulationMessageInput) =>
      adminFetch<{ ok: true; message_id: string }>("/emulation/send", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "emulation", "messages"] });
    },
  });
}

export function useClearEmulationMessages() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      adminFetch<{ ok: true }>("/emulation/messages", {
        method: "DELETE",
        body: JSON.stringify({}),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "emulation", "messages"] });
    },
  });
}
