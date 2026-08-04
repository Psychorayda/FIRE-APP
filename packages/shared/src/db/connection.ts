// src/db/connection.ts
import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';

/**
 * 创建数据库连接
 * @param path 数据库文件路径（必填），':memory:' 为内存数据库（用于测试）
 * @throws 空路径抛错，避免误用相对默认值导致数据写到非预期位置
 */
export function createDatabase(path: string): DatabaseType {
  if (!path) throw new Error('数据库路径不能为空');
  const db = new Database(path);

  // 启用外键约束
  db.pragma('foreign_keys = ON');

  // 文件数据库开启WAL模式（内存数据库不支持WAL，会静默忽略）
  if (path !== ':memory:') {
    db.pragma('journal_mode = WAL');
    // busy_timeout: 遇到锁时自动重试 5s，消化杀毒扫描/文件句柄延迟释放等瞬时锁
    // busy_timeout: auto-retry 5s on lock, absorbs transient locks from AV scans / handle release delay
    db.pragma('busy_timeout = 5000');
  }

  return db;
}

/**
 * 关闭数据库连接
 * 先执行 WAL checkpoint 将日志合并到主库，再关闭连接
 * WAL checkpoint before close to ensure all data is persisted to the main database file
 */
export function closeDatabase(db: DatabaseType): void {
  if (db.open) {
    try {
      db.pragma('wal_checkpoint(TRUNCATE)');
    } catch {
      // checkpoint 失败不阻塞关闭
      // checkpoint failure should not block close
    }
    db.close();
  }
}
