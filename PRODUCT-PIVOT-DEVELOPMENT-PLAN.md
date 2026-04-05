# Product Pivot Development Plan

## Purpose

This document reassesses only these six workstreams:

- Shared conversation substrate
- Ambient intake
- Structured replies
- Topic-shaped behavior
- Smart routing and approvals
- Proactive follow-up

This version incorporates the latest feedback and uses a stricter framing:

- compare **current runtime** to the **strongest end-state product**
- do **not** bias the recommendation based on migration cost, user disruption, or implementation effort

The question is:

> If we are free to build the strongest version of this product, what should each of these six workstreams become?

## Assessment Frame

This document compares current runtime behavior to the strongest end-state product for each workstream.

It does not evaluate document quality, naming, or presentation. It evaluates product behavior and target product truth.

## Assessment Standard

Each workstream is judged against the same product standard:

- Does it make the assistant feel more native and natural?
- Does it reduce the need for the household to manually narrate life?
- Does it lower friction without lowering trust?
- Does it make the product feel more distinct from a generic assistant?
- Does it strengthen the assistant's long-term identity?

## Overall Conclusion

Under that standard, all six workstreams should move toward the vision.

Five of the six were already clearly moving that way in the prior version:

- Shared conversation substrate
- Ambient intake
- Structured replies
- Smart routing and approvals
- Proactive follow-up

The biggest adjustment in this rewrite is `Topic-shaped behavior`.

It should no longer be treated as one feature among several. It should be treated as an **identity-level pillar** of the product.

That changes both the recommendation and the sequencing.

## Summary Table

