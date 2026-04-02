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

The topics are: Calendar, Chores, Finances, Grocery, Health, Pets, School, Travel, Vendors, Business, Relationship, Family Status, Meals, Maintenance.

## Behavior Profiles

- **Tone** — how the assistant sounds. Direct for chores. Calm and factual for finances. Warm and never clinical for relationship. Professional for business. Attentive for health. Utilitarian for grocery. Collaborative for meals. Practical for maintenance.
- **Initiative style** — how the assistant initiates. Structured reminders with escalation for chores. Deadline-driven alerts for finances. Gentle nudges that disappear if ignored for relationship. Event-driven reminders and follow-ups for calendar and health. Pipeline-driven alerts for business. Timing-aware suggestions for meals. Cycle-driven reminders for maintenance.
- **Escalation level** — high (chores, finances), medium (school, health, calendar), low (relationship, pets, family status, maintenance), or none (grocery, vendors, business, meals).
- **Framework grounding** — certain topics draw on established frameworks. Relationship draws on Internal Family Systems Therapy, emotionally focused therapy, and attachment-based connection practices. The assistant uses these to inform the quality of its nudges, not to act as a therapist.
- **Response format** — lists for grocery, snapshots with numbers for finances, open-ended prompts for relationship, structured confirmations for calendar, clear task statements for chores, meal plans with grocery links for meals, schedules and history logs for maintenance.
