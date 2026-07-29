// 主进程 CSV 解析 / Main process CSV parsing
// 读取文件 + 按模板编码解码（GBK/UTF-8）+ 调用模板 parseHook

import fs from 'node:fs';
import iconv from 'iconv-lite';
import { getTemplate } from '@shared/import-templates/registry.js';
import type { ParsedCsvTransaction } from '@shared/import-templates/types.js';

/**
 * 解析 CSV 文件为结构化交易数组
 * Parse a CSV file into structured transactions
 * @param templateId 模板 ID / template ID
 * @param filePath 文件路径 / file path
 */
export function parseCsvFile(templateId: string, filePath: string): ParsedCsvTransaction[] {
  const template = getTemplate(templateId);
  if (!template) {
    throw new Error(`未找到模板: ${templateId}`);
  }
  const buffer = fs.readFileSync(filePath);
  const content = iconv.decode(buffer, template.encoding);
  const rawRows = parseCsvContent(content);
  if (template.parseHook) {
    return template.parseHook(rawRows);
  }
  return [];
}

/**
 * 简易 CSV 解析器：支持双引号转义、CRLF/LF 换行
 * Minimal CSV parser: supports double-quote escaping, CRLF/LF line endings
 */
function parseCsvContent(content: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];
    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
      } else if (char === '\r' && nextChar === '\n') {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
        i++;
      } else if (char === '\n' || char === '\r') {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }
  return rows;
}
