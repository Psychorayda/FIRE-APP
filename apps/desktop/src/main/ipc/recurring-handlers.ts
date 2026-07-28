import { registerHandler } from './register-handlers.js';
import { createRecurring, getActiveRecurring, updateRecurring } from '@shared/models/recurring.js';
import { processRecurringTransactions } from '@shared/services/recurring-service.js';
import type { Database as DatabaseType } from 'better-sqlite3';
import type { CreateRecurringInput } from '@shared/models/recurring.js';
import type { RecurringTransaction } from '@shared/types/index.js';

export function registerRecurringHandlers(db: DatabaseType): void {
  registerHandler('db:recurring:create', (_db, input: CreateRecurringInput) => createRecurring(_db, input), db);
  registerHandler('db:recurring:listActive', (_db, userId: string) => getActiveRecurring(_db, userId), db);
  registerHandler('db:recurring:update', (_db, id: string, updates: Partial<RecurringTransaction>) => { updateRecurring(_db, id, updates); }, db);
  registerHandler('db:recurring:process', (_db, userId: string) => processRecurringTransactions(_db, userId), db);
}
