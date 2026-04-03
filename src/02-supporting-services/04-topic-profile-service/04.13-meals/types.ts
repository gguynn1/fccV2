export enum MealType {
  Breakfast = "breakfast",
  Lunch = "lunch",
  Dinner = "dinner",
  Snack = "snack",
}

export enum MealPlanStatus {
  Planned = "planned",
  Prepared = "prepared",
  Skipped = "skipped",
}

export interface RecipeReference {
  title: string;
  source: "conversation" | "email_parsing" | "assistant_suggestion";
  notes?: string;
}

export interface MealPlan {
  id: string;
  date: Date;
  meal_type: MealType;
  description: string;
  planned_by: string;
  status: MealPlanStatus;
  recipe_reference?: RecipeReference | null;
  grocery_items_linked?: string[];
}

export interface DietaryNote {
  entity: string;
  note: string;
  scope?: "private" | "shared";
  added_at: Date;
}

export interface MealsState {
  planned: MealPlan[];
  dietary_notes: DietaryNote[];
}

export type MealAction =
  | { type: "plan_meal"; date: Date; meal_type: MealType; description: string; planned_by: string }
  | {
      type: "update_meal";
      meal_plan_id: string;
      changes: Partial<Pick<MealPlan, "description" | "meal_type" | "date" | "recipe_reference">>;
    }
  | { type: "link_grocery_items"; meal_plan_id: string; grocery_items: string[] }
  | { type: "skip_meal"; meal_plan_id: string }
  | { type: "add_dietary_note"; entity: string; note: string }
  | { type: "query_plans"; date_range?: { start: Date; end: Date } };
