import { registerHandler } from './register-handlers.js';
import { updateUserSchema } from './schemas.js';
import { createUser, getUser, updateUser, getFirstUser } from '@shared/models/user.js';
import type { Database as DatabaseType } from 'better-sqlite3';
import type { CreateUserInput, UpdateUserInput } from '@shared/models/user.js';

export function registerUserHandlers(db: DatabaseType): void {
  // TODO: db:user:create 待补 createUserSchema
  registerHandler('db:user:create', (_db, input: CreateUserInput) => createUser(_db, input), db);
  registerHandler('db:user:get', (_db, id: string) => getUser(_db, id), db);
  // update 接入 zod：.strict() 拒绝 encryption_key_hash / last_sync_at / sync_version 等服务端字段
  // update wired through zod: .strict() rejects server-controlled fields like
  // encryption_key_hash / last_sync_at / sync_version.
  registerHandler('db:user:update', (_db, id: string, input: UpdateUserInput) => {
    const safe = updateUserSchema.parse(input);
    return updateUser(_db, id, safe);
  }, db);
  registerHandler('db:user:getFirst', (_db) => getFirstUser(_db), db);
}
