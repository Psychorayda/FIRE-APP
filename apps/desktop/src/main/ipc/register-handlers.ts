// IPC handler 注册器：统一错误处理包装（脱敏版）
// IPC handler registrar: unified error handling (sanitized)

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
 * 将底层错误映射为业务化文案，避免泄露 SQL/表结构/堆栈
 * Map underlying errors to business-friendly messages, avoid leaking
 * SQL / schema / stack traces to the renderer.
 *
 * 完整原始错误通过 console.error 记录在主进程日志中，仅对渲染层脱敏。
 * The full original error is logged in the main process via console.error;
 * only a sanitized message is surfaced to the renderer.
 */
export function sanitizeError(error: unknown): IpcError {
  const raw = error instanceof Error ? error.message : String(error);
  // SQLite 约束错误 → 通用文案 / SQLite constraint errors → generic copy
  if (raw.includes('SQLITE_CONSTRAINT: CHECK')) {
    return { code: 'VALIDATION_ERROR', message: '数据校验失败，请检查输入值' };
  }
  if (raw.includes('SQLITE_CONSTRAINT: UNIQUE')) {
    return { code: 'DUPLICATE_ERROR', message: '数据已存在，请勿重复添加' };
  }
  if (raw.includes('SQLITE_CONSTRAINT')) {
    return { code: 'VALIDATION_ERROR', message: '数据约束冲突，请检查输入' };
  }
  // not found
  if (raw.includes('not found') || raw.includes('不存在')) {
    return { code: 'NOT_FOUND', message: '记录不存在或已被删除' };
  }
  // zod 校验错误 / zod validation errors
  if (raw.includes('validation') || (error instanceof Error && 'issues' in error)) {
    return { code: 'VALIDATION_ERROR', message: '输入参数校验失败' };
  }
  // 路径守卫错误（对用户有意义，保留原消息）
  // Path-guard errors are meaningful to the user; keep the original message.
  if (raw.includes('路径不安全') || raw.includes('路径未经')) {
    return { code: 'PATH_FORBIDDEN', message: raw };
  }
  // 兜底：不暴露原始 SQL/堆栈
  // Fallback: do not expose raw SQL / stack
  console.error('[IPC] unhandled error:', raw); // 主进程日志 / main-process log
  return { code: 'DB_ERROR', message: '操作失败，请稍后重试' };
}

/**
 * 包装 IPC handler，统一错误处理（脱敏）
 * Wrap IPC handler with unified, sanitized error handling.
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
      throw sanitizeError(error);
    }
  });
}
