import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, closeDatabase } from '../../src/db/connection.js';
import { initSchema } from '../../src/db/schema.js';
import { createUser } from '../../src/models/user.js';
import { createAccount, getAccount } from '../../src/models/account.js';
import { createCategory } from '../../src/models/category.js';
import {
  createRecurring,
  getActiveRecurring,
} from '../../src/models/recurring.js';
import { processRecurringTransactions } from '../../src/services/recurring-service.js';
import { createTransaction } from '../../src/services/transaction-service.js';
import { nowMs, addMonths } from '../../src/utils/time.js';
import type { Database as DatabaseType } from 'better-sqlite3';

describe('recurring service', () => {
  let db: DatabaseType;
  let userId: string;
  let accountId: string;
  let categoryId: string;

  beforeEach(() => {
    db = createDatabase(':memory:');
    initSchema(db);
    userId = 'test-user-id';
    createUser(db, { id: userId, display_name: '测试' });
    const acc = createAccount(db, { user_id: userId, name: '活期', asset_class: 'liquid', account_type: 'checking' });
    accountId = acc.id;
    const cat = createCategory(db, { user_id: userId, name: '工资', type: 'income' });
    categoryId = cat.id;
  });

  afterEach(() => { closeDatabase(db); });

  it('processRecurringTransactions: 到期模板生成交易', () => {
    const pastDate = nowMs() - 100000;
    createRecurring(db, {
      user_id: userId, account_id: accountId, category_id: categoryId,
      transaction_type: 'income', amount: 10000, frequency: 'monthly',
      start_date: pastDate, next_due_date: pastDate,
    });
    const generated = processRecurringTransactions(db, userId);
    expect(generated).toHaveLength(1);
    const acc = getAccount(db, accountId);
    expect(acc!.current_balance).toBe(10000);
  });

  it('processRecurringTransactions: 补生成多月遗漏交易', () => {
    const threeMonthsAgo = addMonths(nowMs(), -3);
    createRecurring(db, {
      user_id: userId, account_id: accountId, category_id: categoryId,
      transaction_type: 'income', amount: 5000, frequency: 'monthly',
      start_date: threeMonthsAgo, next_due_date: threeMonthsAgo,
    });
    const generated = processRecurringTransactions(db, userId);
    expect(generated.length).toBeGreaterThanOrEqual(3);
    expect(generated.length).toBeLessThanOrEqual(4);
    const acc = getAccount(db, accountId);
    expect(acc!.current_balance).toBe(5000 * generated.length);
  });

  it('processRecurringTransactions: 未到期 → 不生成', () => {
    const futureDate = nowMs() + 100000000;
    createRecurring(db, {
      user_id: userId, account_id: accountId, category_id: categoryId,
      transaction_type: 'income', amount: 10000, frequency: 'monthly',
      start_date: futureDate, next_due_date: futureDate,
    });
    const generated = processRecurringTransactions(db, userId);
    expect(generated).toHaveLength(0);
  });

  it('processRecurringTransactions: end_date过期 → 设为inactive', () => {
    const pastDate = nowMs() - 100000;
    const recentEndDate = nowMs() - 50000;
    createRecurring(db, {
      user_id: userId, account_id: accountId, category_id: categoryId,
      transaction_type: 'income', amount: 10000, frequency: 'monthly',
      start_date: pastDate, end_date: recentEndDate, next_due_date: pastDate,
    });
    processRecurringTransactions(db, userId);
    const templates = getActiveRecurring(db, userId);
    expect(templates).toHaveLength(0);
  });

  it('processRecurringTransactions: 暂停模板不生成', () => {
    const pastDate = nowMs() - 100000;
    createRecurring(db, {
      user_id: userId, account_id: accountId, category_id: categoryId,
      transaction_type: 'income', amount: 10000, frequency: 'monthly',
      start_date: pastDate, next_due_date: pastDate, is_active: 0,
    });
    const generated = processRecurringTransactions(db, userId);
    expect(generated).toHaveLength(0);
    const acc = getAccount(db, accountId);
    expect(acc!.current_balance).toBe(0);
  });

  it('processRecurringTransactions: 转账模板正确生成', () => {
    const toAcc = createAccount(db, { user_id: userId, name: '基金', asset_class: 'invested', account_type: 'fund' });
    const pastDate = nowMs() - 100000;
    // 使用 createTransaction 给源账户充值（确保余额正确更新）
    createTransaction(db, {
      user_id: userId, account_id: accountId, category_id: categoryId,
      transaction_type: 'income', amount: 100000, transaction_date: 50000,
    });
    createRecurring(db, {
      user_id: userId, account_id: accountId, to_account_id: toAcc.id,
      transaction_type: 'transfer', amount: 5000, frequency: 'monthly',
      start_date: pastDate, next_due_date: pastDate,
    });
    const generated = processRecurringTransactions(db, userId);
    expect(generated).toHaveLength(1);
    const source = getAccount(db, accountId);
    const target = getAccount(db, toAcc.id);
    expect(source!.current_balance).toBe(95000);
    expect(target!.current_balance).toBe(5000);
  });
});
