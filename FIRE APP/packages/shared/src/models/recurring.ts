import type { Database as DatabaseType } from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { nowMs } from '../utils/time.js';
import type { RecurringTransaction, TransactionType, Frequency } from '../types/index.js';

export interface CreateRecurringInput {
  user_id: string;
  account_id: string;
  to_account_id?: string | null;
  category_id?: string | null;
  transaction_type: TransactionType;
  amount: number;
  frequency: Frequency;
  interval?: number;
  start_date: number;
  end_date?: number | null;
  next_due_date: number;
  description?: string | null;
  is_active?: number;
  auto_create?: number;
}

export function createRecurring(db: DatabaseType, input: CreateRecurringInput): RecurringTransaction {
  const id = uuidv4();
  const now = nowMs();
  const rec: RecurringTransaction = {
    id, user_id: input.user_id, account_id: input.account_id,
    to_account_id: input.to_account_id ?? null, category_id: input.category_id ?? null,
    transaction_type: input.transaction_type, amount: input.amount,
    frequency: input.frequency, interval: input.interval ?? 1,
    start_date: input.start_date, end_date: input.end_date ?? null,
    next_due_date: input.next_due_date, last_generated_date: null,
    description: input.description ?? null, is_active: input.is_active ?? 1,
    auto_create: input.auto_create ?? 1, sync_version: 0, updated_at: now, deleted_flag: 0,
  };
  db.prepare(`INSERT INTO recurring_transactions (id, user_id, account_id, to_account_id, category_id, transaction_type, amount, frequency, interval, start_date, end_date, next_due_date, last_generated_date, description, is_active, auto_create, sync_version, updated_at, deleted_flag) VALUES (@id, @user_id, @account_id, @to_account_id, @category_id, @transaction_type, @amount, @frequency, @interval, @start_date, @end_date, @next_due_date, @last_generated_date, @description, @is_active, @auto_create, @sync_version, @updated_at, @deleted_flag)`).run(rec);
  return rec;
}

export function getActiveRecurring(db: DatabaseType, userId: string): RecurringTransaction[] {
  return db.prepare('SELECT * FROM recurring_transactions WHERE user_id = ? AND is_active = 1 AND deleted_flag = 0').all(userId) as RecurringTransaction[];
}

export function updateRecurring(db: DatabaseType, id: string, updates: Partial<RecurringTransaction>): void {
  const current = db.prepare('SELECT * FROM recurring_transactions WHERE id = ?').get(id) as RecurringTransaction | undefined;
  if (!current) { throw new Error(`Recurring transaction not found: ${id}`); }
  const updated = { ...current, ...updates, sync_version: current.sync_version + 1, updated_at: nowMs() };
  db.prepare(`UPDATE recurring_transactions SET next_due_date = @next_due_date, last_generated_date = @last_generated_date, is_active = @is_active, sync_version = @sync_version, updated_at = @updated_at WHERE id = @id`).run(updated);
}
