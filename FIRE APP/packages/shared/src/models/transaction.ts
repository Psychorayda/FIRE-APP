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
