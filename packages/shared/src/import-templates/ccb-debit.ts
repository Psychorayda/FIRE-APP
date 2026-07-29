import type { CsvImportTemplate, ParsedCsvTransaction } from './types.js';

export const ccbDebitTemplate: CsvImportTemplate = {
  id: 'ccb-debit',
  displayName: '建设银行借记卡',
  description: '建设银行网上银行导出的借记卡流水 CSV（GBK 编码）',
  fileSignatures: ['中国建设银行', '交易日期'],
  encoding: 'gbk',
  headerLineCount: 1,
  amountConvention: 'signed',
  columnMapping: {
    date: { columnName: '交易日期', format: 'yyyy-mm-dd' },
    amount: { columnName: '交易金额' },
    description: { columnName: '摘要' },
    counterparty: { columnName: '对方户名' },
  },
  categoryMapping: {},
  parseHook: (rawRows: string[][]): ParsedCsvTransaction[] => {
    const dataRows = rawRows.slice(1).filter(row => row.length > 1 && row.some(cell => cell.trim() !== ''));
    return dataRows.map((row, idx) => {
      // 索引：0=交易日期, 1=交易金额, 5=对方户名, 6=摘要
      const dateStr = row[0] ?? '';
      const amountStr = row[1] ?? '0';
      const counterparty = row[5] ?? '';
      const description = row[6] ?? counterparty;
      const amountYuan = parseFloat(amountStr.replace(/[¥￥,]/g, '')) || 0;
      const amountCents = Math.round(amountYuan * 100);
      const transactionType = amountCents > 0 ? 'income' : amountCents < 0 ? 'expense' : 'transfer';
      const transactionDate = parseDate(dateStr);
      return {
        tempId: `ccb-${idx}`, transactionDate, amount: amountCents, transactionType,
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
