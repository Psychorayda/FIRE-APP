import type { ExportTableName } from './export-service.js';

/**
 * 每张表的合法列名白名单（从 schema 派生，与 db/schema.ts 保持同步）
 * Legal column whitelist per table (derived from schema, kept in sync with db/schema.ts)
 */
const COLUMN_WHITELIST: Record<ExportTableName, readonly string[]> = {
  users: ['id', 'display_name', 'base_currency', 'is_china_market', 'default_withdrawal_rate', 'default_expected_return', 'default_inflation_rate', 'encryption_key_hash', 'last_sync_at', 'sync_version', 'updated_at', 'deleted_flag'],
  accounts: ['id', 'user_id', 'name', 'asset_class', 'account_type', 'current_balance', 'last_updated', 'display_order', 'note', 'sync_version', 'updated_at', 'deleted_flag'],
  categories: ['id', 'user_id', 'parent_id', 'name', 'type', 'icon', 'color', 'linked_fire_concept', 'display_order', 'is_system', 'sync_version', 'updated_at', 'deleted_flag'],
  transactions: ['id', 'user_id', 'account_id', 'to_account_id', 'category_id', 'recurring_id', 'transaction_type', 'amount', 'transaction_date', 'description', 'sync_version', 'updated_at', 'deleted_flag'],
  recurring_transactions: ['id', 'user_id', 'account_id', 'to_account_id', 'category_id', 'transaction_type', 'amount', 'frequency', 'interval', 'start_date', 'end_date', 'next_due_date', 'last_generated_date', 'description', 'is_active', 'auto_create', 'sync_version', 'updated_at', 'deleted_flag'],
  net_worth_snapshots: ['id', 'user_id', 'snapshot_date', 'snapshot_year_month', 'total_liquid', 'total_invested', 'total_use_asset', 'total_liability', 'net_worth', 'sync_version', 'updated_at', 'deleted_flag'],
  fire_scenarios: ['id', 'user_id', 'name', 'description', 'current_age', 'retirement_age', 'current_portfolio_value', 'auto_sync_assets', 'monthly_savings', 'annual_expenses', 'expected_return_rate', 'inflation_rate', 'withdrawal_rate', 'retirement_years', 'post_retirement_monthly_income', 'is_china_market', 'is_active', 'sync_version', 'updated_at', 'deleted_flag'],
};

const COLUMN_NAME_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export function getColumnWhitelist(tableName: ExportTableName): readonly string[] {
  return COLUMN_WHITELIST[tableName] ?? [];
}

export function isValidColumnName(column: string): boolean {
  return COLUMN_NAME_REGEX.test(column);
}

export function filterRecordColumns(tableName: ExportTableName, record: Record<string, unknown>): Record<string, unknown> {
  const allowed = new Set(getColumnWhitelist(tableName));
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (allowed.has(key) && isValidColumnName(key)) {
      filtered[key] = value;
    }
  }
  return filtered;
}
