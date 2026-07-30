import { registerHandler } from './register-handlers.js';
import { createAccountSchema, editAccountSchema } from './schemas.js';
import {
  createAccount, getAccount, getAccounts, updateAccount, updateAccountBalance,
  getInvestableBalance, getNetWorth, hasTransactions, softDeleteAccount,
} from '@shared/models/account.js';
import type { Database as DatabaseType } from 'better-sqlite3';
import type { CreateAccountInput, EditAccountInput } from '@shared/models/account.js';

export function registerAccountHandlers(db: DatabaseType): void {
  // create/update 接入 zod：校验枚举与长度，update 路径 .strict() 拒绝 sync_version 等未知字段
  // create/update wired through zod: validates enums & lengths; update path uses
  // .strict() to reject unknown fields like sync_version.
  registerHandler('db:account:create', (_db, input: CreateAccountInput) => {
    const safe = createAccountSchema.parse(input);
    return createAccount(_db, safe);
  }, db);
  registerHandler('db:account:get', (_db, id: string) => getAccount(_db, id), db);
  registerHandler('db:account:list', (_db, userId: string) => getAccounts(_db, userId), db);
  registerHandler('db:account:update', (_db, id: string, input: EditAccountInput) => {
    const safe = editAccountSchema.parse(input);
    return updateAccount(_db, id, safe);
  }, db);
  registerHandler('db:account:updateBalance', (_db, id: string, newBalance: number) => { updateAccountBalance(_db, id, newBalance); }, db);
  registerHandler('db:account:investableBalance', (_db, userId: string) => getInvestableBalance(_db, userId), db);
  registerHandler('db:account:netWorth', (_db, userId: string) => getNetWorth(_db, userId), db);
  registerHandler('db:account:hasTransactions', (_db, accountId: string) => hasTransactions(_db, accountId), db);
  registerHandler('db:account:softDelete', (_db, id: string) => { softDeleteAccount(_db, id); }, db);
}
