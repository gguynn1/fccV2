# Identity Service

## Role in the system

**Primary roles: startup validation and worker-time utility** — not the hot path for resolving who sent an inbound phone message.

- **Inbound messages:** The transport layer maps **messaging identity → entity id** (and thread) using configuration loaded at startup. That lookup happens **before** enqueue; it does not call `IdentityService` on every webhook. Think of it as the same mapping data the service would use, applied at the boundary for speed and clarity.
- **Post-dequeue worker:** The worker uses **`createWorkerIdentityService()`**, a narrow adapter that **trusts the queue item**: it takes **`item.concerning[0]`** (with a default human fallback) as the source entity and **`item.target_thread`** as the thread context, and loads entity type from config via `IdentityService.getEntity`. It does not re-resolve the sender from raw transport fields for that step.

So `IdentityService` remains the place that knows entity records, thread memberships, and validation rules — but **inbound identity resolution for “who texted us?” is owned by transport**, not by invoking the full service on the hot path.

## Resolving by messaging identity

`resolveByMessagingIdentity(messagingIdentity, incomingThreadId)` maps a messaging identity to an entity **only for entities that have one**. The internal map is built from entities with a non-null `messaging_identity`.

**`EntityType.Pet` is intentionally excluded from messaging-identity resolution:** pet entities must not have a messaging identity (enforced by the entity schema when configuration is parsed, including when `IdentityService` is constructed). They never appear in the messaging-identity map and cannot be looked up as senders. `IdentityService.assertPetMessagingIdentities()` exists to assert the same invariant explicitly if needed.

## What it knows

Entity type (adult / child / pet), permissions, thread memberships.

Returns (for `resolveByMessagingIdentity`): entity ID, entity type, permissions, incoming thread ID, full thread membership list for that entity.

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
