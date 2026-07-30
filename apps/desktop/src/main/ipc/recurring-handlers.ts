import { registerHandler } from './register-handlers.js';
import { createRecurringSchema } from './schemas.js';
import { createRecurring, getActiveRecurring, updateRecurring } from '@shared/models/recurring.js';
import { processRecurringTransactions } from '@shared/services/recurring-service.js';
import type { Database as DatabaseType } from 'better-sqlite3';
import type { CreateRecurringInput } from '@shared/models/recurring.js';
import type { RecurringTransaction } from '@shared/types/index.js';

export function registerRecurringHandlers(db: DatabaseType): void {
  // create 接入 zod：校验 transaction_type / frequency 枚举与 amount 正数
  // create wired through zod: validates transaction_type / frequency enums and positive amount.
  // TODO: db:recurring:update 待补 updateRecurringSchema（当前 Partial<RecurringTransaction> 直传，updateRecurringSchema 待接入）
  registerHandler('db:recurring:create', (_db, input: CreateRecurringInput) => {
    const safe = createRecurringSchema.parse(input);
    return createRecurring(_db, safe);
  }, db);
  registerHandler('db:recurring:listActive', (_db, userId: string) => getActiveRecurring(_db, userId), db);
  registerHandler('db:recurring:update', (_db, id: string, updates: Partial<RecurringTransaction>) => { updateRecurring(_db, id, updates); }, db);
  registerHandler('db:recurring:process', (_db, userId: string) => processRecurringTransactions(_db, userId), db);
}
