# Identity Service

Resolves who sent this
Maps messaging identity to entity

Knows: type (adult/child/pet), permissions, thread memberships

Returns: entity ID, entity type, which thread this came from

## Entity Model

Three entity types:

**Adult** — has a messaging identity, has a private thread, can approve financial actions, authorize sends on behalf, and modify system rules.

**Child** — has a messaging identity, has a private thread, can complete tasks and ask questions but cannot approve financial actions or change system rules.

**Pet** — no messaging identity, no thread. A tracked entity with a profile (species, vet, medications, care schedule). Information about pets surfaces in the threads of responsible adults. A pet never receives a message, but the system tracks its care history as thoroughly as any other entity's records.

Every entity has an identity record the system maintains: name, type, permissions, messaging identity if applicable, and which threads they belong to. The full entity roster is defined in the system configuration.

## Entity to Thread Mapping

```
One entity with a messaging identity --> their private thread
A subset of entities -----------------> their shared thread
A pet --------------------------------> responsible adult's thread
```

Thread memberships are defined in the system configuration. Each thread has an explicit participant list and type (private or shared).
