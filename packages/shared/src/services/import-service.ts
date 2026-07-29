import type { Database as DatabaseType } from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import type { Category } from '../types/index.js';
import type { ExportEnvelope, ExportTableName } from './export-service.js';
import { EXPORT_TABLE_NAMES } from './export-service.js';
import type { ParsedCsvTransaction } from '../import-templates/types.js';
import { inferCategory } from '../import-templates/keyword-rules.js';
import { resolveCategoryPlaceholder } from '../import-templates/placeholder-resolver.js';
import { nowMs } from '../utils/time.js';

export interface ImportResult {
  success: boolean;
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export interface CsvImportParams {
  templateId: string;
  filePath: string;
  accountId: string;
  userId: string;
  transactions: ParsedCsvTransaction[];
}

export function importJsonWithLww(db: DatabaseType, envelope: ExportEnvelope): ImportResult {
  const validation = validateEnvelope(envelope);
  if (!validation.success) {
    return { success: false, inserted: 0, updated: 0, skipped: 0, errors: validation.errors };
  }

  const result: ImportResult = { success: true, inserted: 0, updated: 0, skipped: 0, errors: [] };
  const localUserId = getLocalUserId(db);
  if (!localUserId) {
    return { success: false, inserted: 0, updated: 0, skipped: 0, errors: ['本地无用户数据'] };
  }

  const processOrder: ExportTableName[] = [
    'users', 'categories', 'accounts', 'recurring_transactions',
    'transactions', 'net_worth_snapshots', 'fire_scenarios',
  ];

  try {
    db.transaction(() => {
      for (const tableName of processOrder) {
        const records = (envelope.data as Record<string, Record<string, unknown>[]>)[tableName] ?? [];
        for (const record of records) {
          const normalized = normalizeUserId(record, localUserId, tableName);
          const action = mergeRecordLww(db, tableName, normalized);
          if (action === 'insert') result.inserted++;
          else if (action === 'update') result.updated++;
          else result.skipped++;
        }
      }
    })();
  } catch (e) {
    return { success: false, inserted: 0, updated: 0, skipped: 0, errors: [(e as Error).message] };
  }

  return result;
}

function validateEnvelope(envelope: ExportEnvelope): { success: boolean; errors: string[] } {
  const errors: string[] = [];
  if (envelope.header.format !== 'fire-app-export') errors.push('文件不是 FIRE APP 导出文件（format 字段不匹配）');
  if (envelope.header.version !== '1.0') errors.push(`导出文件版本 ${envelope.header.version} 不被支持，当前支持版本 1.0`);
  if (envelope.header.crypto !== null) errors.push('加密文件暂不支持导入');
  const tableCount = Object.keys(envelope.data).length;
  if (tableCount !== EXPORT_TABLE_NAMES.length) errors.push(`数据表数量不匹配：期望 ${EXPORT_TABLE_NAMES.length}，实际 ${tableCount}`);
  return { success: errors.length === 0, errors };
}

function mergeRecordLww(db: DatabaseType, tableName: ExportTableName, record: Record<string, unknown>): 'insert' | 'update' | 'skip' {
  const existing = db.prepare(`SELECT updated_at FROM ${tableName} WHERE id = ?`).get(record.id) as { updated_at: number } | undefined;
  if (!existing) {
    insertRecord(db, tableName, record);
    return 'insert';
  }
  const recordUpdatedAt = Number(record.updated_at) || 0;
  if (recordUpdatedAt > existing.updated_at) {
    updateRecord(db, tableName, record);
    return 'update';
  }
  return 'skip';
}

function insertRecord(db: DatabaseType, tableName: ExportTableName, record: Record<string, unknown>): void {
  const columns = Object.keys(record);
  const placeholders = columns.map(() => '?').join(',');
  db.prepare(`INSERT INTO ${tableName} (${columns.join(',')}) VALUES (${placeholders})`).run(...columns.map(c => record[c]));
}

function updateRecord(db: DatabaseType, tableName: ExportTableName, record: Record<string, unknown>): void {
  const columns = Object.keys(record).filter(c => c !== 'id');
  const setClause = columns.map(c => `${c} = ?`).join(',');
  db.prepare(`UPDATE ${tableName} SET ${setClause} WHERE id = ?`).run(...columns.map(c => record[c]), record.id);
}

function getLocalUserId(db: DatabaseType): string | null {
  const row = db.prepare('SELECT id FROM users WHERE deleted_flag = 0 LIMIT 1').get() as { id: string } | undefined;
  return row?.id ?? null;
}

function normalizeUserId(record: Record<string, unknown>, localUserId: string, tableName: ExportTableName): Record<string, unknown> {
  if (tableName === 'users') return { ...record, id: localUserId };
  return { ...record, user_id: localUserId };
}

export function importCsvTransactions(db: DatabaseType, params: CsvImportParams): ImportResult {
  const result: ImportResult = { success: true, inserted: 0, updated: 0, skipped: 0, errors: [] };
  const { userId, accountId, transactions } = params;

  const account = db.prepare('SELECT * FROM accounts WHERE id = ? AND user_id = ?').get(accountId, userId);
  if (!account) {
    return { success: false, inserted: 0, updated: 0, skipped: 0, errors: ['目标账户不存在'] };
  }

  try {
    db.transaction(() => {
      for (const tx of transactions) {
        if (tx.isDuplicate) {
          result.skipped++;
          continue;
        }
        insertCsvTransaction(db, userId, accountId, tx);
        updateAccountBalance(db, accountId, tx.amount, tx.transactionType);
        result.inserted++;
      }
    })();
  } catch (e) {
    return { success: false, inserted: 0, updated: 0, skipped: 0, errors: [(e as Error).message] };
  }

  return result;
}

function insertCsvTransaction(db: DatabaseType, userId: string, accountId: string, tx: ParsedCsvTransaction): void {
  const txId = uuidv4();
  const now = nowMs();
  const absAmount = Math.abs(tx.amount);
  db.prepare(`
    INSERT INTO transactions (id, user_id, account_id, to_account_id, category_id, recurring_id,
      transaction_type, amount, transaction_date, description, sync_version, updated_at, deleted_flag)
    VALUES (?, ?, ?, NULL, ?, NULL, ?, ?, ?, ?, 0, ?, 0)
  `).run(txId, userId, accountId, tx.finalCategoryId || null, tx.transactionType, absAmount, tx.transactionDate, tx.description, now);
}

function updateAccountBalance(db: DatabaseType, accountId: string, amount: number, transactionType: 'income' | 'expense' | 'transfer'): void {
  let delta = 0;
  if (transactionType === 'income') delta = Math.abs(amount);
  else if (transactionType === 'expense') delta = -Math.abs(amount);
  if (delta !== 0) {
    db.prepare('UPDATE accounts SET current_balance = current_balance + ?, last_updated = ? WHERE id = ?').run(delta, nowMs(), accountId);
  }
}

export function markDuplicateTransactions(db: DatabaseType, accountId: string, transactions: ParsedCsvTransaction[]): ParsedCsvTransaction[] {
  const existingTx = db.prepare(
    'SELECT transaction_date, amount, description FROM transactions WHERE account_id = ? AND deleted_flag = 0'
  ).all(accountId) as { transaction_date: number; amount: number; description: string | null }[];

  const existingSet = new Set(existingTx.map(t => `${t.transaction_date}|${t.amount}|${t.description ?? ''}`));

  return transactions.map(tx => {
    const absAmount = Math.abs(tx.amount);
    const hashWithoutSign = `${tx.transactionDate}|${absAmount}|${tx.description}`;
    return { ...tx, isDuplicate: existingSet.has(hashWithoutSign) };
  });
}

export function resolveCategoryForTransactions(
  transactions: ParsedCsvTransaction[],
  systemCategories: Category[],
  _templateCategoryMapping: Record<string, string>
): ParsedCsvTransaction[] {
  const defaultExpenseId = systemCategories.find(c => c.name === '其他支出')?.id ?? '';
  const defaultIncomeId = systemCategories.find(c => c.name === '其他收入')?.id ?? '';

  return transactions.map(tx => {
    let categoryId = '';
    if (tx.mappedCategoryId) {
      categoryId = resolveCategoryPlaceholder(tx.mappedCategoryId, systemCategories) ?? '';
    }
    if (!categoryId) {
      const inferredPlaceholder = inferCategory(tx.description, tx.productDescription);
      if (inferredPlaceholder) {
        categoryId = resolveCategoryPlaceholder(inferredPlaceholder, systemCategories) ?? '';
      }
    }
    if (!categoryId) {
      categoryId = tx.transactionType === 'income' ? defaultIncomeId : defaultExpenseId;
    }
    return { ...tx, finalCategoryId: categoryId };
  });
}
