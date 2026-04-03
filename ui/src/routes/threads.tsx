import { useCallback } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EditableCell } from "@/components/editable-cell";
import { useEntities, useUpdateEntities } from "@/hooks/use-entities";
import { useConfig, useUpdateConfig } from "@/hooks/use-config";

export function ThreadsRoute() {
  const { data: entitiesData, isLoading: entitiesLoading } = useEntities();
  const { data: configData, isLoading: configLoading } = useConfig();
  const updateConfig = useUpdateConfig();
  const updateEntities = useUpdateEntities();

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

  const toggleParticipant = useCallback(
    (threadId: string, entityId: string, isMember: boolean) => {
      if (!configData || !entitiesData) return;
      const nextThreads = configData.threads.map((t) => {
        if (t.id !== threadId) return t;
        const participants = isMember
          ? [...t.participants, entityId]
          : t.participants.filter((p) => p !== entityId);
        return { ...t, participants };
      });
      updateConfig.mutate({ ...configData, threads: nextThreads });

      const entity = entitiesData.entities.find((e) => e.id === entityId);
      if (entity?.routes_to !== undefined) {
        const nextEntities = entitiesData.entities.map((e) => {
          if (e.id !== entityId) return e;
          return e;
        });
        updateEntities.mutate(nextEntities);
      }
    },
    [configData, entitiesData, updateConfig, updateEntities],
  );

  if (entitiesLoading || configLoading || !entitiesData || !configData) {
    return <p className="text-sm text-muted-foreground">Loading threads…</p>;
  }

  const entityIds = entitiesData.entities.map((e) => e.id);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Threads</h2>
        <p className="text-sm text-muted-foreground">Thread membership and configuration.</p>
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
                          <button
                            key={eId}
                            type="button"
                            onClick={() => toggleParticipant(thread.id, eId, !isMember)}
                            className="cursor-pointer"
                          >
                            <Badge variant={isMember ? "default" : "outline"} className="text-xs">
                              {eId}
                            </Badge>
                          </button>
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
