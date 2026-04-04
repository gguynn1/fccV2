# Relationship

Connection prompts, quality-time ideas, appreciation nudges, conversation starters.

Routes to the adults-only shared thread only.

This is where the assistant's behavior is most different from every other topic. The assistant draws on relationship frameworks — the kind of gentle, evidence-based practices you'd find in Internal Family Systems Therapy research or emotionally focused approaches. Small bids for connection. Appreciation prompts. Open-ended questions that invite conversation between the partners, not with the assistant.

The tone is warm, brief, and never clinical. "It's been a busy week — one thing you appreciated about each other this week?"

Initiative is the softest of any topic: occasional nudges during genuinely quiet windows, never during busy or stressful periods, and always easy to ignore with zero follow-up. If a nudge is ignored, it simply disappears. No escalation, no reminders, no guilt. The assistant might try again in a few days with something different, but it never pushes. This topic exists to serve the relationship, not to create another obligation.

## Nudge scheduling and state (implementation)

- **`next_nudge_eligible`** — After each **`dispatch_nudge`** application, this timestamp is advanced from “now” using an effective cooldown in days (see below). The scheduler only emits proactive relationship items when `next_nudge_eligible` is in the past.

- **Backoff after ignores** — Consecutive **ignored** nudges (no response recorded) increase the cooldown with a **1.5× multiplier per consecutive ignore**, capped at **30 days**. A **response** resets toward the **base** cooldown from configuration (`cooldown_days`).

- **Rotation** — `selectNextRelationshipNudgeType` walks a fixed `NudgeType` rotation so successive nudges vary (appreciation, conversation starter, connection prompt, etc.).

- **Scheduled nudges vs queries** — Policy-driven scheduled relationship items use **`ClassifierIntent.Nudge`**, not **`ClassifierIntent.Query`**, so they resolve to the **`dispatch_nudge`** typed action instead of collapsing into **`query_nudge_history`**.

- **`dispatch_nudge`** — Applies the rotation, appends to `nudge_history`, updates **`next_nudge_eligible`** with the backoff-aware cooldown, and composes outbound copy from **real prompt variants** per nudge type (short, concrete strings in the worker — not open-ended model improvisation for the default path).

Anthropic Claude API personalizes prompts, but always grounded in the local prompt library and tone rules — it does not freeform-generate relationship advice.
