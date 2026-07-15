import type { Database as DatabaseType } from 'better-sqlite3';
import type { Transaction } from '../types/index.js';

export function getTransaction(db: DatabaseType, id: string): Transaction | null {
  const row = db.prepare('SELECT * FROM transactions WHERE id = ? AND deleted_flag = 0').get(id) as Transaction | undefined;
  return row ?? null;
}

export function getTransactionById(db: DatabaseType, id: string): Transaction | null {
  const row = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as Transaction | undefined;
  return row ?? null;
}

/**
 * 获取用户的所有交易列表（排除已删除，按日期倒序）
 * Get all transactions for a user (excludes deleted, sorted by date desc)
 * @param db 数据库实例 / Database instance
 * @param userId 用户 ID / User ID
 * @returns 交易列表 / Transaction list
 */
export function getTransactionsByUser(db: DatabaseType, userId: string): Transaction[] {
  return db.prepare(
    'SELECT * FROM transactions WHERE user_id = ? AND deleted_flag = 0 ORDER BY transaction_date DESC, updated_at DESC'
  ).all(userId) as Transaction[];
}
