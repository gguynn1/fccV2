import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { adminFetch } from "@/lib/api";

export interface EvalScenarioSetSummary {
  name: string;
  label: string;
}

export interface GenerateScenarioSetResponse {
  ok: true;
  scenario_set_name: string;
  file_path: string;
  guide_path: string;
}

export interface EvalScenarioLogEvent {
  seq: number;
  timestamp: string;
  level: string;
  phase: string;
  scenario_id?: string;
  message: string;
}

export interface EvalScenarioRecord {
  id: string;
  title: string;
  category: string;
  status: string;
  raw_outcome: string;
  started_at: string | null;
  completed_at: string | null;
  expected: {
    topic: string;
    intent: string;
    target_thread: string;
    priority: string;
    confirmation_required: boolean;
  };
  failures: Array<{
    field: string;
    message: string;
  }>;
  tuner: {
    status: string;
    summary: string;
    candidate?: {
      title: string;
      summary: string;
      body: string;
    };
  } | null;
}

export interface EvalRunRecord {
  id: string;
  scenario_set: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  summary: Record<string, number>;
  scenarios: EvalScenarioRecord[];
  logs: EvalScenarioLogEvent[];
  artifacts: {
    json_path: string;
    markdown_path: string | null;
  };
}

export interface EvalOverviewResponse {
  scenario_sets: EvalScenarioSetSummary[];
  active_run_id: string | null;
  runs: EvalRunRecord[];
}

export interface EvalRunResponse {
  run: EvalRunRecord;
  active_run_id: string | null;
}

export interface EvalMarkdownResponse {
  path: string;
  content: string;
}

export function useEvalOverview() {
  return useQuery({
    queryKey: ["admin", "eval", "overview"],
    queryFn: () => adminFetch<EvalOverviewResponse>("/eval"),
    refetchInterval: 2_000,
  });
}

export function useEvalRun(runId: string | null) {
  return useQuery({
    queryKey: ["admin", "eval", "run", runId],
    queryFn: () => adminFetch<EvalRunResponse>(`/eval/runs/${encodeURIComponent(runId ?? "")}`),
    enabled: runId !== null,
    refetchInterval: 2_000,
  });
}

export function useEvalMarkdown(runId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["admin", "eval", "markdown", runId],
    queryFn: () =>
      adminFetch<EvalMarkdownResponse>(`/eval/runs/${encodeURIComponent(runId ?? "")}/markdown`),
    enabled: runId !== null && enabled,
  });
}

export function useStartEvalRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (scenarioSet: string) =>
      adminFetch<{ ok: true; run_id: string }>("/eval/runs", {
        method: "POST",
        body: JSON.stringify({ scenario_set: scenarioSet }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "eval"] });
    },
  });
}

export function useGenerateScenarioSet() {
  return useMutation({
    mutationFn: () =>
      adminFetch<GenerateScenarioSetResponse>("/eval/scenario-sets/generate", {
        method: "POST",
        body: JSON.stringify({}),
      }),
  });
}
