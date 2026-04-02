# Transport to Identity to Classifier

TRANSPORT -----> IDENTITY -----> CLASSIFIER

Transport receives inbound message
Identity resolves who sent this, maps sender identifier to entity
Classifier determines what this is about, reads message content and thread context

## Identity Resolution

Maps a sender identifier to an entity. Most often this is a phone number, but the interface does not depend on that. Knows: type (adult/child/pet), permissions, thread memberships. Returns: entity ID, entity type, which thread this came from.

## Classification

Returns: topic (Calendar, Chores, Finances, Grocery, Health, Pets, School, Travel, Vendors, Business, Relationship, Family Status, Meals, Maintenance) and intent (request, response, completion, question, forwarded data).
