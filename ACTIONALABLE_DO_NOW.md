# ACTIONALABLE DO NOW

All repo-side critical build items from the current assessment and build plan have been completed.

This file is intentionally cleared of implementation backlog items.

Remaining follow-up is manual/provider verification only and continues to live in `TODO.md`, including:

- Twilio verification approval
- real IMAP credentials and live inbox verification
- live webhook and status callback verification
- ngrok, launchd, reboot, and host-environment checks

# ACTIONALABLE DO NOW

This document turns `ASSESSMENT.md` into an ordered execution plan.

It intentionally does **not** duplicate the external/manual verification items already tracked in `TODO.md`, especially:

- Twilio verification approval
- Real IMAP credentials and live inbox verification
- ngrok, launchd, reboot, and machine-level runtime verification
- Live provider callback verification

Those remain in `TODO.md`. Everything below is the repo-side implementation and proof work that should be prioritized now.

## Order Of Execution

1. `P0` Stop the health/privacy leak immediately.
2. `P1` Choose one canonical truth for shared vs private threads.
3. `P1` Rebuild confirmation threading around that chosen thread truth.
4. `P1` Turn topic routing/privacy JSON into executable runtime policy.
5. `P1` Make the admin/config surface truthful to what the runtime actually honors.
6. `P2` Strengthen the global outbound governor so the assistant stays quiet unless useful.
7. `P2` Make ingest attribution and passive data handling safe.
8. `P2` Replace generic CalDAV change detection with event-level ingest.
9. `P2` Enforce relationship-topic quiet-window semantics end-to-end.
10. `P2` Add explanation surfaces so humans can ask why the assistant acted.
11. `P3` Expand eval around trust-breaking cases.
12. `P3` Add missing automated tests in the fragile services.
13. `P3` Preserve the current architecture as a guardrail, not a rewrite target.

## Dependency Notes

- `02` must be decided before `03`, and it influences `06`, `11`, and `12`.
- `04` unblocks `05`, sharpens `06`, and gives `09` a policy model to enforce.
- `07` and `08` should land before `10` so the explanation surface can report trustworthy ingest behavior.
- `11` and `12` should be written as the implementation lands, but they are listed last because they primarily prove the earlier work.

## 01 — P0 Stop The Health Privacy Leak

**Do this**

- Remove `TopicKey.Health` from `Worker.SHARED_AWARENESS_TOPICS`.
- Add an explicit runtime guard so privacy-sensitive topics cannot emit shared-awareness notices unless a topic policy explicitly allows it.
- Add at least one regression eval and one automated test proving a private health event never produces a shared-thread notice by default.

**Why this is first**

- This is the clearest trust-breaking bug in the repo.
- It creates the possibility that the assistant reveals the existence of a private health matter even when the config says health should stay private.
- Family trust dies faster from privacy leakage than from missing features.

**What this fixes / reconciles**

- Reconciles the mismatch between `never_share_across_people` in config and the actual worker path.
- Directly addresses the strongest repo-specific issue missed by Claude.
- Brings runtime behavior back in line with the original promise that threads are participant-safe and topic-aware.

**Files to inspect**

- `src/01-service-stack/05-worker/index.ts`
- `src/config/minimal-system-config.ts`
- `src/02-supporting-services/05-routing-service/index.ts`
- `eval/scenarios/`
- `src/01-service-stack/05-worker/index.test.ts`

**How this aligns with the original vision**

- Preserves one assistant messaging identity while making topic-specific privacy real instead of aspirational.

**How this mitigates Claude's feedback**

- Removes the kind of hidden friction that would make family members stop trusting the assistant after one wrong notification.

**Done when**

- A health update in a private thread never emits a shared notice unless an explicit allow-policy exists.
- Tests and eval fail if that behavior regresses.

## 02 — P1 Choose One Canonical Thread Truth

**Do this**

