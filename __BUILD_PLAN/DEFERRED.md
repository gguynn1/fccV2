# Deferred Items

Only unresolved technical debt lives here. Historical accepted and resolved review notes were purged during plan consolidation.

## Active Deferrals

### D-01 — Per-topic runtime state validation

- **Severity:** High
- **Description:** State slices are still validated as broad records instead of per-topic runtime shapes, which leaves Worker reads and writes under-validated.
- **Target:** `TODO-02`
- **Action:** Replace generic topic-record validation with per-topic Zod schemas and validate each topic slice on State Service read/write paths without broad casts.

### D-02 — Admin API config validation hardening

- **Severity:** Medium
- **Description:** Admin config routes rely on permissive schemas and unsafe casts instead of strict payload validation.
- **Target:** `TODO-02`
- **Action:** Replace permissive admin config schemas with strict per-surface validation for entities, threads, topics, budget, and scheduler payloads, then remove the unsafe casts.

### D-03 — Meal-to-grocery extraction is still placeholder logic

- **Severity:** Low
- **Description:** Meal parsing still uses hardcoded keyword matching instead of model-backed grocery extraction.
- **Target:** `TODO-02`
- **Action:** Replace the placeholder helper with structured extraction that can turn meal descriptions into grocery items.

### D-04 — Unused CalDAV type definitions

- **Severity:** Medium
- **Description:** Several CalDAV types are defined but not used by the current implementation.
- **Target:** `TODO-02`
- **Action:** Either wire the types into the CalDAV implementation or remove them.

### D-05 — CalDAV collection `ctag` is static

- **Severity:** Low
- **Description:** The CalDAV collection still reports a hardcoded `ctag`, which prevents proper cache invalidation when events change.
- **Target:** `TODO-02`
- **Action:** Derive `ctag` from persisted calendar state, such as the most recent event modification timestamp.

### D-06 — Confirmation request typing still needs cleanup

- **Severity:** Low
- **Description:** Confirmation opening logic still depends on a cast instead of a complete request interface.
- **Target:** `TODO-02`
- **Action:** Expand the request type to include the optional fields used at runtime and remove the cast.
