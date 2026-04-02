# Classifier Service

Determines what this is about
Reads the message content
Reads the thread context
Reads recent conversation history

Returns: topic (chores, health, calendar, etc.) and intent (request, response, completion, question, forwarded data)

Example: "this is a calendar request about a vet appointment involving PET"

## Topics

Topics are internal classifications, not threads. Each topic carries routing rules, a tone, a response format, an initiative style, and an escalation level. The assistant is one entity but shifts how it behaves depending on the topic.

The topics are: Calendar, Chores, Finances, Grocery, Health, Pets, School, Travel, Vendors, Business, Relationship, Family Status, Meals, Maintenance.
