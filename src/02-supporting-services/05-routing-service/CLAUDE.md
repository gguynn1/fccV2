# Routing Service

Applies the two routing rules

Called by the Worker

Inputs: topic, entities involved, is this a response or proactive?

Rule 1: response — same thread
Rule 2: proactive — narrowest thread

Returns: target thread ID

## Routing Rules

**Rule 1 — Responses stay in context, unless the topic policy makes that unsafe.** If someone says something in a thread, the assistant replies in that same thread whenever the topic allows it. If the origin thread violates topic privacy policy, routing falls back to the safest allowed thread instead of leaking the topic.

**Rule 2 — Proactive messages route to the narrowest appropriate thread allowed by topic policy.** When the assistant initiates, it sends to the smallest thread that includes only the entities who need the information and is still permitted by the topic's delivery policy. A chore reminder for an assigned entity goes to their private thread. A financial alert stays in the adults-only shared thread. A health follow-up stays private.

When both rules apply to the same event — someone says something in a group thread that will later need a proactive follow-up — Rule 1 handles the immediate reply and Rule 2 handles any future outbound.

## Context Transition

The routing service tracks active topic context per thread and detects when the conversation has shifted. A topic reset happens when the thread has been idle for 90 minutes, or when the new message's classified topic differs from the thread's active context, or when an explicit switch signal is detected. This prevents stale context from influencing routing or composition.

## Thread Map

Thread membership is defined in the system configuration. Each thread has an explicit participant list and type (private or shared). The routing service reads the thread definitions, applies the two routing rules, and then respects executable topic delivery policy such as private-only topics, restricted shared scopes, and shared-awareness rules.

This service resolves `response` and `proactive` targets. The wider topic-delivery policy layer also governs `awareness`, `confirmation`, and `digest` delivery kinds that the worker and other services enforce around routing.
