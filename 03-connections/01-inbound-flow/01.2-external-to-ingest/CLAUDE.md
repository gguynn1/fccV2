# External Sources to Data Ingest

emails -----------> DATA INGEST
calendar changes -> DATA INGEST
future sources ---> DATA INGEST

Data Ingest watches external sources independently

When something relevant arrives:
extracts content
pre-classifies topic
creates a queue item
drops it into THE QUEUE
with source = "ingest"
