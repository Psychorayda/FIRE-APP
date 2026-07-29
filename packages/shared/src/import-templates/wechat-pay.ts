import type { CsvImportTemplate, ParsedCsvTransaction } from './types.js';

export const wechatPayTemplate: CsvImportTemplate = {
  id: 'wechat-pay',
  displayName: '微信支付账单',
  description: '微信钱包导出的交易账单 CSV（GBK 编码，前 16 行元信息）',
  fileSignatures: ['微信支付账单明细', '微信账号'],
  encoding: 'gbk',
  headerLineCount: 16,
  amountConvention: 'positive_is_expense',
  columnMapping: {
    date: { columnName: '交易时间', format: 'yyyy-mm-dd' },
    amount: { columnName: '金额(元)' },
    description: { columnName: '商品' },
    counterparty: { columnName: '交易对方' },
    productDescription: { columnName: '商品' },
    category: { columnName: '交易类型' },
  },
  categoryMapping: {
    '餐饮美食': '__CATEGORY_FOOD__',
    '交通出行': '__CATEGORY_TRANSPORT__',
    '日用百货': '__CATEGORY_SHOPPING__',
    '服饰装扮': '__CATEGORY_SHOPPING__',
    '文化休闲': '__CATEGORY_ENTERTAINMENT__',
    '医疗健康': '__CATEGORY_MEDICAL__',
    '教育培训': '__CATEGORY_EDUCATION__',
    '生活服务': '__CATEGORY_HOUSING__',
    '充值缴费': '__CATEGORY_HOUSING__',
    '金融保险': '__CATEGORY_INSURANCE__',
  },
  parseHook: (rawRows: string[][]): ParsedCsvTransaction[] => {
    const dataRows = rawRows.slice(16).filter(row =>
      row.length > 1 && !row[0]?.startsWith('本期') && !row[0]?.startsWith('-') && row.some(cell => cell.trim() !== '')
    );
    return dataRows.map((row, idx) => parseWechatRow(row, idx));
  },
};

function parseWechatRow(row: string[], lineNum: number): ParsedCsvTransaction {
  // 索引：0=交易时间, 2=交易对方, 3=商品, 4=收/支, 5=金额(元)
  const dateStr = row[0] ?? '';
  const description = row[3] ?? '';
  const counterparty = row[2] ?? '';
  const direction = row[4] ?? '';
  const amountStr = row[5] ?? '0';

  const amountYuan = parseFloat(amountStr.replace(/[¥,]/g, '')) || 0;
  const amountCents = Math.round(amountYuan * 100);

  let transactionType: 'income' | 'expense' | 'transfer';
  let signedAmount: number;
  if (direction.includes('收入')) {
    transactionType = 'income';
    signedAmount = amountCents;
  } else if (direction.includes('支出')) {
    transactionType = 'expense';
    signedAmount = -amountCents;
  } else {
    transactionType = 'transfer';
    signedAmount = 0;
  }

  const transactionDate = parseWechatDate(dateStr);

  return {
    tempId: `wechat-${lineNum}`,
    transactionDate,
    amount: signedAmount,
    transactionType,
    description,
    counterparty,
    productDescription: description,
    mappedCategoryId: '',
    finalCategoryId: '',
    dedupHash: `${transactionDate}|${signedAmount}|${description}|${counterparty}`,
    isDuplicate: false,
    sourceLine: lineNum,
  };
}

function parseWechatDate(dateStr: string): number {
  const date = new Date(dateStr.replace(/-/g, '/'));
  return isNaN(date.getTime()) ? 0 : date.getTime();
}
