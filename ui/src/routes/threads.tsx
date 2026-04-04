import { useCallback } from "react";

import { EditableCell } from "@/components/editable-cell";
import { PageHeader } from "@/components/page-header";
import { PageModeBanner } from "@/components/page-mode-banner";
import { ReconciliationSummary } from "@/components/reconciliation-summary";
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
import { useConfig, useUpdateConfig } from "@/hooks/use-config";
import { useEntities } from "@/hooks/use-entities";
import { EntityType } from "@/lib/constants";

export function ThreadsRoute() {
  const { data: entitiesData, isLoading: entitiesLoading } = useEntities();
  const { data: configData, isLoading: configLoading } = useConfig();
  const updateConfig = useUpdateConfig();

  const saveSystemField = useCallback(
    (field: "timezone" | "locale", value: string) => {
      if (!configData) return;
      updateConfig.mutate({
        ...configData,
        system: { ...configData.system, [field]: value },
      });
    },
    [configData, updateConfig],
  );

  const toggleParticipant = useCallback(
    (threadId: string, entityId: string, isMember: boolean) => {
      if (!configData) return;
      const existing = configData.threads.find((thread) => thread.id === threadId);
      const baseThread =
        existing ??
        ({
          id: threadId,
          type: "shared",
          participants: [],
          description: "Couple thread. Finances, relationship, couple-level coordination.",
        } as const);
      const participants = isMember
        ? [...baseThread.participants, entityId]
        : baseThread.participants.filter((participant) => participant !== entityId);
      const nextThread = { ...baseThread, participants };
      const nextThreads = existing
        ? configData.threads.map((thread) => (thread.id === threadId ? nextThread : thread))
        : [...configData.threads, nextThread];
      updateConfig.mutate({ ...configData, threads: nextThreads });
    },
    [configData, updateConfig],
  );

  if (entitiesLoading || configLoading || !entitiesData || !configData) {
    return (
      <div className="space-y-6">
        <PageHeader title="Threads" description="System config plus the generated thread graph." />
        <p className="text-sm text-muted-foreground">Loading threads…</p>
      </div>
    );
  }

  const entityIds = entitiesData.entities.map((e) => e.id);
  const adultEntityIds = entitiesData.entities
    .filter((entity) => entity.type === EntityType.Adult)
    .map((entity) => entity.id);
  const privateThreads = configData.threads.filter((thread) => thread.type === "private");
  const familyThread = configData.threads.find((thread) => thread.id === "family");
  const coupleThread = configData.threads.find((thread) => thread.id === "couple");

  return (
    <div className="space-y-6">
      <PageHeader title="Threads" description="System config plus the generated thread graph." />
      <PageModeBanner
        mode="editable"
        detail="Timezone, locale, and couple membership update live. Private and family threads are generated from the current entity roster and shown read-only."
      />
      <ReconciliationSummary result={updateConfig.data} />
      {updateConfig.error instanceof Error && (
        <Card className="border-destructive/40">
          <CardContent className="pt-6 text-sm text-destructive">
            {updateConfig.error.message}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>System</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Timezone *</p>
            <EditableCell
              value={configData.system.timezone}
              onSave={(value) => saveSystemField("timezone", value)}
            />
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Locale *</p>
            <EditableCell
              value={configData.system.locale}
              onSave={(value) => saveSystemField("locale", value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Generated Threads</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium">Private Threads</h3>
              <Badge variant="outline">Read only</Badge>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Thread ID</TableHead>
                  <TableHead>Participant</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {privateThreads.map((thread) => (
                  <TableRow key={thread.id}>
                    <TableCell className="font-mono text-xs">{thread.id}</TableCell>
                    <TableCell>{thread.participants[0] ?? ""}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium">Family Thread</h3>
              <Badge variant="outline">Read only</Badge>
            </div>
            <div className="rounded-md border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-xs">{familyThread?.id ?? "family"}</span>
                <div className="flex flex-wrap gap-1">
                  {(familyThread?.participants ?? entityIds).map((entityId) => (
                    <Badge key={entityId} variant="secondary" className="text-xs">
                      {entityId}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium">Couple Thread</h3>
              <Badge variant="secondary">Editable</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Select at least two adults to keep the couple thread. Leave fewer than two selected to
              remove it.
            </p>
            <div className="flex flex-wrap gap-2">
              {adultEntityIds.map((entityId) => {
                const isMember = coupleThread?.participants.includes(entityId) ?? false;
                return (
                  <Button
                    key={entityId}
                    type="button"
                    size="sm"
                    variant={isMember ? "default" : "outline"}
                    onClick={() => toggleParticipant("couple", entityId, !isMember)}
                  >
                    {entityId}
                  </Button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
