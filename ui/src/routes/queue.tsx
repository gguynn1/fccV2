import { PageHeader } from "@/components/page-header";
import { StatusCard } from "@/components/status-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDiscardDlq, useQueue, useRetryDlq, type DispatchMetadata } from "@/hooks/use-queue";

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString();
}

function buildCompletionTooltip(item: DispatchMetadata): string {
  const lines = [
    `Dispatch ID: ${item.id}`,
    `Thread: ${item.target_thread}`,
    `Topic: ${item.topic}`,
    `Priority: ${item.priority}`,
    `Concerning: ${item.concerning.join(", ") || "—"}`,
    `Included in digest: ${item.included_in ?? "no"}`,
    `Response received: ${item.response_received === null ? "unknown" : String(item.response_received)}`,
    `Escalation step: ${item.escalation_step ?? "—"}`,
    "",
    "Message body is intentionally hidden on this page.",
  ];
  return lines.join("\n");
}

export function QueueRoute() {
  const { data, isLoading } = useQueue();
  const retryMutation = useRetryDlq();
  const discardMutation = useDiscardDlq();

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Queue"
          description="Queue depth, pending items, and dead-letter controls."
        />
        <p className="text-sm text-muted-foreground">Loading queue…</p>
      </div>
    );
  }

  const { depth, pending_items, dead_letter_items, recent_completions } = data;
  const totalDepth = depth.waiting + depth.delayed + depth.active;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Queue"
        description="Queue depth, pending items, and dead-letter controls."
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <StatusCard title="Waiting" value={depth.waiting} />
        <StatusCard title="Delayed" value={depth.delayed} />
        <StatusCard title="Active" value={depth.active} />
        <StatusCard
          title="Dead Letter"
          value={depth.dead_letter}
          variant={depth.dead_letter > 0 ? "destructive" : "default"}
          badge={depth.dead_letter > 0 ? "action needed" : undefined}
        />
      </div>

      {totalDepth > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Pending Items{" "}
              <Badge variant="secondary" className="ml-1">
                {pending_items.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Topic</TableHead>
                  <TableHead>Thread</TableHead>
                  <TableHead>Concerning</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending_items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs">{item.id.slice(0, 8)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {item.source}
                      </Badge>
                    </TableCell>
                    <TableCell>{item.topic ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{item.target_thread}</TableCell>
                    <TableCell>{item.concerning.join(", ")}</TableCell>
                    <TableCell className="text-xs">{formatDate(item.created_at)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {item.status ?? "queued"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {dead_letter_items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Dead Letter Queue{" "}
              <Badge variant="destructive" className="ml-1">
                {dead_letter_items.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>DLQ ID</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Topic</TableHead>
                  <TableHead>Thread</TableHead>
                  <TableHead>Failed</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dead_letter_items.map((entry) => (
                  <TableRow key={entry.dead_letter_job_id}>
                    <TableCell className="font-mono text-xs">{entry.dead_letter_job_id}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {entry.item.source}
                      </Badge>
                    </TableCell>
                    <TableCell>{entry.item.topic ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{entry.item.target_thread}</TableCell>
                    <TableCell className="text-xs">{formatDate(entry.failed_at)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => retryMutation.mutate(entry.dead_letter_job_id)}
                          disabled={retryMutation.isPending}
                        >
                          Retry
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => discardMutation.mutate(entry.dead_letter_job_id)}
                          disabled={discardMutation.isPending}
                        >
                          Discard
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            Recent Completions{" "}
            <Badge variant="secondary" className="ml-1">
              {recent_completions.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Topic</TableHead>
                <TableHead>Thread</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Dispatched</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent_completions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No recent completions.
                  </TableCell>
                </TableRow>
              ) : (
                recent_completions.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs">{item.id.slice(0, 8)}</TableCell>
                    <TableCell>{item.topic}</TableCell>
                    <TableCell className="font-mono text-xs">{item.target_thread}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          item.priority === "immediate"
                            ? "default"
                            : item.priority === "batched"
                              ? "secondary"
                              : "outline"
                        }
                        className="text-xs"
                      >
                        {item.priority}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      <span
                        className="cursor-help text-muted-foreground underline decoration-dotted underline-offset-2"
                        title={buildCompletionTooltip(item)}
                      >
                        view
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">{formatDate(item.dispatched_at)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
