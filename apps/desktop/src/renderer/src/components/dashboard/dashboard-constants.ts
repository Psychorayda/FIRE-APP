// 仪表盘纯函数与类型 / Dashboard pure functions and types
// 净资产汇总、本月交易筛选、近期交易切片、趋势数据格式化 — 全部无副作用
// Net worth summary, current month filter, recent slice, trend formatting — all pure

import type { Account, Transaction, NetWorthSnapshot } from '@shared/types/index.js';
import { centsToYuan } from '@shared/utils/money.js';

/** 净资产汇总结果 */
// Net worth summary result
export interface NetWorthSummary {
  totalLiquid: number;     // 流动资产（分）
  totalInvested: number;   // 投资资产（分）
  totalUseAsset: number;   // 使用资产（分）
  totalLiability: number;  // 负债（分，负数）
  totalAssets: number;     // 总资产 = liquid + invested + use_asset（分）
  netWorth: number;        // 净资产 = totalAssets + totalLiability（分）
}

/** 趋势图数据点 */
// Trend chart data point
export interface TrendPoint {
  month: string;     // YYYY-MM
  netWorth: number;  // 元（已转元，非分）
}

/** 按资产类别聚合净资产 */
// Aggregate net worth by asset class
export function computeNetWorthSummary(accounts: Account[]): NetWorthSummary {
  const result = {
    totalLiquid: 0,
    totalInvested: 0,
    totalUseAsset: 0,
    totalLiability: 0,
  };

  for (const acc of accounts) {
    switch (acc.asset_class) {
      case 'liquid':    result.totalLiquid += acc.current_balance; break;
      case 'invested':  result.totalInvested += acc.current_balance; break;
      case 'use_asset': result.totalUseAsset += acc.current_balance; break;
      case 'liability': result.totalLiability += acc.current_balance; break;
    }
  }

  const totalAssets = result.totalLiquid + result.totalInvested + result.totalUseAsset;
  const netWorth = totalAssets + result.totalLiability;

  return { ...result, totalAssets, netWorth };
}

/** 取近期交易（按日期降序，限制数量） */
// Get recent transactions (date desc, limited count)
export function getRecentTransactions(txs: Transaction[], limit: number): Transaction[] {
  const copy = [...txs];
  copy.sort((a, b) => b.transaction_date - a.transaction_date);
  return copy.slice(0, limit);
}

/** 格式化趋势数据（snapshot → Recharts 格式） */
// Format trend data (snapshot → Recharts format)
export function formatTrendData(snapshots: NetWorthSnapshot[]): TrendPoint[] {
  const copy = [...snapshots];
  copy.sort((a, b) => a.snapshot_year_month.localeCompare(b.snapshot_year_month));
  const last6 = copy.slice(-6);
  return last6.map(s => ({
    month: s.snapshot_year_month,
    netWorth: centsToYuan(s.net_worth),
  }));
}