- Make an explicit architectural decision between these two models:
- `Recommended if you want real shared family/couple threads:` shared threads are real only when backed by Twilio Conversations.
- `Alternative if you want maximum simplicity:` the system is private-first, and shared notices are secondary awareness surfaces, not symmetric conversations.
- Codify that choice in runtime behavior, config expectations, and docs. Do not keep the current hybrid ambiguity.

**Why this is next**

- The current system has two incompatible notions of thread truth:
- inbound direct webhook traffic normalizes to private threads
- shared-thread inbound only really exists when Conversations is enabled and mapped
- outbound can either post to a real conversation or fan out individual messages
- Confirmation behavior, routing rules, and eval expectations cannot be made stable until this is settled.

**What this fixes / reconciles**

- Reconciles the transport split called out in `ASSESSMENT.md`.
- Prevents future code from rebuilding “rooms” accidentally while thinking it is only refining routing.
- Gives the rest of the stack one stable definition of what `family`, `couple`, and private threads actually mean.

**Files to inspect**

- `src/01-service-stack/01-transport-layer/index.ts`
- `src/server.ts`
- `src/config/minimal-system-config.ts`
- `src/02-supporting-services/05-routing-service/types.ts`
- `src/01-service-stack/01-transport-layer/CLAUDE.md`
- `src/01-service-stack/CLAUDE.md`

**How this aligns with the original vision**

- Keeps the core idea of one assistant contact and participant-defined threads, but makes the transport story honest and stable.

**How this mitigates Claude's feedback**

- Directly addresses his biggest concern: a single phone-native assistant identity only works if thread semantics are disciplined and predictable.

**Done when**

- Inbound, outbound, routing, confirmation, and eval all assume the same thread model.
- There is no silent fallback that changes the social meaning of a thread without the code acknowledging it.

## 03 — P1 Rebuild Confirmation Threading Around The Chosen Thread Truth

**Do this**

- Stop treating `requested_in_thread` as the only meaningful thread field.
- Introduce explicit confirmation semantics such as:
- `origin_thread`
- `display_thread`
- `approval_thread_policy`
- Update confirmation open/resolve logic so a human-reasonable reply does not become an accidental rejection solely because transport normalized it differently.
- Decide when approvals must be exact-thread-only and when requester-private approval is the safer rule.

**Why this matters**

- Right now the worker opens confirmations in the escalation target thread, and the confirmation service rejects wrong-thread replies.
- That is brittle even before the thread-truth decision, and it becomes a trust problem once the assistant is live with real family workflows.

**What this fixes / reconciles**

- Reconciles participant intent with transport reality.
- Fixes the confirmation/notification collision concern Claude called out.
- Makes “reply where you are” and “approve safely” compatible instead of adversarial.

**Files to inspect**

- `src/01-service-stack/05-worker/index.ts`
- `src/02-supporting-services/08-confirmation-service/index.ts`
- `src/02-supporting-services/08-confirmation-service/types.ts`
- `src/02-supporting-services/05-routing-service/index.ts`
- `eval/scenarios/thread-dynamics.ts`
- `eval/scenarios/nudge-realism.ts`

**How this aligns with the original vision**

- Preserves simple phone-native confirmation flows instead of forcing users to understand internal routing quirks.

**How this mitigates Claude's feedback**

- Directly fixes the “I acted in one thread, why did the confirmation or approval fail elsewhere?” friction.

**Done when**

- Confirmations succeed or safely clarify based on explicit policy, not transport accidents.
- Wrong-thread handling is deliberate and explainable, not an implicit rejection trap.

## 04 — P1 Turn Topic Routing And Privacy JSON Into Executable Runtime Policy

**Do this**

- Replace descriptive per-topic routing strings with a typed policy model the runtime actually consumes.
- Introduce explicit policy fields such as:
- `privacy_scope`
- `response_thread_policy`
- `follow_up_thread_policy`
- `awareness_policy`
- `allowed_thread_ids`
- `digest_policy`
- `confirmation_policy`
- Update routing, worker follow-up notices, shared-awareness, scheduler, and budget behavior to consume the same policy object instead of ad-hoc logic.

