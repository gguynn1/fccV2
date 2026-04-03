import type { InputMethod } from "../../../types.js";

export enum BillStatus {
  Upcoming = "upcoming",
  Paid = "paid",
  Overdue = "overdue",
  Cancelled = "cancelled",
}

export enum RecurringInterval {
  Weekly = "weekly",
  Biweekly = "biweekly",
  Monthly = "monthly",
  Quarterly = "quarterly",
  Annual = "annual",
  OneTime = "one_time",
}

export enum PaceStatus {
  Ahead = "ahead",
  OnTrack = "on_track",
  Steady = "steady",
  Behind = "behind",
  AtRisk = "at_risk",
}

export interface Bill {
  id: string;
  name: string;
  amount: number;
  due_date: Date;
  status: BillStatus;
  reminder_sent: boolean;
  reminder_sent_at?: Date;
  recurring: RecurringInterval;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  date: Date;
  logged_by: string;
  logged_via: InputMethod;
  confirmed: boolean;
}

export interface SavingsContribution {
  amount: number;
  date: Date;
  logged_by: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  target: number;
  current: number;
  percent: number;
  deadline: Date | null;
  last_contribution?: SavingsContribution;
  pace_status: PaceStatus;
}

export interface FinancesState {
  bills: Bill[];
  expenses_recent: Expense[];
  savings_goals: SavingsGoal[];
}

export type FinanceAction =
  | { type: "log_expense"; description: string; amount: number; logged_by: string }
  | { type: "pay_bill"; bill_id: string }
  | { type: "adjust_savings"; goal_id: string; amount: number }
  | { type: "query_finances"; category?: "bills" | "expenses" | "savings" };
