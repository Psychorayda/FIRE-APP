import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, closeDatabase } from '../../src/db/connection.js';
import { initSchema } from '../../src/db/schema.js';
import { createUser } from '../../src/models/user.js';
import { createAccount } from '../../src/models/account.js';
import { seedCategories } from '../../src/models/category.js';
import { createTransaction } from '../../src/services/transaction-service.js';
import {
  buildExportEnvelope, serializeExportEnvelope, buildCsvExport, EXPORT_TABLE_NAMES,
} from '../../src/services/export-service.js';
import type { Database as DatabaseType } from 'better-sqlite3';

describe('export-service', () => {
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

  it('buildExportEnvelope: 构造 7 张表数据 + header', () => {
    const envelope = buildExportEnvelope(db, userId, '0.8.0');
    expect(envelope.header.format).toBe('fire-app-export');
    expect(envelope.header.version).toBe('1.0');
    expect(envelope.header.app_version).toBe('0.8.0');
    expect(envelope.header.table_count).toBe(7);
    expect(envelope.header.crypto).toBeNull();
    expect(envelope.data.users).toHaveLength(1);
    expect(envelope.data.accounts).toHaveLength(1);
    expect(envelope.data.categories.length).toBe(18);
    expect(envelope.data.transactions).toHaveLength(0);
    expect(envelope.header.record_count).toBe(1 + 1 + 18);
  });

  it('buildExportEnvelope: 含交易时 record_count 正确', () => {
    createTransaction(db, { user_id: userId, account_id: accountId, category_id: null, transaction_type: 'income', amount: 10000, transaction_date: 1000000 });
    const envelope = buildExportEnvelope(db, userId, '0.8.0');
    expect(envelope.data.transactions).toHaveLength(1);
    expect(envelope.header.record_count).toBe(1 + 1 + 18 + 1);
  });

  it('serializeExportEnvelope: 序列化为 JSON 字符串', () => {
    const envelope = buildExportEnvelope(db, userId, '0.8.0');
    const json = serializeExportEnvelope(envelope);
    const parsed = JSON.parse(json);
    expect(parsed.header.format).toBe('fire-app-export');
    expect(parsed.data.users[0].display_name).toBe('测试');
  });

  it('buildCsvExport: accounts 表导出含表头和数据行', () => {
    const { csvContent, recordCount } = buildCsvExport(db, 'accounts', userId);
    expect(recordCount).toBe(1);
    const lines = csvContent.split('\r\n');
    expect(lines[0]).toContain('id');
    expect(lines[0]).toContain('name');
    expect(lines[1]).toContain('招行');
  });

  it('buildCsvExport: 含逗号字段被双引号包裹', () => {
    createAccount(db, { user_id: userId, name: '招行,储蓄', asset_class: 'liquid', account_type: 'checking' });
    const { csvContent } = buildCsvExport(db, 'accounts', userId);
    expect(csvContent).toContain('"招行,储蓄"');
  });

  it('buildCsvExport: 空表返回 recordCount=0', () => {
    const { csvContent, recordCount } = buildCsvExport(db, 'transactions', userId);
    expect(recordCount).toBe(0);
    expect(csvContent).toBe('');
  });

  it('buildCsvExport: 不支持的表名抛出错误', () => {
    expect(() => buildCsvExport(db, 'unknown_table' as any, userId)).toThrow(/不支持/);
  });

  it('EXPORT_TABLE_NAMES: 含 7 张表', () => {
    expect(EXPORT_TABLE_NAMES).toHaveLength(7);
    expect(EXPORT_TABLE_NAMES).toContain('users');
    expect(EXPORT_TABLE_NAMES).toContain('fire_scenarios');
  });
});
