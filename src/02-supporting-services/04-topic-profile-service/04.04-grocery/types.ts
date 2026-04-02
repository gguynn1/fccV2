export enum GrocerySection {
  Produce = "produce",
  Dairy = "dairy",
  Meat = "meat",
  Pantry = "pantry",
  Frozen = "frozen",
  Household = "household",
  Other = "other",
}

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
