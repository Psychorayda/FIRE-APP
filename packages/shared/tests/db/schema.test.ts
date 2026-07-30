// tests/db/schema.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, closeDatabase } from '../../src/db/connection.js';
import { initSchema, TABLE_NAMES } from '../../src/db/schema.js';
import { createUser } from '../../src/models/user.js';
import { createAccount } from '../../src/models/account.js';
import type { Database as DatabaseType } from 'better-sqlite3';

describe('schema', () => {
  let db: DatabaseType;

  beforeEach(() => {
    db = createDatabase(':memory:');
    initSchema(db);
  });

  afterEach(() => {
    closeDatabase(db);
  });

  it('initSchema: 7张表全部创建', () => {
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all() as { name: string }[];
    const tableNames = tables.map(t => t.name);

    expect(tableNames).toContain('users');
    expect(tableNames).toContain('accounts');
    expect(tableNames).toContain('transactions');
    expect(tableNames).toContain('categories');
    expect(tableNames).toContain('recurring_transactions');
    expect(tableNames).toContain('net_worth_snapshots');
    expect(tableNames).toContain('fire_scenarios');
  });

  it('TABLE_NAMES: 包含所有7张表名', () => {
    expect(TABLE_NAMES).toHaveLength(7);
    expect(TABLE_NAMES).toContain('users');
    expect(TABLE_NAMES).toContain('accounts');
    expect(TABLE_NAMES).toContain('transactions');
    expect(TABLE_NAMES).toContain('categories');
    expect(TABLE_NAMES).toContain('recurring_transactions');
    expect(TABLE_NAMES).toContain('net_worth_snapshots');
    expect(TABLE_NAMES).toContain('fire_scenarios');
  });

  it('users表: 字段完整', () => {
    const cols = db.prepare("PRAGMA table_info('users')").all() as { name: string }[];
    const colNames = cols.map(c => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('display_name');
    expect(colNames).toContain('base_currency');
    expect(colNames).toContain('is_china_market');
    expect(colNames).toContain('default_withdrawal_rate');
    expect(colNames).toContain('default_expected_return');
    expect(colNames).toContain('default_inflation_rate');
    expect(colNames).toContain('encryption_key_hash');
    expect(colNames).toContain('last_sync_at');
    expect(colNames).toContain('sync_version');
    expect(colNames).toContain('updated_at');
    expect(colNames).toContain('deleted_flag');
  });

  it('accounts表: asset_class 和 account_type 字段存在', () => {
    const cols = db.prepare("PRAGMA table_info('accounts')").all() as { name: string }[];
    const colNames = cols.map(c => c.name);
    expect(colNames).toContain('asset_class');
    expect(colNames).toContain('account_type');
    expect(colNames).toContain('current_balance');
  });

  it('transactions表: transaction_type 和 to_account_id 字段存在', () => {
    const cols = db.prepare("PRAGMA table_info('transactions')").all() as { name: string }[];
    const colNames = cols.map(c => c.name);
    expect(colNames).toContain('transaction_type');
    expect(colNames).toContain('to_account_id');
    expect(colNames).toContain('recurring_id');
  });

  it('net_worth_snapshots表: snapshot_year_month 字段存在', () => {
    const cols = db.prepare("PRAGMA table_info('net_worth_snapshots')").all() as { name: string }[];
    const colNames = cols.map(c => c.name);
    expect(colNames).toContain('snapshot_year_month');
    expect(colNames).toContain('total_liquid');
    expect(colNames).toContain('total_invested');
    expect(colNames).toContain('total_use_asset');
    expect(colNames).toContain('total_liability');
    expect(colNames).toContain('net_worth');
  });

  it('fire_scenarios表: 完整参数字段', () => {
    const cols = db.prepare("PRAGMA table_info('fire_scenarios')").all() as { name: string }[];
    const colNames = cols.map(c => c.name);
    expect(colNames).toContain('current_age');
    expect(colNames).toContain('retirement_age');
    expect(colNames).toContain('auto_sync_assets');
    expect(colNames).toContain('monthly_savings');
    expect(colNames).toContain('annual_expenses');
    expect(colNames).toContain('withdrawal_rate');
    expect(colNames).toContain('post_retirement_monthly_income');
  });

  it('索引: transactions 表有4个索引', () => {
    const indexes = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='transactions'"
    ).all() as { name: string }[];
    const indexNames = indexes.map(i => i.name);
    expect(indexNames).toContain('idx_tx_user_date');
    expect(indexNames).toContain('idx_tx_account');
    expect(indexNames).toContain('idx_tx_category');
    expect(indexNames).toContain('idx_tx_recurring');
  });

  it('net_worth_snapshots: 唯一约束 (user_id, snapshot_year_month)', () => {
    // 外键约束已开启，需先插入一条 users 记录以满足 net_worth_snapshots.user_id 外键
    db.prepare(`
      INSERT INTO users (id, display_name, updated_at)
      VALUES ('u1', 'tester', 1000)
    `).run();

    // 插入第一条 → 成功
    db.prepare(`
      INSERT INTO net_worth_snapshots (id, user_id, snapshot_date, snapshot_year_month,
        total_liquid, total_invested, total_use_asset, total_liability, net_worth,
        sync_version, updated_at, deleted_flag)
      VALUES ('s1', 'u1', 1000, '2026-07', 100, 200, 300, -50, 550, 0, 1000, 0)
    `).run();

    // 插入同月第二条 → 应失败
    expect(() => {
      db.prepare(`
        INSERT INTO net_worth_snapshots (id, user_id, snapshot_date, snapshot_year_month,
          total_liquid, total_invested, total_use_asset, total_liability, net_worth,
          sync_version, updated_at, deleted_flag)
        VALUES ('s2', 'u1', 2000, '2026-07', 100, 200, 300, -50, 550, 0, 2000, 0)
      `).run();
    }).toThrow();
  });

  // ===== CHECK 约束 / CHECK constraints (Task D4) =====
  describe('CHECK constraints', () => {
    let userId: string;
    let accountId: string;

    beforeEach(() => {
      userId = 'check-user-id';
      createUser(db, { id: userId, display_name: 'CHECK 测试' });
      const acc = createAccount(db, {
        user_id: userId, name: '活期', asset_class: 'liquid', account_type: 'checking',
      });
      accountId = acc.id;
    });

    it('transactions: transfer 无 to_account_id 被拒绝', () => {
      expect(() => {
        db.prepare(`INSERT INTO transactions (id, user_id, account_id, transaction_type, amount, transaction_date, description, sync_version, updated_at, deleted_flag) VALUES (?, ?, ?, 'transfer', 1000, 1000, NULL, 0, 0, 0)`).run('tx1', userId, accountId);
      }).toThrow(/CHECK constraint failed/);
    });

    it('transactions: transfer to_account_id == account_id 被拒绝', () => {
      expect(() => {
        db.prepare(`INSERT INTO transactions (id, user_id, account_id, to_account_id, transaction_type, amount, transaction_date, description, sync_version, updated_at, deleted_flag) VALUES (?, ?, ?, ?, 'transfer', 1000, 1000, NULL, 0, 0, 0)`).run('tx2', userId, accountId, accountId);
      }).toThrow(/CHECK constraint failed/);
    });

    it('recurring_transactions: interval=0 被拒绝', () => {
      expect(() => {
        db.prepare(`INSERT INTO recurring_transactions (id, user_id, account_id, transaction_type, amount, frequency, interval, start_date, next_due_date, sync_version, updated_at, deleted_flag) VALUES (?, ?, ?, 'income', 1000, 'monthly', 0, 1000, 1000, 0, 0, 0)`).run('r1', userId, accountId);
      }).toThrow(/CHECK constraint failed/);
    });

    it('accounts: liability 正余额被拒绝', () => {
      expect(() => {
        db.prepare(`INSERT INTO accounts (id, user_id, name, asset_class, account_type, current_balance, last_updated, sync_version, updated_at, deleted_flag) VALUES (?, ?, ?, 'liability', 'credit_card', 5000, 0, 0, 0, 0)`).run('acc-liab', userId, '信用卡');
      }).toThrow(/CHECK constraint failed/);
    });
  });
});