**Why this matters**

- The repo is close to your JSON-first vision structurally, but too much of the current JSON is descriptive rather than operative.
- Right now the config looks more expressive than the runtime really is.

**What this fixes / reconciles**

- Reconciles the strongest architectural gap in the assessment: elegant config that over-promises.
- Gives the runtime a single source of truth for topic behavior instead of spreading special cases across worker and routing code.
- Makes privacy, routing, and proactive behavior more explainable and testable.

**Files to inspect**

- `src/config/minimal-system-config.ts`
- `src/01-service-stack/03-classifier-service/types.ts`
- `src/02-supporting-services/04-topic-profile-service/index.ts`
- `src/02-supporting-services/05-routing-service/index.ts`
- `src/index.ts`

**How this aligns with the original vision**

- This is the clearest way to honor the original idea that the whole system can be expressed as bootstrappable config plus state.

**How this mitigates Claude's feedback**

- Prevents channel/topic behavior from sprawling into bespoke code paths.
- Makes “theme per topic” a real configuration lever instead of hidden logic.

**Done when**

- Routing and privacy behavior come from typed policy fields that are actually executed.
- Topic behavior can be explained by reading config plus one policy interpreter, not scattered worker branches.

## 05 — P1 Make The Admin And Config Surface Truthful

**Do this**

- Audit every editable topic/config field exposed through admin schemas and the runtime config.
- For each field, do one of two things:
- implement it in the runtime
- remove/hide it until implementation exists
- Specifically wire the collision strategy from config instead of hardcoding `SamePrecedenceStrategy.Batch`.

**Why this matters**

- A control surface that edits fields the runtime ignores is worse than having fewer controls.
- It creates false confidence and makes debugging impossible because the config appears authoritative but is not.

**What this fixes / reconciles**

- Reconciles the admin/config over-promise noted in the assessment.
- Makes the JSON-first story honest.
- Prevents operator confusion when tuning topic behavior, routing, or notification settings.

**Files to inspect**

- `src/admin/routes.ts`
- `src/admin/config-hardening.ts`
- `src/01-service-stack/05-worker/index.ts`
- `src/01-service-stack/types.ts`
- `src/01-service-stack/06-action-router/index.ts`
- `src/config/minimal-system-config.ts`

**How this aligns with the original vision**

- Keeps configuration central and trusted, which is essential if the system is supposed to boot into any state with behavior already defined.

**How this mitigates Claude's feedback**

- Reduces hidden complexity by making sure configurable channel/topic nuance is either real or absent, never fake.

**Done when**

- Every editable field is either consumed by runtime logic or removed from the operator surface.
- `same_precedence_strategy` comes from config all the way into routing behavior.

## 06 — P2 Strengthen The Global Outbound Governor

**Do this**

- Keep the current `immediate / batched / silent` model.
- Extend the budget/dispatcher behavior with:
- explicit quiet hours
- cooldown after any human signal, including private-thread interaction
- per-topic quotas
- topic and participant mute/stop state
- cross-topic cooldown carryover after a negative/stop signal
- “visible in-thread but do not separately ping others” semantics for confirmations, acknowledgments, and follow-up notices
- Review whether follow-up thread notices should be suppressed more aggressively once the thread-truth decision is finalized.

**Why this matters**

- This is the main path to keeping the assistant useful instead of noisy.
- The repo already has a solid dispatcher skeleton; this is an upgrade, not a rewrite.

**What this fixes / reconciles**

- Reconciles your original requirement for digesting, nudging, proactive messaging, and conflict avoidance.
- Directly answers Claude’s alert-fatigue concern without discarding the existing architecture.
- Turns the current coarse quiet-window logic into true family-safe pacing.

**Files to inspect**

