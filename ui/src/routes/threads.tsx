import { useCallback } from "react";

import { EditableCell } from "@/components/editable-cell";
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

export function ThreadsRoute() {
  const { data: entitiesData, isLoading: entitiesLoading } = useEntities();
  const { data: configData, isLoading: configLoading } = useConfig();
  const updateConfig = useUpdateConfig();

  const saveThreadField = useCallback(
    (threadId: string, field: string, value: string) => {
      if (!configData) return;
      const nextThreads = configData.threads.map((t) =>
        t.id === threadId ? { ...t, [field]: value } : t,
      );
      updateConfig.mutate({ ...configData, threads: nextThreads });
    },
    [configData, updateConfig],
  );

  const saveSystemField = useCallback(
    (field: "timezone" | "locale" | "version", value: string) => {
      if (!configData) return;
      updateConfig.mutate({
        ...configData,
        system: { ...configData.system, [field]: value },
      });
    },
    [configData, updateConfig],
  );

  const saveAssistantField = useCallback(
    (field: "messaging_identity" | "description" | "name", value: string) => {
      if (!configData) return;
      updateConfig.mutate({
        ...configData,
        assistant: {
          ...configData.assistant,
          [field]: field === "name" ? value || null : value,
        },
      });
    },
    [configData, updateConfig],
  );

  const toggleParticipant = useCallback(
    (threadId: string, entityId: string, isMember: boolean) => {
      if (!configData) return;
      const nextThreads = configData.threads.map((t) => {
        if (t.id !== threadId) return t;
        const participants = isMember
          ? [...t.participants, entityId]
          : t.participants.filter((p) => p !== entityId);
        return { ...t, participants };
      });
      updateConfig.mutate({ ...configData, threads: nextThreads });
    },
    [configData, updateConfig],
  );

  if (entitiesLoading || configLoading || !entitiesData || !configData) {
    return <p className="text-sm text-muted-foreground">Loading threads…</p>;
  }

  const entityIds = entitiesData.entities.map((e) => e.id);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Threads</h2>
        <p className="text-sm text-muted-foreground">
          System config, assistant identity, and thread membership.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>System</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Timezone</p>
              <EditableCell
                value={configData.system.timezone}
                onSave={(value) => saveSystemField("timezone", value)}
              />
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Locale</p>
              <EditableCell
                value={configData.system.locale}
                onSave={(value) => saveSystemField("locale", value)}
              />
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Version</p>
              <EditableCell
                value={configData.system.version}
                onSave={(value) => saveSystemField("version", value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assistant</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Messaging Identity</p>
              <EditableCell
                value={configData.assistant.messaging_identity}
                onSave={(value) => saveAssistantField("messaging_identity", value)}
              />
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Name</p>
              <EditableCell
                value={configData.assistant.name ?? ""}
                onSave={(value) => saveAssistantField("name", value)}
              />
            </div>
            <div className="sm:col-span-2">
              <p className="mb-1 text-xs text-muted-foreground">Description</p>
              <EditableCell
                value={configData.assistant.description}
                onSave={(value) => saveAssistantField("description", value)}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Thread Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Thread ID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Participants</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {configData.threads.map((thread) => (
                <TableRow key={thread.id}>
                  <TableCell className="font-mono text-xs">{thread.id}</TableCell>
                  <TableCell>
                    <Badge variant={thread.type === "private" ? "secondary" : "outline"}>
                      {thread.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <EditableCell
                      value={thread.description}
                      onSave={(v) => saveThreadField(thread.id, "description", v)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {entityIds.map((eId) => {
                        const isMember = thread.participants.includes(eId);
                        return (
                          <Button
                            key={eId}
                            type="button"
                            size="sm"
                            variant={isMember ? "default" : "outline"}
                            onClick={() => toggleParticipant(thread.id, eId, !isMember)}
                          >
                            {eId}
                          </Button>
                        );
                      })}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
