import type { Database as DatabaseType } from 'better-sqlite3';
import type { NetWorthSnapshot } from '../types/index.js';

export function getSnapshots(db: DatabaseType, userId: string): NetWorthSnapshot[] {
  return db.prepare('SELECT * FROM net_worth_snapshots WHERE user_id = ? AND deleted_flag = 0 ORDER BY snapshot_date DESC').all(userId) as NetWorthSnapshot[];
}

export function getSnapshotByMonth(db: DatabaseType, userId: string, yearMonth: string): NetWorthSnapshot | null {
  const row = db.prepare('SELECT * FROM net_worth_snapshots WHERE user_id = ? AND snapshot_year_month = ? AND deleted_flag = 0').get(userId, yearMonth) as NetWorthSnapshot | undefined;
  return row ?? null;
}

export function insertSnapshot(db: DatabaseType, snapshot: NetWorthSnapshot): void {
  db.prepare(`INSERT INTO net_worth_snapshots (id, user_id, snapshot_date, snapshot_year_month, total_liquid, total_invested, total_use_asset, total_liability, net_worth, sync_version, updated_at, deleted_flag) VALUES (@id, @user_id, @snapshot_date, @snapshot_year_month, @total_liquid, @total_invested, @total_use_asset, @total_liability, @net_worth, @sync_version, @updated_at, @deleted_flag)`).run(snapshot);
}
