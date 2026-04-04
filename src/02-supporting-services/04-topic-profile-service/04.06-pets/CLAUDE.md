# Pets

Care logs, vet visits, medications, grooming, boarding, travel prep.

## Routing and architecture

**Pets do not have messaging identities by design.** They cannot send or receive phone-native messages; they are tracked entities (profile, care history), not participants on the messaging surface.

**All pet concerns route to the responsible adult's private thread.** Proactive pet reminders, care nudges, and follow-ups about a pet go to that thread—not to a pet-specific destination and not treated as if the pet were a messaging participant.

This is an **intentional architectural decision**, not a missing feature or a gap to close later. The product model is: humans coordinate; pets are subjects of record and routing targets only through a responsible adult.

**Configuration validation:** `EntityType.Pet` entries are validated when entity configuration is loaded (schema rules) so a pet cannot be assigned a messaging identity. That keeps the invariant enforceable at startup rather than only at runtime.

The assistant is warm but practical here — a caretaker tone. "PET's last vet visit was 11 months ago — might be time for the annual." It tracks care history so the family doesn't have to remember when something last happened.

Initiative is gentle: periodic reminders about overdue care, pre-travel checklists for boarding or pet-sitting, and medication tracking if applicable. No escalation — just steady, helpful awareness.

Cross-topic connections: Calendar (vet appointments), Vendors (grooming, boarding providers).
