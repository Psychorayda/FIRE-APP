import { registerHandler } from './register-handlers.js';
import { getTransaction, getTransactionById, getTransactionsByUser } from '@shared/models/transaction.js';
import { createTransaction, editTransaction, deleteTransaction } from '@shared/services/transaction-service.js';
import type { Database as DatabaseType } from 'better-sqlite3';
import type { CreateTransactionInput, EditTransactionInput } from '@shared/services/transaction-service.js';

export function registerTransactionHandlers(db: DatabaseType): void {
  registerHandler('db:tx:get', (_db, id: string) => getTransaction(_db, id), db);
  registerHandler('db:tx:getById', (_db, id: string) => getTransactionById(_db, id), db);
  registerHandler('db:tx:listByUser', (_db, userId: string) => getTransactionsByUser(_db, userId), db);
  registerHandler('db:tx:create', (_db, input: CreateTransactionInput) => createTransaction(_db, input), db);
  registerHandler('db:tx:edit', (_db, id: string, input: EditTransactionInput) => editTransaction(_db, id, input), db);
  registerHandler('db:tx:delete', (_db, id: string) => { deleteTransaction(_db, id); }, db);
}
