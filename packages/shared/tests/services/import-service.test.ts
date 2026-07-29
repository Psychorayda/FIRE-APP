import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, closeDatabase } from '../../src/db/connection.js';
import { initSchema } from '../../src/db/schema.js';
import { createUser, getUser } from '../../src/models/user.js';
import { createAccount, getAccount } from '../../src/models/account.js';
import { seedCategories, getCategories } from '../../src/models/category.js';
import { createTransaction } from '../../src/services/transaction-service.js';
import { buildExportEnvelope } from '../../src/services/export-service.js';
import {
  importJsonWithLww, importCsvTransactions,
  markDuplicateTransactions, resolveCategoryForTransactions,
} from '../../src/services/import-service.js';
import type { ParsedCsvTransaction } from '../../src/import-templates/types.js';
import type { Database as DatabaseType } from 'better-sqlite3';

describe('import-service JSON', () => {
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

  it('importJsonWithLww: 新记录 INSERT', () => {
    const sourceDb = createDatabase(':memory:');
    initSchema(sourceDb);
    createUser(sourceDb, { id: 'other-user', display_name: '源用户' });
    seedCategories(sourceDb, 'other-user');
    createAccount(sourceDb, { user_id: 'other-user', name: '工行', asset_class: 'liquid', account_type: 'savings' });
    const envelope = buildExportEnvelope(sourceDb, 'other-user', '0.8.0');
    closeDatabase(sourceDb);

    const result = importJsonWithLww(db, envelope);
    expect(result.success).toBe(true);
    expect(result.inserted).toBeGreaterThan(0);
    const accounts = db.prepare('SELECT * FROM accounts WHERE user_id = ? AND deleted_flag = 0').all(userId);
    expect(accounts.length).toBe(2);
  });

  it('importJsonWithLww: updated_at 更大时 UPDATE', () => {
    const envelope = buildExportEnvelope(db, userId, '0.8.0');
    envelope.data.users[0].display_name = '新名字';
    envelope.data.users[0].updated_at = envelope.data.users[0].updated_at + 1000;

    const result = importJsonWithLww(db, envelope);
    expect(result.updated).toBeGreaterThanOrEqual(1);
    expect(getUser(db, userId)!.display_name).toBe('新名字');
  });

  it('importJsonWithLww: updated_at 更小时 SKIP', () => {
    const envelope = buildExportEnvelope(db, userId, '0.8.0');
    envelope.data.users[0].updated_at = 1;

    const result = importJsonWithLww(db, envelope);
    expect(result.skipped).toBeGreaterThanOrEqual(1);
    expect(getUser(db, userId)!.display_name).toBe('测试');
  });

  it('importJsonWithLww: 跨用户 user_id 归一为本地', () => {
    const sourceDb = createDatabase(':memory:');
    initSchema(sourceDb);
    createUser(sourceDb, { id: 'other-user', display_name: '源用户' });
    seedCategories(sourceDb, 'other-user');
    const envelope = buildExportEnvelope(sourceDb, 'other-user', '0.8.0');
    closeDatabase(sourceDb);

    importJsonWithLww(db, envelope);
    const accounts = db.prepare('SELECT * FROM accounts WHERE user_id = ?').all(userId);
    expect(accounts.length).toBeGreaterThan(0);
  });

  it('importJsonWithLww: 格式错误返回失败', () => {
    const envelope = buildExportEnvelope(db, userId, '0.8.0');
    envelope.header.format = 'bad-format' as any;
    const result = importJsonWithLww(db, envelope);
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('importJsonWithLww: 加密文件拒绝导入', () => {
    const envelope = buildExportEnvelope(db, userId, '0.8.0');
    (envelope.header as any).crypto = { algorithm: 'aes-256' };
    const result = importJsonWithLww(db, envelope);
    expect(result.success).toBe(false);
  });
});

describe('import-service CSV', () => {
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

  function makeParsedTx(overrides: Partial<ParsedCsvTransaction> = {}): ParsedCsvTransaction {
    return {
      tempId: 'test-0', transactionDate: 1700000000000, amount: -10000,
      transactionType: 'expense', description: '测试消费', counterparty: '商家',
      finalCategoryId: '', dedupHash: '1700000000000|-10000|测试消费|商家',
      isDuplicate: false, sourceLine: 0, ...overrides,
    };
  }

  it('importCsvTransactions: 插入新交易并更新账户余额', () => {
    const result = importCsvTransactions(db, {
      templateId: 'alipay', filePath: '/tmp/test.csv',
      accountId, userId, transactions: [makeParsedTx()],
    });
    expect(result.success).toBe(true);
    expect(result.inserted).toBe(1);
    expect(getAccount(db, accountId)!.current_balance).toBe(-10000);
  });

  it('importCsvTransactions: 跳过 isDuplicate=true 的交易', () => {
    const result = importCsvTransactions(db, {
      templateId: 'alipay', filePath: '/tmp/test.csv',
      accountId, userId, transactions: [makeParsedTx({ isDuplicate: true })],
    });
    expect(result.inserted).toBe(0);
    expect(result.skipped).toBe(1);
    expect(getAccount(db, accountId)!.current_balance).toBe(0);
  });

  it('importCsvTransactions: 事务性，失败回滚', () => {
    const goodTx = makeParsedTx({ tempId: 'good' });
    const badTx = makeParsedTx({ tempId: 'bad', transactionType: 'invalid' as any });
    importCsvTransactions(db, {
      templateId: 'alipay', filePath: '/tmp/test.csv',
      accountId, userId, transactions: [goodTx, badTx],
    });
    // 整批回滚
    const txs = db.prepare('SELECT * FROM transactions WHERE user_id = ?').all(userId);
    expect(txs.length).toBe(0);
    expect(getAccount(db, accountId)!.current_balance).toBe(0);
  });

  it('markDuplicateTransactions: 标记与本地重复的交易', () => {
    createTransaction(db, { user_id: userId, account_id: accountId, category_id: null, transaction_type: 'expense', amount: 10000, transaction_date: 1700000000000, description: '测试消费' });
    const parsedTx = makeParsedTx({ description: '测试消费', counterparty: '', dedupHash: '1700000000000|-10000|测试消费|' });
    const result = markDuplicateTransactions(db, accountId, [parsedTx]);
    expect(result[0].isDuplicate).toBe(true);
  });

  it('resolveCategoryForTransactions: 模板映射优先于关键词推断', () => {
    const categories = getCategories(db, userId);
    const tx = makeParsedTx({ description: '海底捞餐厅消费', mappedCategoryId: '__CATEGORY_FOOD__' });
    const result = resolveCategoryForTransactions([tx], categories, { '餐饮美食': '__CATEGORY_FOOD__' });
    const foodCategory = categories.find(c => c.name === '食品')!;
    expect(result[0].finalCategoryId).toBe(foodCategory.id);
  });

  it('resolveCategoryForTransactions: 无模板映射时走关键词推断', () => {
    const categories = getCategories(db, userId);
    const tx = makeParsedTx({ description: '滴滴打车', mappedCategoryId: undefined });
    const result = resolveCategoryForTransactions([tx], categories, {});
    const transportCategory = categories.find(c => c.name === '交通')!;
    expect(result[0].finalCategoryId).toBe(transportCategory.id);
  });

  it('resolveCategoryForTransactions: 无映射无关键词时默认其他', () => {
    const categories = getCategories(db, userId);
    const tx = makeParsedTx({ description: '某笔无关键词交易', mappedCategoryId: undefined });
    const result = resolveCategoryForTransactions([tx], categories, {});
    const otherExpense = categories.find(c => c.name === '其他支出')!;
    expect(result[0].finalCategoryId).toBe(otherExpense.id);
  });
});
