import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboard } from "@/hooks/use-dashboard";

function StatusCard({
  title,
  value,
  to,
  variant = "default",
  badge,
}: {
  title: string;
  value: string | number;
  to: string;
  variant?: "default" | "success" | "warning" | "destructive";
  badge?: string;
}) {
  const colorMap = {
    default: "border-border",
    success: "border-emerald-600/40",
    warning: "border-amber-600/40",
    destructive: "border-red-600/40",
  };

  return (
    <Link to={to}>
      <Card className={`transition-colors hover:bg-muted/30 ${colorMap[variant]}`}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm font-medium text-muted-foreground">
            {title}
            {badge && (
              <Badge
                variant={
                  variant === "destructive"
                    ? "destructive"
                    : variant === "warning"
                      ? "warning"
                      : "secondary"
                }
                className="text-xs"
              >
                {badge}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{value}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

export function DashboardRoute() {
  const { data, isLoading } = useDashboard();

  if (isLoading || !data) {
    return <p className="text-sm text-muted-foreground">Loading dashboard…</p>;
  }

  const { queue, escalations, confirmations, dispatches, budget, system } = data;
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

  const budgetUsageRatio = budgetCap > 0 ? dispatchedToday / budgetCap : 0;
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
      <div>
        <h2 className="text-lg font-semibold">Dashboard</h2>
        <p className="text-sm text-muted-foreground">System health at a glance.</p>
      </div>

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
            budgetUsageRatio >= 0.75 ? `${Math.round(budgetUsageRatio * 100)}% of cap` : undefined
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
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
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
