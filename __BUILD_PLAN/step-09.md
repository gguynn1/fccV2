# Step 9 — Classifier Service

> Source: src/01-service-stack/03-classifier-service/notes.txt

## What to Build

Build the LLM-powered topic and intent classification service.

- `src/01-service-stack/03-classifier-service/types.ts` — ClassificationResult type with topic (TopicKey), intent (ClassifierIntent — 8 values: Request, Update, Cancellation, Query, Response, Completion, Confirmation, ForwardedData), entities, confidence
- `src/01-service-stack/03-classifier-service/index.ts` — ClassifierService implementation
- Claude API integration for topic classification
- Reads message content plus recent thread context for disambiguation
- Structured output validation with Zod
- **Topic disambiguation** handling for: meals vs grocery, maintenance vs vendors, maintenance vs chores, business vs vendors
- **Intent disambiguation** handling for: cancellation vs completion (future vs past event), request vs update (new vs existing item), cancellation vs update (remove entirely vs change details), query vs request (asking about state vs asking to create)
- Context-aware classification: same message may classify differently based on thread history

## Dependencies

Step 0, Step 1, Step 3 (State Service for thread history).

## Technologies

- Anthropic Claude API (@anthropic-ai/sdk)
- Zod for structured output validation
- System prompts with few-shot examples for classification

## Files to Create/Modify

- `src/01-service-stack/03-classifier-service/types.ts`
- `src/01-service-stack/03-classifier-service/index.ts`
- `src/01-service-stack/03-classifier-service/prompts.ts` (classification system prompt)

### Bootstrap Note

During early development, thread history is empty because no items have been processed yet. Use seed data from Step 0 Part 2 to populate initial thread history for testing. Classification tests that depend on thread context require the seeded state to be loaded first.

### Context Window Limit

Define a maximum number of recent messages included in the classification prompt (e.g., last 10–20 messages per thread). Without a cap, thread history grows unboundedly, increasing Claude API latency and cost per classification call. Document the chosen limit in the Classifier's configuration.

## Acceptance Criteria

- Classifies messages into one of 14 TopicKey values
- Returns ClassifierIntent alongside topic as a typed ClassificationResult
- Uses thread context for ambiguous messages
- Disambiguation rules produce correct results for edge cases
- Structured outputs are Zod-validated
- `npm run typecheck` passes
