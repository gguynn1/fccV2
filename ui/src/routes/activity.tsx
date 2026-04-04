import { useMemo, useState } from "react";

import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useConfirmations, useDispatches, useEscalations } from "@/hooks/use-activity";

const PAGE_SIZE = 20;

type DateRange = "24h" | "7d" | "custom";

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function formatDate(d: string): string {
  return new Date(d).toLocaleString();
}

function escalationTimestamp(escalation: {
  next_action_at: string;
  history: Array<{ at: string }>;
}): string {
  return escalation.next_action_at || escalation.history.at(-1)?.at || "";
}

function isInRange(dateStr: string, range: DateRange, customStart: string): boolean {
  const date = new Date(dateStr);
  if (range === "24h") return date >= hoursAgo(24);
  if (range === "7d") return date >= hoursAgo(168);
  if (customStart) return date >= new Date(customStart);
  return true;
}

export function ActivityRoute() {
  const { data: dispatchesData, isLoading: dispatchesLoading } = useDispatches();
  const { data: escalationsData, isLoading: escalationsLoading } = useEscalations();
  const { data: confirmationsData, isLoading: confirmationsLoading } = useConfirmations();

  const [dateRange, setDateRange] = useState<DateRange>("24h");
  const [customStart, setCustomStart] = useState("");
  const [topicFilter, setTopicFilter] = useState("");
  const [threadFilter, setThreadFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");

  const [dispatchPage, setDispatchPage] = useState(1);
  const [escalationPage, setEscalationPage] = useState(1);
  const [confirmationPage, setConfirmationPage] = useState(1);

  const filteredDispatches = useMemo(() => {
    if (!dispatchesData?.recent) return [];
    return dispatchesData.recent.filter((d) => {
      if (!isInRange(d.dispatched_at, dateRange, customStart)) return false;
      if (topicFilter && d.topic !== topicFilter) return false;
      if (threadFilter && d.target_thread !== threadFilter) return false;
      if (entityFilter && !d.concerning.includes(entityFilter)) return false;
      return true;
    });
  }, [dispatchesData, dateRange, customStart, topicFilter, threadFilter, entityFilter]);

  const filteredEscalations = useMemo(() => {
    if (!escalationsData?.active) return [];
    return escalationsData.active.filter((e) => {
      if (!isInRange(escalationTimestamp(e), dateRange, customStart)) return false;
      if (topicFilter && e.topic !== topicFilter) return false;
      if (threadFilter && e.target_thread_for_escalation !== threadFilter) return false;
      if (entityFilter && e.responsible_entity !== entityFilter) return false;
      return true;
    });
  }, [escalationsData, dateRange, customStart, topicFilter, threadFilter, entityFilter]);

  const allConfirmations = useMemo(() => {
    if (!confirmationsData) return [];
    return [...confirmationsData.pending, ...confirmationsData.recent];
  }, [confirmationsData]);

  const filteredConfirmations = useMemo(() => {
    return allConfirmations.filter((c) => {
      const dateField = c.requested_at;
      if (!isInRange(dateField, dateRange, customStart)) return false;
      if (threadFilter && c.requested_in_thread !== threadFilter) return false;
      if (entityFilter && c.requested_by !== entityFilter) return false;
      return true;
    });
  }, [allConfirmations, dateRange, customStart, threadFilter, entityFilter]);

  const pagedDispatches = filteredDispatches.slice(
    (dispatchPage - 1) * PAGE_SIZE,
    dispatchPage * PAGE_SIZE,
  );
  const pagedEscalations = filteredEscalations.slice(
    (escalationPage - 1) * PAGE_SIZE,
    escalationPage * PAGE_SIZE,
  );
  const pagedConfirmations = filteredConfirmations.slice(
    (confirmationPage - 1) * PAGE_SIZE,
    confirmationPage * PAGE_SIZE,
  );

  const isLoading = dispatchesLoading || escalationsLoading || confirmationsLoading;

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading activity…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Activity</h2>
        <p className="text-sm text-muted-foreground">
          Dispatch, escalation, and confirmation history.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Date Range</p>
              <div className="flex gap-1">
                {(["24h", "7d", "custom"] as const).map((r) => (
                  <Button
                    key={r}
                    variant={dateRange === r ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setDateRange(r);
                      setDispatchPage(1);
                      setEscalationPage(1);
                      setConfirmationPage(1);
                    }}
                  >
                    {r === "24h" ? "24h" : r === "7d" ? "7 days" : "Custom"}
                  </Button>
                ))}
              </div>
            </div>
            {dateRange === "custom" && (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Start Date</p>
                <Input
                  type="datetime-local"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="h-9 w-52"
                />
              </div>
            )}
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Topic</p>
              <Input
                placeholder="filter topic…"
                value={topicFilter}
                onChange={(e) => {
                  setTopicFilter(e.target.value);
                  setDispatchPage(1);
                }}
                className="h-9 w-36"
              />
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Thread</p>
              <Input
                placeholder="filter thread…"
                value={threadFilter}
                onChange={(e) => {
                  setThreadFilter(e.target.value);
                  setDispatchPage(1);
                }}
                className="h-9 w-36"
              />
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Entity</p>
              <Input
                placeholder="filter entity…"
                value={entityFilter}
                onChange={(e) => {
                  setEntityFilter(e.target.value);
                  setDispatchPage(1);
                  setEscalationPage(1);
                  setConfirmationPage(1);
                }}
                className="h-9 w-36"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Recent Dispatches{" "}
            <Badge variant="secondary" className="ml-1">
              {filteredDispatches.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pagedDispatches.length === 0 ? (
            <p className="text-sm text-muted-foreground">No dispatches in this range.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Topic</TableHead>
                    <TableHead>Thread</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedDispatches.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="text-xs">{formatDate(d.dispatched_at)}</TableCell>
                      <TableCell>{d.topic}</TableCell>
                      <TableCell className="font-mono text-xs">{d.target_thread}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            d.priority === "immediate"
                              ? "default"
                              : d.priority === "batched"
                                ? "secondary"
                                : "outline"
                          }
                          className="text-xs"
                        >
                          {d.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {d.response_received ? (
                          <Badge variant="success" className="text-xs">
                            replied
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            sent
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination
                page={dispatchPage}
                pageSize={PAGE_SIZE}
                total={filteredDispatches.length}
                onPageChange={setDispatchPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Active Escalations{" "}
            <Badge variant="secondary" className="ml-1">
              {filteredEscalations.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pagedEscalations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active escalations.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Topic</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Profile</TableHead>
                    <TableHead>Step</TableHead>
                    <TableHead>Next Action</TableHead>
                    <TableHead>Next At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedEscalations.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>{e.topic}</TableCell>
                      <TableCell className="font-mono text-xs">{e.responsible_entity}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs uppercase">
                          {e.profile}
                        </Badge>
                      </TableCell>
                      <TableCell>{e.current_step}</TableCell>
                      <TableCell className="text-xs">{e.next_action.replace(/_/g, " ")}</TableCell>
                      <TableCell className="text-xs">{formatDate(e.next_action_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination
                page={escalationPage}
                pageSize={PAGE_SIZE}
                total={filteredEscalations.length}
                onPageChange={setEscalationPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Confirmations{" "}
            <Badge variant="secondary" className="ml-1">
              {filteredConfirmations.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pagedConfirmations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No confirmations in this range.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Requested By</TableHead>
                    <TableHead>Thread</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedConfirmations.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-xs">{formatDate(c.requested_at)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {c.type.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            c.status === "pending"
                              ? "warning"
                              : c.status === "resolved"
                                ? "success"
                                : c.status === "expired"
                                  ? "destructive"
                                  : "secondary"
                          }
                          className="text-xs"
                        >
                          {c.status ?? c.result ?? "unknown"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{c.requested_by}</TableCell>
                      <TableCell className="font-mono text-xs">{c.requested_in_thread}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination
                page={confirmationPage}
                pageSize={PAGE_SIZE}
                total={filteredConfirmations.length}
                onPageChange={setConfirmationPage}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
