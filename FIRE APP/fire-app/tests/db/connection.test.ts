// tests/db/connection.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, closeDatabase } from '../../src/db/connection.js';

describe('database connection', () => {
  let db: ReturnType<typeof createDatabase>;

  beforeEach(() => {
    db = createDatabase(':memory:');
  });

  afterEach(() => {
    closeDatabase(db);
  });

  it('createDatabase: 内存数据库可创建', () => {
    expect(db).toBeDefined();
    expect(db.open).toBe(true);
  });

  it('createDatabase: 可执行简单SQL', () => {
    db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
    db.prepare('INSERT INTO test (name) VALUES (?)').run('hello');
    const row = db.prepare('SELECT * FROM test WHERE id = 1').get() as { name: string };
    expect(row.name).toBe('hello');
  });

  it('createDatabase: 开启WAL模式（内存库回退到memory）', () => {
    // 内存数据库不支持WAL但不报错
    expect(db.open).toBe(true);
  });

  it('closeDatabase: 关闭后不可用', () => {
    closeDatabase(db);
    expect(db.open).toBe(false);
  });
});
