import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, closeDatabase } from '../../src/db/connection.js';
import { initSchema } from '../../src/db/schema.js';
import { createUser } from '../../src/models/user.js';
import { createAccount } from '../../src/models/account.js';
import { generateMonthlySnapshot } from '../../src/services/snapshot-service.js';
import { getSnapshots } from '../../src/models/snapshot.js';
import type { Database as DatabaseType } from 'better-sqlite3';

describe('snapshot service', () => {
  let db: DatabaseType;
  let userId: string;

  beforeEach(() => {
    db = createDatabase(':memory:');
    initSchema(db);
    userId = 'test-user-id';
    createUser(db, { id: userId, display_name: '测试' });
  });

  afterEach(() => { closeDatabase(db); });

  it('generateMonthlySnapshot: 首次生成快照', () => {
    createAccount(db, { user_id: userId, name: '活期', asset_class: 'liquid', account_type: 'checking', initial_balance: 100000 });
    createAccount(db, { user_id: userId, name: '基金', asset_class: 'invested', account_type: 'fund', initial_balance: 300000 });
    createAccount(db, { user_id: userId, name: '房产', asset_class: 'use_asset', account_type: 'real_estate', initial_balance: 2000000 });
    createAccount(db, { user_id: userId, name: '信用卡', asset_class: 'liability', account_type: 'credit_card', initial_balance: -50000 });
    const snapshot = generateMonthlySnapshot(db, userId);
    expect(snapshot).not.toBeNull();
    expect(snapshot!.total_liquid).toBe(100000);
    expect(snapshot!.total_invested).toBe(300000);
    expect(snapshot!.total_use_asset).toBe(2000000);
    expect(snapshot!.total_liability).toBe(-50000);
    expect(snapshot!.net_worth).toBe(2350000);
  });

  it('generateMonthlySnapshot: 同月重复调用 → 返回null', () => {
    createAccount(db, { user_id: userId, name: '活期', asset_class: 'liquid', account_type: 'checking', initial_balance: 100000 });
    const first = generateMonthlySnapshot(db, userId);
    expect(first).not.toBeNull();
    const second = generateMonthlySnapshot(db, userId);
    expect(second).toBeNull();
  });

  it('generateMonthlySnapshot: 无账户 → 净资产0', () => {
    const snapshot = generateMonthlySnapshot(db, userId);
    expect(snapshot).not.toBeNull();
    expect(snapshot!.net_worth).toBe(0);
    expect(snapshot!.total_liquid).toBe(0);
    expect(snapshot!.total_invested).toBe(0);
  });

  it('getSnapshots: 返回按日期降序', () => {
    createAccount(db, { user_id: userId, name: '活期', asset_class: 'liquid', account_type: 'checking', initial_balance: 100000 });
    db.prepare(`INSERT INTO net_worth_snapshots (id, user_id, snapshot_date, snapshot_year_month, total_liquid, total_invested, total_use_asset, total_liability, net_worth, sync_version, updated_at, deleted_flag) VALUES ('old1', ?, 1000000, '2026-01', 50000, 0, 0, 0, 50000, 0, 1000000, 0)`).run(userId);
    db.prepare(`INSERT INTO net_worth_snapshots (id, user_id, snapshot_date, snapshot_year_month, total_liquid, total_invested, total_use_asset, total_liability, net_worth, sync_version, updated_at, deleted_flag) VALUES ('old2', ?, 2000000, '2026-03', 80000, 0, 0, 0, 80000, 0, 2000000, 0)`).run(userId);
    generateMonthlySnapshot(db, userId);
    const snapshots = getSnapshots(db, userId);
    expect(snapshots.length).toBeGreaterThanOrEqual(3);
    expect(snapshots[0].snapshot_date).toBeGreaterThanOrEqual(snapshots[1].snapshot_date);
  });

  it('getSnapshots: snapshot_year_month 格式正确', () => {
    createAccount(db, { user_id: userId, name: '活期', asset_class: 'liquid', account_type: 'checking', initial_balance: 100000 });
    const snapshot = generateMonthlySnapshot(db, userId);
    expect(snapshot!.snapshot_year_month).toMatch(/^\d{4}-\d{2}$/);
  });
});
