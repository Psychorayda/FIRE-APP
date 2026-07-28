import { registerHandler } from './register-handlers.js';
import { createScenario, getScenario, getScenarios, updateScenario } from '@shared/models/scenario.js';
import type { Database as DatabaseType } from 'better-sqlite3';
import type { CreateScenarioInput } from '@shared/models/scenario.js';
import type { FireScenario } from '@shared/types/index.js';

export function registerScenarioHandlers(db: DatabaseType): void {
  registerHandler('db:scenario:create', (_db, input: CreateScenarioInput) => createScenario(_db, input), db);
  registerHandler('db:scenario:get', (_db, id: string) => getScenario(_db, id), db);
  registerHandler('db:scenario:list', (_db, userId: string) => getScenarios(_db, userId), db);
  registerHandler('db:scenario:update', (_db, id: string, updates: Partial<FireScenario>) => updateScenario(_db, id, updates), db);
}
