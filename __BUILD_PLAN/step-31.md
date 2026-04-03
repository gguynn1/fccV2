# Step 31 — Worker → Topic Profile Integration

> Source: src/01-service-stack/05-worker/05.1-calls-topic-profile/notes.txt

## What to Build

- Wire the Worker's step 7 (apply topic behavior profile) to the Topic Profile Service
- Worker requests: tone, format, initiative style, escalation level, framework grounding for the classified topic
- Claude API composition consumes the returned profile fields rather than inventing tone from scratch
- Composition output shaped by all 14 topic profiles producing distinct voices

## Dependencies

Step 10 (Topic Profile Service), Step 30 (Worker).

## Technologies

Claude API for composition, TopicKey-driven profile lookup

## Files to Create/Modify

Integration code within `src/01-service-stack/05-worker/` (step 7 wiring)

## Acceptance Criteria

Each of the 14 topics produces a distinct tone/format/initiative, Claude composition uses profile fields, Vitest fixtures compare profile-shaped outputs