- `src/02-supporting-services/06-budget-service/index.ts`
- `src/01-service-stack/05-worker/index.ts`
- `src/01-service-stack/06-action-router/index.ts`
- `src/02-supporting-services/05-routing-service/index.ts`
- `src/config/minimal-system-config.ts`

**How this aligns with the original vision**

- Keeps one queue, one worker, one assistant identity, and one dispatcher governing all outbound behavior.

**How this mitigates Claude's feedback**

- Gives you the real global governor he argued for, but by strengthening the one you already have rather than starting over.

**Done when**

- A participant can signal “not now” in one context and the system actually quiets down across relevant topics.
- Confirmations and follow-ups no longer create duplicate audience alerts by default.

## 07 — P2 Make Ingest Attribution And Passive Data Handling Safe

**Do this**

- Replace shared-adult fallback attribution with safer handling:
- quarantine silently
- ask one clarifying question in the safest private context
- surface to operator/admin metadata when human review is needed
- Preserve provenance and confidence so later explanation surfaces can tell users what was ingested and why it was or was not surfaced.
- Add explicit thresholds for low-confidence attribution and stale relevance.

**Why this matters**

- Passive data sources are where silent trust failures happen.
- A family assistant cannot quietly decide that ambiguous external data belongs in a shared family thread.

**What this fixes / reconciles**

- Reconciles the desire for external data feeds with the need for family-safe privacy boundaries.
- Solves the hidden trust issue identified in the assessment around ambiguous attribution.

**Files to inspect**

- `src/02-supporting-services/02-data-ingest-service/index.ts`
- `src/02-supporting-services/02-data-ingest-service/types.ts`
- `src/02-supporting-services/03-state-service/types.ts`
- `src/config/minimal-system-config.ts`

**How this aligns with the original vision**

- Preserves the “data can feed the queue without manual re-entry” goal while keeping the assistant conservative when it is uncertain.

**How this mitigates Claude's feedback**

- Directly addresses his concern that passive ingest will create silent failures and privacy surprises unless the assistant can explain what it saw and how it handled it.

**Done when**

- Ambiguous external inputs no longer default to shared family visibility.
- Ingest decisions are auditable and safe by default.

## 08 — P2 Replace Generic CalDAV Hash Sync With Event-Level Ingest

**Do this**

- Stop treating “calendar data changed” as sufficient queue content.
- Build event-level diffing so the queue item knows:
- what changed
- which event changed
- who is affected
- whether the change is urgent, informative, or ignorable
- Normalize event changes into typed calendar updates instead of generic change notices.

**Why this matters**

- Generic change detection is too weak for high-trust proactive behavior.
- You cannot build reliable nudges, digests, or transparency on top of “something changed.”

**What this fixes / reconciles**

- Reconciles the local CalDAV strategy with the original vision of the assistant surfacing relevant information to the right people.
- Fixes one of the assessment’s clearest ingest shortcomings.

**Files to inspect**

- `src/02-supporting-services/02-data-ingest-service/index.ts`
- `src/01-service-stack/01-transport-layer/01.1-caldav/index.ts`
- `src/02-supporting-services/03-state-service/types.ts`
- `src/config/minimal-system-config.ts`

**How this aligns with the original vision**

- Keeps the local CalDAV model intact while making it useful enough for real automation.

**How this mitigates Claude's feedback**

- Prevents passive data ingestion from becoming vague, noisy, and difficult to trust.

**Done when**

- Calendar-triggered queue items describe concrete event changes and target the right people/threads.

## 09 — P2 Enforce Relationship Quiet-Window Semantics End-To-End

**Do this**

- Make the scheduler and worker honor the existing relationship helpers and state:
- `isRelationshipQuietWindow(...)`
- cooldown/backoff
- ignored-response behavior
- minimum gap between nudges
- stressful/busy period suppression
- Ensure relationship nudges are emitted only when both schedule and quiet-window rules permit them.

**Why this matters**

