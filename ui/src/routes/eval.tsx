import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useEvalMarkdown,
  useEvalOverview,
  useEvalRun,
  useGenerateScenarioSet,
  useStartEvalRun,
} from "@/hooks/use-eval";

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString();
}

function toStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "passed":
    case "prompt_fix_suggested":
    case "completed":
      return "default";
    case "running":
    case "queued":
      return "secondary";
    case "investigation_needed":
    case "failed":
    case "regressed":
      return "destructive";
    default:
      return "outline";
  }
}

export function EvalRoute() {
  const overviewQuery = useEvalOverview();
  const [selectedScenarioSet, setSelectedScenarioSet] = useState("default");
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const startRunMutation = useStartEvalRun();
  const generateScenarioSetMutation = useGenerateScenarioSet();

  const effectiveRunId =
    selectedRunId ?? overviewQuery.data?.active_run_id ?? overviewQuery.data?.runs[0]?.id ?? null;

  const runQuery = useEvalRun(effectiveRunId);
  const selectedRun = runQuery.data?.run ?? null;
  const markdownQuery = useEvalMarkdown(
    effectiveRunId,
    Boolean(selectedRun?.artifacts.markdown_path && selectedRun.status === "completed"),
  );

  const summaryEntries = useMemo(() => {
    if (!selectedRun) {
      return [];
    }

    return [
      { label: "Total", value: selectedRun.summary.total ?? 0 },
      { label: "Passed", value: selectedRun.summary.passed ?? 0 },
      {
        label: "Prompt Fix Suggested",
        value: selectedRun.summary.prompt_fix_suggested ?? 0,
      },
      {
        label: "Investigation Needed",
        value: selectedRun.summary.investigation_needed ?? 0,
      },
      { label: "Failed", value: selectedRun.summary.failed ?? 0 },
    ];
  }, [selectedRun]);

  const supersedingRun = useMemo(() => {
    if (!selectedRun || !overviewQuery.data) {
      return null;
    }

    const sameSetRuns = overviewQuery.data.runs.filter(
      (run) => run.scenario_set === selectedRun.scenario_set && run.id !== selectedRun.id,
    );

    const newer = sameSetRuns.find(
      (run) => new Date(run.started_at).getTime() > new Date(selectedRun.started_at).getTime(),
    );

    return newer ?? null;
  }, [selectedRun, overviewQuery.data]);

  if (overviewQuery.isLoading || !overviewQuery.data) {
    return <p className="text-sm text-muted-foreground">Loading eval runner…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Eval</h2>
        <p className="text-sm text-muted-foreground">
          Run scenarios sequentially, inspect logs, and review the generated prompt markdown.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Run Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="w-full max-w-xs space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Scenario set</p>
              <Select value={selectedScenarioSet} onValueChange={setSelectedScenarioSet}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {overviewQuery.data.scenario_sets.map((scenarioSet) => (
                    <SelectItem key={scenarioSet.name} value={scenarioSet.name}>
                      {scenarioSet.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                generateScenarioSetMutation.mutate();
              }}
              disabled={generateScenarioSetMutation.isPending}
            >
              {generateScenarioSetMutation.isPending
                ? "Generating Scenario Set..."
                : "Generate Scenario Set"}
            </Button>
            <Button
              onClick={() => {
                startRunMutation.mutate(selectedScenarioSet, {
                  onSuccess: (response) => {
                    setSelectedRunId(response.run_id);
                  },
                });
              }}
              disabled={startRunMutation.isPending || overviewQuery.data.active_run_id !== null}
            >
              {overviewQuery.data.active_run_id ? "Run In Progress" : "Start Sequential Run"}
            </Button>
            {overviewQuery.data.active_run_id && (
              <Badge variant="secondary">
                Active: {overviewQuery.data.active_run_id.slice(0, 16)}
              </Badge>
            )}
          </div>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              Scenario set scaffolds are generated into `eval/scenarios/generated/`. Finish editing
              the file and it becomes runnable automatically.
            </p>
            <p>Authoring guide: `eval/scenarios/SCENARIO_SETS.md`</p>
            {generateScenarioSetMutation.data && (
              <p className="text-foreground">
                Created `{generateScenarioSetMutation.data.file_path}` as `
                {generateScenarioSetMutation.data.scenario_set_name}`. Guide: `
                {generateScenarioSetMutation.data.guide_path}`
              </p>
            )}
            {generateScenarioSetMutation.error && (
              <p className="text-destructive">{generateScenarioSetMutation.error.message}</p>
            )}
            {startRunMutation.error && (
              <p className="text-destructive">{startRunMutation.error.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Runs</CardTitle>
        </CardHeader>
        <CardContent>
          {overviewQuery.data.runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No eval runs yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Scenario Set</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overviewQuery.data.runs.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="font-mono text-xs">{run.id}</TableCell>
                    <TableCell>
                      <Badge variant={toStatusVariant(run.status)}>{run.status}</Badge>
                    </TableCell>
                    <TableCell>{run.scenario_set}</TableCell>
                    <TableCell className="text-xs">{formatDate(run.started_at)}</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => setSelectedRunId(run.id)}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selectedRun && (
        <>
          <Card>
            <CardContent className="flex flex-wrap items-center gap-4 pt-6">
              <p className="text-sm font-medium">
                Run: <span className="font-mono text-xs">{selectedRun.id}</span>
              </p>
              <Badge variant={toStatusVariant(selectedRun.status)}>{selectedRun.status}</Badge>
              {supersedingRun && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedRunId(supersedingRun.id)}
                >
                  Superseded by {supersedingRun.id.slice(0, 20)}...
                </Button>
              )}
              <div className="ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    startRunMutation.mutate(selectedRun.scenario_set, {
                      onSuccess: (response) => {
                        setSelectedRunId(response.run_id);
                      },
                    });
                  }}
                  disabled={startRunMutation.isPending || overviewQuery.data.active_run_id !== null}
                >
                  Re-run This Set
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-5">
            {summaryEntries.map((entry) => (
              <Card key={entry.label}>
                <CardContent className="pt-6">
                  <p className="text-xs text-muted-foreground">{entry.label}</p>
                  <p className="text-2xl font-bold">{entry.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>
                Scenario Results <Badge className="ml-2">{selectedRun.scenarios.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Scenario</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Topic</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Failures</TableHead>
                    <TableHead>Suggestion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedRun.scenarios.map((scenario) => (
                    <TableRow key={scenario.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium">{scenario.title}</p>
                          <p className="font-mono text-xs text-muted-foreground">{scenario.id}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={toStatusVariant(scenario.status)}>{scenario.status}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {scenario.expected?.topic ?? "—"}
                      </TableCell>
                      <TableCell>{scenario.category}</TableCell>
                      <TableCell className="text-xs">
                        {scenario.failures.length === 0
                          ? "—"
                          : scenario.failures.map((failure) => failure.field).join(", ")}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {scenario.tuner?.candidate ? "embedded" : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Logs</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedRun.logs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No logs yet.</p>
                ) : (
                  <div className="max-h-[28rem] space-y-2 overflow-y-auto rounded-md border border-border p-3">
                    {selectedRun.logs.map((log) => (
                      <div key={log.seq} className="rounded-md border border-border p-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <Badge
                            variant={toStatusVariant(log.level === "error" ? "failed" : "running")}
                          >
                            {log.level}
                          </Badge>
                          <span className="font-mono text-muted-foreground">{log.timestamp}</span>
                          <span className="font-mono text-muted-foreground">{log.phase}</span>
                          {log.scenario_id && (
                            <span className="font-mono text-muted-foreground">
                              {log.scenario_id}
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-sm">{log.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Prompt Markdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  {selectedRun.artifacts.markdown_path
                    ? `Artifact: ${selectedRun.artifacts.markdown_path}`
                    : "Markdown artifact will appear when the run completes."}
                </div>
                {markdownQuery.data ? (
                  <div className="max-h-[28rem] overflow-y-auto rounded-md border border-border p-3 font-mono text-xs whitespace-pre-wrap">
                    {markdownQuery.data.content}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {selectedRun.status === "completed"
                      ? "Loading generated markdown…"
                      : "Run the suite to generate the markdown artifact."}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
