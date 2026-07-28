// transaction-constants 纯函数测试 / transaction-constants pure function tests

import { describe, it, expect } from 'vitest';
import type { Transaction } from '@shared/types/index.js';
import {
  TRANSACTION_TYPE_CONFIG,
  TRANSACTION_TYPE_OPTIONS,
  formatAmount,
  formatDate,
  computeOverview,
  filterTransactions,
  sortTransactions,
  hasActiveFilters,
  type TransactionFilters,
} from '@renderer/components/transactions/transaction-constants.js';

// 构造基础交易 mock / Build base transaction mock
function makeTx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'tx-1',
    user_id: 'user-1',
    account_id: 'acc-1',
    to_account_id: null,
    category_id: null,
    recurring_id: null,
    transaction_type: 'expense',
    amount: 10000,
    transaction_date: new Date('2026-07-15').getTime(),
    description: null,
    sync_version: 0,
    updated_at: 0,
    deleted_flag: 0,
    ...overrides,
  };
}

const EMPTY_FILTERS: TransactionFilters = {
  type: '',
  account_id: '',
  category_id: '',
  dateFrom: '',
  dateTo: '',
};

describe('TRANSACTION_TYPE_CONFIG', () => {
  it('包含 4 种类型', () => {
    expect(Object.keys(TRANSACTION_TYPE_CONFIG)).toHaveLength(4);
    expect(TRANSACTION_TYPE_CONFIG.income).toBeDefined();
    expect(TRANSACTION_TYPE_CONFIG.expense).toBeDefined();
    expect(TRANSACTION_TYPE_CONFIG.transfer).toBeDefined();
    expect(TRANSACTION_TYPE_CONFIG.initial_balance).toBeDefined();
  });

  it('每种类型有 label/dotClass/tagClass/sign', () => {
    for (const key of Object.keys(TRANSACTION_TYPE_CONFIG) as (keyof typeof TRANSACTION_TYPE_CONFIG)[]) {
      const config = TRANSACTION_TYPE_CONFIG[key];
      expect(config.label).toBeTruthy();
      expect(config.dotClass).toBeTruthy();
      expect(config.tagClass).toBeTruthy();
      expect(config.sign).toBeTruthy();
    }
  });
});

describe('TRANSACTION_TYPE_OPTIONS', () => {
  it('长度 = 4', () => {
    expect(TRANSACTION_TYPE_OPTIONS).toHaveLength(4);
  });

  it('每个选项有 label 和 value', () => {
    for (const opt of TRANSACTION_TYPE_OPTIONS) {
      expect(opt.label).toBeTruthy();
      expect(opt.value).toBeTruthy();
    }
  });
});

describe('formatAmount', () => {
  it('0 分 → 包含 0.00', () => {
    expect(formatAmount(0)).toContain('0.00');
  });

  it('正数 10000 分 → 包含 100.00', () => {
    expect(formatAmount(10000)).toContain('100.00');
  });

  it('负数 -5000 分 → 包含 50.00 和负号', () => {
    const result = formatAmount(-5000);
    expect(result).toContain('50.00');
    expect(result).toContain('-');
  });
});

describe('formatDate', () => {
  it('时间戳 → YYYY-MM-DD', () => {
    const ms = new Date('2026-07-15T08:30:00').getTime();
    expect(formatDate(ms)).toBe('2026-07-15');
  });

  it('一位数月日补零', () => {
    const ms = new Date('2026-01-05T12:00:00').getTime();
    expect(formatDate(ms)).toBe('2026-01-05');
  });
});

describe('computeOverview', () => {
  it('空数组 → 全部 0', () => {
    const overview = computeOverview([]);
    expect(overview.income).toBe(0);
    expect(overview.expense).toBe(0);
    expect(overview.transfer).toBe(0);
    expect(overview.balance).toBe(0);
  });

  it('纯 income', () => {
    const txs = [makeTx({ transaction_type: 'income', amount: 10000 })];
    const overview = computeOverview(txs);
    expect(overview.income).toBe(10000);
    expect(overview.expense).toBe(0);
    expect(overview.balance).toBe(10000);
  });

  it('纯 expense', () => {
    const txs = [makeTx({ transaction_type: 'expense', amount: 5000 })];
    const overview = computeOverview(txs);
    expect(overview.income).toBe(0);
    expect(overview.expense).toBe(5000);
    expect(overview.balance).toBe(-5000);
  });

  it('initial_balance 计入 income', () => {
    const txs = [makeTx({ transaction_type: 'initial_balance', amount: 20000 })];
    const overview = computeOverview(txs);
    expect(overview.income).toBe(20000);
    expect(overview.balance).toBe(20000);
  });

  it('transfer 不计入 balance', () => {
    const txs = [
      makeTx({ id: 'tx-1', transaction_type: 'income', amount: 10000 }),
      makeTx({ id: 'tx-2', transaction_type: 'transfer', amount: 5000 }),
    ];
    const overview = computeOverview(txs);
    expect(overview.income).toBe(10000);
    expect(overview.expense).toBe(0);
    expect(overview.transfer).toBe(5000);
    expect(overview.balance).toBe(10000);
  });

  it('混合：income + expense + transfer', () => {
    const txs = [
      makeTx({ id: 'tx-1', transaction_type: 'income', amount: 10000 }),
      makeTx({ id: 'tx-2', transaction_type: 'expense', amount: 3000 }),
      makeTx({ id: 'tx-3', transaction_type: 'transfer', amount: 2000 }),
      makeTx({ id: 'tx-4', transaction_type: 'initial_balance', amount: 5000 }),
    ];
    const overview = computeOverview(txs);
    expect(overview.income).toBe(15000);
    expect(overview.expense).toBe(3000);
    expect(overview.transfer).toBe(2000);
    expect(overview.balance).toBe(12000);
  });
});

