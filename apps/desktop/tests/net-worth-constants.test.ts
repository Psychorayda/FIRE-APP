// 净资产趋势页纯函数测试 / Net worth page pure function tests

import { describe, it, expect } from 'vitest';
import type { NetWorthSnapshot } from '@shared/types/index.js';
import {
  filterByTimeRange,
  formatTrendForMetric,
  getAllocationData,
  TIME_RANGE_CONFIG,
  METRIC_CONFIG,
} from '@renderer/components/net-worth/net-worth-constants.js';

function makeSnapshot(overrides: Partial<NetWorthSnapshot>): NetWorthSnapshot {
  return {
    id: 's1',
    user_id: 'user-1',
    snapshot_date: 0,
    snapshot_year_month: '2026-01',
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

describe('TIME_RANGE_CONFIG', () => {
  it('包含 4 个时间范围', () => {
    expect(TIME_RANGE_CONFIG).toHaveLength(4);
    expect(TIME_RANGE_CONFIG.map(c => c.key)).toEqual(['3m', '6m', '1y', 'all']);
  });
});

describe('METRIC_CONFIG', () => {
  it('包含 4 个指标', () => {
    expect(METRIC_CONFIG).toHaveLength(4);
    expect(METRIC_CONFIG.map(c => c.key)).toEqual(['netWorth', 'liquid', 'invested', 'liability']);
  });

  it('每个指标有 dataKey 和 color', () => {
    for (const c of METRIC_CONFIG) {
      expect(c.dataKey).toBeTruthy();
      expect(c.color).toMatch(/^#/);
    }
  });
});

describe('filterByTimeRange', () => {
  const snapshots = [
    makeSnapshot({ id: 's1', snapshot_year_month: '2026-01' }),
    makeSnapshot({ id: 's2', snapshot_year_month: '2026-02' }),
    makeSnapshot({ id: 's3', snapshot_year_month: '2026-03' }),
    makeSnapshot({ id: 's4', snapshot_year_month: '2026-04' }),
    makeSnapshot({ id: 's5', snapshot_year_month: '2026-05' }),
    makeSnapshot({ id: 's6', snapshot_year_month: '2026-06' }),
    makeSnapshot({ id: 's7', snapshot_year_month: '2026-07' }),
  ];

  it('3m 返回最近 3 个月（升序）', () => {
    const result = filterByTimeRange(snapshots, '3m');
    expect(result).toHaveLength(3);
    expect(result.map(s => s.id)).toEqual(['s5', 's6', 's7']);
  });

  it('6m 返回最近 6 个月（升序）', () => {
    const result = filterByTimeRange(snapshots, '6m');
    expect(result).toHaveLength(6);
    expect(result.map(s => s.id)).toEqual(['s2', 's3', 's4', 's5', 's6', 's7']);
  });

  it('1y 返回最近 12 个月（数据不足时返回全部）', () => {
    const result = filterByTimeRange(snapshots, '1y');
    expect(result).toHaveLength(7);
  });

  it('all 返回全部（升序）', () => {
    const result = filterByTimeRange(snapshots, 'all');
    expect(result).toHaveLength(7);
    expect(result.map(s => s.id)).toEqual(['s1', 's2', 's3', 's4', 's5', 's6', 's7']);
  });

  it('空数组返回空数组', () => {
    expect(filterByTimeRange([], '6m')).toEqual([]);
  });

  it('数据不足 N 条时返回全部（升序）', () => {
    const few = [makeSnapshot({ id: 's1', snapshot_year_month: '2026-01' })];
    const result = filterByTimeRange(few, '6m');
    expect(result).toHaveLength(1);
  });
});

describe('formatTrendForMetric', () => {
  const snapshots = [
    makeSnapshot({ id: 's1', snapshot_year_month: '2026-01', net_worth: 100000, total_liquid: 50000 }),
    makeSnapshot({ id: 's2', snapshot_year_month: '2026-02', net_worth: 200000, total_liquid: 80000 }),
  ];

  it('netWorth 指标正确转换金额', () => {
    const result = formatTrendForMetric(snapshots, 'netWorth');
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ month: '2026-01', value: 1000, snapshotDate: 0 });
    expect(result[1]).toEqual({ month: '2026-02', value: 2000, snapshotDate: 0 });
  });

  it('liquid 指标使用 total_liquid 字段', () => {
    const result = formatTrendForMetric(snapshots, 'liquid');
    expect(result[0].value).toBe(500);
    expect(result[1].value).toBe(800);
  });

  it('invested 指标使用 total_invested 字段', () => {
    const result = formatTrendForMetric(snapshots, 'invested');
    expect(result[0].value).toBe(0);
  });

  it('liability 指标使用 total_liability 字段（负数保留）', () => {
    const negSnapshots = [
      makeSnapshot({ id: 's1', snapshot_year_month: '2026-01', total_liability: -100000 }),
    ];
    const result = formatTrendForMetric(negSnapshots, 'liability');
    expect(result[0].value).toBe(-1000);
  });

  it('空数组返回空数组', () => {
    expect(formatTrendForMetric([], 'netWorth')).toEqual([]);
  });
});

describe('getAllocationData', () => {
  it('空数组返回 hasData: false', () => {
    const result = getAllocationData([]);
    expect(result.hasData).toBe(false);
    expect(result.items).toEqual([]);
    expect(result.netWorth).toBe(0);
    expect(result.totalAssets).toBe(0);
  });

  it('取最新月份快照', () => {
    const snapshots = [
      makeSnapshot({ id: 's1', snapshot_year_month: '2026-01', total_liquid: 100000, net_worth: 100000 }),
      makeSnapshot({ id: 's2', snapshot_year_month: '2026-02', total_liquid: 200000, net_worth: 200000 }),
    ];
    const result = getAllocationData(snapshots);
    expect(result.hasData).toBe(true);
    expect(result.items[0].value).toBe(2000); // 最新月份 200000 分 = 2000 元
  });

  it('4 类资产金额和百分比正确', () => {
    const snapshots = [
      makeSnapshot({
        snapshot_year_month: '2026-01',
        total_liquid: 100000,    // 1000 元
        total_invested: 200000,  // 2000 元
        total_use_asset: 100000, // 1000 元
        total_liability: -50000, // -500 元
        net_worth: 350000,       // 3500 元
      }),
    ];
    const result = getAllocationData(snapshots);
    expect(result.totalAssets).toBe(4000); // 1000+2000+1000
    expect(result.netWorth).toBe(3500);
    expect(result.items).toHaveLength(4);
    expect(result.items[0]).toEqual({ name: '流动资产', value: 1000, color: '#3B82F6', percent: 25 });
    expect(result.items[1]).toEqual({ name: '投资资产', value: 2000, color: '#8B5CF6', percent: 50 });
    expect(result.items[2]).toEqual({ name: '使用资产', value: 1000, color: '#F59E0B', percent: 25 });
    expect(result.items[3]).toEqual({ name: '负债', value: -500, color: '#EF4444', percent: -12.5 });
  });

  it('总资产为 0 时百分比全为 0（避免除零）', () => {
    const snapshots = [
      makeSnapshot({
        snapshot_year_month: '2026-01',
        total_liquid: 0,
        total_invested: 0,
        total_use_asset: 0,
        total_liability: 0,
        net_worth: 0,
      }),
    ];
    const result = getAllocationData(snapshots);
    expect(result.totalAssets).toBe(0);
    for (const item of result.items) {
      expect(item.percent).toBe(0);
    }
  });
});
