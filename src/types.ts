export enum TopicKey {
  Calendar = "calendar",
  Chores = "chores",
  Finances = "finances",
  Grocery = "grocery",
  Health = "health",
  Pets = "pets",
  School = "school",
  Travel = "travel",
  Vendors = "vendors",
  Business = "business",
  Relationship = "relationship",
  FamilyStatus = "family_status",
  Meals = "meals",
  Maintenance = "maintenance",
}

export enum EscalationLevel {
  High = "high",
  Medium = "medium",
  Low = "low",
  None = "none",
}

export enum GrocerySection {
  Produce = "produce",
  Dairy = "dairy",
  Meat = "meat",
  Pantry = "pantry",
  Frozen = "frozen",
  Household = "household",
  Other = "other",
}

export enum ClassifierIntent {
  Request = "request",
  Update = "update",
  Cancellation = "cancellation",
  Query = "query",
  Response = "response",
  Completion = "completion",
  Confirmation = "confirmation",
  ForwardedData = "forwarded_data",
}

export enum EntityType {
  Adult = "adult",
  Child = "child",
  Pet = "pet",
}

export enum DispatchPriority {
  Immediate = "immediate",
  Batched = "batched",
  Silent = "silent",
}

export enum QueueItemType {
  Outbound = "outbound",
  Inbound = "inbound",
}

export enum QueueItemSource {
  HumanMessage = "human_message",
  Reaction = "reaction",
  ForwardedMessage = "forwarded_message",
  ImageAttachment = "image_attachment",
  EmailMonitor = "email_monitor",
  DataIngest = "data_ingest",
  InternalStateChange = "internal_state_change",
  ScheduledTrigger = "scheduled_trigger",
  CrossTopic = "cross_topic",
}

export enum ClarificationReason {
  AmbiguousIntent = "ambiguous_intent",
  AmbiguousReference = "ambiguous_reference",
  MissingRequiredField = "missing_required_field",
  MultipleMatches = "multiple_matches",
}

export enum InputMethod {
  Text = "text",
  Image = "image",
}
