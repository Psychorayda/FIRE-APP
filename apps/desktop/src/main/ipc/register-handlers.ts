// IPC handler 注册器：统一错误处理包装
// IPC handler registrar: unified error handling wrapper

import { ipcMain } from 'electron';
import type { Database as DatabaseType } from 'better-sqlite3';

/**
 * 标准化 IPC 错误对象
 * Standardized IPC error object
 */
export interface IpcError {
  code: string;
  message: string;
  entity?: string;
}

/**
 * 包装 IPC handler，统一错误处理
 * Wrap IPC handler with unified error handling
 * @param channel IPC 通道名 / IPC channel name
 * @param handler 业务处理函数 / Business handler function
 * @param db 数据库实例 / Database instance
 */
export function registerHandler<TArgs extends unknown[], TResult>(
  channel: string,
  handler: (db: DatabaseType, ...args: TArgs) => TResult,
  db: DatabaseType,
): void {
  ipcMain.handle(channel, async (_event, ...args: TArgs): Promise<TResult> => {
    try {
      return handler(db, ...args);
    } catch (error) {
      const ipcError: IpcError = {
        code: error instanceof Error && error.message.includes('not found') ? 'NOT_FOUND' : 'DB_ERROR',
        message: error instanceof Error ? error.message : String(error),
      };
      throw ipcError;
    }
  });
}
