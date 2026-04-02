# Data Ingest Service

Watches external sources independently:
email inboxes
calendar sync
future: bank, school, vet, weather

When something relevant arrives:
extracts content
pre-classifies topic
creates a queue item
drops it into THE QUEUE
with source = "ingest"