- Relationship nudges are the most likely to feel intrusive if the assistant gets them wrong.
- The repo already has partial logic here; it needs to be made authoritative.

**What this fixes / reconciles**

- Reconciles the rich relationship model in config/state/helpers with the simpler scheduler behavior actually running today.
- Protects the most delicate topic from becoming naggy or weird.

**Files to inspect**

- `src/02-supporting-services/01-scheduler-service/index.ts`
- `src/02-supporting-services/04-topic-profile-service/04.11-relationship/profile.ts`
- `src/02-supporting-services/04-topic-profile-service/04.11-relationship/types.ts`
- `src/01-service-stack/05-worker/index.ts`
- `src/config/minimal-system-config.ts`

**How this aligns with the original vision**

- Preserves the “different theme per topic” idea without letting the relationship topic sprawl into custom chaos.

**How this mitigates Claude's feedback**

- Directly addresses his concern that the themed “us” channel will become hidden complexity unless cadence and restraint are formalized.

**Done when**

- Relationship nudges respect quiet windows and ignore/backoff semantics in actual runtime behavior, not just helper code and state fields.

## 10 — P2 Add Explanation Surfaces For Participants And Operators

**Do this**

- Add participant-facing commands such as:
- `what did you see today`
- `why did you message me`
- `what are you holding for later`
- Back those replies with existing internal data:
- ingest provenance
- held queue items
- dispatch reason codes
- recent dispatches
- Keep operator/admin views metadata-first and consistent with admin UI constraints.

**Why this matters**

- Trust requires explainability.
- The repo already stores much of the needed metadata, but users cannot currently ask for it in a simple way.

**What this fixes / reconciles**

- Reconciles passive ingest and proactive nudging with human understanding.
- Makes wrong decisions debuggable instead of mysterious.

**Files to inspect**

- `src/01-service-stack/05-worker/index.ts`
- `src/02-supporting-services/02-data-ingest-service/index.ts`
- `src/02-supporting-services/03-state-service/types.ts`
- `src/admin/routes.ts`
- `src/02-supporting-services/06-budget-service/index.ts`

**How this aligns with the original vision**

- Keeps the primary interaction surface phone-native while still letting the family understand how the assistant is operating.

**How this mitigates Claude's feedback**

- Directly answers his transparency-layer concern.

**Done when**

- A participant can ask why the assistant acted, and the answer reflects real runtime state rather than hand-wavy messaging.

## 11 — P3 Expand Eval Around Trust-Breaking Cases

**Do this**

- Add eval scenarios for the cases most likely to break trust:
- wrong-thread confirmation replies
- simultaneous replies from two participants
- delayed replies after days
- image-only or attachment-only replies
- ambiguous `yes/ok` to multi-part questions
- stop/mute/cooldown carryover across topics
- direct webhook behavior vs Conversations-backed shared threads
- ambiguous ingest attribution
- private health events that must never create shared awareness
- quiet-hours and quiet-window suppression behavior
- Prefer worker-mode truth for these scenarios where possible so routing and confirmation behavior are exercised realistically.

**Why this matters**

- The current eval system is good infrastructure, but the current proof surface is still too happy-path to protect the family-critical edge cases.

**What this fixes / reconciles**

- Reconciles the repo’s eval ambition with the actual trust risks you care about.
- Makes Claude’s “test ugly failures, not just happy paths” point fully actionable.

**Files to inspect**

- `eval/scenarios/default.ts`
- `eval/scenarios/thread-dynamics.ts`
- `eval/scenarios/nudge-realism.ts`
- `eval/scenarios/digest-quality.ts`
- `eval/scenarios/generate-set.ts`
- `eval/runners/sequential-runner.ts`

**How this aligns with the original vision**

- Supports your original goal of infinite scenario generation that proves the model and exposes what still needs tuning.

**How this mitigates Claude's feedback**

- Turns his scenario-generation critique into a concrete eval backlog instead of a general warning.

