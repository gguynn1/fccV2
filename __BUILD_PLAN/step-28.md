# Step 28 — Confirmation Service

> Source: src/02-supporting-services/08-confirmation-service/notes.txt

## What to Build

- `src/02-supporting-services/08-confirmation-service/types.ts` — confirmation record types (pending, resolved, expired), gate types
- `src/02-supporting-services/08-confirmation-service/index.ts` — ConfirmationService implementation
- Three confirmation gate categories: sending on behalf, financial actions, system changes
- Confirmation flow: present in originating thread → wait for response → approve/reject/expire
- Reply matching for approvals (yes, positive reaction), rejections (no, negative reaction), and structured choices
- Expiry: unresolved confirmations expire after configured window, never auto-execute
- Recovery after downtime: scan pending confirmations for expired ones, mark expired, notify user, offer reissue
- Persist confirmation state in SQLite via State Service

## Dependencies

Step 0, Step 2, Step 3 (State Service), Step 5 (Scheduler for expiry timers).

## Technologies

SQLite via State Service, BullMQ delayed jobs for expiry timers (Redis AOF required)

## Files to Create/Modify

`types.ts` and `index.ts` in `08-confirmation-service/`

## Acceptance Criteria

All three gate types enforced, approval/rejection/expiry flows work, expired confirmations never auto-execute, downtime recovery handles passed expiry
