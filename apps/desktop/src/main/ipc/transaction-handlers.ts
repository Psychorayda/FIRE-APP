import { registerHandler } from './register-handlers.js';
import { createTransactionSchema, editTransactionSchema } from './schemas.js';
import { getTransaction, getTransactionById } from '@shared/models/transaction.js';
import {
  getTransactionsPage,
  getRecentTransactions,
  getMonthlyOverview,
} from '@shared/models/transaction-queries.js';
import type { TransactionPageParams } from '@shared/models/transaction-queries.js';
import { createTransaction, editTransaction, deleteTransaction } from '@shared/services/transaction-service.js';
import type { Database as DatabaseType } from 'better-sqlite3';
import type { CreateTransactionInput, EditTransactionInput } from '@shared/services/transaction-service.js';

export function registerTransactionHandlers(db: DatabaseType): void {
  registerHandler('db:tx:get', (_db, id: string) => getTransaction(_db, id), db);
  registerHandler('db:tx:getById', (_db, id: string) => getTransactionById(_db, id), db);
  // 分页查询：筛选/排序下推到 SQL，避免全量拉取
  // Paginated query: filters/order pushed to SQL, avoids full table fetch
  registerHandler(
    'db:tx:page',
    (_db, userId: string, params: TransactionPageParams) => getTransactionsPage(_db, userId, params),
    db,
  );
  registerHandler(
    'db:tx:recent',
    (_db, userId: string, limit: number) => getRecentTransactions(_db, userId, limit),
    db,
  );
  registerHandler(
    'db:tx:monthlyOverview',
    (_db, userId: string, yearMonth: string) => getMonthlyOverview(_db, userId, yearMonth),
    db,
  );
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
