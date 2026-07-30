import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, closeDatabase } from '../../src/db/connection.js';
import { initSchema } from '../../src/db/schema.js';
import { createUser } from '../../src/models/user.js';
import { createAccount, getAccount } from '../../src/models/account.js';
import { seedCategories } from '../../src/models/category.js';
import { createTransaction } from '../../src/services/transaction-service.js';
import { createRecurring } from '../../src/models/recurring.js';
import { clearAllTransactions } from '../../src/services/clear-service.js';
import type { Database as DatabaseType } from 'better-sqlite3';

describe('clear-service', () => {
  let db: DatabaseType;
  let userId: string;
  let accountId: string;

  beforeEach(() => {
    db = createDatabase(':memory:');
    initSchema(db);
    userId = 'test-user-id';
    createUser(db, { id: userId, display_name: '测试' });
    seedCategories(db, userId);
    const acc = createAccount(db, { user_id: userId, name: '招行', asset_class: 'liquid', account_type: 'checking' });
    accountId = acc.id;
  });
  afterEach(() => closeDatabase(db));

  it('clearAllTransactions: 软删除所有交易', () => {
    createTransaction(db, { user_id: userId, account_id: accountId, category_id: null, transaction_type: 'income', amount: 10000, transaction_date: 1000000 });
    createTransaction(db, { user_id: userId, account_id: accountId, category_id: null, transaction_type: 'expense', amount: 5000, transaction_date: 2000000 });
    const result = clearAllTransactions(db, userId);
    expect(result.success).toBe(true);
    expect(result.clearedTransactionCount).toBe(2);
    const activeTx = db.prepare('SELECT * FROM transactions WHERE user_id = ? AND deleted_flag = 0').all(userId);
    expect(activeTx.length).toBe(0);
    const allTx = db.prepare('SELECT * FROM transactions WHERE user_id = ?').all(userId);
    expect(allTx.length).toBe(2);
  });

  it('clearAllTransactions: 软删除所有经常性交易模板', () => {
    createRecurring(db, {
      user_id: userId, account_id: accountId, transaction_type: 'expense',
      amount: 1000, frequency: 'monthly', interval: 1, start_date: 1000000,
      next_due_date: 1000000, description: '月度房租',
    });
    const result = clearAllTransactions(db, userId);
    expect(result.clearedRecurringCount).toBe(1);
    const activeRecurring = db.prepare('SELECT * FROM recurring_transactions WHERE user_id = ? AND deleted_flag = 0').all(userId);
    expect(activeRecurring.length).toBe(0);
  });

  it('clearAllTransactions: 重置所有账户余额为 0', () => {
    createTransaction(db, { user_id: userId, account_id: accountId, category_id: null, transaction_type: 'income', amount: 50000, transaction_date: 1000000 });
    expect(getAccount(db, accountId)!.current_balance).toBe(50000);
    const result = clearAllTransactions(db, userId);
    expect(result.resetAccountCount).toBe(1);
    expect(getAccount(db, accountId)!.current_balance).toBe(0);
  });

  it('clearAllTransactions: 无交易时返回 0', () => {
    const result = clearAllTransactions(db, userId);
    expect(result.success).toBe(true);
    expect(result.clearedTransactionCount).toBe(0);
    expect(result.clearedRecurringCount).toBe(0);
    expect(result.resetAccountCount).toBe(1);
  });

  it('clearAllTransactions: 不影响分类', () => {
    createTransaction(db, { user_id: userId, account_id: accountId, category_id: null, transaction_type: 'income', amount: 10000, transaction_date: 1000000 });
    clearAllTransactions(db, userId);
    const categories = db.prepare('SELECT * FROM categories WHERE user_id = ? AND deleted_flag = 0').all(userId);
    expect(categories.length).toBe(18);
  });

  it('clearAllTransactions: 软删除交易递增 sync_version + updated_at', async () => {
    const tx = createTransaction(db, { user_id: userId, account_id: accountId, category_id: null, transaction_type: 'income', amount: 10000, transaction_date: 1000000 });
    const beforeVersion = tx.sync_version;
    const beforeUpdatedAt = tx.updated_at;
    // 确保时间戳不同（nowMs 精度为毫秒）
    await new Promise(r => setTimeout(r, 10));
    clearAllTransactions(db, userId);
    const softDeleted = db.prepare('SELECT sync_version, updated_at, deleted_flag FROM transactions WHERE id = ?').get(tx.id) as { sync_version: number; updated_at: number; deleted_flag: number };
    expect(softDeleted.sync_version).toBe(beforeVersion + 1);
    expect(softDeleted.deleted_flag).toBe(1);
    expect(softDeleted.updated_at).toBeGreaterThanOrEqual(beforeUpdatedAt);
  });

  it('clearAllTransactions: 账户余额归零递增 sync_version + updated_at', async () => {
    createTransaction(db, { user_id: userId, account_id: accountId, category_id: null, transaction_type: 'income', amount: 50000, transaction_date: 1000000 });
    const accBefore = getAccount(db, accountId)!;
    const beforeVersion = accBefore.sync_version;
    const beforeUpdatedAt = accBefore.updated_at;
    // 确保时间戳不同（nowMs 精度为毫秒）
    await new Promise(r => setTimeout(r, 10));
    clearAllTransactions(db, userId);
    const accAfter = getAccount(db, accountId)!;
    expect(accAfter.current_balance).toBe(0);
    expect(accAfter.sync_version).toBe(beforeVersion + 1);
    expect(accAfter.updated_at).toBeGreaterThanOrEqual(beforeUpdatedAt);
  });
});
