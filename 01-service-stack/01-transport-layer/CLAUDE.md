# Transport Layer

Receives and sends phone-native messages
One shared messaging identity, all threads

Accepts: messages, reactions when supported, images, forwarded content

Sends: outbound messages to threads

Inbound messages flow down
Outbound messages flow up

## Threads

Threads are defined by participants, not topics. A private thread is one person plus the assistant. A shared thread is multiple people plus the assistant. The system never creates threads per topic — it routes topics into the correct participant-based thread.

There are five threads total:

- PARTICIPANT 1 + Assistant (private)
- PARTICIPANT 2 + Assistant (private)
- PARTICIPANT 3 + Assistant (private)
- PARTICIPANT 2 + PARTICIPANT 1 + Assistant (couple)
- PARTICIPANT 2 + PARTICIPANT 1 + PARTICIPANT 3 + Assistant (family)

All interaction happens inside these threads. The assistant figures out what topic is being discussed and applies the right behavior internally.

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
