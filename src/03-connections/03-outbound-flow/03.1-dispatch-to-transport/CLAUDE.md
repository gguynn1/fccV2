# Dispatch → Transport

```
ACTION ROUTER (decision: dispatch)
        |
        v
 DISPATCH handler (Zod-validated outbound envelope)
        |
        v
 TRANSPORT ---> provider REST API ---> device delivery
        ^
        |
 Status callback webhook <--- provider (delivery lifecycle)
```

## Immediate priority

- `DispatchPriority.Immediate` outcomes skip batching and enqueue/provider-send as soon as policy allows (budget + confirmation gates already cleared in Worker).
- Typical cases: direct answers, urgent alerts, clarification questions, escalation visibility bumps.

## Provider details (implemented stack)

- Outbound uses the same Twilio integration as inbound through the Transport layer.
- **Status callbacks** land on the Fastify status route; Transport maps terminal failure/success into logging and optional retry policy.
- **Outbound retries:** failed sends can be re-queued via a dedicated outbound BullMQ queue with exponential backoff (per transport implementation).

## Routing

- **Response-in-place:** Replies target the thread where the inbound item originated.
- **Proactive:** Routing Service chooses the **narrowest** thread that fits the audience (plus escalation overrides when Escalation widens visibility).

## Network outage

- If the host cannot reach the provider API, outbound work retries with backoff and remains durable in Redis/SQLite-backed audit paths — nothing is dropped; ordering still respects sequential Worker processing for a single item’s lifecycle.
