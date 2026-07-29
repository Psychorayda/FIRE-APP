import type { CsvImportTemplate, ParsedCsvTransaction } from './types.js';

export const rcuDebitTemplate: CsvImportTemplate = {
  id: 'rcu-debit',
  displayName: '农村商业银行借记卡',
  description: '农商行网上银行导出的借记卡流水 CSV（UTF-8 编码）',
  fileSignatures: ['农商行', '交易时间'],
  encoding: 'utf-8',
  headerLineCount: 1,
  amountConvention: 'signed',
  columnMapping: {
    date: { columnName: '交易时间', format: 'yyyy-mm-dd' },
    amount: { columnName: '交易金额' },
    description: { columnName: '交易摘要' },
    counterparty: { columnName: '对方户名' },
  },
  categoryMapping: {},
  parseHook: (rawRows: string[][]): ParsedCsvTransaction[] => {
    const dataRows = rawRows.slice(1).filter(row => row.length > 1 && row.some(cell => cell.trim() !== ''));
    return dataRows.map((row, idx) => {
      // 索引：0=交易时间, 1=交易金额, 3=交易摘要, 5=对方户名
      const dateStr = row[0] ?? '';
      const amountStr = row[1] ?? '0';
      const description = row[3] ?? '';
      const counterparty = row[5] ?? '';
      const amountYuan = parseFloat(amountStr.replace(/[¥,]/g, '')) || 0;
      const amountCents = Math.round(amountYuan * 100);
      const transactionType = amountCents > 0 ? 'income' : amountCents < 0 ? 'expense' : 'transfer';
      const transactionDate = parseDate(dateStr);
      return {
        tempId: `rcu-${idx}`, transactionDate, amount: amountCents, transactionType,
        description, counterparty, mappedCategoryId: '', finalCategoryId: '',
        dedupHash: `${transactionDate}|${amountCents}|${description}|${counterparty}`,
        isDuplicate: false, sourceLine: idx,
      };
    });
  },
};

function parseDate(dateStr: string): number {
  const date = new Date(dateStr.replace(/-/g, '/'));
  return isNaN(date.getTime()) ? 0 : date.getTime();
}
