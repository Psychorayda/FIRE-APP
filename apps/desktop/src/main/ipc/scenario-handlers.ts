import { registerHandler } from './register-handlers.js';
import { updateScenarioSchema } from './schemas.js';
import { createScenario, getScenario, getScenarios, updateScenario } from '@shared/models/scenario.js';
import type { Database as DatabaseType } from 'better-sqlite3';
import type { CreateScenarioInput } from '@shared/models/scenario.js';
import type { FireScenario } from '@shared/types/index.js';

export function registerScenarioHandlers(db: DatabaseType): void {
  registerHandler('db:scenario:create', (_db, input: CreateScenarioInput) => createScenario(_db, input), db);
  registerHandler('db:scenario:get', (_db, id: string) => getScenario(_db, id), db);
  registerHandler('db:scenario:list', (_db, userId: string) => getScenarios(_db, userId), db);
  // 更新路径接入 zod 校验：剔除 user_id / sync_version 等不可信字段，防止渲染层篡改
  // Update path wired through zod: strips untrusted fields (user_id / sync_version)
  // to prevent renderer-side tampering.
  registerHandler('db:scenario:update', (_db, id: string, updates: Partial<FireScenario>) => {
    const safe = updateScenarioSchema.parse(updates);
    return updateScenario(_db, id, safe);
  }, db);
}