| Workstream                    | Current Runtime Signal                                                   | Why Current Runtime Is Not Yet The End-State                                                                    | Strongest End-State Product                                                         | Recommendation  | Codebase Assessment                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Shared conversation substrate | Shared behavior already exists in a meaningful way when fully configured | Shared behavior still depends too much on setup quality and does not yet feel unquestionably canonical          | Shared conversations are canonical, natural, and stable                             | Build to vision | 📊 **~82%** — Thread model, routing policy, Conversations text path, and delivery guards are real and exercised <br>✅ **Feasibility: High** — gap-fill is incremental; Conversations works for text <br>⚙️ **Effort: Medium** — persist SIDs to SQLite, achieve media/status parity, harden shared-to-private handoff <br>⚠️ **Risk: Low-Med** — Conversations edge cases and carrier behavior are the main unknowns; no eval coverage for Conversations path <br>📅 **Sequence: Foundation** <br>💎 **Value: High** — core differentiator; shared surface is what separates this from a private-only assistant <br>🔍 **Gaps:** SID not persisted to SQLite after create (restart relies on uniqueName recovery) · shared-thread media and delivery-status not at parity with Programmable Messaging · eval harness has no Conversations exercise · transport throws hard on unmapped shared thread instead of degrading                                                                                                                                                                                                                                                                 |
| Ambient intake                | The runtime already accepts multiple ambient inputs                      | Ambient inputs still feel more like separate entry points than one unified intake layer                         | The assistant reduces narration burden by absorbing supported household signals     | Build to vision | 📊 **~65%** — IMAP monitoring, MMS vision, forwarded detection, and scheduled triggers all exist and feed the unified BullMQ queue <br>✅ **Feasibility: High** — all three input doors exist; closing gaps is additive, not structural <br>⚙️ **Effort: Medium** — wire unused extraction code, gate IMAP on config, add email-attachment vision, unify intake feel <br>⚠️ **Risk: Low** — additive work on existing paths; no architectural change; risk limited to extraction quality <br>📅 **Sequence: Bridge layer** <br>💎 **Value: High** — "forward it and the assistant handles it" depends on this layer feeling unified <br>🔍 **Gaps:** `extractForwardedPayload` implemented but never called from production path · email `active` config flag doesn't gate live IMAP · email attachments not sent to Claude vision · `produceIngestItems` contract method has no caller · `poll_interval_minutes` unused for IMAP timing                                                                                                                                                                                                                                                   |
| Structured replies            | The runtime already supports lightweight replies                         | Lightweight replies still behave more like conveniences than a full quick-reply language                        | A deliberate quick-reply language becomes part of the product identity              | Build to vision | 📊 **~58%** — Binary confirm/reject with thread-aware matching and expiry is solid; reactions, N-option, and dynamic menus are thin or absent <br>✅ **Feasibility: High** — incremental on existing confirmation system; no new infrastructure needed <br>⚙️ **Effort: Low-Med** — extend to N-option registry, preserve StructuredChoice kind through enqueue, wire ClarificationRequest.options <br>⚠️ **Risk: Low** — additive changes; main risk is interaction-design complexity, not code breakage <br>📅 **Sequence: Foundation** <br>💎 **Value: Med-High** — interaction compression makes the product feel effortless; scales proactive behavior without reply burden <br>🔍 **Gaps:** No N-option prompt registry beyond binary · StructuredChoice kind dropped at enqueue · no native tapback/emoji decoding (word-list heuristic only) · ClarificationRequest.options never populated · reply doesn't resolve escalation state · `always_require_approval` config not read by worker                                                                                                                                                                                         |
| Topic-shaped behavior         | Topic profiles already shape runtime behavior                            | The behavioral range is real but not yet deep enough to define the assistant's identity in every important flow | The assistant has strong situational range that people can actually feel            | Build to vision | 📊 **~57%** — Delivery policy and typed-action branching per topic are deep; composition voice, per-topic timing, and cross-topic connections are surface-level <br>✅ **Feasibility: Medium** — requires significant iteration in the 4.3k-line worker where most behavioral surface area concentrates <br>⚙️ **Effort: High** — worker refactoring, profile-to-Claude pipeline enrichment, remaining cross-topic edges, functional config routing <br>🔴 **Risk: High** — largest surface area; identity-level changes cascade through routing, composition, escalation, and eval; limited test coverage for topic-specific paths <br>📅 **Sequence: Foundation (identity pillar)** <br>💎 **Value: Very High** — the defensibility axis; separates the product from a polished but generic assistant <br>🔍 **Gaps:** State-backed templates override profile-driven voice for many actions · multi-tone topics only surface first tone key · config routing strings are descriptive not functional IDs · cross-topic connections overclaim vs `buildCrossTopicContent` · escalation profiles hardcoded in `PROFILE_BY_LEVEL` · disambiguation config not wired into classifier prompts |
| Smart routing and approvals   | Routing and policy behavior already exist in real form                   | The system still exposes too much visible conservatism in flows that should feel more natural                   | Reply, follow-up, approval, and awareness land in the right place with low friction | Build to vision | 📊 **~72%** — Action router, delivery policy, thread selection, and confirmation gates are real; dead config fields and dedup gaps remain <br>✅ **Feasibility: High** — targeted policy/logic adjustments, not new infrastructure <br>⚙️ **Effort: Medium** — fix dead metadata, improve multi-entity fallbacks, tighten dedup, align collision models <br>⚠️ **Risk: Medium** — routing touches many worker paths; escalation overrides create paired-thread inconsistency; forced dispatch bypasses the final guard <br>📅 **Sequence: Foundation** <br>💎 **Value: High** — "feels intelligent" vs "feels rule-shaped" is a perceptible quality line <br>🔍 **Gaps:** `CollisionPolicy` ignored by budget service · proactive routing throws instead of degrading · `confirmation_policy`, `follow_up_thread_policy`, `digest_policy` defined but never read · `dedupe_key` computed but not applied (substring heuristic instead) · multi-entity unsafe targets only store, no shared reroute · forced dispatch bypasses `enforceDispatchPolicy`                                                                                                                                      |
| Proactive follow-up           | The runtime already has reminders, batching, digests, and escalation     | The building blocks are present, but the follow-through layer is not yet the product's full center of gravity   | The assistant becomes a trusted follow-through layer, not just a responder          | Build to vision | 📊 **~57%** — Scheduler ticks, XState escalation, budget caps, and staleness checks exist; digest merging, rich per-topic reminders, and config-driven escalation are missing <br>✅ **Feasibility: Med-High** — pipeline exists end-to-end; enrichment is the work, not construction <br>⚙️ **Effort: High** — digest composer, per-topic reminder engine, config-driven escalation profiles, threshold reconciliation <br>⚠️ **Risk: Medium** — digest merging is a new capability; escalation reconciliation is fragile; thresholds inconsistent (scheduler 4h, queue 24h, worker heuristic) <br>📅 **Sequence: Trustworthy Follow-Through (last)** <br>💎 **Value: Very High** — headline promise; follow-through is what makes the assistant feel like it carries household load <br>🔍 **Gaps:** No digest composer merging batched items into one outbound · per-topic reminders are config prose not executable · escalation profiles hardcoded not from persisted config · staleness thresholds inconsistent across layers · `FlaggedInDigest` not a real digest hook · `on_ignored` text not executed as logic                                                                   |

