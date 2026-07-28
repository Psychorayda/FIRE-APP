// src/models/account.ts
import type { Database as DatabaseType } from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { nowMs } from '../utils/time.js';
import type { Account, AssetClass, AccountType } from '../types/index.js';

export interface CreateAccountInput {
  user_id: string;
  name: string;
  asset_class: AssetClass;
  account_type: AccountType;
  initial_balance?: number;
  display_order?: number;
  note?: string | null;
}

export interface EditAccountInput {
  name?: string;
  asset_class?: AssetClass;
  account_type?: AccountType;
  note?: string | null;
  display_order?: number;
}

export function createAccount(db: DatabaseType, input: CreateAccountInput): Account {
  const id = uuidv4();
  const now = nowMs();

  const account: Account = {
    id,
    user_id: input.user_id,
    name: input.name,
    asset_class: input.asset_class,
    account_type: input.account_type,
    current_balance: input.initial_balance ?? 0,
    last_updated: now,
    display_order: input.display_order ?? 0,
    note: input.note ?? null,
    sync_version: 0,
    updated_at: now,
    deleted_flag: 0,
  };

  db.prepare(`
    INSERT INTO accounts (id, user_id, name, asset_class, account_type, current_balance,
      last_updated, display_order, note, sync_version, updated_at, deleted_flag)
    VALUES (@id, @user_id, @name, @asset_class, @account_type, @current_balance,
      @last_updated, @display_order, @note, @sync_version, @updated_at, @deleted_flag)
  `).run(account);

  return account;
}

export function getAccount(db: DatabaseType, id: string): Account | null {
  const row = db.prepare(
    'SELECT * FROM accounts WHERE id = ? AND deleted_flag = 0'
  ).get(id) as Account | undefined;
  return row ?? null;
}

export function getAccounts(db: DatabaseType, userId: string): Account[] {
  return db.prepare(
    'SELECT * FROM accounts WHERE user_id = ? AND deleted_flag = 0 ORDER BY display_order, name'
  ).all(userId) as Account[];
}

export function updateAccountBalance(db: DatabaseType, id: string, newBalance: number): void {
  db.prepare(`
    UPDATE accounts SET current_balance = ?, last_updated = ? WHERE id = ?
  `).run(newBalance, nowMs(), id);
}

/**
 * 更新账户字段（partial update，余额不可直接编辑）
 * 每次更新递增 sync_version，为后续同步层预留
 */
export function updateAccount(db: DatabaseType, id: string, input: EditAccountInput): Account {
  const current = getAccount(db, id);
  if (!current) { throw new Error(`Account not found: ${id}`); }

  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (input.name !== undefined) { fields.push('name = ?'); values.push(input.name); }
  if (input.asset_class !== undefined) { fields.push('asset_class = ?'); values.push(input.asset_class); }
  if (input.account_type !== undefined) { fields.push('account_type = ?'); values.push(input.account_type); }
  if (input.note !== undefined) { fields.push('note = ?'); values.push(input.note); }
  if (input.display_order !== undefined) { fields.push('display_order = ?'); values.push(input.display_order); }

  if (fields.length === 0) { return current; }

  fields.push('sync_version = ?'); values.push(current.sync_version + 1);
  fields.push('updated_at = ?'); values.push(nowMs());
  values.push(id);

  db.prepare(`UPDATE accounts SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  return getAccount(db, id)!;
}

/**
 * 获取可投资组合余额（liquid + invested）
 */
export function getInvestableBalance(db: DatabaseType, userId: string): number {
  const result = db.prepare(`
    SELECT COALESCE(SUM(current_balance), 0) as total
    FROM accounts
    WHERE user_id = ? AND asset_class IN ('liquid', 'invested') AND deleted_flag = 0
  `).get(userId) as { total: number };
  return result.total;
}

/**
 * 获取净资产（所有账户余额之和，负债为负数）
 */
export function getNetWorth(db: DatabaseType, userId: string): number {
  const result = db.prepare(`
    SELECT COALESCE(SUM(current_balance), 0) as total
    FROM accounts
    WHERE user_id = ? AND deleted_flag = 0
  `).get(userId) as { total: number };
  return result.total;
}

/**
 * 检查账户是否有关联交易
 */
export function hasTransactions(db: DatabaseType, accountId: string): boolean {
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM transactions
    WHERE (account_id = ? OR to_account_id = ?) AND deleted_flag = 0
  `).get(accountId, accountId) as { count: number };
  return result.count > 0;
}

/**
 * 软删除账户（有关联交易时抛出错误）
 */
export function softDeleteAccount(db: DatabaseType, id: string): void {
  if (hasTransactions(db, id)) {
    throw new Error('该账户下有关联交易，无法删除。请先处理关联交易。');
  }

  const current = getAccount(db, id);
  if (!current) {
    throw new Error(`Account not found: ${id}`);
  }

  db.prepare(`
    UPDATE accounts SET
      deleted_flag = 1,
      sync_version = ?,
      updated_at = ?
    WHERE id = ?
  `).run(current.sync_version + 1, nowMs(), id);
}
