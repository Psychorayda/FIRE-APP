// 主进程数据库单例管理器 / Main process database singleton manager
// 持有 better-sqlite3 连接，供 IPC handler 使用

import { app } from 'electron';
import { join } from 'path';
import { mkdirSync, existsSync, renameSync, unlinkSync } from 'fs';
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
 * 检查数据库完整性 / Check database integrity
 * 返回 true 表示数据库完好，false 表示已损坏
 */
function checkIntegrity(db: DatabaseType): boolean {
  try {
    const result = db.pragma('integrity_check') as Array<{ integrity_check: string }>;
    return result.length === 1 && result[0].integrity_check === 'ok';
  } catch {
    return false;
  }
}

/**
 * 初始化数据库 / Initialize database
 * 创建连接、初始化 schema，返回 DB 实例
 *
 * 如果数据库文件已损坏（integrity_check 失败），会备份损坏文件并重新建库。
 * 这会导致数据丢失，但至少应用能正常启动而不是卡死。
 */
export function initDatabase(): DatabaseType {
  if (dbInstance && dbInstance.open) {
    return dbInstance;
  }

  const dbPath = getDbPath();

  // 尝试打开数据库并检查完整性
  try {
    dbInstance = createDatabase(dbPath);

    // 完整性检查：如果损坏，备份 + 重建
    if (!checkIntegrity(dbInstance)) {
      console.error('[DB] 数据库损坏，备份并重建 / Database corrupted, backing up and rebuilding');
      // 先关闭损坏的连接
      try { dbInstance.close(); } catch {}
      dbInstance = null;

      // 备份损坏的文件（附 .corrupted 时间戳）
      const backupPath = `${dbPath}.corrupted-${Date.now()}`;
      try {
        renameSync(dbPath, backupPath);
        console.error(`[DB] 损坏数据库已备份到: ${backupPath}`);
      } catch {
        // 备份失败则直接删除（否则重建会失败）
        try { unlinkSync(dbPath); } catch {}
      }
      // 同时清理 WAL 和 SHM 文件
      try { unlinkSync(`${dbPath}-wal`); } catch {}
      try { unlinkSync(`${dbPath}-shm`); } catch {}

      // 重新创建
      dbInstance = createDatabase(dbPath);
    }

    initSchema(dbInstance);
    console.log(`[DB] 数据库已初始化: ${dbPath}`);
    return dbInstance;
  } catch (err) {
    // createDatabase 或 initSchema 失败，尝试重建
    console.error('[DB] 数据库初始化失败，尝试重建:', err);
    if (dbInstance) {
      try { dbInstance.close(); } catch {}
      dbInstance = null;
    }
    // 删除可能损坏的文件 + WAL/SHM
    try { unlinkSync(dbPath); } catch {}
    try { unlinkSync(`${dbPath}-wal`); } catch {}
    try { unlinkSync(`${dbPath}-shm`); } catch {}

    dbInstance = createDatabase(dbPath);
    initSchema(dbInstance);
    console.log(`[DB] 数据库已重建: ${dbPath}`);
    return dbInstance;
  }
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
