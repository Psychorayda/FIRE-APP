import { registerHandler } from './register-handlers.js';
import { createUser, getUser, updateUser, getFirstUser } from '@shared/models/user.js';
import type { Database as DatabaseType } from 'better-sqlite3';
import type { CreateUserInput, UpdateUserInput } from '@shared/models/user.js';

export function registerUserHandlers(db: DatabaseType): void {
  registerHandler('db:user:create', (_db, input: CreateUserInput) => createUser(_db, input), db);
  registerHandler('db:user:get', (_db, id: string) => getUser(_db, id), db);
  registerHandler('db:user:update', (_db, id: string, input: UpdateUserInput) => updateUser(_db, id, input), db);
  registerHandler('db:user:getFirst', (_db) => getFirstUser(_db), db);
}
