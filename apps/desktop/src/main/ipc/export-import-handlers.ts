// 导出/导入/清空 IPC handlers / Export/Import/Clear IPC handlers

import { app, dialog, ipcMain } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import iconv from 'iconv-lite';
import { registerHandler } from './register-handlers.js';
import { buildExportEnvelope, serializeExportEnvelope, buildCsvExport } from '@shared/services/export-service.js';
import {
  importJsonWithLww,
  importCsvTransactions,
  markDuplicateTransactions,
  resolveCategoryForTransactions,
} from '@shared/services/import-service.js';
import { clearAllTransactions } from '@shared/services/clear-service.js';
import { getCategories } from '@shared/models/category.js';
import { getTemplate, detectTemplate } from '@shared/import-templates/registry.js';
import { parseCsvFile } from '../import-csv-parser.js';
import { issuePathToken, assertFileOperationAllowed } from './path-guard.js';
import type { Database as DatabaseType } from 'better-sqlite3';
import type { ExportTableName } from '@shared/services/export-service.js';
import type { ParsedCsvTransaction } from '@shared/import-templates/types.js';

/**
 * 注册导出/导入/清空相关 IPC handlers
 * Register export/import/clear IPC handlers
 */
export function registerExportImportHandlers(db: DatabaseType): void {
  // JSON 全量导出 / JSON full export
  registerHandler('export:json', (_db, filePath: string) => {
    assertFileOperationAllowed(filePath, 'write');
    const userId = getLocalUserId(_db);
    if (!userId) throw new Error('无用户数据');
    const envelope = buildExportEnvelope(_db, userId, app.getVersion());
    const json = serializeExportEnvelope(envelope);
    fs.writeFileSync(filePath, json, 'utf-8');
    return { success: true, recordCount: envelope.header.record_count };
  }, db);

  // CSV 单表导出 / CSV single-table export
  registerHandler('export:csv', (_db, filePath: string, tableName: ExportTableName) => {
    assertFileOperationAllowed(filePath, 'write');
    const userId = getLocalUserId(_db);
    if (!userId) throw new Error('无用户数据');
    const { csvContent, recordCount } = buildCsvExport(_db, tableName, userId);
    const bom = '\uFEFF';
    fs.writeFileSync(filePath, bom + csvContent, 'utf-8');
    return { success: true, recordCount };
  }, db);

  // JSON 导入（LWW 合并） / JSON import (LWW merge)
  registerHandler('import:json', (_db, filePath: string) => {
    assertFileOperationAllowed(filePath, 'read');
    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch {
      throw new Error('文件读取失败，请确认文件存在且可访问');
    }
    let envelope;
    try {
      envelope = JSON.parse(content);
    } catch {
      throw new Error('文件不是有效的 JSON 格式');
    }
    return importJsonWithLww(_db, envelope);
  }, db);

  // CSV 解析（预览阶段，含分类解析） / CSV parse (preview stage, with category resolution)
  registerHandler('import:parseCsv', (_db, templateId: string, filePath: string) => {
    assertFileOperationAllowed(filePath, 'read');
    const userId = getLocalUserId(_db);
    if (!userId) throw new Error('无用户数据');
    const parsed = parseCsvFile(templateId, filePath);
    const categories = getCategories(_db, userId);
    return resolveCategoryForTransactions(parsed, categories, getTemplate(templateId)?.categoryMapping ?? {});
  }, db);

  // CSV 交易批量导入 / CSV transactions batch import
  registerHandler('import:csvTransactions', (_db, params: {
    templateId: string;
    filePath: string;
    accountId: string;
    transactions: ParsedCsvTransaction[];
  }) => {
    assertFileOperationAllowed(params.filePath, 'read');
    const userId = getLocalUserId(_db);
    if (!userId) throw new Error('无用户数据');
    return importCsvTransactions(_db, {
      templateId: params.templateId,
      filePath: params.filePath,
      accountId: params.accountId,
      userId,
      transactions: params.transactions,
    });
  }, db);

  // 清空所有交易 / Clear all transactions
  registerHandler('clear:transactions', (_db) => {
    const userId = getLocalUserId(_db);
    if (!userId) throw new Error('无用户数据');
    return clearAllTransactions(_db, userId);
  }, db);

  // 标记重复交易 / Mark duplicate transactions
  registerHandler('import:markDuplicates', (_db, accountId: string, transactions: ParsedCsvTransaction[]) => {
    return markDuplicateTransactions(_db, accountId, transactions);
  }, db);

  // 检测模板 / Detect template from file content
  registerHandler('import:detectTemplate', (_db, filePath: string) => {
    assertFileOperationAllowed(filePath, 'read');
    const buffer = fs.readFileSync(filePath);
    const utf8Content = buffer.slice(0, 1024).toString('utf-8');
    const gbkContent = iconv.decode(buffer.slice(0, 1024), 'gbk');
    return detectTemplate(utf8Content) ?? detectTemplate(gbkContent);
  }, db);

  // 保存对话框 / Save dialog
  ipcMain.handle('dialog:save', async (_event, params: { defaultName: string; extension: 'json' | 'csv' }) => {
    const result = await dialog.showSaveDialog({
      defaultPath: path.join(app.getPath('desktop'), params.defaultName),
      filters: [{ name: params.extension.toUpperCase() + ' 文件', extensions: [params.extension] }],
    });
    if (!result.canceled && result.filePath) {
      issuePathToken(result.filePath);
    }
    return { canceled: result.canceled, filePath: result.filePath ?? null };
  });

  // 打开文件对话框 / Open file dialog
  ipcMain.handle('dialog:open', async (_event, params: { extensions: string[] }) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: '文件', extensions: params.extensions }],
    });
    if (!result.canceled && result.filePaths[0]) {
      issuePathToken(result.filePaths[0]);
    }
    return { canceled: result.canceled, filePath: result.filePaths[0] ?? null };
  });
}

function getLocalUserId(db: DatabaseType): string | null {
  const row = db.prepare('SELECT id FROM users WHERE deleted_flag = 0 LIMIT 1').get() as { id: string } | undefined;
  return row?.id ?? null;
}
