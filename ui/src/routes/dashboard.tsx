import { Link } from "react-router-dom";

import { PageHeader } from "@/components/page-header";
import { StatusCard } from "@/components/status-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboard } from "@/hooks/use-dashboard";

export function DashboardRoute() {
  const { data, isLoading } = useDashboard();

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" description="System health at a glance." />
        <p className="text-sm text-muted-foreground">Loading dashboard…</p>
      </div>
    );
  }

  const { queue, escalations, confirmations, dispatches, budget_usage, budget, system } = data;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const queueDepth = queue.depth.waiting + queue.depth.delayed + queue.depth.active;
  const dlqDepth = queue.depth.dead_letter;
  const activeEscalations = escalations.active.length;
  const pendingConfirmations = confirmations.pending.length;
  const dispatchedToday = dispatches.recent.filter(
    (dispatch) => new Date(dispatch.dispatched_at) >= startOfToday,
  ).length;

  const budgetCap = budget.dispatch.outbound_budget.max_unprompted_per_person_per_day;
  const perPersonUsage = Object.entries(budget_usage.outbound_budget_tracker.by_person)
    .map(([entityId, usage]) => ({
      entityId,
      sent: usage.unprompted_sent,
      max: usage.max,
      ratio: usage.max > 0 ? usage.unprompted_sent / usage.max : 0,
    }))
    .sort((left, right) => right.ratio - left.ratio)[0];

  const queueVariant: "success" | "warning" | "destructive" =
    queueDepth === 0 ? "success" : queueDepth < 10 ? "warning" : "destructive";

  const dlqVariant: "success" | "destructive" = dlqDepth > 0 ? "destructive" : "success";

  const escalationBadge =
    activeEscalations > 0
      ? escalations.active.some((e) => {
          const nextAt = new Date(e.next_action_at);
          return nextAt < new Date();
        })
        ? "stuck"
        : "active"
      : undefined;

  const budgetUsageRatio = perPersonUsage?.ratio ?? 0;
  const budgetVariant: "success" | "warning" | "destructive" =
    budgetUsageRatio >= 1 ? "destructive" : budgetUsageRatio >= 0.75 ? "warning" : "success";

  const caldavEndpoint = (() => {
    const baseUrl = new URL(window.location.origin);
    baseUrl.port = String(system.caldav.port);
    baseUrl.pathname = system.caldav.path;
    baseUrl.search = "";
    baseUrl.hash = "";
    return baseUrl.toString();
  })();

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="System health at a glance." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatusCard title="Queue Depth" value={queueDepth} to="/queue" variant={queueVariant} />

        <StatusCard
          title="Dead Letter Queue"
          value={dlqDepth}
          to="/queue"
          variant={dlqVariant}
          badge={dlqDepth > 0 ? `${dlqDepth} items` : undefined}
        />

        <StatusCard
          title="Active Escalations"
          value={activeEscalations}
          to="/activity"
          variant={escalationBadge === "stuck" ? "warning" : "default"}
          badge={escalationBadge}
        />

        <StatusCard
          title="Pending Confirmations"
          value={pendingConfirmations}
          to="/activity"
          variant={pendingConfirmations > 5 ? "warning" : "default"}
        />

        <StatusCard
          title="Dispatched Today"
          value={dispatchedToday}
          to="/activity"
          variant={budgetVariant}
          badge={
            budgetUsageRatio >= 0.75 && perPersonUsage
              ? `${perPersonUsage.entityId}: ${perPersonUsage.sent}/${perPersonUsage.max}`
              : undefined
          }
        />

        <StatusCard title="Budget Cap" value={`${budgetCap}/person/day`} to="/budget" />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">CalDAV Endpoint</CardTitle>
            <p className="text-sm text-muted-foreground">
              Subscribe from a calendar app on the local network. This endpoint is not exposed
              through the tunnel.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => void navigator.clipboard.writeText(caldavEndpoint)}
          >
            Copy URL
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Assistant Identifier
            </p>
            <p className="break-all rounded-md border bg-muted/30 px-3 py-2 font-mono text-xs">
              {system.messaging_identity}
            </p>
          </div>
          <p className="break-all rounded-md border bg-muted/30 px-3 py-2 font-mono text-xs">
            {caldavEndpoint}
          </p>
          <p className="text-sm text-muted-foreground">
            Port {system.caldav.port} • {system.caldav.local_only ? "Local network only" : "Public"}
          </p>
        </CardContent>
      </Card>

      {dlqDepth > 0 && (
        <Card className="border-red-600/40">
          <CardHeader>
            <CardTitle className="text-sm text-red-400">
              Dead Letter Items Require Attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {dlqDepth} item{dlqDepth !== 1 ? "s" : ""} failed processing and need to be retried or
              discarded.
            </p>
            <Link to="/queue" className="mt-2 inline-block text-sm text-primary underline">
              Go to Queue →
            </Link>
          </CardContent>
        </Card>
      )}

      {escalationBadge === "stuck" && (
        <Card className="border-amber-600/40">
          <CardHeader>
            <CardTitle className="text-sm text-amber-400">Stuck Escalations</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              One or more escalations have overdue next actions.
            </p>
            <Link to="/activity" className="mt-2 inline-block text-sm text-primary underline">
              View Escalations →
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
