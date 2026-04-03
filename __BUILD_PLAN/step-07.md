# Step 7 — Transport Layer

> Source: src/01-service-stack/01-transport-layer/notes.txt

## What to Build

Build the Twilio-powered messaging adapter for inbound and outbound phone-native messages.

- `src/01-service-stack/01-transport-layer/types.ts` — transport input types (text, reaction, image, forwarded content, silence), outbound message types, delivery status types
- `src/01-service-stack/01-transport-layer/index.ts` — TransportLayer implementation
- Fastify webhook route at `/webhook/twilio` for inbound messages
- Twilio request signature validation on the webhook endpoint
- Inbound normalization: phone-native messages, structured choices, reactions, images/attachments (media download), forwarded content
- Outbound delivery via Twilio REST API with status callbacks
- Thread-to-participants mapping for the five allowed threads
- Retry with exponential backoff on network failure (via BullMQ)

## Dependencies

Step 0, Step 1, Step 6 (Identity Service).

## Technologies

- Twilio Programmable Messaging API
- Fastify for webhook handling
- ngrok tunnel from public URL to localhost:3000
- BullMQ retry for failed outbound sends

## Files to Create/Modify

- `src/01-service-stack/01-transport-layer/types.ts`
- `src/01-service-stack/01-transport-layer/index.ts`

## Acceptance Criteria

- Webhook endpoint validates Twilio signatures
- Inbound messages are normalized into typed transport inputs
- Outbound messages are delivered via Twilio REST API
- Media URLs are downloaded and normalized
- Reactions are handled with fallback to conversational parsing
- Network failures retry with backoff
- `npm run typecheck` passes

## Setup Gate — Twilio Webhook

Before proceeding past this step, the following must be verified:

- [ ] Twilio webhook URL configured to `https://<NGROK_DOMAIN>/webhook/twilio`
- [ ] Send a test inbound message to the messaging identity — webhook receives it, signature validates, transport normalizes the input
- [ ] Send a test outbound message via the Twilio REST API — delivery status callback received
- [ ] Confirm ngrok tunnel is forwarding to localhost:3000 and the Fastify route responds
