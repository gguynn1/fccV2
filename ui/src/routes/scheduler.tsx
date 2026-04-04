import { useCallback } from "react";

import { EditableCell } from "@/components/editable-cell";
import { PageHeader } from "@/components/page-header";
import { PageModeBanner } from "@/components/page-mode-banner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  useScheduler,
  useUpdateScheduler,
  type DailyRhythmPayload,
  type SchedulerResponse,
} from "@/hooks/use-scheduler";

const DIGEST_SUBTITLES: Record<string, string> = {
  "Morning Digest":
    "Delivered to each person in their private thread. What's ahead, what's due, what's unresolved.",
  "Evening Check-in": "Brief check-in if anything is still open. Otherwise, nothing.",
};

function toTitleCase(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function formatDigestRecipientLabel(entityKey: string): string {
  const participantMatch = /^participant_(\d+)$/i.exec(entityKey);
  if (participantMatch) {
    return `Participant ${participantMatch[1]}`;
  }
  if (entityKey.toLowerCase() === "pet") {
    return "Pet";
  }
  return toTitleCase(entityKey.replace(/_/g, " "));
}

export interface DigestBlockProps {
  title: string;
  block: { times: Record<string, string | null> };
  onTimeChange: (entity: string, time: string | null) => void;
}

function DigestBlock({ title, block, onTimeChange }: DigestBlockProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">{DIGEST_SUBTITLES[title]}</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {Object.entries(block.times).map(([entity, time]) => (
            <div key={entity} className="flex items-center gap-3">
              <div className="w-28 shrink-0">
                <p className="truncate text-xs font-medium">{formatDigestRecipientLabel(entity)}</p>
                <p className="font-mono text-[10px] text-muted-foreground">{entity}</p>
              </div>
              {time === null ? (
                <span className="text-xs text-muted-foreground italic">not scheduled</span>
              ) : (
                <EditableCell value={time} type="time" onSave={(v) => onTimeChange(entity, v)} />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function SchedulerRoute() {
  const { data, isLoading } = useScheduler();
  const mutation = useUpdateScheduler();

  const saveRhythm = useCallback(
    (patch: Partial<DailyRhythmPayload>) => {
      if (!data) return;
      const payload: SchedulerResponse = {
        daily_rhythm: { ...data.daily_rhythm, ...patch },
      };
      mutation.mutate(payload);
    },
    [data, mutation],
  );

  const saveMorningTime = useCallback(
    (entity: string, time: string | null) => {
      if (!data) return;
      saveRhythm({
        morning_digest: {
          ...data.daily_rhythm.morning_digest,
          times: { ...data.daily_rhythm.morning_digest.times, [entity]: time },
        },
      });
    },
    [data, saveRhythm],
  );

  const saveEveningTime = useCallback(
    (entity: string, time: string | null) => {
      if (!data) return;
      saveRhythm({
        evening_checkin: {
          ...data.daily_rhythm.evening_checkin,
          times: { ...data.daily_rhythm.evening_checkin.times, [entity]: time },
        },
      });
    },
    [data, saveRhythm],
  );

  const toggleEligibility = useCallback(
    (field: string, value: boolean) => {
      if (!data) return;
      saveRhythm({
        digest_eligibility: {
          ...data.daily_rhythm.digest_eligibility,
          [field]: value,
        },
      });
    },
    [data, saveRhythm],
  );

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Scheduler"
          description="Digest windows, timing, and eligibility rules."
        />
        <p className="text-sm text-muted-foreground">Loading scheduler…</p>
      </div>
    );
  }

  const rhythm = data.daily_rhythm;
  const eligibility = rhythm.digest_eligibility;

  return (
    <div className="space-y-6">
      <PageHeader title="Scheduler" description="Digest windows, timing, and eligibility rules." />
      <PageModeBanner
        mode="editable"
        detail="Scheduler edits apply live. Changes here are synchronized back to per-entity digest settings."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <DigestBlock
          title="Morning Digest"
          block={rhythm.morning_digest}
          onTimeChange={saveMorningTime}
        />
        <DigestBlock
          title="Evening Check-in"
          block={rhythm.evening_checkin}
          onTimeChange={saveEveningTime}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Digest Eligibility</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Exclude already dispatched</span>
              <Switch
                checked={eligibility.exclude_already_dispatched}
                onCheckedChange={(v) => toggleEligibility("exclude_already_dispatched", v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Exclude stale</span>
              <Switch
                checked={eligibility.exclude_stale}
                onCheckedChange={(v) => toggleEligibility("exclude_stale", v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Suppress repeats from previous digest</span>
              <Switch
                checked={eligibility.suppress_repeats_from_previous_digest}
                onCheckedChange={(v) =>
                  toggleEligibility("suppress_repeats_from_previous_digest", v)
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Include unresolved from yesterday</span>
              <Switch
                checked={eligibility.include_unresolved_from_yesterday}
                onCheckedChange={(v) => toggleEligibility("include_unresolved_from_yesterday", v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Staleness threshold (hours)</span>
              <EditableCell
                value={String(eligibility.staleness_threshold_hours)}
                type="number"
                onSave={(v) => {
                  const n = Number.parseInt(v, 10);
                  if (!Number.isNaN(n) && n > 0) {
                    saveRhythm({
                      digest_eligibility: {
                        ...eligibility,
                        staleness_threshold_hours: n,
                      },
                    });
                  }
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Default State</CardTitle>
        </CardHeader>
        <CardContent>
          <EditableCell
            value={rhythm.default_state}
            onSave={(value) => saveRhythm({ default_state: value })}
          />
        </CardContent>
      </Card>
    </div>
  );
}