**Done when**

- The trust-breaking behaviors above have explicit scenarios and fail loudly on regression.

## 12 — P3 Add Missing Automated Tests In The Fragile Services

**Do this**

- Add dedicated tests where the current repo is weakest:
- `06-budget-service`
- `08-confirmation-service`
- targeted transport parity tests for shared vs private thread behavior
- privacy regression tests around shared-awareness
- relationship scheduler tests around quiet-window suppression
- Use focused tests that validate policy behavior, not noisy implementation details.

**Why this matters**

- The assessment identified budget and confirmation as two of the highest-leverage services, yet they currently lack the strongest dedicated test coverage.

**What this fixes / reconciles**

- Reconciles the repo’s architectural sophistication with its current proof gaps.
- Prevents fragile policy logic from regressing silently during later feature work.

**Files to inspect**

- `src/02-supporting-services/06-budget-service/`
- `src/02-supporting-services/08-confirmation-service/`
- `src/01-service-stack/01-transport-layer/index.ts`
- `src/02-supporting-services/01-scheduler-service/index.test.ts`
- `src/01-service-stack/05-worker/index.test.ts`

**How this aligns with the original vision**

- Lets you keep the architecture elegant without having to trust memory or documentation when making changes.

**How this mitigates Claude's feedback**

- Gives the notification, confirmation, and edge-case logic the kind of proof he is implicitly asking for.

**Done when**

- Budget, confirmation, transport parity, privacy, and relationship gating have targeted automated tests with clear failure modes.

## 13 — P3 Preserve The Current Architecture As A Guardrail, Not A Rewrite Target

**Do this**

- Treat the following as non-negotiable guardrails while implementing the earlier items:
- one assistant messaging identity
- threads defined by participants, not topics
- topics as internal state/behavior domains, not chat rooms
- one queue, one worker, one outbound governor
- JSON-bootstrappable config and state
- Update docs after implementation so they describe what the runtime really does, not what it hopes to do.
- Avoid reintroducing room/channel mental models while fixing thread behavior.

**Why this matters**

- The repo’s core architecture is already good.
- The risk now is not under-building; it is solving the right problems in a way that accidentally recreates room-based complexity.

**What this fixes / reconciles**

- Reconciles your original simplification goal with the real concerns Claude raised.
- Keeps the system grounded in the dispatcher-plus-topic-state model rather than drifting back toward Slack/Rocket.Chat concepts.

**Files to inspect**

- `src/01-service-stack/CLAUDE.md`
- `src/01-service-stack/01-transport-layer/CLAUDE.md`
- `src/02-supporting-services/05-routing-service/CLAUDE.md`
- `src/02-supporting-services/03-state-service/CLAUDE.md`
- `README.md`

**How this aligns with the original vision**

- This is the original vision: one assistant contact, topic-aware behavior, no channel sprawl, config/state as the source of truth.

**How this mitigates Claude's feedback**

- Accepts his routing/policy concerns without conceding the architectural core that is already working.

**Done when**

- The code and docs both describe the same simplified architecture, and no new feature work reintroduces room/channel assumptions.

## Coverage Map From `ASSESSMENT.md`

This section exists so nothing from `ASSESSMENT.md` is lost or silently dropped.

- Health/privacy leak: `01`, `04`, `11`, `12`
- Two transport truths: `02`, `03`, `11`, `12`
- Confirmation brittleness: `03`, `06`, `11`, `12`
- JSON richer than executable policy: `04`, `05`
- Notification fatigue / need for stronger governor: `06`, `09`, `10`, `11`, `12`
- Ingest too trusting / ambiguous attribution: `07`, `08`, `10`, `11`
- Eval too thin for trust failures: `11`, `12`
- Relationship quiet-window semantics only partially real: `09`, `11`, `12`
- Preserve current architecture rather than rebuild rooms: `13`
- External/manual verification still pending: intentionally left in `TODO.md`, not duplicated here
