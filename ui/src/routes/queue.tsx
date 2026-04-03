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
import { useDiscardDlq, useQueue, useRetryDlq } from "@/hooks/use-queue";

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString();
}

export function QueueRoute() {
  const { data, isLoading } = useQueue();
  const retryMutation = useRetryDlq();
  const discardMutation = useDiscardDlq();

  if (isLoading || !data) {
    return <p className="text-sm text-muted-foreground">Loading queue…</p>;
  }

  const { depth, pending_items, dead_letter_items, recent_completions } = data;
  const totalDepth = depth.waiting + depth.delayed + depth.active;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Queue</h2>
        <p className="text-sm text-muted-foreground">
          Queue depth, pending items, and dead-letter controls.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Waiting</p>
            <p className="text-2xl font-bold">{depth.waiting}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Delayed</p>
            <p className="text-2xl font-bold">{depth.delayed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Active</p>
            <p className="text-2xl font-bold">{depth.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Dead Letter</p>
            <p className="text-2xl font-bold">
              {depth.dead_letter}
              {depth.dead_letter > 0 && (
                <Badge variant="destructive" className="ml-2 text-xs">
                  action needed
                </Badge>
              )}
            </p>
          </CardContent>
        </Card>
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
          {recent_completions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent completions.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Topic</TableHead>
                  <TableHead>Thread</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Dispatched</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent_completions.map((item) => (
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
                    <TableCell className="text-xs">{formatDate(item.dispatched_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
