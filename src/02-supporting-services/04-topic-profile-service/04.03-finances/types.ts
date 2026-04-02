import type { InputMethod } from "../../../types.js";

export enum BillStatus {
  Upcoming = "upcoming",
}

export enum RecurringInterval {
  Monthly = "monthly",
}

export enum PaceStatus {
  OnTrack = "on_track",
  Steady = "steady",
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
