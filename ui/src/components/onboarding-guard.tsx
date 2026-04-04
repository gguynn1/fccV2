import { useState, type Dispatch, type ReactNode, type SetStateAction } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useConfig, useUpdateConfig, type ConfigPayload } from "@/hooks/use-config";
import { useUpdateEntities, type EntityPayload } from "@/hooks/use-entities";
import { useSystem } from "@/hooks/use-system";
import { ADULT_PERMISSIONS, CHILD_PERMISSIONS, EntityType, ThreadType } from "@/lib/constants";

export interface OnboardingGuardProps {
  children: ReactNode;
}

// ── Constants ──

const TIMEZONES = Intl.supportedValuesOf("timeZone");

// ── Helpers ──

function deriveEntityId(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "_");
}

function permissionLabel(p: string): string {
  return p.replace(/_/g, " ");
}

function petDraftToEntity(pet: PetDraft, validPeopleIds: Set<string>): EntityPayload {
  return {
    id: deriveEntityId(pet.name),
    type: EntityType.Pet,
    name: pet.name.trim(),
    messaging_identity: null,
    permissions: [],
    profile: {
      species: pet.species.trim(),
      breed: null,
      vet: null,
      medications: [],
      care_schedule: [],
    },
    routes_to: pet.routes_to.filter((id) => validPeopleIds.has(id)),
  };
}

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "America/Chicago";
  }
}

function detectLocale(): string {
  try {
    return navigator.language;
  } catch {
    return "en-US";
  }
}

// ── Draft types ──

type PersonType = typeof EntityType.Adult | typeof EntityType.Child;

interface PersonDraft {
  name: string;
  type: PersonType;
  messaging_identity: string;
  permissions: string[];
  morning: string;
  evening: string;
}

interface PetDraft {
  name: string;
  species: string;
  routes_to: string[];
}

function createPersonDraft(): PersonDraft {
  return {
    name: "",
    type: EntityType.Adult,
    messaging_identity: "",
    permissions: [...ADULT_PERMISSIONS],
    morning: "07:00",
    evening: "20:00",
  };
}

function createPetDraft(): PetDraft {
  return { name: "", species: "", routes_to: [] };
}

function entityToPersonDraft(entity: EntityPayload): PersonDraft {
  return {
    name: entity.name,
    type: entity.type as PersonDraft["type"],
    messaging_identity: entity.messaging_identity ?? "",
    permissions: [...entity.permissions],
    morning: entity.digest?.morning ?? "07:00",
    evening: entity.digest?.evening ?? "",
  };
}

// ── Step 0: Locale ──

interface LocaleStepProps {
  config: ConfigPayload;
  onComplete: () => void;
}