describe('filterTransactions', () => {
  const txs: Transaction[] = [
    makeTx({ id: 'tx-1', transaction_type: 'income', account_id: 'acc-1', to_account_id: null, category_id: 'cat-1', transaction_date: new Date('2026-07-10').getTime() }),
    makeTx({ id: 'tx-2', transaction_type: 'expense', account_id: 'acc-2', to_account_id: null, category_id: 'cat-2', transaction_date: new Date('2026-07-15').getTime() }),
    makeTx({ id: 'tx-3', transaction_type: 'transfer', account_id: 'acc-1', to_account_id: 'acc-2', category_id: null, transaction_date: new Date('2026-07-16').getTime() }),
    makeTx({ id: 'tx-4', transaction_type: 'expense', account_id: 'acc-3', to_account_id: null, category_id: 'cat-1', transaction_date: new Date('2026-07-17').getTime() }),
  ];

  it('空筛选 → 返回全部', () => {
    expect(filterTransactions(txs, EMPTY_FILTERS)).toHaveLength(4);
  });

  it('type 筛选', () => {
    const result = filterTransactions(txs, { ...EMPTY_FILTERS, type: 'expense' });
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.id)).toEqual(['tx-2', 'tx-4']);
  });

  it('account 筛选含 transfer 双向匹配', () => {
    // acc-1 是 tx-1 的 account_id，也是 tx-3 的 account_id（source）
    const result = filterTransactions(txs, { ...EMPTY_FILTERS, account_id: 'acc-1' });
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.id)).toEqual(['tx-1', 'tx-3']);
  });

  it('account 筛选匹配 to_account_id（transfer 目标）', () => {
    // acc-2 是 tx-2 的 account_id，也是 tx-3 的 to_account_id（target）
    const result = filterTransactions(txs, { ...EMPTY_FILTERS, account_id: 'acc-2' });
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.id)).toEqual(['tx-2', 'tx-3']);
  });

  it('category 筛选', () => {
    const result = filterTransactions(txs, { ...EMPTY_FILTERS, category_id: 'cat-1' });
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.id)).toEqual(['tx-1', 'tx-4']);
  });

  it('dateFrom 筛选', () => {
    const result = filterTransactions(txs, { ...EMPTY_FILTERS, dateFrom: '2026-07-16' });
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.id)).toEqual(['tx-3', 'tx-4']);
  });

  it('dateTo 筛选含当天', () => {
    // dateTo=2026-07-16 应包含 7/10, 7/15, 7/16，不含 7/17
    const result = filterTransactions(txs, { ...EMPTY_FILTERS, dateTo: '2026-07-16' });
    expect(result).toHaveLength(3);
    expect(result.map((t) => t.id)).toEqual(['tx-1', 'tx-2', 'tx-3']);
  });

  it('组合筛选：type + account', () => {
    const result = filterTransactions(txs, { ...EMPTY_FILTERS, type: 'transfer', account_id: 'acc-1' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('tx-3');
  });

  it('无匹配', () => {
    const result = filterTransactions(txs, { ...EMPTY_FILTERS, account_id: 'acc-999' });
    expect(result).toHaveLength(0);
  });
});

describe('sortTransactions', () => {
  const txs: Transaction[] = [
    makeTx({ id: 'tx-a', amount: 3000, transaction_date: new Date('2026-07-10').getTime() }),
    makeTx({ id: 'tx-b', amount: 10000, transaction_date: new Date('2026-07-15').getTime() }),
    makeTx({ id: 'tx-c', amount: 5000, transaction_date: new Date('2026-07-20').getTime() }),
  ];

  it('date-desc（默认）：日期降序', () => {
    const result = sortTransactions(txs, 'date-desc');
    expect(result.map((t) => t.id)).toEqual(['tx-c', 'tx-b', 'tx-a']);
  });

  it('date-asc：日期升序', () => {
    const result = sortTransactions(txs, 'date-asc');
    expect(result.map((t) => t.id)).toEqual(['tx-a', 'tx-b', 'tx-c']);
  });

  it('amount-desc：金额降序', () => {
    const result = sortTransactions(txs, 'amount-desc');
    expect(result.map((t) => t.id)).toEqual(['tx-b', 'tx-c', 'tx-a']);
  });

  it('amount-asc：金额升序', () => {
    const result = sortTransactions(txs, 'amount-asc');
    expect(result.map((t) => t.id)).toEqual(['tx-a', 'tx-c', 'tx-b']);
  });

  it('不修改原数组', () => {
    const original = [...txs];
    sortTransactions(txs, 'amount-asc');
    expect(txs.map((t) => t.id)).toEqual(original.map((t) => t.id));
  });
});

describe('hasActiveFilters', () => {
  it('全空 → false', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
  });

  it('有 type → true', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, type: 'expense' })).toBe(true);
  });

  it('有 account_id → true', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, account_id: 'acc-1' })).toBe(true);
  });

  it('有 dateFrom → true', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, dateFrom: '2026-07-01' })).toBe(true);
  });
});
