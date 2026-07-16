// 交易相关常量与纯函数 / Transaction constants and pure functions
// 包含类型配置、格式化、筛选、排序、概览计算 — 全部无副作用，易于单元测试
// Includes type config, formatting, filtering, sorting, overview computation — all pure, easily testable

import type { Transaction, TransactionType } from '@shared/types/index.js';
import { centsToYuan } from '@shared/utils/money.js';

/** 交易类型配置：标签、色点类名、标签类名、金额符号 */
// Transaction type config: label, dot class, tag class, amount sign
export const TRANSACTION_TYPE_CONFIG: Record<TransactionType, {
  label: string;
  dotClass: string;
  tagClass: string;
  sign: string;
}> = {
  income: { label: '收入', dotClass: 'bg-green-500', tagClass: 'bg-green-100 text-green-700', sign: '+' },
  expense: { label: '支出', dotClass: 'bg-red-500', tagClass: 'bg-red-100 text-red-700', sign: '-' },
  transfer: { label: '转账', dotClass: 'bg-blue-500', tagClass: 'bg-blue-100 text-blue-700', sign: '⟷' },
  initial_balance: { label: '初始余额', dotClass: 'bg-purple-500', tagClass: 'bg-purple-100 text-purple-700', sign: '+' },
};

/** 交易类型选项（供 Select 组件使用） */
// Transaction type options (for Select component)
export const TRANSACTION_TYPE_OPTIONS: { label: string; value: TransactionType }[] = [
  { label: '收入', value: 'income' },
  { label: '支出', value: 'expense' },
  { label: '转账', value: 'transfer' },
  { label: '初始余额', value: 'initial_balance' },
];

/** 筛选状态：全部 string，空 = '' 表示不筛选 */
// Filter state: all strings, empty = '' means no filter
export interface TransactionFilters {
  type: string;
  account_id: string;
  category_id: string;
  dateFrom: string;
  dateTo: string;
}

/** 概览聚合结果 */
// Overview aggregation result
export interface TransactionOverview {
  income: number;    // 含 initial_balance / includes initial_balance
  expense: number;
  transfer: number;  // 不计入 balance / not counted in balance
  balance: number;   // income - expense
}

/** 分转元并格式化为人民币货币字符串 */
// Convert cents to yuan and format as CNY currency string
export function formatAmount(cents: number): string {
  const yuan = centsToYuan(cents);
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
  }).format(yuan);
}

/** 时间戳 → YYYY-MM-DD 字符串 */
// Timestamp → YYYY-MM-DD string
export function formatDate(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 从交易数组前端计算概览（无 IPC 往返） */
// Compute overview from transactions array in-memory (no IPC roundtrip)
export function computeOverview(txs: Transaction[]): TransactionOverview {
  const result: TransactionOverview = { income: 0, expense: 0, transfer: 0, balance: 0 };
  for (const tx of txs) {
    if (tx.transaction_type === 'income' || tx.transaction_type === 'initial_balance') {
      result.income += tx.amount;
    } else if (tx.transaction_type === 'expense') {
      result.expense += tx.amount;
    } else if (tx.transaction_type === 'transfer') {
      result.transfer += tx.amount;
    }
  }
  result.balance = result.income - result.expense;
  return result;
}

/** 前端内存筛选 */
// In-memory filtering
export function filterTransactions(txs: Transaction[], filters: TransactionFilters): Transaction[] {
  return txs.filter((tx) => {
    if (filters.type && tx.transaction_type !== filters.type) return false;
    // 账户筛选：双向匹配（account_id 或 to_account_id）
    // Account filter: bidirectional match (account_id or to_account_id)
    if (filters.account_id && tx.account_id !== filters.account_id && tx.to_account_id !== filters.account_id) return false;
    if (filters.category_id && tx.category_id !== filters.category_id) return false;
    if (filters.dateFrom && tx.transaction_date < new Date(filters.dateFrom).getTime()) return false;
    // dateTo 含当天：截止到次日 0 点
    // dateTo inclusive: up to next day 00:00
    if (filters.dateTo && tx.transaction_date >= new Date(filters.dateTo).getTime() + 86400000) return false;
    return true;
  });
}

/** 排序：date-desc(默认), date-asc, amount-desc, amount-asc */
// Sort: date-desc (default), date-asc, amount-desc, amount-asc
export function sortTransactions(txs: Transaction[], sortBy: string): Transaction[] {
  const copy = [...txs];
  switch (sortBy) {
    case 'date-asc':
      return copy.sort((a, b) => a.transaction_date - b.transaction_date);
    case 'amount-desc':
      return copy.sort((a, b) => b.amount - a.amount);
    case 'amount-asc':
      return copy.sort((a, b) => a.amount - b.amount);
    default:
      return copy.sort((a, b) => b.transaction_date - a.transaction_date);
  }
}

/** 判断是否有激活的筛选条件 */
// Check if any filter is active
export function hasActiveFilters(filters: TransactionFilters): boolean {
  return Boolean(filters.type || filters.account_id || filters.category_id || filters.dateFrom || filters.dateTo);
}
