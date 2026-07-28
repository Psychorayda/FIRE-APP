// src/models/category.ts
import type { Database as DatabaseType } from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { nowMs } from '../utils/time.js';
import type { Category, CategoryType } from '../types/index.js';

export interface CreateCategoryInput {
  user_id: string;
  parent_id?: string | null;
  name: string;
  type: CategoryType;
  icon?: string | null;
  color?: string | null;
  linked_fire_concept?: string | null;
  display_order?: number;
}

const SEED_CATEGORIES: { name: string; type: CategoryType; linked_fire_concept?: string }[] = [
  // 支出分类 (11)
  { name: '住房', type: 'expense' },
  { name: '食品', type: 'expense' },
  { name: '交通', type: 'expense' },
  { name: '保险', type: 'expense', linked_fire_concept: 'insurance_planning' },
  { name: '医疗', type: 'expense', linked_fire_concept: 'china_medical_insurance' },
  { name: '娱乐', type: 'expense' },
  { name: '购物', type: 'expense' },
  { name: '个人护理', type: 'expense' },
  { name: '教育', type: 'expense' },
  { name: '债务还款', type: 'expense', linked_fire_concept: 'debt_management' },
  { name: '其他支出', type: 'expense' },
  // 收入分类 (7)
  { name: '工资薪金', type: 'income' },
  { name: '自由职业', type: 'income' },
  { name: '投资收益', type: 'income' },
  { name: '租金收入', type: 'income', linked_fire_concept: 'retirement_income_diversification' },
  { name: '退税', type: 'income' },
  { name: '社保养老金', type: 'income', linked_fire_concept: 'china_pension_system' },
  { name: '其他收入', type: 'income' },
];

export function createCategory(db: DatabaseType, input: CreateCategoryInput): Category {
  const id = uuidv4();
  const now = nowMs();

  const category: Category = {
    id,
    user_id: input.user_id,
    parent_id: input.parent_id ?? null,
    name: input.name,
    type: input.type,
    icon: input.icon ?? null,
    color: input.color ?? null,
    linked_fire_concept: input.linked_fire_concept ?? null,
    display_order: input.display_order ?? 0,
    is_system: 0,
    sync_version: 0,
    updated_at: now,
    deleted_flag: 0,
  };

  db.prepare(`
    INSERT INTO categories (id, user_id, parent_id, name, type, icon, color,
      linked_fire_concept, display_order, is_system, sync_version, updated_at, deleted_flag)
    VALUES (@id, @user_id, @parent_id, @name, @type, @icon, @color,
      @linked_fire_concept, @display_order, @is_system, @sync_version, @updated_at, @deleted_flag)
  `).run(category);

  return category;
}

export function getCategory(db: DatabaseType, id: string): Category | null {
  const row = db.prepare(
    'SELECT * FROM categories WHERE id = ? AND deleted_flag = 0'
  ).get(id) as Category | undefined;
  return row ?? null;
}

export function getCategories(
  db: DatabaseType,
  userId: string,
  type?: CategoryType
): Category[] {
  if (type) {
    return db.prepare(
      'SELECT * FROM categories WHERE user_id = ? AND type = ? AND deleted_flag = 0 ORDER BY display_order, name'
    ).all(userId, type) as Category[];
  }
  return db.prepare(
    'SELECT * FROM categories WHERE user_id = ? AND deleted_flag = 0 ORDER BY display_order, name'
  ).all(userId) as Category[];
}

export function seedCategories(db: DatabaseType, userId: string): void {
  const now = nowMs();
  const insert = db.prepare(`
    INSERT INTO categories (id, user_id, parent_id, name, type, icon, color,
      linked_fire_concept, display_order, is_system, sync_version, updated_at, deleted_flag)
    VALUES (@id, @user_id, @parent_id, @name, @type, @icon, @color,
      @linked_fire_concept, @display_order, @is_system, @sync_version, @updated_at, @deleted_flag)
  `);

  SEED_CATEGORIES.forEach((seed, index) => {
    insert.run({
      id: uuidv4(),
      user_id: userId,
      parent_id: null,
      name: seed.name,
      type: seed.type,
      icon: null,
      color: null,
      linked_fire_concept: seed.linked_fire_concept ?? null,
      display_order: index,
      is_system: 1,
      sync_version: 0,
      updated_at: now,
      deleted_flag: 0,
    });
  });
}
