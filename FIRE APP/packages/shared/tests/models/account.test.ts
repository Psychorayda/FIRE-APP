// tests/models/account.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, closeDatabase } from '../../src/db/connection.js';
import { initSchema } from '../../src/db/schema.js';
import { createUser } from '../../src/models/user.js';
import {
  createAccount,
  getAccount,
  getAccounts,
  getInvestableBalance,
  getNetWorth,
  softDeleteAccount,
  hasTransactions,
  updateAccountBalance,
  updateAccount,
} from '../../src/models/account.js';
import type { Database as DatabaseType } from 'better-sqlite3';

describe('account model', () => {
  let db: DatabaseType;
  const userId = 'test-user-id';

  beforeEach(() => {
    db = createDatabase(':memory:');
    initSchema(db);
    createUser(db, { id: userId, display_name: '测试' });
  });

  afterEach(() => {
    closeDatabase(db);
  });

  it('createAccount: 创建活期账户，余额0', () => {
    const acc = createAccount(db, {
      user_id: userId,
      name: '招商活期',
      asset_class: 'liquid',
      account_type: 'checking',
    });
    expect(acc.id).toBeDefined();
    expect(acc.current_balance).toBe(0);
    expect(acc.asset_class).toBe('liquid');
    expect(acc.account_type).toBe('checking');
  });

  it('createAccount: 创建投资账户带初始余额', () => {
    const acc = createAccount(db, {
      user_id: userId,
      name: '券商账户',
      asset_class: 'invested',
      account_type: 'investment',
      initial_balance: 500000,
    });
    expect(acc.current_balance).toBe(500000);
  });

  it('createAccount: 创建负债账户', () => {
    const acc = createAccount(db, {
      user_id: userId,
      name: '信用卡',
      asset_class: 'liability',
      account_type: 'credit_card',
      initial_balance: -20000,
    });
    expect(acc.current_balance).toBe(-20000);
  });

  it('getAccount: 读取单个账户', () => {
    const created = createAccount(db, {
      user_id: userId,
      name: '测试',
      asset_class: 'liquid',
      account_type: 'savings',
    });
    const acc = getAccount(db, created.id);
    expect(acc).not.toBeNull();
    expect(acc!.name).toBe('测试');
  });

  it('getAccounts: 返回用户所有账户', () => {
    createAccount(db, { user_id: userId, name: 'A', asset_class: 'liquid', account_type: 'checking' });
    createAccount(db, { user_id: userId, name: 'B', asset_class: 'invested', account_type: 'fund' });
    const accs = getAccounts(db, userId);
    expect(accs).toHaveLength(2);
  });

  it('updateAccountBalance: 更新余额和last_updated', () => {
    const acc = createAccount(db, {
      user_id: userId,
      name: '测试',
      asset_class: 'liquid',
      account_type: 'checking',
    });
    updateAccountBalance(db, acc.id, 100000);
    const updated = getAccount(db, acc.id);
    expect(updated!.current_balance).toBe(100000);
  });

  it('getInvestableBalance: 只汇总 liquid + invested', () => {
    createAccount(db, { user_id: userId, name: '活期', asset_class: 'liquid', account_type: 'checking', initial_balance: 100000 });
    createAccount(db, { user_id: userId, name: '基金', asset_class: 'invested', account_type: 'fund', initial_balance: 300000 });
    createAccount(db, { user_id: userId, name: '房产', asset_class: 'use_asset', account_type: 'real_estate', initial_balance: 2000000 });
    createAccount(db, { user_id: userId, name: '信用卡', asset_class: 'liability', account_type: 'credit_card', initial_balance: -10000 });

    const investable = getInvestableBalance(db, userId);
    expect(investable).toBe(400000); // 100000 + 300000
  });

  it('getNetWorth: 所有账户余额之和', () => {
    createAccount(db, { user_id: userId, name: '活期', asset_class: 'liquid', account_type: 'checking', initial_balance: 100000 });
    createAccount(db, { user_id: userId, name: '房产', asset_class: 'use_asset', account_type: 'real_estate', initial_balance: 2000000 });
    createAccount(db, { user_id: userId, name: '信用卡', asset_class: 'liability', account_type: 'credit_card', initial_balance: -50000 });

    const netWorth = getNetWorth(db, userId);
    expect(netWorth).toBe(2050000); // 100000 + 2000000 - 50000
  });

  it('hasTransactions: 无交易 → false', () => {
    const acc = createAccount(db, { user_id: userId, name: '测试', asset_class: 'liquid', account_type: 'checking' });
    expect(hasTransactions(db, acc.id)).toBe(false);
  });

  it('hasTransactions: 有交易 → true', () => {
    const acc = createAccount(db, { user_id: userId, name: '测试', asset_class: 'liquid', account_type: 'checking' });
    // 直接插入一条交易记录模拟
    db.prepare(`
      INSERT INTO transactions (id, user_id, account_id, transaction_type, amount, transaction_date,
        sync_version, updated_at, deleted_flag)
      VALUES ('tx1', ?, ?, 'income', 100, 1000, 0, 1000, 0)
    `).run(userId, acc.id);
    expect(hasTransactions(db, acc.id)).toBe(true);
  });

  it('softDeleteAccount: 有关联交易 → 抛出错误', () => {
    const acc = createAccount(db, { user_id: userId, name: '测试', asset_class: 'liquid', account_type: 'checking' });
    db.prepare(`
      INSERT INTO transactions (id, user_id, account_id, transaction_type, amount, transaction_date,
        sync_version, updated_at, deleted_flag)
      VALUES ('tx1', ?, ?, 'income', 100, 1000, 0, 1000, 0)
    `).run(userId, acc.id);
    expect(() => softDeleteAccount(db, acc.id)).toThrow(/有关联交易/);
  });

  it('softDeleteAccount: 无关联交易 → 成功', () => {
    const acc = createAccount(db, { user_id: userId, name: '测试', asset_class: 'liquid', account_type: 'checking' });
    softDeleteAccount(db, acc.id);
    const deleted = getAccount(db, acc.id);
    expect(deleted).toBeNull(); // 软删除后查询返回null
  });

  it('updateAccount: 更新名称 → 返回更新后的 Account', () => {
    const acc = createAccount(db, {
      user_id: userId, name: '测试', asset_class: 'liquid', account_type: 'checking',
    });
    const updated = updateAccount(db, acc.id, { name: '新名称' });
    expect(updated.name).toBe('新名称');
    expect(updated.id).toBe(acc.id);
  });

  it('updateAccount: 更新多个字段 → 所有字段更新 + sync_version 递增', () => {
    const acc = createAccount(db, {
      user_id: userId, name: '测试', asset_class: 'liquid', account_type: 'checking',
    });
    const updated = updateAccount(db, acc.id, {
      name: '基金账户', asset_class: 'invested', account_type: 'fund', note: '长期持有',
    });
    expect(updated.name).toBe('基金账户');
    expect(updated.asset_class).toBe('invested');
    expect(updated.account_type).toBe('fund');
    expect(updated.note).toBe('长期持有');
    expect(updated.sync_version).toBe(acc.sync_version + 1);
  });

  it('updateAccount: 空输入 → 返回原 Account 不变', () => {
    const acc = createAccount(db, {
      user_id: userId, name: '测试', asset_class: 'liquid', account_type: 'checking',
    });
    const updated = updateAccount(db, acc.id, {});
    expect(updated.name).toBe('测试');
    expect(updated.sync_version).toBe(acc.sync_version);
  });

  it('updateAccount: 不存在的 ID → 抛出错误', () => {
    expect(() => updateAccount(db, 'nonexistent-id', { name: 'x' })).toThrow(/Account not found/);
  });
});
