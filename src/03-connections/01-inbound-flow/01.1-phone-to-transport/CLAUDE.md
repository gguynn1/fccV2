# Phone-native channel → Transport

```
Provider webhook -----> tunnel -----> Fastify :3000 -----> TRANSPORT (normalize) -----> IDENTITY -----> enqueue
```

## Network path

1. **Provider** delivers an HTTP webhook signed per provider rules.
2. **Tunnel** (static subdomain) forwards to **localhost:3000** on the host.
3. **Fastify** routes the verified request to the Transport layer, which maps the payload into normalized inbound fields and queues a stack item for Identity + the main queue.

Inbound signature verification rejects forged requests before normalization.

## What arrives (input shapes)

Transport is responsible for recognizing and normalizing:

| Shape              | Role                                                                                                                          |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Plain content      | Free-form text interpreted with thread context after classification                                                           |
| Structured choice  | Assistant-offered options; short replies map to the offered choice                                                            |
| Reaction           | Positive or negative reaction on a prior assistant segment; used for confirmations and quick resolutions where supported      |
| Image / attachment | Media reference; downloaded to local media store for downstream interpretation                                                |
| Forwarded content  | Outer/inner body treated as forwarded payload for extraction                                                                  |
| Silence            | Absence of a reply within an escalation or follow-up window is **not** approval; handling depends on topic escalation profile |

**Reactions:** Behavior is **conservative** — not every client encodes reactions the same way. When mapping is uncertain, the system falls back to text clarification rather than assuming intent.

## Outage behavior

- If the tunnel or host is unreachable, inbound webhooks fail at the edge; the provider **retries only briefly**. Items are not buffered indefinitely server-side while offline.
- After connectivity returns, new events flow normally; stale / missed-window behavior is handled at the Worker, Scheduler, and queue reconciliation layers (see `02-processing-flow/CLAUDE.md`).

## Identity after Transport

Pre-enqueue identity maps the sender **messaging identity** to an **entity id** and **target_thread**. For private-thread traffic, that target is the sender's private thread. For shared-thread traffic under Twilio Conversations, the transport layer maps `ConversationSid` directly to the configured shared thread id and rejects unmapped shared conversations instead of rerouting them privately.

This is still a lightweight lookup inside the Transport layer, not a full Identity Service call. Full identity resolution — `EntityType`, permissions, thread memberships — happens post-dequeue in Worker step 2. Pets do not carry personal messaging identities; rules in Identity enforce invariants from configuration.
