# Routing Service

Applies the two routing rules

Called by the Worker

Inputs: topic, entities involved, is this a response or proactive?

Rule 1: response — same thread
Rule 2: proactive — narrowest thread

Returns: target thread ID

## Routing Rules

**Rule 1 — Responses stay in context.** If someone says something in a thread, the assistant replies in that same thread. Everyone present sees it.

**Rule 2 — Proactive messages route to the narrowest appropriate thread.** When the assistant initiates, it sends to the smallest thread that includes only the entities who need the information. A chore reminder for an assigned entity goes to their private thread. A financial alert goes to the adults-only shared thread. A health follow-up goes to the individual's private thread.

When both rules apply to the same event — someone says something in a group thread that will later need a proactive follow-up — Rule 1 handles the immediate reply and Rule 2 handles any future outbound.

## Context Transition

The routing service tracks active topic context per thread and detects when the conversation has shifted. A topic reset happens when the thread has been idle for 90 minutes, or when the new message's classified topic differs from the thread's active context, or when an explicit switch signal is detected. This prevents stale context from influencing routing or composition.

## Thread Map

Thread membership is defined in the system configuration. Each thread has an explicit participant list and type (private or shared). The routing service reads the thread definitions and applies the two routing rules to determine the target thread.
