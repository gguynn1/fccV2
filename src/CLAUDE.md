# Family Command Center

Root of the system architecture. Contains configuration, state, and all service definitions.

## Structure

- `01-service-stack/` — Core processing pipeline from transport to dispatch
- `02-supporting-services/` — Services called by the worker or feeding the queue
- `03-connections/` — How services interact

## Shared Vocabulary

`types.ts` defines cross-cutting enums that belong to no single service:

- **TopicKey** — The 14 topic classifications used system-wide
- **EscalationLevel** — Severity levels for escalation paths
- **GrocerySection** — Categorization for the grocery list
- **InputMethod** — How input was received (text, image)

These enums are foundational vocabulary referenced by multiple services across both the service stack and supporting services. They live here because they represent concepts that are not semantically owned by any single service.

## Cross-cutting Policy

`config/topic-delivery-policy.ts` is the executable delivery-policy layer that sits alongside persisted config.

It is where the runtime derives cross-cutting rules such as:

- privacy scope by topic
- allowed and denied thread ids
- awareness policy for shared notices
- confirmation approval-thread defaults
- per-topic notification quotas and cooldown hints
- quiet-hours defaults used by the outbound governor

Routing, Worker dispatch safety, budget suppression, transport shared-thread handling, and confirmation fallback behavior all depend on that policy layer in addition to persisted `SystemConfig`.
