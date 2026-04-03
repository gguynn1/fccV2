import { useCallback } from "react";

import { EditableCell } from "@/components/editable-cell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  useTopics,
  useUpdateTopics,
  type TopicConfigPayload,
  type TopicsResponse,
} from "@/hooks/use-topics";

const ESCALATION_LEVELS = ["high", "medium", "low", "none"] as const;
const CONFIRMATION_ACTIONS = ["sending_on_behalf", "financial_action", "system_change"] as const;

export interface TopicCardProps {
  config: TopicConfigPayload;
  onUpdate: (patch: Partial<TopicConfigPayload>) => void;
}

function TopicCard({ config, onUpdate }: TopicCardProps) {
  const isEnabled = config.behavior?.enabled !== "false";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{config.label}</CardTitle>
          <Switch
            checked={isEnabled}
            onCheckedChange={(checked) =>
              onUpdate({
                behavior: { ...config.behavior, enabled: checked ? "true" : "false" },
              })
            }
          />
        </div>
        <p className="text-xs text-muted-foreground">{config.description}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Tone</p>
            <EditableCell
              value={config.behavior?.tone ?? ""}
              onSave={(tone) => onUpdate({ behavior: { ...config.behavior, tone } })}
            />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Format</p>
            <EditableCell
              value={config.behavior?.format ?? ""}
              onSave={(format) => onUpdate({ behavior: { ...config.behavior, format } })}
            />
          </div>
        </div>

        <div>
          <p className="text-xs text-muted-foreground mb-1">Escalation</p>
          <Select
            value={config.escalation}
            onChange={(e) => onUpdate({ escalation: e.target.value })}
            className="h-8 text-xs"
          >
            {ESCALATION_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </Select>
        </div>

        {config.confirmation_required !== undefined && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Confirmation Required</p>
            <Switch
              checked={config.confirmation_required}
              onCheckedChange={(checked) => onUpdate({ confirmation_required: checked })}
            />
          </div>
        )}

        {config.confirmation_required_for_sends !== undefined && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Confirm Sends</p>
            <Switch
              checked={config.confirmation_required_for_sends}
              onCheckedChange={(checked) => onUpdate({ confirmation_required_for_sends: checked })}
            />
          </div>
        )}

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
  const mutation = useUpdateTopics();

  const updateTopic = useCallback(
    (topicKey: string, patch: Partial<TopicConfigPayload>) => {
      if (!data) return;
      const current = data.topics[topicKey];
      const nextTopics = {
        ...data.topics,
        [topicKey]: { ...current, ...patch },
      };
      const payload: TopicsResponse = {
        ...data,
        topics: nextTopics,
      };
      mutation.mutate(payload);
    },
    [data, mutation],
  );

  const toggleApprovalGate = useCallback(
    (action: string) => {
      if (!data) return;
      const nextSet = new Set(data.confirmation_gates.always_require_approval);
      if (nextSet.has(action)) {
        nextSet.delete(action);
      } else {
        nextSet.add(action);
      }
      mutation.mutate({
        ...data,
        confirmation_gates: {
          ...data.confirmation_gates,
          always_require_approval: [...nextSet],
        },
      });
    },
    [data, mutation],
  );

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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {topicEntries.map(([key, config]) => (
          <TopicCard key={key} config={config} onUpdate={(patch) => updateTopic(key, patch)} />
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
                {CONFIRMATION_ACTIONS.map((action) => (
                  <Button
                    key={action}
                    type="button"
                    size="sm"
                    variant={
                      data.confirmation_gates.always_require_approval.includes(action)
                        ? "default"
                        : "outline"
                    }
                    onClick={() => toggleApprovalGate(action)}
                  >
                    {action.replace(/_/g, " ")}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Expiry Minutes</p>
              <EditableCell
                value={String(data.confirmation_gates.expiry_minutes)}
                type="number"
                onSave={(v) => {
                  const n = Number.parseInt(v, 10);
                  if (Number.isNaN(n) || n <= 0) return;
                  mutation.mutate({
                    ...data,
                    confirmation_gates: { ...data.confirmation_gates, expiry_minutes: n },
                  });
                }}
              />
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">On Expiry</p>
            <EditableCell
              value={data.confirmation_gates.on_expiry}
              onSave={(v) => {
                mutation.mutate({
                  ...data,
                  confirmation_gates: { ...data.confirmation_gates, on_expiry: v },
                });
              }}
            />
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
