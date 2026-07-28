// dashboard-constants 纯函数测试 / Pure function tests

import { describe, it, expect } from 'vitest';
import {
  computeNetWorthSummary,
  filterCurrentMonthTransactions,
  getRecentTransactions,
  formatTrendData,
} from '@renderer/components/dashboard/dashboard-constants.js';
import type { Account, Transaction, NetWorthSnapshot } from '@shared/types/index.js';

function makeAccount(overrides: Partial<Account>): Account {
  return {
    id: 'acc-1',
    user_id: 'user-1',
    name: 'test',
    asset_class: 'liquid',
    account_type: 'checking',
    current_balance: 0,
    last_updated: 0,
    display_order: 0,
    note: null,
    sync_version: 0,
    updated_at: 0,
    deleted_flag: 0,
    ...overrides,
  };
}

function makeTx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'tx-1',
    user_id: 'user-1',
    account_id: 'acc-1',
    to_account_id: null,
    category_id: null,
    recurring_id: null,
    transaction_type: 'income',
    amount: 10000,
    transaction_date: new Date('2026-07-15').getTime(),
    description: null,
    sync_version: 0,
    updated_at: 0,
    deleted_flag: 0,
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<NetWorthSnapshot>): NetWorthSnapshot {
  return {
    id: 'snap-1',
    user_id: 'user-1',
    snapshot_date: new Date('2026-07-01').getTime(),
    snapshot_year_month: '2026-07',
    total_liquid: 0,
    total_invested: 0,
    total_use_asset: 0,
    total_liability: 0,
    net_worth: 0,
    sync_version: 0,
    updated_at: 0,
    deleted_flag: 0,
    ...overrides,
  };
}

describe('computeNetWorthSummary', () => {
  it('4 种 asset_class 正确分组求和', () => {
    const accounts = [
      makeAccount({ id: 'a1', asset_class: 'liquid', current_balance: 100000 }),
      makeAccount({ id: 'a2', asset_class: 'invested', current_balance: 200000 }),
      makeAccount({ id: 'a3', asset_class: 'use_asset', current_balance: 500000 }),
      makeAccount({ id: 'a4', asset_class: 'liability', current_balance: -80000 }),
    ];
    const result = computeNetWorthSummary(accounts);
    expect(result.totalLiquid).toBe(100000);
    expect(result.totalInvested).toBe(200000);
    expect(result.totalUseAsset).toBe(500000);
    expect(result.totalLiability).toBe(-80000);
    expect(result.totalAssets).toBe(800000);
    expect(result.netWorth).toBe(720000);
  });

  it('空数组返回全 0', () => {
    const result = computeNetWorthSummary([]);
    expect(result).toEqual({
      totalLiquid: 0,
      totalInvested: 0,
      totalUseAsset: 0,
      totalLiability: 0,
      totalAssets: 0,
      netWorth: 0,
    });
  });

  it('liability 为负数时正确计入净资产', () => {
    const accounts = [
      makeAccount({ id: 'a1', asset_class: 'liquid', current_balance: 50000 }),
      makeAccount({ id: 'a2', asset_class: 'liability', current_balance: -30000 }),
    ];
    const result = computeNetWorthSummary(accounts);
    expect(result.totalAssets).toBe(50000);
    expect(result.totalLiability).toBe(-30000);
    expect(result.netWorth).toBe(20000);
  });

  it('净资产为负时正确计算', () => {
    const accounts = [
      makeAccount({ id: 'a1', asset_class: 'liquid', current_balance: 10000 }),
      makeAccount({ id: 'a2', asset_class: 'liability', current_balance: -50000 }),
    ];
    const result = computeNetWorthSummary(accounts);
    expect(result.netWorth).toBe(-40000);
  });
});

