import { registerHandler } from './register-handlers.js';
import { createCategory, getCategory, getCategories, seedCategories } from '@shared/models/category.js';
import type { Database as DatabaseType } from 'better-sqlite3';
import type { CreateCategoryInput } from '@shared/models/category.js';
import type { CategoryType } from '@shared/types/index.js';

export function registerCategoryHandlers(db: DatabaseType): void {
  registerHandler('db:category:create', (_db, input: CreateCategoryInput) => createCategory(_db, input), db);
  registerHandler('db:category:get', (_db, id: string) => getCategory(_db, id), db);
  registerHandler('db:category:list', (_db, userId: string, type?: CategoryType) => getCategories(_db, userId, type), db);
  registerHandler('db:category:seed', (_db, userId: string) => { seedCategories(_db, userId); }, db);
}
