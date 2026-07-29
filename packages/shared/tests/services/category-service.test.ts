import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, closeDatabase } from '../../src/db/connection.js';
import { initSchema } from '../../src/db/schema.js';
import { createUser } from '../../src/models/user.js';
import { seedCategories, getCategories, createCategory } from '../../src/models/category.js';
import { resetSystemCategories } from '../../src/services/category-service.js';
import type { Database as DatabaseType } from 'better-sqlite3';

describe('category service', () => {
  let db: DatabaseType;
  let userId: string;

  beforeEach(() => {
    db = createDatabase(':memory:');
    initSchema(db);
    userId = 'test-user-id';
    createUser(db, { id: userId, display_name: '测试' });
  });

  afterEach(() => { closeDatabase(db); });

  it('resetSystemCategories: 软删除旧系统分类并重新 seed 18 个', () => {
    seedCategories(db, userId);
    const cats = getCategories(db, userId);
    expect(cats.length).toBe(18);

    resetSystemCategories(db, userId);

    const after = getCategories(db, userId);
    expect(after.length).toBe(18);
    expect(after.every((c) => c.is_system === 1 && c.deleted_flag === 0)).toBe(true);
    const expenses = after.filter((c) => c.type === 'expense');
    const incomes = after.filter((c) => c.type === 'income');
    expect(expenses.length).toBe(11);
    expect(incomes.length).toBe(7);
  });

  it('resetSystemCategories: 保留自定义分类', () => {
    seedCategories(db, userId);
    createCategory(db, {
      user_id: userId,
      name: '我的自定义分类',
      type: 'expense',
    });
    expect(getCategories(db, userId).length).toBe(19);

    resetSystemCategories(db, userId);

    const after = getCategories(db, userId);
    expect(after.length).toBe(19);
    const custom = after.find((c) => c.name === '我的自定义分类');
    expect(custom).toBeDefined();
    expect(custom!.is_system).toBe(0);
  });

  it('resetSystemCategories: 旧系统分类被软删除', () => {
    seedCategories(db, userId);

    resetSystemCategories(db, userId);

    const allRows = db.prepare(
      'SELECT * FROM categories WHERE user_id = ? AND is_system = 1'
    ).all(userId) as { deleted_flag: number }[];
    const deletedOld = allRows.filter((r) => r.deleted_flag === 1);
    expect(deletedOld.length).toBe(18);
  });
});
