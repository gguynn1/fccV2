import { useCallback } from "react";

import { EditableCell } from "@/components/editable-cell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useSystem } from "@/hooks/use-system";
import { EntityType } from "@/lib/constants";

function permissionLabel(p: string): string {
  return p.replace(/_/g, " ");
}

export function EntitiesRoute() {
  const { data, isLoading } = useEntities();
  const { data: systemData } = useSystem();
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

  const saveDigestField = useCallback(
    (index: number, field: "morning" | "evening", value: string) => {
      if (!data) return;
      const entity = data.entities[index];
      const digest = entity.digest ?? { morning: "07:00", evening: null };
      saveEntity(index, {
        digest: { ...digest, [field]: field === "evening" && value === "" ? null : value },
      });
    },
    [data, saveEntity],
  );

  const saveProfileField = useCallback(
    (index: number, field: string, value: string | string[] | null) => {
      if (!data) return;
      const entity = data.entities[index];
      const profile = entity.profile ?? {
        species: "",
        breed: null,
        vet: null,
        medications: [],
        care_schedule: [],
      };
      saveEntity(index, { profile: { ...profile, [field]: value } });
    },
    [data, saveEntity],
  );

  const toggleRoute = useCallback(
    (index: number, personId: string) => {
      if (!data) return;
      const entity = data.entities[index];
      const routes = entity.routes_to ?? [];
      const has = routes.includes(personId);
      saveEntity(index, {
        routes_to: has ? routes.filter((r) => r !== personId) : [...routes, personId],
      });
    },
    [data, saveEntity],
  );

  if (isLoading || !data) {
    return <p className="text-sm text-muted-foreground">Loading entities…</p>;
  }

  const allPermissions = systemData?.permissions ?? [];

  const people = data.entities.filter((e) => e.type !== EntityType.Pet);
  const pets = data.entities.filter((e) => e.type === EntityType.Pet);
  const personIds = people.map((p) => p.id);

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
                <TableHead>Name *</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Messaging Identity *</TableHead>
                <TableHead>Threads</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.entities.map((entity, idx) => {
                const isPet = entity.type === EntityType.Pet;
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

      {people.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Digest Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entity</TableHead>
                  <TableHead>Morning *</TableHead>
                  <TableHead>Evening</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.entities.map((entity, idx) => {
                  if (entity.type === EntityType.Pet) return null;
                  return (
                    <TableRow key={entity.id}>
                      <TableCell className="font-mono text-xs">{entity.id}</TableCell>
                      <TableCell>
                        <EditableCell
                          type="time"
                          value={entity.digest?.morning ?? ""}
                          onSave={(v) => saveDigestField(idx, "morning", v)}
                        />
                      </TableCell>
                      <TableCell>
                        <EditableCell
                          type="time"
                          value={entity.digest?.evening ?? ""}
                          allowEmpty
                          onSave={(v) => saveDigestField(idx, "evening", v)}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {pets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pet Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {pets.map((pet) => {
              const idx = data.entities.indexOf(pet);
              return (
                <div key={pet.id} className="space-y-3 rounded-md border border-border p-4">
                  <p className="text-sm font-medium">{pet.name}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="mb-1 text-xs text-muted-foreground">Species *</p>
                      <EditableCell
                        value={pet.profile?.species ?? ""}
                        onSave={(v) => saveProfileField(idx, "species", v)}
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-xs text-muted-foreground">Breed</p>
                      <EditableCell
                        value={pet.profile?.breed ?? ""}
                        allowEmpty
                        onSave={(v) => saveProfileField(idx, "breed", v || null)}
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-xs text-muted-foreground">Vet</p>
                      <EditableCell
                        value={pet.profile?.vet ?? ""}
                        allowEmpty
                        onSave={(v) => saveProfileField(idx, "vet", v || null)}
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-xs text-muted-foreground">Medications</p>
                      <EditableCell
                        value={(pet.profile?.medications ?? []).join(", ")}
                        allowEmpty
                        onSave={(v) =>
                          saveProfileField(
                            idx,
                            "medications",
                            v
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          )
                        }
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-xs text-muted-foreground">Care Schedule</p>
                      <EditableCell
                        value={(pet.profile?.care_schedule ?? []).join(", ")}
                        allowEmpty
                        onSave={(v) =>
                          saveProfileField(
                            idx,
                            "care_schedule",
                            v
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          )
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Routes To *</p>
                    <div className="flex flex-wrap gap-1">
                      {personIds.map((pid) => {
                        const isMember = (pet.routes_to ?? []).includes(pid);
                        return (
                          <Button
                            key={pid}
                            type="button"
                            size="sm"
                            variant={isMember ? "default" : "outline"}
                            onClick={() => toggleRoute(idx, pid)}
                          >
                            {pid}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

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
