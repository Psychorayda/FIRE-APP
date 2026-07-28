import { registerHandler } from './register-handlers.js';
import { getSnapshots, getSnapshotByMonth } from '@shared/models/snapshot.js';
import { generateMonthlySnapshot } from '@shared/services/snapshot-service.js';
import type { Database as DatabaseType } from 'better-sqlite3';

export function registerSnapshotHandlers(db: DatabaseType): void {
  registerHandler('db:snapshot:list', (_db, userId: string) => getSnapshots(_db, userId), db);
  registerHandler('db:snapshot:getByMonth', (_db, userId: string, yearMonth: string) => getSnapshotByMonth(_db, userId, yearMonth), db);
  registerHandler('db:snapshot:generateMonthly', (_db, userId: string) => generateMonthlySnapshot(_db, userId), db);
}
