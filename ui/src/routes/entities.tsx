import { useCallback } from "react";

import { EditableCell } from "@/components/editable-cell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useEntities, useUpdateEntities, type EntityPayload } from "@/hooks/use-entities";

function permissionLabel(p: string): string {
  return p.replace(/_/g, " ");
}

export function EntitiesRoute() {
  const { data, isLoading } = useEntities();
  const mutation = useUpdateEntities();

  const saveEntity = useCallback(
    (index: number, patch: Partial<EntityPayload>) => {
      if (!data) return;
      const next = data.entities.map((e, i) => (i === index ? { ...e, ...patch } : e));
      mutation.mutate(next);
    },
    [data, mutation],
  );

  const togglePermission = useCallback(
    (index: number, permission: string, has: boolean) => {
      if (!data) return;
      const entity = data.entities[index];
      const permissions = has
        ? [...entity.permissions, permission]
        : entity.permissions.filter((p) => p !== permission);
      saveEntity(index, { permissions });
    },
    [data, saveEntity],
  );

  if (isLoading || !data) {
    return <p className="text-sm text-muted-foreground">Loading entities…</p>;
  }

  const allPermissions = [
    "approve_financial",
    "approve_sends",
    "modify_system",
    "assign_tasks",
    "view_all_topics",
    "complete_tasks",
    "add_items",
    "ask_questions",
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Entities</h2>
        <p className="text-sm text-muted-foreground">
          Participants, permissions, and thread assignments.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Entity Registry</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Messaging Identity</TableHead>
                <TableHead>Threads</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.entities.map((entity, idx) => {
                const isPet = entity.type === "pet";
                const memberThreads = data.threads.filter((t) =>
                  t.participants.includes(entity.id),
                );
                return (
                  <TableRow key={entity.id}>
                    <TableCell className="font-mono text-xs">{entity.id}</TableCell>
                    <TableCell>
                      <EditableCell
                        value={entity.name}
                        onSave={(name) => saveEntity(idx, { name })}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{entity.type}</Badge>
                    </TableCell>
                    <TableCell>
                      {isPet ? (
                        <span className="text-xs text-muted-foreground italic">no messaging</span>
                      ) : (
                        <EditableCell
                          value={entity.messaging_identity ?? ""}
                          onSave={(v) => saveEntity(idx, { messaging_identity: v })}
                          disabled={isPet}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {memberThreads.map((t) => (
                          <Badge key={t.id} variant="outline" className="text-xs">
                            {t.id}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entity</TableHead>
                {allPermissions.map((p) => (
                  <TableHead key={p} className="text-center text-xs">
                    {permissionLabel(p)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.entities.map((entity, idx) => (
                <TableRow key={entity.id}>
                  <TableCell className="font-mono text-xs">{entity.id}</TableCell>
                  {allPermissions.map((p) => {
                    const has = entity.permissions.includes(p);
                    return (
                      <TableCell key={p} className="text-center">
                        <Switch
                          checked={has}
                          onCheckedChange={(checked) => togglePermission(idx, p, checked)}
                        />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
