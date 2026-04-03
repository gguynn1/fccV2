import type { GrocerySection } from "../../../types.js";

export interface GroceryItem {
  id: string;
  item: string;
  section: GrocerySection;
  added_by: string;
  added_at: Date;
}

export interface PurchasedItem {
  item: string;
  purchased_by: string;
  purchased_at: Date;
}

export interface GroceryState {
  list: GroceryItem[];
  recently_purchased: PurchasedItem[];
}

export type GroceryAction =
  | { type: "add_items"; items: Array<{ item: string; section?: GrocerySection }> }
  | { type: "remove_items"; item_ids: string[] }
  | { type: "mark_purchased"; item_ids: string[]; purchased_by: string }
  | { type: "query_list"; section?: GrocerySection };
