import type { CsvImportTemplate, ParsedCsvTransaction } from './types.js';

export const cmbDebitTemplate: CsvImportTemplate = {
  id: 'cmb-debit',
  displayName: '招商银行借记卡',
  description: '招商银行网上银行导出的借记卡流水 CSV（GBK 编码，单行表头）',
  fileSignatures: ['招商银行', '交易日期'],
  encoding: 'gbk',
  headerLineCount: 1,
  amountConvention: 'signed',
  columnMapping: {
    date: { columnName: '交易日期', format: 'yyyy-mm-dd' },
    amount: { columnName: '交易金额' },
    description: { columnName: '摘要' },
    counterparty: { columnName: '交易对手' },
  },
  categoryMapping: {},
  parseHook: (rawRows: string[][]): ParsedCsvTransaction[] => {
    const dataRows = rawRows.slice(1).filter(row => row.length > 1 && row.some(cell => cell.trim() !== ''));
    return dataRows.map((row, idx) => {
      // 索引：0=交易日期, 2=交易金额, 5=交易对手, 6=摘要
      const dateStr = row[0] ?? '';
      const amountStr = row[2] ?? '0';
      const counterparty = row[5] ?? '';
      const description = row[6] ?? counterparty;
      const amountYuan = parseFloat(amountStr.replace(/[¥￥,]/g, '')) || 0;
      const amountCents = Math.round(amountYuan * 100);
      const transactionType = amountCents > 0 ? 'income' : amountCents < 0 ? 'expense' : 'transfer';
      const transactionDate = parseCmbDate(dateStr);
      return {
        tempId: `cmb-${idx}`, transactionDate, amount: amountCents, transactionType,
        description, counterparty, mappedCategoryId: '', finalCategoryId: '',
        dedupHash: `${transactionDate}|${amountCents}|${description}|${counterparty}`,
        isDuplicate: false, sourceLine: idx,
      };
    });
  },
};

function parseCmbDate(dateStr: string): number {
  const normalized = dateStr.replace(/\//g, '-');
  const parts = normalized.split(' ')[0].split('-');
  if (parts.length === 3) {
    const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return date.getTime();
  }
  return 0;
}
