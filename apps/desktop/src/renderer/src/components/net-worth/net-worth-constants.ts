// 净资产趋势页纯函数与类型 / Net worth page pure functions and types
// 时间范围筛选、趋势格式化、配比数据计算 — 全部无副作用
// Time range filter, trend formatting, allocation calc — all pure

import type { NetWorthSnapshot } from '@shared/types/index.js';
import { centsToYuan } from '@shared/utils/money.js';

/** 时间范围配置 */
// Time range config
export const TIME_RANGE_CONFIG = [
  { key: '3m', label: '近3月', months: 3 },
  { key: '6m', label: '近6月', months: 6 },
  { key: '1y', label: '近1年', months: 12 },
  { key: 'all', label: '全部', months: Infinity },
] as const;

export type TimeRangeKey = '3m' | '6m' | '1y' | 'all';

/** 指标配置 */
// Metric config
export const METRIC_CONFIG = [
  { key: 'netWorth', label: '净资产', dataKey: 'net_worth' as const, color: '#3b82f6' },
  { key: 'liquid', label: '流动', dataKey: 'total_liquid' as const, color: '#3b82f6' },
  { key: 'invested', label: '投资', dataKey: 'total_invested' as const, color: '#8b5cf6' },
  { key: 'liability', label: '负债', dataKey: 'total_liability' as const, color: '#ef4444' },
] as const;

export type MetricKey = 'netWorth' | 'liquid' | 'invested' | 'liability';

/** 趋势图数据点 */
// Trend chart data point
export interface TrendPoint {
  month: string;        // YYYY-MM
  value: number;        // 元（已转元，非分）
  snapshotDate: number; // 原始时间戳，用于 tooltip
}

/** 配比单项 */
// Allocation item
export interface AllocationItem {
  name: string;
  value: number;   // 元
  color: string;
  percent: number; // 0-100
}

/** 配比数据 */
// Allocation data
export interface AllocationData {
  items: AllocationItem[];    // 4 类资产
  netWorth: number;            // 元
  totalAssets: number;         // 元（liquid + invested + use_asset）
  hasData: boolean;
}

/** 按时间范围筛选 snapshots（返回升序） */
// Filter snapshots by time range (returns ascending)
export function filterByTimeRange(
  snapshots: NetWorthSnapshot[],
  timeRange: TimeRangeKey
): NetWorthSnapshot[] {
  const config = TIME_RANGE_CONFIG.find(c => c.key === timeRange)!;
  if (config.months === Infinity) {
    return [...snapshots].sort((a, b) => a.snapshot_year_month.localeCompare(b.snapshot_year_month));
  }
  // 按 year_month 降序取 N 条，再升序返回
  // Sort desc by year_month, take N, then sort asc
  return [...snapshots]
    .sort((a, b) => b.snapshot_year_month.localeCompare(a.snapshot_year_month))
    .slice(0, config.months)
    .sort((a, b) => a.snapshot_year_month.localeCompare(b.snapshot_year_month));
}

/** 格式化趋势数据（snapshot → Recharts 格式） */
// Format trend data (snapshot → Recharts format)
export function formatTrendForMetric(
  snapshots: NetWorthSnapshot[],
  metric: MetricKey
): TrendPoint[] {
  const config = METRIC_CONFIG.find(c => c.key === metric)!;
  return snapshots.map(s => ({
    month: s.snapshot_year_month,
    value: centsToYuan(s[config.dataKey]),
    snapshotDate: s.snapshot_date,
  }));
}

/** 取最新月份配比数据 */
// Get allocation data from latest month snapshot
export function getAllocationData(snapshots: NetWorthSnapshot[]): AllocationData {
  if (snapshots.length === 0) {
    return { items: [], netWorth: 0, totalAssets: 0, hasData: false };
  }
  // 取最新月份（year_month 最大的）
  // Get latest month (max year_month)
  const latest = [...snapshots]
    .sort((a, b) => b.snapshot_year_month.localeCompare(a.snapshot_year_month))[0];

  const liquid = centsToYuan(latest.total_liquid);
  const invested = centsToYuan(latest.total_invested);
  const useAsset = centsToYuan(latest.total_use_asset);
  const liability = centsToYuan(latest.total_liability);
  const totalAssets = liquid + invested + useAsset;

  const items: AllocationItem[] = [
    { name: '流动资产', value: liquid, color: '#3B82F6', percent: totalAssets > 0 ? (liquid / totalAssets) * 100 : 0 },
    { name: '投资资产', value: invested, color: '#8B5CF6', percent: totalAssets > 0 ? (invested / totalAssets) * 100 : 0 },
    { name: '使用资产', value: useAsset, color: '#F59E0B', percent: totalAssets > 0 ? (useAsset / totalAssets) * 100 : 0 },
    { name: '负债', value: liability, color: '#EF4444', percent: totalAssets > 0 ? (liability / totalAssets) * 100 : 0 },
  ];

  return {
    items,
    netWorth: centsToYuan(latest.net_worth),
    totalAssets,
    hasData: true,
  };
}
