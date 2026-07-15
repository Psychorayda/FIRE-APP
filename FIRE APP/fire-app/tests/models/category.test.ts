// tests/models/category.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, closeDatabase } from '../../src/db/connection.js';
import { initSchema } from '../../src/db/schema.js';
import { createUser } from '../../src/models/user.js';
import {
  createCategory,
  getCategories,
  getCategory,
  seedCategories,
} from '../../src/models/category.js';
import type { Database as DatabaseType } from 'better-sqlite3';

describe('category model', () => {
  let db: DatabaseType;
  const userId = 'test-user-id';

  beforeEach(() => {
    db = createDatabase(':memory:');
    initSchema(db);
    createUser(db, { id: userId, display_name: '测试' });
  });

  afterEach(() => {
    closeDatabase(db);
  });

  it('createCategory: 创建自定义分类', () => {
    const cat = createCategory(db, {
      user_id: userId,
      name: '咖啡',
      type: 'expense',
    });
    expect(cat.id).toBeDefined();
    expect(cat.name).toBe('咖啡');
    expect(cat.type).toBe('expense');
    expect(cat.is_system).toBe(0);
  });

  it('createCategory: 创建子分类', () => {
    const parent = createCategory(db, { user_id: userId, name: '食品', type: 'expense' });
    const child = createCategory(db, {
      user_id: userId,
      name: '日用品',
      type: 'expense',
      parent_id: parent.id,
    });
    expect(child.parent_id).toBe(parent.id);
  });

  it('getCategories: 返回所有非删除分类', () => {
    createCategory(db, { user_id: userId, name: '住房', type: 'expense' });
    createCategory(db, { user_id: userId, name: '食品', type: 'expense' });
    createCategory(db, { user_id: userId, name: '工资', type: 'income' });
    const cats = getCategories(db, userId);
    expect(cats).toHaveLength(3);
  });

  it('getCategories: 按type过滤', () => {
    createCategory(db, { user_id: userId, name: '住房', type: 'expense' });
    createCategory(db, { user_id: userId, name: '工资', type: 'income' });
    const expenses = getCategories(db, userId, 'expense');
    expect(expenses).toHaveLength(1);
    expect(expenses[0].name).toBe('住房');
  });

  it('getCategory: 读取单个分类', () => {
    const created = createCategory(db, { user_id: userId, name: '交通', type: 'expense' });
    const cat = getCategory(db, created.id);
    expect(cat).not.toBeNull();
    expect(cat!.name).toBe('交通');
  });

  it('seedCategories: 创建18个标准分类', () => {
    seedCategories(db, userId);
    const cats = getCategories(db, userId);
    // 11个支出 + 7个收入 = 18
    expect(cats).toHaveLength(18);
    const expenses = cats.filter(c => c.type === 'expense');
    const incomes = cats.filter(c => c.type === 'income');
    expect(expenses).toHaveLength(11);
    expect(incomes).toHaveLength(7);
  });

  it('seedCategories: 保险分类关联 insurance_planning', () => {
    seedCategories(db, userId);
    const cats = getCategories(db, userId);
    const insurance = cats.find(c => c.name === '保险');
    expect(insurance).toBeDefined();
    expect(insurance!.linked_fire_concept).toBe('insurance_planning');
  });

  it('seedCategories: 医疗分类关联 china_medical_insurance', () => {
    seedCategories(db, userId);
    const cats = getCategories(db, userId);
    const medical = cats.find(c => c.name === '医疗');
    expect(medical).toBeDefined();
    expect(medical!.linked_fire_concept).toBe('china_medical_insurance');
  });

  it('seedCategories: 社保养老金关联 china_pension_system', () => {
    seedCategories(db, userId);
    const cats = getCategories(db, userId);
    const pension = cats.find(c => c.name === '社保养老金');
    expect(pension).toBeDefined();
    expect(pension!.linked_fire_concept).toBe('china_pension_system');
  });

  it('seedCategories: 系统分类标记 is_system=1', () => {
    seedCategories(db, userId);
    const cats = getCategories(db, userId);
    expect(cats.every(c => c.is_system === 1)).toBe(true);
  });
});
