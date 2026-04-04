import { PageModeBanner } from "@/components/page-mode-banner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTopics, type TopicConfigPayload } from "@/hooks/use-topics";

export interface TopicCardProps {
  config: TopicConfigPayload;
}

function TopicCard({ config }: TopicCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{config.label}</CardTitle>
          <Badge variant="outline">Read only</Badge>
        </div>
        <p className="text-xs text-muted-foreground">{config.description}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Tone</p>
            <p>{config.behavior?.tone ?? "Configured in code"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Format</p>
            <p>{config.behavior?.format ?? "Configured in code"}</p>
          </div>
        </div>

        <div>
          <p className="text-xs text-muted-foreground mb-1">Escalation</p>
          <p>{config.escalation}</p>
        </div>

        {config.cross_topic_connections && config.cross_topic_connections.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Cross-topic Connections</p>
            <div className="flex flex-wrap gap-1">
              {config.cross_topic_connections.map((c) => (
                <Badge key={c} variant="outline" className="text-xs">
                  {c}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function TopicsRoute() {
  const { data, isLoading } = useTopics();

  if (isLoading || !data) {
    return <p className="text-sm text-muted-foreground">Loading topics…</p>;
  }

  const topicEntries = Object.entries(data.topics);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Topics</h2>
        <p className="text-sm text-muted-foreground">
          Topic profile settings, escalation controls, and confirmation gates.
        </p>
      </div>
      <PageModeBanner
        mode="read-only"
        detail="These values are visible for operator reference, but runtime topic composition and confirmation-gate behavior are still code-backed rather than safely live-editable."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {topicEntries.map(([key, config]) => (
          <TopicCard key={key} config={config} />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Confirmation Gates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Always Require Approval</p>
              <div className="flex flex-wrap gap-1">
                {data.confirmation_gates.always_require_approval.map((action) => (
                  <Badge key={action} variant="secondary" className="text-xs">
                    {action.replace(/_/g, " ")}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Expiry Minutes</p>
              <p>{data.confirmation_gates.expiry_minutes}</p>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">On Expiry</p>
            <p>{data.confirmation_gates.on_expiry}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Escalation Profiles</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(data.escalation_profiles).map(([level, profile]) => (
              <div key={level} className="border-b border-border pb-3 last:border-0 last:pb-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="secondary" className="text-xs uppercase">
                    {level}
                  </Badge>
                  <span className="text-sm font-medium">{profile.label}</span>
                </div>
                <div className="text-xs text-muted-foreground mb-1">
                  Applies to: {profile.applies_to.join(", ")}
                </div>
                <div className="text-xs text-muted-foreground">
                  Steps: {profile.steps.join(" → ")}
                </div>
                <div className="text-xs text-muted-foreground">
                  On reassignment: {profile.on_reassignment}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
