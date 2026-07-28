import { registerHandler } from './register-handlers.js';
import { closeDatabase } from '@shared/db/connection.js';
import type { Database as DatabaseType } from 'better-sqlite3';

export function registerDbHandlers(db: DatabaseType): void {
  // db:init — 主进程已初始化，此处仅返回确认（幂等）
  registerHandler('db:init', () => undefined, db);
  // db:close — 关闭数据库连接
  registerHandler('db:close', (_db) => { closeDatabase(_db); }, db);
}
