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
 */
export function closeDatabase(db: DatabaseType): void {
  if (db.open) {
    db.close();
  }
}
