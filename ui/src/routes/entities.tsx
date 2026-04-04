import { useCallback, useState } from "react";

import { EditableCell } from "@/components/editable-cell";
import { PageModeBanner } from "@/components/page-mode-banner";
import { ReconciliationSummary } from "@/components/reconciliation-summary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { ADULT_PERMISSIONS, CHILD_PERMISSIONS, EntityType } from "@/lib/constants";

function permissionLabel(p: string): string {
  return p.replace(/_/g, " ");
}

function deriveEntityId(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "_");
}

function uniqueEntityId(name: string, existingIds: Set<string>): string {
  const base = deriveEntityId(name);
  if (!existingIds.has(base)) {
    return base;
  }

  let index = 2;
  while (existingIds.has(`${base}_${index}`)) {
    index += 1;
  }
  return `${base}_${index}`;
}

export function EntitiesRoute() {
  const { data, isLoading } = useEntities();
  const { data: systemData } = useSystem();
  const mutation = useUpdateEntities();
  const [newPersonName, setNewPersonName] = useState("");
  const [newPersonIdentity, setNewPersonIdentity] = useState("");
  const [newPersonType, setNewPersonType] = useState<
    typeof EntityType.Adult | typeof EntityType.Child
  >(EntityType.Adult);
  const [newPetName, setNewPetName] = useState("");
  const [newPetSpecies, setNewPetSpecies] = useState("");
  const [newPetRoutesTo, setNewPetRoutesTo] = useState<string[]>([]);

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

  const removeEntity = useCallback(
    (entityId: string) => {
      if (!data) return;
      mutation.mutate(data.entities.filter((entity) => entity.id !== entityId));
    },
    [data, mutation],
  );

  if (isLoading || !data) {
    return <p className="text-sm text-muted-foreground">Loading entities…</p>;
  }

  const allPermissions = systemData?.permissions ?? [];

  const people = data.entities.filter((e) => e.type !== EntityType.Pet);
  const pets = data.entities.filter((e) => e.type === EntityType.Pet);
  const personIds = people.map((p) => p.id);
  const existingIds = new Set(data.entities.map((entity) => entity.id));
  const existingIdentities = new Set(
    data.entities
      .map((entity) => entity.messaging_identity?.trim())
      .filter((identity): identity is string => Boolean(identity)),
  );

  const addPerson = () => {
    const trimmedName = newPersonName.trim();
    const trimmedIdentity = newPersonIdentity.trim();
    if (
      trimmedName.length === 0 ||
      trimmedIdentity.length === 0 ||
      existingIdentities.has(trimmedIdentity)
    ) {
      return;
    }

    const nextEntity: EntityPayload = {
      id: uniqueEntityId(trimmedName, existingIds),
      type: newPersonType,
      name: trimmedName,
      messaging_identity: trimmedIdentity,
      permissions:
        newPersonType === EntityType.Adult ? [...ADULT_PERMISSIONS] : [...CHILD_PERMISSIONS],
      digest: {
        morning: newPersonType === EntityType.Adult ? "07:00" : "07:30",
        evening: newPersonType === EntityType.Adult ? "20:00" : null,
      },
    };

    mutation.mutate([...data.entities, nextEntity], {
      onSuccess: () => {
        setNewPersonName("");
        setNewPersonIdentity("");
        setNewPersonType(EntityType.Adult);
      },
    });
  };

  const toggleNewPetRoute = (personId: string) => {
    setNewPetRoutesTo((current) =>
      current.includes(personId) ? current.filter((id) => id !== personId) : [...current, personId],
    );
  };

  const addPet = () => {
    const trimmedName = newPetName.trim();
    const trimmedSpecies = newPetSpecies.trim();
    if (trimmedName.length === 0 || trimmedSpecies.length === 0 || newPetRoutesTo.length === 0) {
      return;
    }

    const nextEntity: EntityPayload = {
      id: uniqueEntityId(trimmedName, existingIds),
      type: EntityType.Pet,
      name: trimmedName,
      messaging_identity: null,
      permissions: [],
      profile: {
        species: trimmedSpecies,
        breed: null,
        vet: null,
        medications: [],
        care_schedule: [],
      },
      routes_to: newPetRoutesTo,
    };

    mutation.mutate([...data.entities, nextEntity], {
      onSuccess: () => {
        setNewPetName("");
        setNewPetSpecies("");
        setNewPetRoutesTo([]);
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Entities</h2>
        <p className="text-sm text-muted-foreground">
          Participants, permissions, and thread assignments.
        </p>
      </div>
      <PageModeBanner
        mode="editable"
        detail="Add, remove, and edit entities inline. Required roots are enforced server-side, and dependent queue or history references are auto-cleaned."
      />
      <ReconciliationSummary result={mutation.data} />
      {mutation.error instanceof Error && (
        <Card className="border-destructive/40">
          <CardContent className="pt-6 text-sm text-destructive">
            {mutation.error.message}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Add Person</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
              <Input
                value={newPersonName}
                onChange={(event) => setNewPersonName(event.target.value)}
                placeholder="Name"
              />
              <Select
                value={newPersonType}
                onValueChange={(v) => setNewPersonType(v as typeof newPersonType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EntityType.Adult}>Adult</SelectItem>
                  <SelectItem value={EntityType.Child}>Child</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input
              value={newPersonIdentity}
              onChange={(event) => setNewPersonIdentity(event.target.value)}
              placeholder="Messaging identity"
            />
            <Button
              type="button"
              onClick={addPerson}
              disabled={
                mutation.isPending ||
                newPersonName.trim().length === 0 ||
                newPersonIdentity.trim().length === 0 ||
                existingIdentities.has(newPersonIdentity.trim())
              }
            >
              Add Person
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add Pet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                value={newPetName}
                onChange={(event) => setNewPetName(event.target.value)}
                placeholder="Pet name"
              />
              <Input
                value={newPetSpecies}
                onChange={(event) => setNewPetSpecies(event.target.value)}
                placeholder="Species"
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Routes To</p>
              <div className="flex flex-wrap gap-1">
                {people.map((person) => {
                  const selected = newPetRoutesTo.includes(person.id);
                  return (
                    <Button
                      key={person.id}
                      type="button"
                      size="sm"
                      variant={selected ? "default" : "outline"}
                      onClick={() => toggleNewPetRoute(person.id)}
                    >
                      {person.name}
                    </Button>
                  );
                })}
              </div>
            </div>
            <Button
              type="button"
              onClick={addPet}
              disabled={
                mutation.isPending ||
                newPetName.trim().length === 0 ||
                newPetSpecies.trim().length === 0 ||
                newPetRoutesTo.length === 0
              }
            >
              Add Pet
            </Button>
          </CardContent>
        </Card>
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
                <TableHead className="text-right">Remove</TableHead>
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
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeEntity(entity.id)}
                        disabled={mutation.isPending}
                      >
                        Remove
                      </Button>
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
              const idx = data.entities.findIndex((entity) => entity.id === pet.id);
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
                          disabled={entity.type === EntityType.Pet}
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
