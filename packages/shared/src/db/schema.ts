// src/db/schema.ts
import type { Database as DatabaseType } from 'better-sqlite3';

export const TABLE_NAMES = [
  'users',
  'accounts',
  'categories',
  'transactions',
  'recurring_transactions',
  'net_worth_snapshots',
  'fire_scenarios',
] as const;

const DDL_STATEMENTS: string[] = [
  // 1. users 表
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY NOT NULL,
    display_name TEXT NOT NULL,
    base_currency TEXT NOT NULL DEFAULT 'CNY',
    is_china_market INTEGER NOT NULL DEFAULT 1,
    default_withdrawal_rate INTEGER NOT NULL DEFAULT 350,
    default_expected_return INTEGER NOT NULL DEFAULT 700,
    default_inflation_rate INTEGER NOT NULL DEFAULT 300,
    encryption_key_hash TEXT,
    last_sync_at INTEGER,
    sync_version INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    deleted_flag INTEGER NOT NULL DEFAULT 0
  )`,

  // 2. accounts 表
  `CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    asset_class TEXT NOT NULL CHECK (asset_class IN ('liquid', 'invested', 'use_asset', 'liability')),
    account_type TEXT NOT NULL CHECK (account_type IN (
      'checking', 'savings', 'cash',
      'investment', 'retirement', 'fund',
      'real_estate', 'vehicle',
      'credit_card', 'loan', 'mortgage'
    )),
    current_balance INTEGER NOT NULL DEFAULT 0,
    last_updated INTEGER NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    note TEXT,
    sync_version INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    deleted_flag INTEGER NOT NULL DEFAULT 0
  )`,

  // 3. categories 表
  `CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id),
    parent_id TEXT REFERENCES categories(id),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    icon TEXT,
    color TEXT,
    linked_fire_concept TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_system INTEGER NOT NULL DEFAULT 0,
    sync_version INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    deleted_flag INTEGER NOT NULL DEFAULT 0
  )`,

  // 4. transactions 表
  // 注意: transactions 表引用 recurring_transactions(id)，但 recurring_transactions 在后面创建
  // SQLite 允许前向引用（外键在启用时才检查），所以创建顺序不影响
  `CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id),
    account_id TEXT NOT NULL REFERENCES accounts(id),
    to_account_id TEXT REFERENCES accounts(id),
    category_id TEXT REFERENCES categories(id),
    recurring_id TEXT REFERENCES recurring_transactions(id),
    transaction_type TEXT NOT NULL CHECK (transaction_type IN (
      'income', 'expense', 'transfer', 'initial_balance'
    )),
    amount INTEGER NOT NULL CHECK (amount > 0),
    transaction_date INTEGER NOT NULL,
    description TEXT,
    sync_version INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    deleted_flag INTEGER NOT NULL DEFAULT 0
  )`,

  // 5. recurring_transactions 表
  `CREATE TABLE IF NOT EXISTS recurring_transactions (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id),
    account_id TEXT NOT NULL REFERENCES accounts(id),
    to_account_id TEXT REFERENCES accounts(id),
    category_id TEXT REFERENCES categories(id),
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('income', 'expense', 'transfer')),
    amount INTEGER NOT NULL CHECK (amount > 0),
    frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
    interval INTEGER NOT NULL DEFAULT 1,
    start_date INTEGER NOT NULL,
    end_date INTEGER,
    next_due_date INTEGER NOT NULL CHECK (next_due_date >= start_date),
    last_generated_date INTEGER,
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    auto_create INTEGER NOT NULL DEFAULT 1,
    sync_version INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    deleted_flag INTEGER NOT NULL DEFAULT 0
  )`,

  // 6. net_worth_snapshots 表
  `CREATE TABLE IF NOT EXISTS net_worth_snapshots (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id),
    snapshot_date INTEGER NOT NULL,
    snapshot_year_month TEXT NOT NULL,
    total_liquid INTEGER NOT NULL,
    total_invested INTEGER NOT NULL,
    total_use_asset INTEGER NOT NULL,
    total_liability INTEGER NOT NULL,
    net_worth INTEGER NOT NULL,
    sync_version INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    deleted_flag INTEGER NOT NULL DEFAULT 0,
    UNIQUE(user_id, snapshot_year_month)
  )`,

  // 7. fire_scenarios 表
  `CREATE TABLE IF NOT EXISTS fire_scenarios (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    description TEXT,
    current_age INTEGER NOT NULL,
    retirement_age INTEGER NOT NULL CHECK (retirement_age > current_age),
    current_portfolio_value INTEGER NOT NULL DEFAULT 0,
    auto_sync_assets INTEGER NOT NULL DEFAULT 1,
    monthly_savings INTEGER NOT NULL DEFAULT 0,
    annual_expenses INTEGER NOT NULL,
    expected_return_rate INTEGER NOT NULL,
    inflation_rate INTEGER NOT NULL DEFAULT 300,
    withdrawal_rate INTEGER NOT NULL CHECK (withdrawal_rate BETWEEN 200 AND 600),
    retirement_years INTEGER NOT NULL DEFAULT 30,
    post_retirement_monthly_income INTEGER NOT NULL DEFAULT 0,
    is_china_market INTEGER NOT NULL DEFAULT 1,
    is_active INTEGER NOT NULL DEFAULT 1,
    sync_version INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    deleted_flag INTEGER NOT NULL DEFAULT 0
  )`,

  // 索引
  `CREATE INDEX IF NOT EXISTS idx_tx_user_date ON transactions(user_id, transaction_date DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_tx_account ON transactions(account_id, transaction_date DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(category_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tx_recurring ON transactions(recurring_id)`,
  `CREATE INDEX IF NOT EXISTS idx_acc_user ON accounts(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_cat_user ON categories(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_recur_user ON recurring_transactions(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_snap_user ON net_worth_snapshots(user_id, snapshot_date DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_fire_user ON fire_scenarios(user_id)`,
];

/**
 * 初始化数据库 schema（创建所有表和索引）
 */
export function initSchema(db: DatabaseType): void {
  for (const ddl of DDL_STATEMENTS) {
    db.exec(ddl);
  }
}