describe('filterCurrentMonthTransactions', () => {
  it('只返回本月交易', () => {
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 15).getTime();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15).getTime();

    const txs = [
      makeTx({ id: 't1', transaction_date: thisMonth }),
      makeTx({ id: 't2', transaction_date: lastMonth }),
    ];
    const result = filterCurrentMonthTransactions(txs);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t1');
  });

  it('空数组返回空', () => {
    expect(filterCurrentMonthTransactions([])).toEqual([]);
  });

  it('月初边界包含本月 1 号', () => {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const txs = [makeTx({ id: 't1', transaction_date: firstOfMonth })];
    const result = filterCurrentMonthTransactions(txs);
    expect(result).toHaveLength(1);
  });

  it('下月 1 号不包含', () => {
    const now = new Date();
    const nextMonthFirst = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
    const txs = [makeTx({ id: 't1', transaction_date: nextMonthFirst })];
    const result = filterCurrentMonthTransactions(txs);
    expect(result).toHaveLength(0);
  });
});

describe('getRecentTransactions', () => {
  it('按日期降序排序', () => {
    const txs = [
      makeTx({ id: 't1', transaction_date: 1000 }),
      makeTx({ id: 't2', transaction_date: 3000 }),
      makeTx({ id: 't3', transaction_date: 2000 }),
    ];
    const result = getRecentTransactions(txs, 10);
    expect(result.map(t => t.id)).toEqual(['t2', 't3', 't1']);
  });

  it('限制返回数量', () => {
    const txs = Array.from({ length: 15 }, (_, i) =>
      makeTx({ id: `t${i}`, transaction_date: i })
    );
    const result = getRecentTransactions(txs, 10);
    expect(result).toHaveLength(10);
  });

  it('不足 limit 返回全部', () => {
    const txs = [makeTx({ id: 't1', transaction_date: 1000 })];
    const result = getRecentTransactions(txs, 10);
    expect(result).toHaveLength(1);
  });

  it('空数组返回空', () => {
    expect(getRecentTransactions([], 10)).toEqual([]);
  });

  it('不修改原数组', () => {
    const txs = [
      makeTx({ id: 't1', transaction_date: 1000 }),
      makeTx({ id: 't2', transaction_date: 2000 }),
    ];
    const original = [...txs];
    getRecentTransactions(txs, 10);
    expect(txs.map(t => t.id)).toEqual(original.map(t => t.id));
  });
});

describe('formatTrendData', () => {
  it('snapshot 数组转 Recharts 格式', () => {
    const snapshots = [
      makeSnapshot({ id: 's1', snapshot_year_month: '2026-05', net_worth: 100000 }),
      makeSnapshot({ id: 's2', snapshot_year_month: '2026-06', net_worth: 150000 }),
    ];
    const result = formatTrendData(snapshots);
    expect(result).toEqual([
      { month: '2026-05', netWorth: 1000 },
      { month: '2026-06', netWorth: 1500 },
    ]);
  });

  it('按 year_month 升序排序', () => {
    const snapshots = [
      makeSnapshot({ id: 's2', snapshot_year_month: '2026-06', net_worth: 150000 }),
      makeSnapshot({ id: 's1', snapshot_year_month: '2026-05', net_worth: 100000 }),
    ];
    const result = formatTrendData(snapshots);
    expect(result[0].month).toBe('2026-05');
    expect(result[1].month).toBe('2026-06');
  });

  it('限制近 6 个月', () => {
    const snapshots = Array.from({ length: 8 }, (_, i) => {
      const month = String(i + 1).padStart(2, '0');
      return makeSnapshot({
        id: `s${i}`,
        snapshot_year_month: `2026-${month}`,
        net_worth: i * 100000,
      });
    });
    const result = formatTrendData(snapshots);
    expect(result).toHaveLength(6);
    expect(result[0].month).toBe('2026-03');
    expect(result[5].month).toBe('2026-08');
  });

  it('空数组返回空', () => {
    expect(formatTrendData([])).toEqual([]);
  });

  it('单个 snapshot 返回 1 个点', () => {
    const snapshots = [makeSnapshot({ net_worth: 200000 })];
    const result = formatTrendData(snapshots);
    expect(result).toHaveLength(1);
    expect(result[0].netWorth).toBe(2000);
  });

  it('分转元正确', () => {
    const snapshots = [makeSnapshot({ net_worth: 123456 })];
    const result = formatTrendData(snapshots);
    expect(result[0].netWorth).toBe(1234.56);
  });
});
