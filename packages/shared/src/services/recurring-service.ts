import type { Database as DatabaseType } from 'better-sqlite3';
import { nowMs, addMonths } from '../utils/time.js';
import { getActiveRecurring, updateRecurring } from '../models/recurring.js';
import { createTransaction } from './transaction-service.js';
import type { Transaction, Frequency } from '../types/index.js';

function advanceDueDate(currentDue: number, frequency: Frequency, interval: number): number {
  switch (frequency) {
    case 'daily': return currentDue + interval * 24 * 60 * 60 * 1000;
    case 'weekly': return currentDue + interval * 7 * 24 * 60 * 60 * 1000;
    case 'monthly': return addMonths(currentDue, interval);
    case 'yearly': return addMonths(currentDue, interval * 12);
    default: return currentDue;
  }
}

export function processRecurringTransactions(db: DatabaseType, userId: string): Transaction[] {
  const templates = getActiveRecurring(db, userId);
  const generated: Transaction[] = [];
  const currentTime = nowMs();

  // 预编译幂等检查语句（查同 recurring_id + transaction_date 是否已存在）
  // Pre-compiled idempotency check (whether same recurring_id + transaction_date already exists)
  const checkExisting = db.prepare('SELECT 1 FROM transactions WHERE recurring_id = ? AND transaction_date = ? AND deleted_flag = 0 LIMIT 1');

  db.transaction(() => {
    for (const template of templates) {
      let { next_due_date } = template;

      while (next_due_date <= currentTime) {
        if (template.end_date !== null && next_due_date > template.end_date) {
          updateRecurring(db, template.id, { is_active: 0 });
          break;
        }

        // 幂等检查：同 recurring_id + transaction_date 已存在则跳过
        // Idempotency: skip if same recurring_id + transaction_date already exists
        const exists = checkExisting.get(template.id, next_due_date);
        if (!exists) {
          const tx = createTransaction(db, {
            user_id: userId, account_id: template.account_id,
            to_account_id: template.to_account_id, category_id: template.category_id,
            recurring_id: template.id, transaction_type: template.transaction_type,
            amount: template.amount, transaction_date: next_due_date,
            description: template.description,
          });
          generated.push(tx);
        }

        updateRecurring(db, template.id, { last_generated_date: next_due_date });
        next_due_date = advanceDueDate(next_due_date, template.frequency, template.interval);
      }

      if (next_due_date !== template.next_due_date) {
        if (template.end_date !== null && next_due_date > template.end_date) {
          updateRecurring(db, template.id, { next_due_date, is_active: 0 });
        } else {
          updateRecurring(db, template.id, { next_due_date });
        }
      }
    }
  })();

  return generated;
}
