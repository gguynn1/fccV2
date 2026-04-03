import { EscalationLevel, TopicKey } from "../../../types.js";
import type { TopicProfile } from "../types.js";

export interface MealThreadCandidate {
  id: string;
  participants: string[];
  is_shared: boolean;
}

export const MEALS_TOPIC_PROFILE: TopicProfile = {
  tone: "collaborative and practical",
  format: "meal options with grocery impact",
  initiative_style: "moderate, timing-aware meal planning suggestions",
  escalation_level: EscalationLevel.None,
  framework_grounding: null,
  response_format: "simple plans and linked ingredient suggestions",
  cross_topic_connections: [TopicKey.Grocery, TopicKey.Health],
};

export function routeMealsPlanningThread(threads: MealThreadCandidate[]): string | null {
  const shared = threads
    .filter((thread) => thread.is_shared)
    .sort((a, b) => b.participants.length - a.participants.length);
  return shared[0]?.id ?? null;
}

export function routeDietaryNoteThread(entity_id: string): string {
  return `${entity_id}_private`;
}

const MEAL_INGREDIENT_MAP: Record<string, string[]> = {
  taco: ["tortillas", "ground protein", "cheese", "salsa", "lettuce", "sour cream"],
  burrito: ["tortillas", "rice", "beans", "cheese", "salsa", "sour cream"],
  quesadilla: ["tortillas", "cheese", "protein"],
  fajita: ["tortillas", "peppers", "onion", "protein", "seasoning"],
  enchilada: ["tortillas", "enchilada sauce", "cheese", "protein"],
  nacho: ["tortilla chips", "cheese", "beans", "salsa", "jalapeños"],
  pasta: ["pasta", "sauce", "parmesan"],
  spaghetti: ["spaghetti", "marinara sauce", "ground beef", "parmesan"],
  lasagna: ["lasagna noodles", "ricotta", "mozzarella", "marinara sauce", "ground beef"],
  mac: ["macaroni", "cheese", "butter", "milk"],
  pizza: ["pizza dough", "mozzarella", "pizza sauce"],
  burger: ["ground beef", "burger buns", "lettuce", "tomato", "cheese"],
  hotdog: ["hot dogs", "buns", "mustard", "ketchup"],
  sandwich: ["bread", "deli meat", "cheese", "lettuce", "tomato"],
  wrap: ["tortillas", "protein", "lettuce", "cheese"],
  stir: ["rice", "soy sauce", "vegetables", "protein", "sesame oil"],
  fried_rice: ["rice", "soy sauce", "eggs", "vegetables", "sesame oil"],
  curry: ["curry paste", "coconut milk", "rice", "vegetables", "protein"],
  soup: ["broth", "vegetables", "protein", "seasoning"],
  chili: ["ground beef", "beans", "diced tomatoes", "chili seasoning", "onion"],
  stew: ["stew meat", "potatoes", "carrots", "onion", "broth"],
  salad: ["lettuce", "tomato", "cucumber", "dressing"],
  chicken: ["chicken", "seasoning"],
  steak: ["steak", "seasoning", "butter"],
  fish: ["fish fillets", "lemon", "seasoning"],
  salmon: ["salmon fillets", "lemon", "olive oil"],
  shrimp: ["shrimp", "garlic", "butter", "lemon"],
  pork: ["pork chops", "seasoning"],
  meatball: ["ground beef", "breadcrumbs", "eggs", "marinara sauce"],
  meatloaf: ["ground beef", "breadcrumbs", "eggs", "ketchup", "onion"],
  casserole: ["protein", "vegetables", "cheese", "cream of mushroom soup"],
  grilled: ["protein", "seasoning", "vegetables"],
  roast: ["roast", "potatoes", "carrots", "onion", "broth"],
  pancake: ["pancake mix", "syrup", "butter", "eggs"],
  waffle: ["waffle mix", "syrup", "butter"],
  french_toast: ["bread", "eggs", "milk", "cinnamon", "syrup"],
  omelet: ["eggs", "cheese", "vegetables", "butter"],
  breakfast: ["eggs", "bread", "butter", "juice"],
  rice_bowl: ["rice", "protein", "vegetables", "sauce"],
  bowl: ["rice", "protein", "vegetables", "sauce"],
  ramen: ["ramen noodles", "broth", "eggs", "green onions"],
  pho: ["rice noodles", "broth", "protein", "bean sprouts", "herbs"],
};

export function extractGroceryItemsFromMealDescription(description: string): string[] {
  const normalized = description.toLowerCase();
  const matched = new Set<string>();

  for (const [keyword, items] of Object.entries(MEAL_INGREDIENT_MAP)) {
    if (normalized.includes(keyword)) {
      for (const item of items) {
        matched.add(item);
      }
    }
  }

  return [...matched];
}
