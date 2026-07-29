import type { Database as DatabaseType } from 'better-sqlite3';
import { nowMs } from '../utils/time.js';

export interface ClearResult {
  success: boolean;
  clearedTransactionCount: number;
  clearedRecurringCount: number;
  resetAccountCount: number;
  error?: string;
}

export function clearAllTransactions(db: DatabaseType, userId: string): ClearResult {
  const result: ClearResult = {
    success: true, clearedTransactionCount: 0, clearedRecurringCount: 0, resetAccountCount: 0,
  };

  try {
    db.transaction(() => {
      const now = nowMs();
      const txCount = db.prepare('SELECT COUNT(*) as cnt FROM transactions WHERE user_id = ? AND deleted_flag = 0').get(userId) as { cnt: number };
      result.clearedTransactionCount = txCount.cnt;
      const recurringCount = db.prepare('SELECT COUNT(*) as cnt FROM recurring_transactions WHERE user_id = ? AND deleted_flag = 0').get(userId) as { cnt: number };
      result.clearedRecurringCount = recurringCount.cnt;
      const accountCount = db.prepare('SELECT COUNT(*) as cnt FROM accounts WHERE user_id = ? AND deleted_flag = 0').get(userId) as { cnt: number };
      result.resetAccountCount = accountCount.cnt;

      db.prepare('UPDATE transactions SET deleted_flag = 1, updated_at = ? WHERE user_id = ? AND deleted_flag = 0').run(now, userId);
      db.prepare('UPDATE recurring_transactions SET deleted_flag = 1, updated_at = ? WHERE user_id = ? AND deleted_flag = 0').run(now, userId);
      db.prepare('UPDATE accounts SET current_balance = 0, last_updated = ? WHERE user_id = ? AND deleted_flag = 0').run(now, userId);
    })();
    return result;
  } catch (e) {
    return { success: false, clearedTransactionCount: 0, clearedRecurringCount: 0, resetAccountCount: 0, error: (e as Error).message };
  }
}
