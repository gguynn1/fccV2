# Classifier Service

Determines what this is about and what the sender wants to happen.
Reads the message content, thread context, and recent conversation history.

Returns a typed `ClassificationResult`: topic, intent, and entities involved.

Example: "this is a calendar update about a vet appointment involving PET" → `{ topic: Calendar, intent: Update, entities: ["pet"] }`

## Topics

Topics are internal classifications, not threads. Each topic carries routing rules, a tone, a response format, an initiative style, and an escalation level. The assistant is one entity but shifts how it behaves depending on the topic.

The topics are: Calendar, Chores, Finances, Grocery, Health, Pets, School, Travel, Vendors, Business, Relationship, Family Status, Meals, Maintenance.

## Intents

Intent is a typed enum (`ClassifierIntent`) that tells the Worker what the sender wants to happen:

- **Request** — asking the system to do something new (add an event, assign a chore, plan a meal)
- **Update** — modifying something that already exists (reschedule, change quantity, adjust budget)
- **Cancellation** — removing or cancelling something (cancel appointment, remove grocery item, archive lead)
- **Query** — asking for information without changing anything (what's on the calendar, what's due, pipeline status)
- **Response** — replying to a system message (answering a follow-up, responding to a reminder)
- **Completion** — marking something done (chore completed, bill paid, visit finished)
- **Confirmation** — approving or rejecting a pending action (approve draft send, confirm payment)
- **ForwardedData** — forwarding content for the system to parse and process (email, image, booking confirmation)

Intent is determined alongside topic. The same message in different contexts can have different intents — "move it to Thursday" is an Update, "add one for Thursday" is a Request. Thread history and recent conversation inform the classification.
