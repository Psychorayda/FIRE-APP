import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, closeDatabase } from '../../src/db/connection.js';
import { initSchema } from '../../src/db/schema.js';
import { createUser } from '../../src/models/user.js';
import { createAccount, getAccount } from '../../src/models/account.js';
import { createCategory } from '../../src/models/category.js';
import { getTransaction } from '../../src/models/transaction.js';
import {
  createTransaction,
  editTransaction,
  deleteTransaction,
} from '../../src/services/transaction-service.js';
import type { Database as DatabaseType } from 'better-sqlite3';

describe('transaction service', () => {
  let db: DatabaseType;
  let userId: string;
  let accountId: string;
  let toAccountId: string;
  let categoryId: string;

  beforeEach(() => {
    db = createDatabase(':memory:');
    initSchema(db);
    userId = 'test-user-id';
    createUser(db, { id: userId, display_name: '测试' });
    const acc = createAccount(db, { user_id: userId, name: '活期', asset_class: 'liquid', account_type: 'checking' });
    accountId = acc.id;
    const toAcc = createAccount(db, { user_id: userId, name: '基金', asset_class: 'invested', account_type: 'fund' });
    toAccountId = toAcc.id;
    const cat = createCategory(db, { user_id: userId, name: '工资', type: 'income' });
    categoryId = cat.id;
  });

  afterEach(() => { closeDatabase(db); });

  it('createTransaction: income → 账户余额增加', () => {
    const tx = createTransaction(db, { user_id: userId, account_id: accountId, category_id: categoryId, transaction_type: 'income', amount: 10000, transaction_date: 1000000 });
    expect(tx.id).toBeDefined();
    expect(tx.amount).toBe(10000);
    const acc = getAccount(db, accountId);
    expect(acc!.current_balance).toBe(10000);
  });

  it('createTransaction: expense → 账户余额减少', () => {
    createTransaction(db, { user_id: userId, account_id: accountId, category_id: categoryId, transaction_type: 'income', amount: 50000, transaction_date: 1000000 });
    createTransaction(db, { user_id: userId, account_id: accountId, category_id: categoryId, transaction_type: 'expense', amount: 30000, transaction_date: 2000000 });
    const acc = getAccount(db, accountId);
    expect(acc!.current_balance).toBe(20000);
  });

  it('createTransaction: transfer → 源账户减、目标账户加', () => {
    createTransaction(db, { user_id: userId, account_id: accountId, category_id: categoryId, transaction_type: 'income', amount: 100000, transaction_date: 1000000 });
    createTransaction(db, { user_id: userId, account_id: accountId, to_account_id: toAccountId, transaction_type: 'transfer', amount: 50000, transaction_date: 2000000 });
    const source = getAccount(db, accountId);
    const target = getAccount(db, toAccountId);
    expect(source!.current_balance).toBe(50000);
    expect(target!.current_balance).toBe(50000);
  });

  it('createTransaction: initial_balance → 余额增加', () => {
    const tx = createTransaction(db, { user_id: userId, account_id: accountId, transaction_type: 'initial_balance', amount: 200000, transaction_date: 500000 });
    expect(tx.transaction_type).toBe('initial_balance');
    const acc = getAccount(db, accountId);
    expect(acc!.current_balance).toBe(200000);
  });

  it('createTransaction: transfer 无 to_account_id → 抛出错误', () => {
    expect(() => { createTransaction(db, { user_id: userId, account_id: accountId, transaction_type: 'transfer', amount: 1000, transaction_date: 1000000 }); }).toThrow(/to_account_id/);
  });

  it('createTransaction: transfer to_account_id = account_id → 抛出错误', () => {
    expect(() => { createTransaction(db, { user_id: userId, account_id: accountId, to_account_id: accountId, transaction_type: 'transfer', amount: 1000, transaction_date: 1000000 }); }).toThrow(/不能转账给自己/);
  });

  it('editTransaction: 修改金额 → 余额正确调整', () => {
    const tx = createTransaction(db, { user_id: userId, account_id: accountId, category_id: categoryId, transaction_type: 'income', amount: 10000, transaction_date: 1000000 });
    editTransaction(db, tx.id, { amount: 15000 });
    const acc = getAccount(db, accountId);
    expect(acc!.current_balance).toBe(15000);
  });

  it('editTransaction: 修改类型 income→expense → 余额反转', () => {
    const tx = createTransaction(db, { user_id: userId, account_id: accountId, category_id: categoryId, transaction_type: 'income', amount: 10000, transaction_date: 1000000 });
    editTransaction(db, tx.id, { transaction_type: 'expense' });
    const acc = getAccount(db, accountId);
    expect(acc!.current_balance).toBe(-10000);
  });

  it('deleteTransaction: 删除后余额回滚', () => {
    const tx = createTransaction(db, { user_id: userId, account_id: accountId, category_id: categoryId, transaction_type: 'income', amount: 10000, transaction_date: 1000000 });
    deleteTransaction(db, tx.id);
    const acc = getAccount(db, accountId);
    expect(acc!.current_balance).toBe(0);
    const deletedTx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(tx.id) as { deleted_flag: number };
    expect(deletedTx.deleted_flag).toBe(1);
  });

  it('deleteTransaction: 转账删除后两个账户都回滚', () => {
    createTransaction(db, { user_id: userId, account_id: accountId, category_id: categoryId, transaction_type: 'income', amount: 100000, transaction_date: 1000000 });
    const transfer = createTransaction(db, { user_id: userId, account_id: accountId, to_account_id: toAccountId, transaction_type: 'transfer', amount: 50000, transaction_date: 2000000 });
    deleteTransaction(db, transfer.id);
    const source = getAccount(db, accountId);
    const target = getAccount(db, toAccountId);
    expect(source!.current_balance).toBe(100000);
    expect(target!.current_balance).toBe(0);
  });
});
