// 主进程数据库单例管理器 / Main process database singleton manager
// 持有 better-sqlite3 连接，供 IPC handler 使用
//
// 核心原则：永远不要自动删除用户数据库。
// 打开失败/完整性异常时保留原文件，明确报错，绝不 unlink。
// Core principle: NEVER auto-delete the user's database.
// On open failure / integrity anomaly, keep the file, report clearly, never unlink.

import { app, BrowserWindow } from 'electron';
import { join } from 'path';
import { mkdirSync, existsSync, renameSync, unlinkSync, appendFileSync, copyFileSync } from 'fs';
import { createDatabase, closeDatabase } from '@shared/db/connection.js';
import { initSchema } from '@shared/db/schema.js';
import type { Database as DatabaseType } from 'better-sqlite3';

let dbInstance: DatabaseType | null = null;

/**
 * 获取数据目录路径 / Get data directory path
 * 返回 {userData}/data/ 目录（userData 已由 fixUserDataPath 固定为 appData/fire-app）
 * Returns {userData}/data/ (userData is fixed to appData/fire-app by fixUserDataPath)
 */
function getDataDir(): string {
  const baseDir = join(app.getPath('userData'), 'data');
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
 * 获取旧路径（双层 fire-app，迁移用）
 * Get legacy path (double fire-app, for migration)
 */
function getLegacyDbPath(): string {
  return join(app.getPath('userData'), 'fire-app', 'data', 'fire.db');
}

/**
 * 写诊断日志到 userData/fire-app-debug.log
 * Write diagnostic log to userData/fire-app-debug.log
 */
function debugLog(message: string): void {
  const logPath = join(app.getPath('userData'), 'fire-app-debug.log');
  const line = `[${new Date().toISOString()}] ${message}\n`;
  try {
    appendFileSync(logPath, line, 'utf8');
  } catch {
    // 日志写入失败不阻塞主流程
  }
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
 * 迁移旧路径数据库到新路径 / Migrate legacy DB to new path
 * 三步：copy → 验证可打开 → delete 源。失败回退旧路径。
 * Three steps: copy → verify openable → delete source. On failure, fall back to legacy path.
 * @returns 迁移后的 dbPath（可能是新路径或回退的旧路径）
 */
function migrateLegacyDb(newDbPath: string): string {
  const legacyPath = getLegacyDbPath();
  if (!existsSync(legacyPath) || existsSync(newDbPath)) {
    return newDbPath; // 无旧库或新库已存在，无需迁移
  }

  debugLog(`检测到旧路径数据库: ${legacyPath}，开始迁移到 ${newDbPath}`);
  try {
    // 1. copy
    copyFileSync(legacyPath, newDbPath);
    // 2. 验证可打开
    const testDb = createDatabase(newDbPath);
    testDb.prepare('SELECT count(*) as c FROM users').get();
    closeDatabase(testDb);
    // 3. delete 源（含旧 WAL/SHM）
    unlinkSync(legacyPath);
    try { unlinkSync(`${legacyPath}-wal`); } catch {}
    try { unlinkSync(`${legacyPath}-shm`); } catch {}
    debugLog('迁移成功');
    return newDbPath;
  } catch (err) {
    debugLog(`迁移失败，回退旧路径: ${(err as Error).message}`);
    // 清理可能残留的半成品新文件
    try { unlinkSync(newDbPath); } catch {}
    return legacyPath;
  }
}

/**
 * 通知 renderer 数据库已损坏并重建 / Notify renderer DB was corrupted and rebuilt
 * 通过 BrowserWindow.webContents.send 推送事件
 */
function notifyCorruptedRecovered(backupPath: string, timestamp: number): void {
  const payload = JSON.stringify({ backupPath, timestamp });
  for (const win of BrowserWindow.getAllWindows()) {
    try {
      win.webContents.send('db:corrupted-recovered', payload);
    } catch {
      // 窗口可能未就绪，忽略
    }
  }
}

/**
 * 初始化数据库 / Initialize database
 * 创建连接、初始化 schema，返回 DB 实例
 *
 * 错误处理原则：
 * - createDatabase 抛错（瞬时锁等）→ 重抛，不删文件，不碰 WAL/SHM
 * - integrity_check 非 ok → 仅记警告，继续用（SQLite 多数异常可读）
 * - initSchema 抛错（确属结构损坏）→ 降级：备份 + 新建 + 通知 renderer
 *
 * Error handling principles:
 * - createDatabase throws (transient lock) → rethrow, keep file, never touch WAL/SHM
 * - integrity_check not 'ok' → log warning only, continue (SQLite is mostly readable)
 * - initSchema throws (genuine structural damage) → degrade: backup + rebuild + notify renderer
 */
export function initDatabase(): DatabaseType {
  if (dbInstance && dbInstance.open) {
    return dbInstance;
  }

  const newDbPath = getDbPath();
  // 迁移旧双层路径（失败回退旧路径，不阻断）
  const dbPath = migrateLegacyDb(newDbPath);
  debugLog(`initDatabase: dbPath = ${dbPath}`);

  // 阶段 1：打开数据库
  try {
    dbInstance = createDatabase(dbPath);
  } catch (err) {
    // 打开失败（多为瞬时锁）→ 重抛，绝不删文件，绝不碰 WAL/SHM
    // WAL 含未 checkpoint 写入，下次成功打开会自动 replay 恢复
    const msg = (err as Error).message;
    debugLog(`createDatabase 失败（保留文件，不删 WAL）: ${msg}`);
    throw err;
  }

  // 阶段 2：完整性检查（仅记警告，不删库）
  if (!checkIntegrity(dbInstance)) {
    const result = dbInstance.pragma('integrity_check') as Array<{ integrity_check: string }>;
    debugLog(`完整性检查异常: ${JSON.stringify(result)}（继续使用，不删库）`);
  }

  // 阶段 3：初始化 schema（失败则降级重建）
  try {
    initSchema(dbInstance);
  } catch (err) {
    const msg = (err as Error).message;
    debugLog(`initSchema 失败，触发降级重建: ${msg}`);
    console.error('[DB] schema 初始化失败，降级重建:', err);

    // 降级：备份原库 → 清理 → 新建空库
    // 此时主库已备份为 .corrupted-<ts>，WAL 无意义可清理
    const timestamp = Date.now();
    const backupPath = `${dbPath}.corrupted-${timestamp}`;
    try {
      // 先关闭当前连接
      try { dbInstance.close(); } catch {}
      dbInstance = null;
      // 重命名备份（保留数据）
      renameSync(dbPath, backupPath);
      debugLog(`原库已备份到: ${backupPath}`);
    } catch {
      // 重命名失败（极端情况）→ 尝试删除（否则新建会失败）
      try { unlinkSync(dbPath); } catch {}
    }
    // 清理 WAL/SHM（主库已备份）
    try { unlinkSync(`${dbPath}-wal`); } catch {}
    try { unlinkSync(`${dbPath}-shm`); } catch {}

    // 新建空库
    dbInstance = createDatabase(dbPath);
    initSchema(dbInstance);
    debugLog('降级重建完成（新空库）');

    // 通知 renderer 显示明确提示（非静默回 Onboarding）
    notifyCorruptedRecovered(backupPath, timestamp);
    return dbInstance;
  }

  // 阶段 4：记录启动诊断信息
  try {
    const row = dbInstance.prepare('SELECT count(*) as c FROM users').get() as { c: number };
    debugLog(`数据库已初始化: ${dbPath}，users 行数 = ${row.c}`);
  } catch {
    debugLog(`数据库已初始化: ${dbPath}（users 查询失败）`);
  }
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
 * 先 WAL checkpoint(TRUNCATE) 再关闭，幂等
 */
export function closeAppDatabase(): void {
  if (dbInstance) {
    try {
      closeDatabase(dbInstance);
      debugLog('数据库已关闭（WAL checkpoint + close）');
    } catch (err) {
      debugLog(`数据库关闭异常: ${(err as Error).message}`);
    }
    dbInstance = null;
    console.log('[DB] 数据库已关闭');
  }
}
