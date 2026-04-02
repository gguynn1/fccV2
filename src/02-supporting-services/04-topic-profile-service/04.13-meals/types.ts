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

export interface MealPlan {
  id: string;
  date: Date;
  meal_type: MealType;
  description: string;
  planned_by: string;
  status: MealPlanStatus;
  grocery_items_linked?: string[];
}

export interface DietaryNote {
  entity: string;
  note: string;
  added_at: Date;
}

export interface MealsState {
  planned: MealPlan[];
  dietary_notes: DietaryNote[];
}
