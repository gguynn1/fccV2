import { useCallback } from "react";

import { EditableCell } from "@/components/editable-cell";
import { PageHeader } from "@/components/page-header";
import { PageModeBanner } from "@/components/page-mode-banner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  useTopics,
  useUpdateTopics,
  type TopicConfigPayload,
  type TopicsResponse,
} from "@/hooks/use-topics";

interface TopicCardProps {
  topicKey: string;
  config: TopicConfigPayload;
  escalationLevels: string[];
  onFieldChange: (topicKey: string, field: string, value: string | boolean) => void;
}

function TopicCard({ topicKey, config, escalationLevels, onFieldChange }: TopicCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{config.label}</CardTitle>
          {config.confirmation_required !== undefined && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Confirm
              </span>
              <Switch
                checked={config.confirmation_required}
                onCheckedChange={(checked) =>
                  onFieldChange(topicKey, "confirmation_required", checked)
                }
              />
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{config.description}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Tone</p>
            <EditableCell
              value={config.behavior?.tone ?? ""}
              onSave={(v) => onFieldChange(topicKey, "behavior.tone", v)}
            />
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Format</p>
            <EditableCell
              value={config.behavior?.format ?? ""}
              onSave={(v) => onFieldChange(topicKey, "behavior.format", v)}
            />
          </div>
        </div>

        <div>
          <p className="mb-1 text-xs text-muted-foreground">Escalation</p>
          <Select
            value={config.escalation}
            onValueChange={(v) => onFieldChange(topicKey, "escalation", v)}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {escalationLevels.map((level) => (
                <SelectItem key={level} value={level}>
                  {level}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {config.cross_topic_connections && config.cross_topic_connections.length > 0 && (
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Cross-topic Connections</p>
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
  const mutation = useUpdateTopics();

  const handleFieldChange = useCallback(
    (topicKey: string, field: string, value: string | boolean) => {
      if (!data) return;

      const nextTopics = structuredClone(data.topics);
      const topic = nextTopics[topicKey];
      if (!topic) return;

      if (field === "confirmation_required") {
        topic.confirmation_required = value as boolean;
      } else if (field === "escalation") {
        topic.escalation = value as string;
      } else if (field.startsWith("behavior.")) {
        const behaviorField = field.slice("behavior.".length);
        if (!topic.behavior) {
          topic.behavior = {} as Record<string, string>;
        }
        topic.behavior[behaviorField] = value as string;
      }

      const payload: TopicsResponse = {
        topics: nextTopics,
        escalation_profiles: data.escalation_profiles,
        confirmation_gates: data.confirmation_gates,
      };
      mutation.mutate(payload);
    },
    [data, mutation],
  );

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Topics"
          description="Topic profile settings, escalation controls, and confirmation gates."
        />
        <p className="text-sm text-muted-foreground">Loading topics…</p>
      </div>
    );
  }

  const topicEntries = Object.entries(data.topics);
  const escalationLevels = Object.keys(data.escalation_profiles);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Topics"
        description="Topic profile settings, escalation controls, and confirmation gates."
      />
      <PageModeBanner
        mode="editable"
        detail="Topic behavior (tone, format, escalation level, confirmation gate) is live-editable. Cross-topic connections are code-managed."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {topicEntries.map(([key, config]) => (
          <TopicCard
            key={key}
            topicKey={key}
            config={config}
            escalationLevels={escalationLevels}
            onFieldChange={handleFieldChange}
          />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Confirmation Gates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Always Require Approval</p>
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
                <div className="mb-1 flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs uppercase">
                    {level}
                  </Badge>
                  <span className="text-sm font-medium">{profile.label}</span>
                </div>
                <div className="text-xs text-muted-foreground">
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
