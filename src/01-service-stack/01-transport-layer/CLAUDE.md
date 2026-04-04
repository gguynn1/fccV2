# Transport Layer

Receives and sends phone-native messages
One shared messaging identity, all threads

Accepts: messages, reactions when supported, images, forwarded content

Sends: outbound messages to threads

Inbound messages flow down
Outbound messages flow up

MMS media URLs are downloaded to a local media store and normalized before classification.

Reaction handling is conservative — not all clients encode reactions the same way. When mapping is uncertain, the system falls back to requesting a text clarification rather than assuming intent.

## Canonical transport model (Twilio)

The layer combines **Twilio Programmable Messaging** and **Twilio Conversations**, but they do not carry equal meaning:

| Path                       | Role                                                                                                                                                                                                            |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Programmable Messaging** | Canonical path for private threads: inbound webhook and outbound SMS/MMS to each participant’s messaging identity.                                                                                              |
| **Conversations API**      | Canonical path for shared threads when `TWILIO_CONVERSATIONS_ENABLED=true`: real group MMS–style threads via Conversations, with the assistant represented by a projected address on the same shared long code. |

**When `TWILIO_CONVERSATIONS_ENABLED=true`**

- Shared threads are backed by a Twilio Conversation. The assistant joins with `messagingBinding.projectedAddress` set to the shared messaging identity; human participants bind by address.
- Inbound shared traffic uses the Conversations webhook.
- Outbound shared traffic sends through `conversations.messages.create`.
- A missing `ConversationSid -> thread.id` mapping is treated as a configuration/runtime error. The transport layer does **not** degrade a shared-thread message into a private thread.

**When Conversations is disabled**

- Only private-thread messaging is available.
- Canonical shared-thread dispatch is unavailable until Conversations is enabled and initialized.

**Webhooks**

- **`POST /webhook/twilio`** — Programmable Messaging: private thread messages (and the usual delivery status callback on `/webhook/twilio/status`).
- **`POST /webhook/twilio/conversations`** — Conversations: handles `onMessageAdded` for shared threads (assistant-authored messages are ignored; unknown senders are dropped like the participant gate; unmapped shared conversations are rejected instead of rerouted privately).

**Operational constraints (carrier / Twilio)**

- Group MMS via Conversations is intended for **+1 US/Canada long codes**. Participant count limits apply (typically **max 10** in a group); very large shared groups may not map cleanly to a single group MMS conversation.

## Threads

Threads are defined by participants, not topics. A private thread is one entity plus the assistant. A shared thread is multiple entities plus the assistant. The system never creates threads per topic — it routes topics into the correct participant-based thread.

Thread count and membership are defined in the system configuration. Two categories:

**Private threads** — one per entity that has a messaging identity. Used for personal topics, daily digests, drafts under review, and anything that concerns only that entity.

**Shared threads** — declared subsets of entities based on relationship topology. Used for topics that concern all members of the group — shared coordination, finances, household logistics, or any topic where multiple people need the same information.

All interaction happens inside these threads. The assistant figures out what topic is being discussed and applies the right behavior internally. Every message the assistant sends goes to exactly one thread based on who needs the information.

## Input Recognition

What the person sends and what it means.

```
TEXT
  "Done" — mark the task complete
  "Yes" — approve the pending action
  "Move it to Thursday" — reschedule
  "Add eggs" — add to grocery list
  Interpreted in context of the thread
  and the most recent topic discussed

STRUCTURED CHOICE
  The assistant offers numbered options
  or yes/no questions
  "1" or "b" or "yes" maps directly
  to the offered choice
  One word or number is all it takes

REACTION
  A positive reaction on a confirmation — approved
  A positive reaction on a task reminder — done
  A negative reaction — rejected or declined
  Preferred when the messaging client supports reactions

IMAGE OR ATTACHMENT
  Photo of a receipt — "log this expense?"
  Image of a school notice — "track this?"
  If intent is unclear, one clarifying question
  Never assumes — always confirms

FORWARDED CONTENT
  A forwarded message from a doctor's office
  or school or vendor
  The assistant parses it, extracts details,
  classifies the topic, and asks what to do
  "Looks like an appointment confirmation
   for April 15. Add to calendar?"

SILENCE
  No response is a signal
  For high-accountability topics,
    silence feeds the escalation ladder
  For low-accountability topics,
    silence means "not now" — respected
  Silence is never treated as approval
```
