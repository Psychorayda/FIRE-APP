import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, closeDatabase } from '../../src/db/connection.js';
import { initSchema } from '../../src/db/schema.js';
import { createUser } from '../../src/models/user.js';
import { createAccount } from '../../src/models/account.js';
import { createTransaction } from '../../src/services/transaction-service.js';
import { getTransactionsPage, getRecentTransactions, getMonthlyOverview } from '../../src/models/transaction-queries.js';
import type { Database as DatabaseType } from 'better-sqlite3';

describe('transaction-queries', () => {
  let db: DatabaseType;
  let userId: string;
  let accountId: string;

  beforeEach(() => {
    db = createDatabase(':memory:');
    initSchema(db);
    userId = 'u1';
    createUser(db, { id: userId, display_name: '测试' });
    const acc = createAccount(db, { user_id: userId, name: '招行', asset_class: 'liquid', account_type: 'checking' });
    accountId = acc.id;
    // 生成 25 条交易：5 收 + 20 支，日期跨 2 个月
    for (let i = 0; i < 5; i++) {
      createTransaction(db, { user_id: userId, account_id: accountId, category_id: null, transaction_type: 'income', amount: 10000, transaction_date: 1700000000000 + i * 86400000 });
    }
    // 1701388800000 = 2023-12-01 00:00:00 UTC，确保 20 条支出全部落在 2023-12
    for (let i = 0; i < 20; i++) {
      createTransaction(db, { user_id: userId, account_id: accountId, category_id: null, transaction_type: 'expense', amount: 1000 + i * 100, transaction_date: 1701388800000 + i * 86400000 });
    }
  });
  afterEach(() => closeDatabase(db));

  it('getTransactionsPage: limit + offset 分页', () => {
    const page1 = getTransactionsPage(db, userId, { limit: 10, offset: 0 });
    expect(page1.items).toHaveLength(10);
    expect(page1.total).toBe(25);
    const page3 = getTransactionsPage(db, userId, { limit: 10, offset: 20 });
    expect(page3.items).toHaveLength(5);
  });

  it('getTransactionsPage: type 筛选下推', () => {
    const result = getTransactionsPage(db, userId, { limit: 100, offset: 0, type: 'income' });
    expect(result.items).toHaveLength(5);
    expect(result.total).toBe(5);
    expect(result.items.every(t => t.transaction_type === 'income')).toBe(true);
  });

  it('getTransactionsPage: dateFrom/dateTo 筛选', () => {
    const result = getTransactionsPage(db, userId, { limit: 100, offset: 0, dateFrom: 1700000000000, dateTo: 1700000000000 + 4 * 86400000 });
    expect(result.items.every(t => t.transaction_date >= 1700000000000 && t.transaction_date <= 1700000000000 + 4 * 86400000)).toBe(true);
  });

  it('getRecentTransactions: LIMIT N', () => {
    const recent = getRecentTransactions(db, userId, 5);
    expect(recent).toHaveLength(5);
    // 按日期倒序
    for (let i = 1; i < recent.length; i++) {
      expect(recent[i].transaction_date).toBeLessThanOrEqual(recent[i - 1].transaction_date);
    }
  });

  it('getMonthlyOverview: 聚合月度收支', () => {
    // 第一批 income 在 2023-11 (1700000000000 = 2023-11-14)
    const overview = getMonthlyOverview(db, userId, '2023-11');
    expect(overview.income).toBe(5 * 10000);
    expect(overview.expense).toBe(0); // expense 全部在 2023-12
  });
});