function LocaleStep({ config, onComplete }: LocaleStepProps) {
  const [timezone, setTimezone] = useState(detectTimezone);
  const [locale, setLocale] = useState(detectLocale);
  const updateConfig = useUpdateConfig();

  function handleContinue() {
    updateConfig.mutate(
      { ...config, system: { ...config.system, timezone, locale } },
      { onSuccess: onComplete },
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>System Locale</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="onboard-tz" className="text-xs text-muted-foreground">
            Timezone *
          </label>
          <Select id="onboard-tz" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replaceAll("_", " ")}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <label htmlFor="onboard-locale" className="text-xs text-muted-foreground">
            Locale *
          </label>
          <Input
            id="onboard-locale"
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            placeholder="en-US"
          />
        </div>
        <div className="flex justify-end pt-2">
          <Button
            onClick={handleContinue}
            disabled={updateConfig.isPending || timezone.length === 0 || locale.length === 0}
          >
            {updateConfig.isPending ? "Saving..." : "Continue"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Step 1: People ──

interface PeopleStepProps {
  initialPeople: EntityPayload[];
  petDrafts: PetDraft[];
  allPermissions: string[];
  onBack: () => void;
  onComplete: (people: EntityPayload[]) => void;
}

function PeopleStep({
  initialPeople,
  petDrafts,
  allPermissions,
  onBack,
  onComplete,
}: PeopleStepProps) {
  const [people, setPeople] = useState<PersonDraft[]>(() =>
    initialPeople.length > 0 ? initialPeople.map(entityToPersonDraft) : [createPersonDraft()],
  );
  const updateEntities = useUpdateEntities();

  function updatePerson(index: number, patch: Partial<PersonDraft>) {
    setPeople((prev) =>
      prev.map((p, i) => {
        if (i !== index) return p;
        const updated = { ...p, ...patch };
        if (patch.type && patch.type !== p.type) {
          updated.permissions =
            patch.type === EntityType.Adult ? [...ADULT_PERMISSIONS] : [...CHILD_PERMISSIONS];
          updated.morning = patch.type === EntityType.Adult ? "07:00" : "07:30";
          updated.evening = patch.type === EntityType.Adult ? "20:00" : "";
        }
        return updated;
      }),
    );
  }

  function togglePermission(index: number, perm: string) {
    setPeople((prev) =>
      prev.map((p, i) => {
        if (i !== index) return p;
        const has = p.permissions.includes(perm);
        return {
          ...p,
          permissions: has ? p.permissions.filter((x) => x !== perm) : [...p.permissions, perm],
        };
      }),
    );
  }

  function addPerson() {
    setPeople((prev) => [...prev, createPersonDraft()]);
  }

  function removePerson(index: number) {
    setPeople((prev) => prev.filter((_, i) => i !== index));
  }

  const ids = people.map((p) => deriveEntityId(p.name));
  const messagingIdentities = people.map((p) => p.messaging_identity.trim());
  const hasAdult = people.some((p) => p.type === EntityType.Adult);
  const allValid = people.every((p) => {
    const id = deriveEntityId(p.name);
    const messagingIdentity = p.messaging_identity.trim();
    return (
      p.name.trim().length > 0 &&
      messagingIdentity.length > 0 &&
      p.morning.length > 0 &&
      id.length > 0 &&
      ids.filter((x) => x === id).length === 1 &&
      messagingIdentities.filter((x) => x === messagingIdentity).length === 1
    );
  });
  const canContinue = hasAdult && allValid && people.length > 0;

  function handleContinue() {
    const validPeopleIds = new Set(people.map((p) => deriveEntityId(p.name)));
    const entities: EntityPayload[] = people.map((p) => ({
      id: deriveEntityId(p.name),
      type: p.type,
      name: p.name.trim(),
      messaging_identity: p.messaging_identity.trim(),
      permissions: p.permissions,
      digest: { morning: p.morning, evening: p.evening || null },
    }));
    const petEntities = petDrafts
      .filter(
        (pet) =>
          pet.name.trim().length > 0 && pet.species.trim().length > 0 && pet.routes_to.length > 0,
      )
      .map((pet) => petDraftToEntity(pet, validPeopleIds));
    updateEntities.mutate([...entities, ...petEntities], { onSuccess: () => onComplete(entities) });
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>People</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {people.map((person, idx) => {
          const id = deriveEntityId(person.name);
          const isDuplicate =
            person.name.trim().length > 0 && ids.filter((x) => x === id).length > 1;
          const normalizedMessagingIdentity = person.messaging_identity.trim();
          const hasDuplicateMessagingIdentity =
            normalizedMessagingIdentity.length > 0 &&
            messagingIdentities.filter((x) => x === normalizedMessagingIdentity).length > 1;

          return (
            <div key={idx} className="space-y-3 rounded-md border border-border p-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <label className="text-xs text-muted-foreground">Name *</label>
                  <Input
                    value={person.name}
                    onChange={(e) => updatePerson(idx, { name: e.target.value })}
                    placeholder="Name"
                  />
                  {person.name.trim().length > 0 && (
                    <p
                      className={`text-xs ${isDuplicate ? "text-destructive" : "text-muted-foreground"}`}
                    >
                      {isDuplicate
                        ? "An entity with this ID already exists. Choose a different name."
                        : `ID: ${id}`}
                    </p>
                  )}
                </div>
                <div className="w-28 shrink-0 space-y-1">
                  <label className="text-xs text-muted-foreground">Type *</label>
                  <Select
                    value={person.type}
                    onChange={(e) =>
                      updatePerson(idx, { type: e.target.value as PersonDraft["type"] })
                    }
                  >
                    <option value={EntityType.Adult}>Adult</option>
                    <option value={EntityType.Child}>Child</option>
                  </Select>
                </div>
                {people.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-5 h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removePerson(idx)}
                  >
                    X
                  </Button>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Messaging Identity *</label>
                <Input
                  value={person.messaging_identity}
                  onChange={(e) => updatePerson(idx, { messaging_identity: e.target.value })}
                  placeholder="e.g. +15551000001"
                />
                {hasDuplicateMessagingIdentity && (
                  <p className="text-xs text-destructive">
                    This messaging identity is already assigned to another person.
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Permissions</label>
                <div className="flex flex-wrap gap-1">
                  {allPermissions.map((perm) => {
                    const has = person.permissions.includes(perm);
                    return (
                      <Badge
                        key={perm}
                        variant={has ? "default" : "outline"}
                        className="cursor-pointer select-none"
                        onClick={() => togglePermission(idx, perm)}
                      >
                        {permissionLabel(perm)}
                      </Badge>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Morning Digest *</label>
                  <Input
                    type="time"
                    value={person.morning}
                    onChange={(e) => updatePerson(idx, { morning: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Evening Digest</label>
                  <Input
                    type="time"
                    value={person.evening}
                    onChange={(e) => updatePerson(idx, { evening: e.target.value })}
                  />
                </div>
              </div>
            </div>
          );
        })}

        <Button type="button" variant="outline" className="w-full" onClick={addPerson}>
          Add Person
        </Button>

        {!hasAdult && people.length > 0 && (
          <p className="text-center text-xs text-destructive">
            At least one adult is required to continue.
          </p>
        )}

        <div className="flex justify-between pt-2">
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
          <Button onClick={handleContinue} disabled={!canContinue || updateEntities.isPending}>
            {updateEntities.isPending ? "Saving..." : "Continue"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Step 2: Pets ──

interface PetsStepProps {
  people: EntityPayload[];
  pets: PetDraft[];
  setPets: Dispatch<SetStateAction<PetDraft[]>>;
  onBack: () => void;
  onComplete: () => void;
}

function PetsStep({ people, pets, setPets, onBack, onComplete }: PetsStepProps) {
  const updateEntities = useUpdateEntities();

  function updatePet(index: number, patch: Partial<PetDraft>) {
    setPets((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function toggleRoute(index: number, personId: string) {
    setPets((prev) =>
      prev.map((p, i) => {
        if (i !== index) return p;
        const has = p.routes_to.includes(personId);
        return {
          ...p,
          routes_to: has ? p.routes_to.filter((x) => x !== personId) : [...p.routes_to, personId],
        };
      }),
    );
  }

  function addPet() {
    setPets((prev) => [...prev, createPetDraft()]);
  }

  function removePet(index: number) {
    setPets((prev) => prev.filter((_, i) => i !== index));
  }

  const peopleIds = people.map((p) => p.id);
  const petIds = pets.map((p) => deriveEntityId(p.name));
  const allIds = [...peopleIds, ...petIds];

  const allPetsValid =
    pets.length > 0 &&
    pets.every((p) => {
      const id = deriveEntityId(p.name);
      return (
        p.name.trim().length > 0 &&
        id.length > 0 &&
        p.species.trim().length > 0 &&
        p.routes_to.length > 0 &&
        allIds.filter((x) => x === id).length === 1
      );
    });

  function handleContinue() {
    const validPeopleIds = new Set(people.map((person) => person.id));
    const petEntities: EntityPayload[] = pets.map((p) => petDraftToEntity(p, validPeopleIds));
    updateEntities.mutate([...people, ...petEntities], { onSuccess: onComplete });
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>Pets</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {pets.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No pets added yet. Add a pet or skip this step.
          </p>
        )}

        {pets.map((pet, idx) => {
          const id = deriveEntityId(pet.name);
          const isDuplicate =
            pet.name.trim().length > 0 && allIds.filter((x) => x === id).length > 1;

          return (
            <div key={idx} className="space-y-3 rounded-md border border-border p-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <label className="text-xs text-muted-foreground">Name *</label>
                  <Input
                    value={pet.name}
                    onChange={(e) => updatePet(idx, { name: e.target.value })}
                    placeholder="Name"
                  />
                  {pet.name.trim().length > 0 && (
                    <p
                      className={`text-xs ${isDuplicate ? "text-destructive" : "text-muted-foreground"}`}
                    >
                      {isDuplicate
                        ? "An entity with this ID already exists. Choose a different name."
                        : `ID: ${id}`}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-5 h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removePet(idx)}
                >
                  X
                </Button>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Species *</label>
                <Input
                  value={pet.species}
                  onChange={(e) => updatePet(idx, { species: e.target.value })}
                  placeholder="e.g. dog, cat, bird"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Routes To *</label>
                <div className="flex flex-wrap gap-1">
                  {people.map((person) => {
                    const selected = pet.routes_to.includes(person.id);
                    return (
                      <Badge
                        key={person.id}
                        variant={selected ? "default" : "outline"}
                        className="cursor-pointer select-none"
                        onClick={() => toggleRoute(idx, person.id)}
                      >
                        {person.name}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}

        <Button type="button" variant="outline" className="w-full" onClick={addPet}>
          Add Pet
        </Button>

        <div className="flex justify-between pt-2">
          <Button variant="ghost" onClick={onBack} disabled={updateEntities.isPending}>
            Back
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onComplete} disabled={updateEntities.isPending}>
              Skip
            </Button>
            {pets.length > 0 && (
              <Button onClick={handleContinue} disabled={!allPetsValid || updateEntities.isPending}>
                {updateEntities.isPending ? "Saving..." : "Continue"}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Step 3: Threads ──

interface ThreadsStepProps {
  people: EntityPayload[];
  coupleMembers: string[];
  setCoupleMembers: Dispatch<SetStateAction<string[]>>;
  config: ConfigPayload;
  onBack: () => void;
  onComplete: () => void;
}

function ThreadsStep({
  people,
  coupleMembers,
  setCoupleMembers,
  config,
  onBack,
  onComplete,
}: ThreadsStepProps) {
  const updateConfig = useUpdateConfig();
  const adultPeople = people.filter((person) => person.type === EntityType.Adult);

  function toggleCoupleMember(personId: string) {
    setCoupleMembers((prev) =>
      prev.includes(personId) ? prev.filter((id) => id !== personId) : [...prev, personId],
    );
  }

  const privateThreads = people.map((p) => ({
    id: `${p.id}_private`,
    type: ThreadType.Private as string,
    participants: [p.id],
    description: `${p.name}'s private thread. Personal reminders, digests, drafts, review space.`,
  }));

  const familyThread = {
    id: "family",
    type: ThreadType.Shared as string,
    participants: people.map((p) => p.id),
    description: "Family thread. Chores, grocery, travel, pets, general household.",
  };

  const coupleThread =
    coupleMembers.length >= 2
      ? {
          id: "couple",
          type: ThreadType.Shared as string,
          participants: [...coupleMembers],
          description: "Couple thread. Finances, relationship, couple-level coordination.",
        }
      : null;

  function handleContinue() {
    const threads = [...privateThreads, familyThread, ...(coupleThread ? [coupleThread] : [])];
    updateConfig.mutate(
      { ...config, system: { ...config.system, is_onboarded: true }, threads },
      { onSuccess: onComplete },
    );
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>Threads</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Private Threads</p>
          <div className="space-y-1">
            {privateThreads.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2"
              >
                <span className="text-sm">{t.participants[0]}</span>
                <span className="font-mono text-xs text-muted-foreground">{t.id}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Family Thread</p>
          <div className="rounded-md border border-border px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">All household members</span>
              <span className="font-mono text-xs text-muted-foreground">{familyThread.id}</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {people.map((p) => (
                <Badge key={p.id} variant="secondary" className="select-none text-xs">
                  {p.name}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Couple Thread</p>
          {adultPeople.length >= 2 ? (
            <>
              <p className="text-xs text-muted-foreground">
                Select the adults in the couple thread, or leave empty to skip.
              </p>
              <div className="flex flex-wrap gap-1">
                {adultPeople.map((p) => {
                  const selected = coupleMembers.includes(p.id);
                  return (
                    <Badge
                      key={p.id}
                      variant={selected ? "default" : "outline"}
                      className="cursor-pointer select-none"
                      onClick={() => toggleCoupleMember(p.id)}
                    >
                      {p.name}
                    </Badge>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Add at least 2 adults to create the couple thread.
            </p>
          )}
          {coupleMembers.length === 1 && (
            <p className="text-xs text-destructive">Select at least 2 members or none.</p>
          )}
        </div>

        <div className="flex justify-between pt-2">
          <Button variant="ghost" onClick={onBack} disabled={updateConfig.isPending}>
            Back
          </Button>
          <Button
            onClick={handleContinue}
            disabled={updateConfig.isPending || coupleMembers.length === 1}
          >
            {updateConfig.isPending ? "Saving..." : "Finish"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Guard ──

export function OnboardingGuard({ children }: OnboardingGuardProps) {
  const { data, isLoading, isError } = useConfig();
  const { data: systemData } = useSystem();
  const [step, setStep] = useState(0);
  const [savedPeople, setSavedPeople] = useState<EntityPayload[]>([]);
  const [petDrafts, setPetDrafts] = useState<PetDraft[]>([]);
  const [coupleMembers, setCoupleMembers] = useState<string[]>([]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <p className="text-sm text-destructive">Failed to load system configuration.</p>
      </div>
    );
  }

  if (data && !data.system.is_onboarded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-6">
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Setup</p>
            <h1 className="mt-1 text-2xl font-semibold">Family Command Center</h1>
          </div>

          {step === 0 && <LocaleStep config={data} onComplete={() => setStep(1)} />}

          {step === 1 && (
            <PeopleStep
              initialPeople={savedPeople}
              petDrafts={petDrafts}
              allPermissions={systemData?.permissions ?? []}
              onBack={() => setStep(0)}
              onComplete={(people) => {
                const validIds = new Set(people.map((p) => p.id));
                const adultIds = new Set(
                  people.filter((p) => p.type === EntityType.Adult).map((p) => p.id),
                );
                setSavedPeople(people);
                setPetDrafts((prev) =>
                  prev.map((pet) => ({
                    ...pet,
                    routes_to: pet.routes_to.filter((id) => validIds.has(id)),
                  })),
                );
                setCoupleMembers((prev) => prev.filter((id) => adultIds.has(id)));
                setStep(2);
              }}
            />
          )}

          {step === 2 && (
            <PetsStep
              people={savedPeople}
              pets={petDrafts}
              setPets={setPetDrafts}
              onBack={() => setStep(1)}
              onComplete={() => setStep(3)}
            />
          )}

          {step === 3 && (
            <ThreadsStep
              people={savedPeople}
              coupleMembers={coupleMembers}
              setCoupleMembers={setCoupleMembers}
              config={data}
              onBack={() => setStep(2)}
              onComplete={() => {}}
            />
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
