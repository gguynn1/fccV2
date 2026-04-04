# Supporting Services

These feed into the queue or are called by the worker but don't sit in the main flow.

Services:
Scheduler Service
Data Ingest Service
State Service
Topic Profile Service
Routing Service
Budget Service
Escalation Service
Confirmation Service

Adding a new data source never requires rethinking the dispatch logic. It just feeds the queue.

Cross-cutting delivery safety is shared through `src/config/topic-delivery-policy.ts`. Supporting services still do not import each other at runtime; the worker remains the orchestrator, but routing, budget, confirmation, transport, and ingest all rely on the same delivery-policy truth.
