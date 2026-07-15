import type { Database as DatabaseType } from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { nowMs, toYearMonth } from '../utils/time.js';
import { getSnapshotByMonth, insertSnapshot } from '../models/snapshot.js';
import type { NetWorthSnapshot } from '../types/index.js';

function summarizeByAssetClass(db: DatabaseType, userId: string): { total_liquid: number; total_invested: number; total_use_asset: number; total_liability: number } {
  const rows = db.prepare(`SELECT asset_class, COALESCE(SUM(current_balance), 0) as total FROM accounts WHERE user_id = ? AND deleted_flag = 0 GROUP BY asset_class`).all(userId) as { asset_class: string; total: number }[];
  const result = { total_liquid: 0, total_invested: 0, total_use_asset: 0, total_liability: 0 };
  for (const row of rows) {
    switch (row.asset_class) {
      case 'liquid': result.total_liquid = row.total; break;
      case 'invested': result.total_invested = row.total; break;
      case 'use_asset': result.total_use_asset = row.total; break;
      case 'liability': result.total_liability = row.total; break;
    }
  }
  return result;
}

export function generateMonthlySnapshot(db: DatabaseType, userId: string): NetWorthSnapshot | null {
  const now = nowMs();
  const yearMonth = toYearMonth(now);
  const existing = getSnapshotByMonth(db, userId, yearMonth);
  if (existing) { return null; }
  const summary = summarizeByAssetClass(db, userId);
  const snapshot: NetWorthSnapshot = {
    id: uuidv4(), user_id: userId, snapshot_date: now, snapshot_year_month: yearMonth,
    total_liquid: summary.total_liquid, total_invested: summary.total_invested,
    total_use_asset: summary.total_use_asset, total_liability: summary.total_liability,
    net_worth: summary.total_liquid + summary.total_invested + summary.total_use_asset + summary.total_liability,
    sync_version: 0, updated_at: now, deleted_flag: 0,
  };
  insertSnapshot(db, snapshot);
  return snapshot;
}

export function getSnapshots(db: DatabaseType, userId: string): NetWorthSnapshot[] {
  return db.prepare('SELECT * FROM net_worth_snapshots WHERE user_id = ? AND deleted_flag = 0 ORDER BY snapshot_date DESC').all(userId) as NetWorthSnapshot[];
}
