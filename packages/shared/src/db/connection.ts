// src/db/connection.ts
import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';

/**
 * 创建数据库连接
 * @param path 数据库文件路径，':memory:' 为内存数据库（用于测试）
 */
export function createDatabase(path: string = 'data/fire-app.db'): DatabaseType {
  const db = new Database(path);

  // 启用外键约束
  db.pragma('foreign_keys = ON');

  // 文件数据库开启WAL模式（内存数据库不支持WAL，会静默忽略）
  if (path !== ':memory:') {
    db.pragma('journal_mode = WAL');
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
