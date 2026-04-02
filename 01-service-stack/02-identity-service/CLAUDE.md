# Identity Service

Resolves who sent this
Maps phone number to entity

Knows: type (adult/child/pet), permissions, thread memberships

Returns: entity ID, entity type, which thread this came from

Example: "PARTICIPANT 1 said this in the couple thread"

## Entity Model

Three entity types:

**Adult** — has a phone number, has a private thread, can approve financial actions, authorize sends on behalf, and modify system rules. PARTICIPANT 1 and PARTICIPANT 2 are adults.

**Child** — has a phone number, has a private thread, can complete tasks and ask questions but cannot approve financial actions or change system rules. PARTICIPANT 3 is a child.

**Pet** — no phone number, no thread. A tracked entity with a profile (species, vet, medications, care schedule). Information about pets surfaces in the threads of responsible adults. PET is a pet.

## Entity to Thread Mapping

```
One adult ---------> their private thread
One child ---------> their private thread
The couple --------> couple thread
The whole family --> family thread
A pet -------------> responsible adult's thread
```

## Thread Memberships

- PARTICIPANT 1 + Assistant (private)
- PARTICIPANT 2 + Assistant (private)
- PARTICIPANT 3 + Assistant (private)
- PARTICIPANT 2 + PARTICIPANT 1 + Assistant (couple)
- PARTICIPANT 2 + PARTICIPANT 1 + PARTICIPANT 3 + Assistant (family)