## Workstream 1: Shared Conversation Substrate

### Current Runtime Signal

- Shared behavior is already a meaningful part of the runtime when shared transport is correctly configured.
- The product already points toward a collaborative shared surface rather than a purely private interaction model.

### Why Current Runtime Is Not Yet The End-State

- Shared behavior is already meaningful, but it is not yet unquestionably canonical.
- The product can still feel like shared coordination sits on top of the system rather than inside its center.

### Strongest End-State Product

Shared conversations should be canonical:

- people coordinate naturally in a shared surface
- the assistant behaves as if it truly belongs there
- replies, follow-up, approvals, and shared awareness feel coherent from that shared starting point
- private follow-up exists because it is useful, not because the shared substrate is weak

### Assessment

The vision is stronger.

Without effort or migration bias, there is no product reason to prefer a weaker shared-surface story over a truly native one.

### Development Target

- Shared conversations become a first-class surface, not a special case.
- Shared-origin flows feel intentional from start to finish.
- Shared behavior becomes one of the main reasons the product feels unlike a generic assistant.

### Validation

- Shared input receives the right shared response by default where appropriate.
- Shared-origin follow-up remains coherent even when narrowed.
- Shared approvals and shared awareness behave intentionally.
- Shared behavior can be described without caveat-heavy language.

## Workstream 2: Ambient Intake

### Current Runtime Signal

The runtime already accepts meaningful ambient inputs:

- forwarded content
- monitored email
- images
- scheduled triggers

### Why Current Runtime Is Not Yet The End-State

- Ambient inputs still behave more like separate supported paths than one coherent intake layer.
- The product still leaves too much interpretation work with the household instead of absorbing it itself.

### Strongest End-State Product

Ambient intake should reduce narration burden.

The assistant should absorb relevant household signals and convert them into:

- tracking
- clarification
- approvals
- reminders
- follow-up

The key idea is not breadth for its own sake. The key idea is that the assistant should carry more of the interpretation burden.

### Assessment

The vision is stronger.

The current runtime is pointing in the right direction, but it still feels more like a set of supported inputs than a unified intake layer.

### Development Target

- Ambient intake becomes core product behavior.
- Supported ambient surfaces feel coherent rather than separate.
- The household spends less time restating information that already exists in a message, image, or inbox.

### Validation

- Supported ambient surfaces behave consistently.
- Intake produces predictable next-step behavior.
- Ambiguity resolves safely without making ambient intake feel unreliable.
- The assistant visibly reduces narration burden.

## Workstream 3: Structured Replies

### Current Runtime Signal

The runtime already supports:

