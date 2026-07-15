// tests/models/user.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, closeDatabase } from '../../src/db/connection.js';
import { initSchema } from '../../src/db/schema.js';
import { createUser, getUser, updateUser } from '../../src/models/user.js';
import type { Database as DatabaseType } from 'better-sqlite3';

describe('user model', () => {
  let db: DatabaseType;
  const userId = 'test-user-id';

  beforeEach(() => {
    db = createDatabase(':memory:');
    initSchema(db);
  });

  afterEach(() => {
    closeDatabase(db);
  });

  it('createUser: 创建用户记录', () => {
    const user = createUser(db, { id: userId, display_name: '测试用户' });
    expect(user.id).toBe(userId);
    expect(user.display_name).toBe('测试用户');
    expect(user.base_currency).toBe('CNY');
    expect(user.is_china_market).toBe(1);
    expect(user.default_withdrawal_rate).toBe(350);
    expect(user.default_expected_return).toBe(700);
    expect(user.default_inflation_rate).toBe(300);
    expect(user.sync_version).toBe(0);
    expect(user.deleted_flag).toBe(0);
  });

  it('createUser: 非中国市场 → 默认提现率400', () => {
    const user = createUser(db, { id: userId, display_name: '全球用户', is_china_market: 0 });
    expect(user.default_withdrawal_rate).toBe(400);
  });

  it('getUser: 读取用户记录', () => {
    createUser(db, { id: userId, display_name: '测试用户' });
    const user = getUser(db, userId);
    expect(user).not.toBeNull();
    expect(user!.display_name).toBe('测试用户');
  });

  it('getUser: 不存在的用户 → null', () => {
    const user = getUser(db, 'nonexistent');
    expect(user).toBeNull();
  });

  it('updateUser: 修改显示名称', () => {
    createUser(db, { id: userId, display_name: '旧名称' });
    const updated = updateUser(db, userId, { display_name: '新名称' });
    expect(updated.display_name).toBe('新名称');
    expect(updated.sync_version).toBe(1);
  });

  it('updateUser: 修改FIRE偏好', () => {
    createUser(db, { id: userId, display_name: '测试' });
    const updated = updateUser(db, userId, {
      default_withdrawal_rate: 400,
      default_expected_return: 500,
    });
    expect(updated.default_withdrawal_rate).toBe(400);
    expect(updated.default_expected_return).toBe(500);
    expect(updated.sync_version).toBe(1);
  });
});
