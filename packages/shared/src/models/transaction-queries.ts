import type { Database as DatabaseType } from 'better-sqlite3';
import type { Transaction } from '../types/index.js';

export interface TransactionPageParams {
  dateFrom?: number;
  dateTo?: number;
  type?: 'income' | 'expense' | 'transfer' | 'initial_balance';
  accountId?: string;
  limit: number;
  offset: number;
}

export interface TransactionPage {
  items: Transaction[];
  total: number;
}

export interface MonthlyOverview {
  income: number;
  expense: number;
  transfer: number;
}

/**
 * 分页查询交易（筛选/排序下推到 SQL）
 * Paginated transaction query (filters/order pushed to SQL)
 */
export function getTransactionsPage(db: DatabaseType, userId: string, params: TransactionPageParams): TransactionPage {
  const conditions = ['user_id = ?', 'deleted_flag = 0'];
  const args: unknown[] = [userId];
  if (params.dateFrom !== undefined) { conditions.push('transaction_date >= ?'); args.push(params.dateFrom); }
  if (params.dateTo !== undefined) { conditions.push('transaction_date <= ?'); args.push(params.dateTo); }
  if (params.type !== undefined) { conditions.push('transaction_type = ?'); args.push(params.type); }
  if (params.accountId !== undefined) { conditions.push('account_id = ?'); args.push(params.accountId); }
  const where = conditions.join(' AND ');

  const total = (db.prepare(`SELECT COUNT(*) as cnt FROM transactions WHERE ${where}`).get(...args) as { cnt: number }).cnt;
  const items = db.prepare(`SELECT * FROM transactions WHERE ${where} ORDER BY transaction_date DESC, updated_at DESC LIMIT ? OFFSET ?`).all(...args, params.limit, params.offset) as Transaction[];
  return { items, total };
}

/**
 * 获取最近 N 条交易（SQL LIMIT，避免拉全量）
 * Get recent N transactions (SQL LIMIT, avoids full table fetch)
 */
export function getRecentTransactions(db: DatabaseType, userId: string, limit: number): Transaction[] {
  return db.prepare('SELECT * FROM transactions WHERE user_id = ? AND deleted_flag = 0 ORDER BY transaction_date DESC, updated_at DESC LIMIT ?').all(userId, limit) as Transaction[];
}

/**
 * 月度收支聚合（SQL SUM/CASE，避免拉全量再前端聚合）
 * Monthly income/expense aggregation (SQL SUM/CASE, avoids full fetch + frontend aggregation)
 */
export function getMonthlyOverview(db: DatabaseType, userId: string, yearMonth: string): MonthlyOverview {
  // yearMonth 格式 YYYY-MM，匹配 transaction_date 所在月
  // yearMonth format YYYY-MM, matching transaction_date's month
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE 0 END), 0) as income,
      COALESCE(SUM(CASE WHEN transaction_type = 'expense' THEN amount ELSE 0 END), 0) as expense,
      COALESCE(SUM(CASE WHEN transaction_type = 'transfer' THEN amount ELSE 0 END), 0) as transfer
    FROM transactions
    WHERE user_id = ? AND deleted_flag = 0
      AND strftime('%Y-%m', transaction_date / 1000, 'unixepoch') = ?
  `).get(userId, yearMonth) as MonthlyOverview;
  return row ?? { income: 0, expense: 0, transfer: 0 };
}