- yes or no
- numbered choices
- short replies
- some reaction handling

### Why Current Runtime Is Not Yet The End-State

- The current reply set is useful, but it is still narrower than the strongest possible quick-reply system.
- The product still behaves more like it allows short replies than like it is designed around them.

### Strongest End-State Product

Structured replies should become a deliberate quick-reply language.

That means people can resolve common flows with minimal effort for:

- approval
- selection
- confirmation
- completion
- status
- lightweight sentiment or rating where it genuinely improves the flow

The real product gain is not reply matching alone. It is interaction compression.

### Assessment

The vision is stronger.

The current runtime is useful, but it still behaves more like a cluster of affordances than a full interaction system.

### Development Target

- Quick replies become a first-class product language.
- Common actions resolve with minimal typing.
- Richer reply forms are offered deliberately rather than incidentally.

### Validation

- Approval flows resolve quickly and predictably.
- Selection flows are unambiguous.
- Reaction handling works as convenience rather than fragile dependency.
- The assistant scales proactive behavior without creating reply burden.

## Workstream 4: Topic-Shaped Behavior

### Current Runtime Signal

Topic profiles and delivery policy already influence behavior through:

- tone
- format
- initiative style
- follow-up posture
- delivery posture

### Why Current Runtime Is Not Yet The End-State

- Topic differences are real, but they are still not deep enough to define the assistant's identity in every important flow.
- The product still risks reading as one generally helpful assistant with tonal variation rather than one assistant with strong situational range.

### Strongest End-State Product

Topic-shaped behavior should be a core identity pillar.

The assistant should feel materially different across contexts, not just lightly restyled.

That means different situations should produce clear differences in:

- voice
- urgency
- initiative
- follow-up style
- pressure
- framing

This is not just a feature. It is part of what makes the product itself defensible.

### Assessment

The vision is stronger, and this workstream should be weighted more heavily than the prior version of the plan weighted it.

This is the axis most likely to separate the product from a polished but generic assistant.

### Development Target

- Topic-shaped behavior becomes one of the product's primary identity pillars.
- Different topic contexts feel obviously and repeatably different in practice.
- Topic behavior affects the design of the rest of the system, not just message wording.

### Validation

- Different contexts produce visibly different behavior in real flows.
- The same input shape can lead to clearly different handling by topic.
- Topic-shaped behavior remains consistent through routing, approvals, and follow-up.
- The assistant feels intentionally modeful, not cosmetically varied.

## Workstream 5: Smart Routing And Approvals

### Current Runtime Signal

The runtime already contains meaningful behavior for:

- reply placement
- narrower follow-up
- delivery policy checks
- approval handling
- some fallback logic

### Why Current Runtime Is Not Yet The End-State

- Routing already does meaningful work, but too much of its caution is still visible to the user.
- The product still risks feeling rule-shaped in places where it should feel naturally intelligent.

### Strongest End-State Product

The strongest product chooses the right surface for:

- reply
- follow-up
- approval
- awareness
- clarification

It minimizes:

- awkward cross-surface friction
- unnecessary approval overhead
- duplicate notifications
- visible thread weirdness

The goal is not invisible automation. The goal is high-trust, low-friction intelligence.

### Assessment

The vision is stronger.

The current runtime already points in that direction, but still carries too much visible conservatism in places where the product should feel more naturally intelligent.

### Development Target

- Routing decisions feel smart rather than rule-exposed.
- Approval placement becomes intentionally optimized.
- Duplicate and conflicting notifications become unacceptable rather than tolerated.

### Validation

- People rarely need to think about why something appeared where it did.
- Approval prompts appear where they feel natural.
- Follow-up and awareness do not create cross-surface confusion.
- Routing feels intelligent without feeling spooky.

## Workstream 6: Proactive Follow-Up

### Current Runtime Signal

The runtime already includes:

- reminders
- digests
- batching
- escalation
- follow-up timing

