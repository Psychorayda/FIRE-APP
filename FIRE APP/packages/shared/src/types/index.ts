// src/types/index.ts

// ============= 枚举类型 =============

export type AssetClass = 'liquid' | 'invested' | 'use_asset' | 'liability';

export type AccountType =
  | 'checking' | 'savings' | 'cash'
  | 'investment' | 'retirement' | 'fund'
  | 'real_estate' | 'vehicle'
  | 'credit_card' | 'loan' | 'mortgage';

export type TransactionType = 'income' | 'expense' | 'transfer' | 'initial_balance';

export type CategoryType = 'income' | 'expense';

export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

// ============= 实体接口 =============

export interface User {
  id: string;
  display_name: string;
  base_currency: string;
  is_china_market: number;
  default_withdrawal_rate: number;
  default_expected_return: number;
  default_inflation_rate: number;
  encryption_key_hash: string | null;
  last_sync_at: number | null;
  sync_version: number;
  updated_at: number;
  deleted_flag: number;
}

export interface Account {
  id: string;
  user_id: string;
  name: string;
  asset_class: AssetClass;
  account_type: AccountType;
  current_balance: number;
  last_updated: number;
  display_order: number;
  note: string | null;
  sync_version: number;
  updated_at: number;
  deleted_flag: number;
}

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  recurring_id: string | null;
  transaction_type: TransactionType;
  amount: number;
  transaction_date: number;
  description: string | null;
  sync_version: number;
  updated_at: number;
  deleted_flag: number;
}

export interface Category {
  id: string;
  user_id: string;
  parent_id: string | null;
  name: string;
  type: CategoryType;
  icon: string | null;
  color: string | null;
  linked_fire_concept: string | null;
  display_order: number;
  is_system: number;
  sync_version: number;
  updated_at: number;
  deleted_flag: number;
}

export interface RecurringTransaction {
  id: string;
  user_id: string;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  transaction_type: TransactionType;
  amount: number;
  frequency: Frequency;
  interval: number;
  start_date: number;
  end_date: number | null;
  next_due_date: number;
  last_generated_date: number | null;
  description: string | null;
  is_active: number;
  auto_create: number;
  sync_version: number;
  updated_at: number;
  deleted_flag: number;
}

export interface NetWorthSnapshot {
  id: string;
  user_id: string;
  snapshot_date: number;
  snapshot_year_month: string;
  total_liquid: number;
  total_invested: number;
  total_use_asset: number;
  total_liability: number;
  net_worth: number;
  sync_version: number;
  updated_at: number;
  deleted_flag: number;
}

export interface FireScenario {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  current_age: number;
  retirement_age: number;
  current_portfolio_value: number;
  auto_sync_assets: number;
  monthly_savings: number;
  annual_expenses: number;
  expected_return_rate: number;
  inflation_rate: number;
  withdrawal_rate: number;
  retirement_years: number;
  post_retirement_monthly_income: number;
  is_china_market: number;
  is_active: number;
  sync_version: number;
  updated_at: number;
  deleted_flag: number;
}
