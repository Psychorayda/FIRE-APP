import type { CsvImportTemplate, ParsedCsvTransaction } from './types.js';

export const alipayTemplate: CsvImportTemplate = {
  id: 'alipay',
  displayName: '支付宝账单',
  description: '支付宝 App 导出的交易账单 CSV（GBK 编码，前 24 行元信息）',
  fileSignatures: ['支付宝（中国）网络技术有限公司'],
  encoding: 'gbk',
  headerLineCount: 24,
  amountConvention: 'signed',
  columnMapping: {
    date: { columnName: '交易创建时间', format: 'yyyy-mm-dd' },
    amount: { columnName: '金额（元）' },
    description: { columnName: '商品名称' },
    counterparty: { columnName: '交易对方' },
    productDescription: { columnName: '商品名称' },
    category: { columnName: '类型' },
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
    '退款': '__CATEGORY_INVESTMENT_INCOME__',
    '工资收入': '__CATEGORY_SALARY__',
    '投资理财': '__CATEGORY_INVESTMENT_INCOME__',
  },
  parseHook: (rawRows: string[][]): ParsedCsvTransaction[] => {
    const dataRows = rawRows.slice(24).filter(row =>
      row.length > 1 && !row[0]?.startsWith('已') && !row[0]?.startsWith('-') && row.some(cell => cell.trim() !== '')
    );
    return dataRows.map((row, idx) => parseAlipayRow(row, idx));
  },
};

function parseAlipayRow(row: string[], lineNum: number): ParsedCsvTransaction {
  // 索引：2=交易创建时间, 5=类型, 7=交易对方, 8=商品名称, 9=金额
  const dateStr = row[2] ?? '';
  const amountStr = row[9] ?? '0';
  const description = row[8] ?? '';
  const counterparty = row[7] ?? '';
  const categoryType = row[5] ?? '';

  const amountYuan = parseFloat(amountStr.replace(/[¥￥,]/g, '')) || 0;
  const amountCents = Math.round(amountYuan * 100);
  const transactionDate = parseAlipayDate(dateStr);
  const transactionType = amountCents > 0 ? 'income' : amountCents < 0 ? 'expense' : 'transfer';

  return {
    tempId: `alipay-${lineNum}`,
    transactionDate,
    amount: amountCents,
    transactionType,
    description,
    counterparty,
    productDescription: description,
    mappedCategoryId: '',
    finalCategoryId: '',
    dedupHash: `${transactionDate}|${amountCents}|${description}|${counterparty}`,
    isDuplicate: false,
    sourceLine: lineNum,
  };
}

function parseAlipayDate(dateStr: string): number {
  const date = new Date(dateStr.replace(/-/g, '/'));
  return isNaN(date.getTime()) ? 0 : date.getTime();
}