### Why Current Runtime Is Not Yet The End-State

- The building blocks are present, but they still read more like capabilities than one coherent follow-through layer.
- The strongest version would make proactive behavior feel central rather than supplemental.

### Strongest End-State Product

The strongest product is defined by trusted proactive follow-up.

That means the assistant reliably:

- notices what needs follow-through
- checks in after relevant events
- adapts pressure based on context
- summarizes instead of spamming
- surfaces unresolved things before they fail

The goal is not merely scheduling outbound messages. The goal is carrying household follow-through load.

### Assessment

The vision is stronger.

The current runtime contains many of the correct ingredients, but the stronger product turns them into a coherent follow-through layer rather than a list of capabilities.

### Development Target

- Proactive follow-up becomes one of the product's headline strengths.
- Timing, batching, pressure, and backoff become deeply intentional.
- The assistant is trusted not just to answer, but to carry follow-through responsibility.

### Validation

- Follow-up feels timely and useful.
- Digests reduce interruption while preserving awareness.
- Pressure adapts rather than staying flat.
- The assistant feels reliably on top of what needs follow-through.

## Revised Recommendation Set

With the current runtime judged generously and migration / effort bias removed, the recommendation set is:

- Shared conversation substrate -> `Build to vision`
- Ambient intake -> `Build to vision`
- Structured replies -> `Build to vision`
- Topic-shaped behavior -> `Build to vision`
- Smart routing and approvals -> `Build to vision`
- Proactive follow-up -> `Build to vision`

The meaningful change from the prior version is not the recommendation direction alone.

The meaningful change is:

- topic-shaped behavior is now treated as identity-level
- current runtime is treated as partial but meaningful rather than thin
- sequencing is changed so topic-shaped behavior starts in the foundation layer

## Revised Sequencing

The previous version separated the work into foundation, intelligence, and autonomy layers in a way that still left topic-shaped behavior too late.

This version changes that.

### Foundation Layer

Start together:

- Topic-shaped behavior
- Shared conversation substrate
- Smart routing and approvals
- Structured replies

Why:

- These four workstreams define what the assistant feels like.
- Topic-shaped behavior cannot be bolted on after routing and reply systems are already structurally set.
- Routing, approvals, and reply forms should be designed with topic-shaped behavior in mind from the start.

### Ambient Intake Integration Layer

This layer contains only one workstream, but it is still a real phase in the product buildout.

It sits between foundation and follow-through because ambient intake should not define the assistant's behavior before the assistant has stable modes, routing, and reply systems. At the same time, proactive follow-up should not become a headline strength until intake can reliably feed those systems with useful signals.

Build next:

- Ambient intake

Why:

- Ambient intake is most valuable when it can land into already-defined behavioral modes, routing rules, and reply systems.
- Intake should feed a product that already knows how it behaves, not a product still inventing its own identity.
- This makes ambient intake a bridge layer: it connects the assistant's behavioral foundation to its later follow-through strength.

### Trustworthy Follow-Through Layer

Build after the foundation is trustworthy and the intake layer can feed it well:

- Proactive follow-up

Why:

- Proactive behavior is most valuable when the assistant's surfaces, modes, and reply system are already trustworthy.
- The product should not scale proactive pressure faster than it scales behavioral coherence.

## Development Implication

This plan should no longer ask:

- what is easiest to preserve
- what is least disruptive to current users
- what is cheapest to evolve from the current state

It should ask:

- what would make the assistant feel most native
- what would make it most distinct
- what would make it most trustworthy once it becomes more capable

That means this plan is now more decisive than compromise-oriented.

## Final Recommendation

The six-workstream answer is now straightforward:

- the current runtime already contains meaningful foundations for the right product
- the strongest end-state still lies further toward the vision
- topic-shaped behavior should be treated as a core identity pillar and started in the foundation layer

The product should not just support these six behaviors.

It should be organized around them.
