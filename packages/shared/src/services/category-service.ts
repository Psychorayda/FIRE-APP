// 分类服务 / Category service
// 跨表组合操作（系统分类重置等）

import type { Database as DatabaseType } from 'better-sqlite3';
import { seedCategories } from '../models/category.js';
import { nowMs } from '../utils/time.js';

/**
 * 重置系统分类：事务内软删除现有系统分类 + 重新 seed 18 个内置分类
 * 自定义分类（is_system=0）保留不动
 *
 * Reset system categories: soft-delete existing system categories + re-seed 18 defaults.
 * Custom categories (is_system=0) are preserved.
 */
export function resetSystemCategories(db: DatabaseType, userId: string): void {
  db.transaction(() => {
    db.prepare(
      'UPDATE categories SET deleted_flag = 1, updated_at = ? WHERE user_id = ? AND is_system = 1'
    ).run(nowMs(), userId);
    seedCategories(db, userId);
  })();
}
