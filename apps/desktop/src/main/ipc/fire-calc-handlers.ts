import { registerHandler } from './register-handlers.js';
import { runProjection } from '@shared/services/fire-calc.js';
import type { Database as DatabaseType } from 'better-sqlite3';
import type { FireScenario } from '@shared/types/index.js';

export function registerFireCalcHandlers(db: DatabaseType): void {
  registerHandler('db:fireCalc:runProjection', (_db, scenario: FireScenario) => runProjection(_db, scenario), db);
}
