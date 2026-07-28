// 主进程数据库单例管理器 / Main process database singleton manager
// 持有 better-sqlite3 连接，供 IPC handler 使用

import { app } from 'electron';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';
import { createDatabase, closeDatabase } from '@shared/db/connection.js';
import { initSchema } from '@shared/db/schema.js';
import type { Database as DatabaseType } from 'better-sqlite3';

let dbInstance: DatabaseType | null = null;

/**
 * 获取数据目录路径 / Get data directory path
 * 返回 {userData}/fire-app/data/ 目录
 */
function getDataDir(): string {
  const baseDir = join(app.getPath('userData'), 'fire-app', 'data');
  if (!existsSync(baseDir)) {
    mkdirSync(baseDir, { recursive: true });
  }
  return baseDir;
}

/**
 * 获取数据库文件路径 / Get database file path
 */
function getDbPath(): string {
  return join(getDataDir(), 'fire.db');
}

/**
 * 初始化数据库 / Initialize database
 * 创建连接、初始化 schema，返回 DB 实例
 */
export function initDatabase(): DatabaseType {
  if (dbInstance && dbInstance.open) {
    return dbInstance;
  }

  const dbPath = getDbPath();
  dbInstance = createDatabase(dbPath);
  initSchema(dbInstance);

  console.log(`[DB] 数据库已初始化: ${dbPath}`);
  return dbInstance;
}

/**
 * 获取数据库实例 / Get database instance
 * 必须在 initDatabase() 之后调用
 */
export function getDatabase(): DatabaseType {
  if (!dbInstance || !dbInstance.open) {
    throw new Error('数据库未初始化，请先调用 initDatabase()');
  }
  return dbInstance;
}

/**
 * 关闭数据库 / Close database
 */
export function closeAppDatabase(): void {
  if (dbInstance) {
    closeDatabase(dbInstance);
    dbInstance = null;
    console.log('[DB] 数据库已关闭');
  }
}
