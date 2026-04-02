# Transport Layer

Receives and sends phone-native messages
One shared messaging identity, all threads

Accepts: messages, reactions when supported, images, forwarded content

Sends: outbound messages to threads

Inbound messages flow down
Outbound messages flow up

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
