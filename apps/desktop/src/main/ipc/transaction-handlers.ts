import { registerHandler } from './register-handlers.js';
import { createTransactionSchema, editTransactionSchema } from './schemas.js';
import { getTransaction, getTransactionById, getTransactionsByUser } from '@shared/models/transaction.js';
import { createTransaction, editTransaction, deleteTransaction } from '@shared/services/transaction-service.js';
import type { Database as DatabaseType } from 'better-sqlite3';
import type { CreateTransactionInput, EditTransactionInput } from '@shared/services/transaction-service.js';

export function registerTransactionHandlers(db: DatabaseType): void {
  registerHandler('db:tx:get', (_db, id: string) => getTransaction(_db, id), db);
  registerHandler('db:tx:getById', (_db, id: string) => getTransactionById(_db, id), db);
  registerHandler('db:tx:listByUser', (_db, userId: string) => getTransactionsByUser(_db, userId), db);
  // create/edit 接入 zod：amount 必须为有限正数，edit 路径 .strict() 拒绝 user_id/sync_version
  // create/edit wired through zod: amount must be finite & positive; edit path uses
  // .strict() to reject user_id / sync_version.
  registerHandler('db:tx:create', (_db, input: CreateTransactionInput) => {
    const safe = createTransactionSchema.parse(input);
    return createTransaction(_db, safe);
  }, db);
  registerHandler('db:tx:edit', (_db, id: string, input: EditTransactionInput) => {
    const safe = editTransactionSchema.parse(input);
    return editTransaction(_db, id, safe);
  }, db);
  registerHandler('db:tx:delete', (_db, id: string) => { deleteTransaction(_db, id); }, db);
}
