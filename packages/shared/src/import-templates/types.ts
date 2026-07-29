export type ParsedTransactionType = 'income' | 'expense' | 'transfer';

export interface ParsedCsvTransaction {
  tempId: string;
  transactionDate: number;
  amount: number; // 分：正收入/负支出/0 转账
  transactionType: ParsedTransactionType;
  description: string; // 映射到 transactions.description
  counterparty?: string;
  productDescription?: string;
  mappedCategoryId?: string;     // 模板映射占位符
  inferredCategoryId?: string;   // 关键词推断占位符
  finalCategoryId: string;       // 由 import-service 填充真实 UUID
  dedupHash: string;
  isDuplicate: boolean;
  sourceLine: number;
}

export interface ColumnMapping {
  date: { columnName?: string; columnIndex?: number; format: 'yyyy-mm-dd' | 'yyyy/mm/dd' | 'dd-mm-yyyy' | 'timestamp' };
  amount: { columnName?: string; columnIndex?: number };
  description: { columnName?: string; columnIndex?: number };
  counterparty?: { columnName?: string; columnIndex?: number };
  productDescription?: { columnName?: string; columnIndex?: number };
  category?: { columnName?: string; columnIndex?: number };
}

export interface CsvImportTemplate {
  id: string;
  displayName: string;
  description: string;
  fileSignatures: string[];
  encoding: 'utf-8' | 'gbk';
  headerLineCount: number;
  columnMapping: ColumnMapping;
  categoryMapping: Record<string, string>;
  amountConvention: 'positive_is_income' | 'positive_is_expense' | 'signed';
  parseHook?: (rawRows: string[][]) => ParsedCsvTransaction[];
}
