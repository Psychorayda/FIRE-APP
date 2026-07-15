import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, closeDatabase } from '../../src/db/connection.js';
import { initSchema } from '../../src/db/schema.js';
import { createUser } from '../../src/models/user.js';
import { createAccount } from '../../src/models/account.js';
import { createCategory } from '../../src/models/category.js';
import { getTransactionsByUser } from '../../src/models/transaction.js';
import { createTransaction } from '../../src/services/transaction-service.js';
import type { Database as DatabaseType } from 'better-sqlite3';

describe('transaction model', () => {
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

  it('getTransactionsByUser: 返回用户所有交易（按日期倒序）', () => {
    createTransaction(db, { user_id: userId, account_id: accountId, category_id: categoryId, transaction_type: 'income', amount: 1000, transaction_date: 1000000 });
    createTransaction(db, { user_id: userId, account_id: accountId, category_id: categoryId, transaction_type: 'expense', amount: 500, transaction_date: 3000000 });
    createTransaction(db, { user_id: userId, account_id: accountId, category_id: categoryId, transaction_type: 'income', amount: 2000, transaction_date: 2000000 });

    const txs = getTransactionsByUser(db, userId);
    expect(txs).toHaveLength(3);
    expect(txs[0].transaction_date).toBe(3000000);
    expect(txs[1].transaction_date).toBe(2000000);
    expect(txs[2].transaction_date).toBe(1000000);
  });

  it('getTransactionsByUser: 排除已删除交易', () => {
    const tx1 = createTransaction(db, { user_id: userId, account_id: accountId, category_id: categoryId, transaction_type: 'income', amount: 1000, transaction_date: 1000000 });
    createTransaction(db, { user_id: userId, account_id: accountId, category_id: categoryId, transaction_type: 'expense', amount: 500, transaction_date: 2000000 });

    // 软删除第一笔
    db.prepare('UPDATE transactions SET deleted_flag = 1 WHERE id = ?').run(tx1.id);

    const txs = getTransactionsByUser(db, userId);
    expect(txs).toHaveLength(1);
    expect(txs[0].amount).toBe(500);
  });

  it('getTransactionsByUser: 无交易时返回空数组', () => {
    const txs = getTransactionsByUser(db, userId);
    expect(txs).toHaveLength(0);
  });
});
