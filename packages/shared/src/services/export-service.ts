import type { Database as DatabaseType } from 'better-sqlite3';
import type { User, Account, Category, Transaction, RecurringTransaction, NetWorthSnapshot, FireScenario } from '../types/index.js';

export const EXPORT_TABLE_NAMES = [
  'users', 'accounts', 'categories', 'transactions',
  'recurring_transactions', 'net_worth_snapshots', 'fire_scenarios',
] as const;

export type ExportTableName = (typeof EXPORT_TABLE_NAMES)[number];

export interface ExportEnvelope {
  header: {
    format: 'fire-app-export';
    version: '1.0';
    exported_at: number;
    app_version: string;
    table_count: number;
    record_count: number;
    crypto: null;
  };
  data: {
    users: User[]; accounts: Account[]; categories: Category[];
    transactions: Transaction[]; recurring_transactions: RecurringTransaction[];
    net_worth_snapshots: NetWorthSnapshot[]; fire_scenarios: FireScenario[];
  };
}

export function buildExportEnvelope(db: DatabaseType, userId: string, appVersion: string): ExportEnvelope {
  const users = db.prepare('SELECT * FROM users WHERE id = ?').all(userId) as User[];
  const accounts = db.prepare('SELECT * FROM accounts WHERE user_id = ?').all(userId) as Account[];
  const categories = db.prepare('SELECT * FROM categories WHERE user_id = ?').all(userId) as Category[];
  const transactions = db.prepare('SELECT * FROM transactions WHERE user_id = ?').all(userId) as Transaction[];
  const recurring = db.prepare('SELECT * FROM recurring_transactions WHERE user_id = ?').all(userId) as RecurringTransaction[];
  const snapshots = db.prepare('SELECT * FROM net_worth_snapshots WHERE user_id = ?').all(userId) as NetWorthSnapshot[];
  const scenarios = db.prepare('SELECT * FROM fire_scenarios WHERE user_id = ?').all(userId) as FireScenario[];

  const data = { users, accounts, categories, transactions, recurring_transactions: recurring, net_worth_snapshots: snapshots, fire_scenarios: scenarios };
  const recordCount = Object.values(data).reduce((sum, arr) => sum + arr.length, 0);

  return {
    header: { format: 'fire-app-export', version: '1.0', exported_at: Date.now(), app_version: appVersion, table_count: EXPORT_TABLE_NAMES.length, record_count: recordCount, crypto: null },
    data,
  };
}

export function serializeExportEnvelope(envelope: ExportEnvelope): string {
  return JSON.stringify(envelope, null, 2);
}

export function buildCsvExport(db: DatabaseType, tableName: ExportTableName, userId: string): { csvContent: string; recordCount: number } {
  if (!EXPORT_TABLE_NAMES.includes(tableName)) {
    throw new Error(`不支持的表名: ${tableName}`);
  }
  const userIdColumn = tableName === 'users' ? 'id' : 'user_id';
  const rows = db.prepare(`SELECT * FROM ${tableName} WHERE ${userIdColumn} = ?`).all(userId) as Record<string, unknown>[];
  if (rows.length === 0) {
    return { csvContent: '', recordCount: 0 };
  }
  const columns = Object.keys(rows[0]);
  const headerLine = columns.map(escapeCsvField).join(',');
  const dataLines = rows.map(row => columns.map(col => escapeCsvField(row[col] == null ? '' : String(row[col]))).join(','));
  return { csvContent: [headerLine, ...dataLines].join('\r\n'), recordCount: rows.length };
}

function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
