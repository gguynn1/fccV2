# Topic Profile Service

Holds the behavior definitions for every topic

Called by the Worker during message composition

Returns:
tone (direct, warm, factual, etc.)
format (list, snapshot, prompt, etc.)
initiative style
escalation level
framework grounding if applicable

Does not make routing decisions — only shapes how the message sounds

## Topics

The topics are: Calendar, Chores, Finances, Grocery, Health, Pets, School, Travel, Vendors, Photography, Relationship, Family Status.

## Behavior Profiles

- **Tone** — how the assistant sounds. Direct for chores. Calm and factual for finances. Warm and never clinical for relationship. Professional for photography. Attentive for health. Utilitarian for grocery.
- **Initiative style** — how the assistant initiates. Structured reminders with escalation for chores. Deadline-driven alerts for finances. Gentle nudges that disappear if ignored for relationship. Event-driven reminders and follow-ups for calendar and health. Pipeline-driven alerts for photography.
- **Escalation level** — high (chores, finances), medium (school, health, calendar), low (relationship, pets, family status), or none (grocery, vendors).
- **Framework grounding** — certain topics draw on established frameworks. Relationship draws on Internal Family Systems Therapy, emotionally focused therapy, and attachment-based connection practices. The assistant uses these to inform the quality of its nudges, not to act as a therapist.
- **Response format** — lists for grocery, snapshots with numbers for finances, open-ended prompts for relationship, structured confirmations for calendar, clear task statements for chores.
