import { registerHandler } from './register-handlers.js';
import {
  createAccount, getAccount, getAccounts, updateAccount, updateAccountBalance,
  getInvestableBalance, getNetWorth, hasTransactions, softDeleteAccount,
} from '@shared/models/account.js';
import type { Database as DatabaseType } from 'better-sqlite3';
import type { CreateAccountInput, EditAccountInput } from '@shared/models/account.js';

export function registerAccountHandlers(db: DatabaseType): void {
  registerHandler('db:account:create', (_db, input: CreateAccountInput) => createAccount(_db, input), db);
  registerHandler('db:account:get', (_db, id: string) => getAccount(_db, id), db);
  registerHandler('db:account:list', (_db, userId: string) => getAccounts(_db, userId), db);
  registerHandler('db:account:update', (_db, id: string, input: EditAccountInput) => updateAccount(_db, id, input), db);
  registerHandler('db:account:updateBalance', (_db, id: string, newBalance: number) => { updateAccountBalance(_db, id, newBalance); }, db);
  registerHandler('db:account:investableBalance', (_db, userId: string) => getInvestableBalance(_db, userId), db);
  registerHandler('db:account:netWorth', (_db, userId: string) => getNetWorth(_db, userId), db);
  registerHandler('db:account:hasTransactions', (_db, accountId: string) => hasTransactions(_db, accountId), db);
  registerHandler('db:account:softDelete', (_db, id: string) => { softDeleteAccount(_db, id); }, db);
}
