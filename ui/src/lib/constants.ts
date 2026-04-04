// Mirrors backend enums from src/types.ts and src/01-service-stack/02-identity-service/types.ts.
// Cannot import directly because erasableSyntaxOnly rejects backend enum declarations.
// The full permission list is served by GET /api/admin/system; the constants below are
// only the per-entity-type defaults used during onboarding auto-selection.

export const EntityType = {
  Adult: "adult",
  Child: "child",
  Pet: "pet",
} as const;

export type EntityType = (typeof EntityType)[keyof typeof EntityType];

export const ADULT_PERMISSIONS = [
  "approve_financial",
  "approve_sends",
  "modify_system",
  "assign_tasks",
  "view_all_topics",
] as const;

export const CHILD_PERMISSIONS = ["complete_tasks", "add_items", "ask_questions"] as const;

export const ThreadType = {
  Private: "private",
  Shared: "shared",
} as const;

export type ThreadType = (typeof ThreadType)[keyof typeof ThreadType];
