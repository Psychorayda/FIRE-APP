# M5 净资产趋势页实施计划 / M5 Net Worth Trend Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 FIRE App 净资产趋势页，替换占位页，提供趋势折线图（4 指标×4 时间范围）+ 资产配比环形图 + 配比明细列表。

**Architecture:** 复刻 M4 模式：容器组件 NetWorthPage + 纯展示子组件（TrendChart、AllocationDonut、AllocationDetail）+ 纯函数模块 net-worth-constants.ts + snapshot-store.ts。TDD 流程，纯函数先行。

**Tech Stack:** React 19、Zustand 5、Recharts 2.x、Tailwind CSS 4、vitest 2、@testing-library/react 16

**Spec:** `docs/superpowers/specs/2026-07-28-fire-app-milestone5-net-worth-trend-design.md`

---

## 文件结构

### 新建文件（7 个）

| 文件 | 职责 |
|------|------|
| `apps/desktop/src/renderer/src/stores/snapshot-store.ts` | snapshot 数据管理（fetchSnapshots + loading/error） |
| `apps/desktop/src/renderer/src/components/net-worth/net-worth-constants.ts` | 纯函数：filterByTimeRange、formatTrendForMetric、getAllocationData + 配置常量 |
| `apps/desktop/src/renderer/src/components/net-worth/TrendChart.tsx` | 趋势折线图 + 时间范围按钮组 + 指标单选 |
| `apps/desktop/src/renderer/src/components/net-worth/AllocationDonut.tsx` | 资产配比环形图 |
| `apps/desktop/src/renderer/src/components/net-worth/AllocationDetail.tsx` | 配比明细列表 |
| `apps/desktop/tests/net-worth-constants.test.ts` | 纯函数测试 |
| `apps/desktop/tests/net-worth-components.test.tsx` | 组件测试 |

### 修改文件（1 个）

| 文件 | 修改 |
|------|------|
| `apps/desktop/src/renderer/src/pages/NetWorthPage.tsx` | 完全重写：占位页 → 容器组件 |

### 不修改文件

- 数据层（snapshot model/service/IPC/handlers 已就位）
- dashboard 组件（独立实现，不复用）
- 路由配置（`/net-worth` 路由已存在，指向 NetWorthPage）

---

## 关键约定

1. **金额单位**：数据库存储整数分，UI 展示元（通过 `centsToYuan` 转换）
2. **Recharts mock**：测试中 mock recharts（jsdom 下 SVG 渲染有问题），参考 dashboard-components.test.tsx 的 mock 方式
3. **window.dataAccess mock**：vitest.setup.ts 已配置 `snapshot.list` 为 `vi.fn()`
4. **dataAccess.getSnapshots**：调用 `window.dataAccess.snapshot.list`
5. **路径**：所有文件在仓库根目录下（非 `FIRE APP/` 子目录）
6. **沙箱环境**：CI=true，无 TTY，命令非交互模式。pnpm test 已配置为 `vitest run`（一次性）
7. **空状态文案**：0 条"暂无趋势数据"/"暂无配比数据"/"暂无明细数据"；1 条趋势图"仅 1 个月数据，需至少 2 个月显示趋势"（配比图和明细正常渲染）

---

## Task 1: 创建 snapshot-store.ts

**Files:**
- Create: `apps/desktop/src/renderer/src/stores/snapshot-store.ts`

- [ ] **Step 1: 创建 snapshot-store.ts**

```typescript
// 快照状态管理 / Snapshot state management
// 拉取净资产快照数据，供净资产趋势页使用

import { create } from 'zustand';
import type { NetWorthSnapshot } from '@shared/types/index.js';
import { dataAccess } from '../data/data-access.js';

interface SnapshotStore {
  snapshots: NetWorthSnapshot[];
  loading: boolean;
  error: string | null;

  fetchSnapshots: (userId: string) => Promise<void>;
  clear: () => void;
}

export const useSnapshotStore = create<SnapshotStore>((set) => ({
  snapshots: [],
  loading: false,
  error: null,

  fetchSnapshots: async (userId) => {
    set({ loading: true, error: null });
    try {
      const snapshots = await dataAccess.getSnapshots(userId);
      set({ snapshots, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  clear: () => set({ snapshots: [], error: null, loading: false }),
}));
```

- [ ] **Step 2: 提交**

```bash
git -C /workspace add apps/desktop/src/renderer/src/stores/snapshot-store.ts
git -C /workspace commit -m "feat(net-worth): add snapshot-store

Zustand store for net worth snapshots, follows account/transaction
store pattern. fetchSnapshots + loading/error state."
```

---

## Task 2: 创建 net-worth-constants.ts + 测试（TDD）

**Files:**
- Create: `apps/desktop/tests/net-worth-constants.test.ts`
- Create: `apps/desktop/src/renderer/src/components/net-worth/net-worth-constants.ts`

- [ ] **Step 1: 写失败测试**

创建 `apps/desktop/tests/net-worth-constants.test.ts`：

```typescript
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
```

- [ ] **Step 2: 运行测试验证失败**

```bash
cd "/workspace/apps/desktop" && pnpm test -- tests/net-worth-constants.test.ts 2>&1 | tail -20
```

Expected: FAIL with "Cannot find module '@renderer/components/net-worth/net-worth-constants.js'"

- [ ] **Step 3: 写实现**

创建 `apps/desktop/src/renderer/src/components/net-worth/net-worth-constants.ts`：

```typescript
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
```

- [ ] **Step 4: 运行测试验证通过**

```bash
cd "/workspace/apps/desktop" && pnpm test -- tests/net-worth-constants.test.ts 2>&1 | tail -20
```

Expected: PASS（所有测试通过）

- [ ] **Step 5: 提交**

```bash
git -C /workspace add apps/desktop/src/renderer/src/components/net-worth/net-worth-constants.ts apps/desktop/tests/net-worth-constants.test.ts
git -C /workspace commit -m "feat(net-worth): add pure functions module

filterByTimeRange (4 time ranges), formatTrendForMetric (4 metrics),
getAllocationData (latest month allocation). All pure, tested."
```

---

## Task 3: 创建 TrendChart.tsx + 测试

**Files:**
- Create: `apps/desktop/tests/net-worth-components.test.tsx`
- Create: `apps/desktop/src/renderer/src/components/net-worth/TrendChart.tsx`

- [ ] **Step 1: 写失败测试**

创建 `apps/desktop/tests/net-worth-components.test.tsx`：

```typescript
// Mock recharts（jsdom 下 SVG 渲染有问题）
// Mock recharts (SVG rendering issues under jsdom)
vi.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="xaxis" />,
  YAxis: () => <div data-testid="yaxis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div data-testid="cell" />,
}));

// 净资产趋势页组件测试 / Net worth page component tests

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TrendChart } from '@renderer/components/net-worth/TrendChart.js';
import type { TrendPoint, TimeRangeKey, MetricKey } from '@renderer/components/net-worth/net-worth-constants.js';

describe('TrendChart', () => {
  const defaultProps = {
    data: [] as TrendPoint[],
    metric: 'netWorth' as MetricKey,
    timeRange: '6m' as TimeRangeKey,
    loading: false,
    onMetricChange: vi.fn(),
    onTimeRangeChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('空数据显示空状态提示', () => {
    render(<TrendChart {...defaultProps} />);
    expect(screen.getByText('暂无趋势数据')).toBeInTheDocument();
  });

  it('仅 1 个月数据显示提示', () => {
    const data = [{ month: '2026-01', value: 1000, snapshotDate: 0 }];
    render(<TrendChart {...defaultProps} data={data} />);
    expect(screen.getByText('仅 1 个月数据，需至少 2 个月显示趋势')).toBeInTheDocument();
  });

  it('2 个及以上数据点渲染图表', () => {
    const data = [
      { month: '2026-01', value: 1000, snapshotDate: 0 },
      { month: '2026-02', value: 2000, snapshotDate: 0 },
    ];
    render(<TrendChart {...defaultProps} data={data} />);
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  it('loading 显示加载中', () => {
    render(<TrendChart {...defaultProps} loading={true} />);
    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  it('渲染 4 个时间范围按钮', () => {
    render(<TrendChart {...defaultProps} />);
    expect(screen.getByText('近3月')).toBeInTheDocument();
    expect(screen.getByText('近6月')).toBeInTheDocument();
    expect(screen.getByText('近1年')).toBeInTheDocument();
    expect(screen.getByText('全部')).toBeInTheDocument();
  });

  it('点击时间范围按钮触发 onTimeRangeChange', () => {
    render(<TrendChart {...defaultProps} />);
    fireEvent.click(screen.getByText('近3月'));
    expect(defaultProps.onTimeRangeChange).toHaveBeenCalledWith('3m');
  });

  it('渲染 4 个指标单选项', () => {
    render(<TrendChart {...defaultProps} />);
    expect(screen.getByText('净资产')).toBeInTheDocument();
    expect(screen.getByText('流动')).toBeInTheDocument();
    expect(screen.getByText('投资')).toBeInTheDocument();
    expect(screen.getByText('负债')).toBeInTheDocument();
  });

  it('点击指标单选项触发 onMetricChange', () => {
    render(<TrendChart {...defaultProps} />);
    fireEvent.click(screen.getByText('流动'));
    expect(defaultProps.onMetricChange).toHaveBeenCalledWith('liquid');
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
cd "/workspace/apps/desktop" && pnpm test -- tests/net-worth-components.test.tsx 2>&1 | tail -20
```

Expected: FAIL with "Cannot find module '@renderer/components/net-worth/TrendChart.js'"

- [ ] **Step 3: 写实现**

创建 `apps/desktop/src/renderer/src/components/net-worth/TrendChart.tsx`：

```typescript
// 趋势折线图 / Trend line chart
// Recharts 折线图，支持 4 指标切换 × 4 时间范围切换
// Recharts line chart, supports 4 metrics × 4 time ranges

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Card } from '../base/Card.js';
import { EmptyState } from '../auxiliary/EmptyState.js';
import { TIME_RANGE_CONFIG, METRIC_CONFIG } from './net-worth-constants.js';
import type { TrendPoint, TimeRangeKey, MetricKey } from './net-worth-constants.js';

interface TrendChartProps {
  data: TrendPoint[];
  metric: MetricKey;
  timeRange: TimeRangeKey;
  loading: boolean;
  onMetricChange: (m: MetricKey) => void;
  onTimeRangeChange: (r: TimeRangeKey) => void;
}

export function TrendChart({ data, metric, timeRange, loading, onMetricChange, onTimeRangeChange }: TrendChartProps) {
  const activeMetric = METRIC_CONFIG.find(c => c.key === metric)!;

  return (
    <Card>
      {/* 控件行：时间范围 + 指标 */}
      {/* Controls: time range + metric */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1">
          {TIME_RANGE_CONFIG.map(c => (
            <button
              key={c.key}
              onClick={() => onTimeRangeChange(c.key)}
              className={`px-3 py-1 text-sm rounded ${
                timeRange === c.key
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex gap-3">
          {METRIC_CONFIG.map(c => (
            <label key={c.key} className="flex items-center gap-1 text-sm text-gray-600 cursor-pointer">
              <input
                type="radio"
                name="metric"
                checked={metric === c.key}
                onChange={() => onMetricChange(c.key)}
                className="form-radio"
              />
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: c.color }}
              />
              {c.label}
            </label>
          ))}
        </div>
      </div>

      {/* 图表区域 */}
      {/* Chart area */}
      {loading ? (
        <div className="py-12 text-center text-gray-400">加载中...</div>
      ) : data.length === 0 ? (
        <EmptyState title="暂无趋势数据" description="继续使用以积累" />
      ) : data.length === 1 ? (
        <EmptyState title="仅 1 个月数据" description="需至少 2 个月显示趋势" />
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#9ca3af" />
              <YAxis hide />
              <Tooltip
                formatter={(value: number) => [`¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`, activeMetric.label]}
                labelFormatter={(label) => `月份: ${label}`}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={activeMetric.color}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
cd "/workspace/apps/desktop" && pnpm test -- tests/net-worth-components.test.tsx 2>&1 | tail -20
```

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git -C /workspace add apps/desktop/src/renderer/src/components/net-worth/TrendChart.tsx apps/desktop/tests/net-worth-components.test.tsx
git -C /workspace commit -m "feat(net-worth): add TrendChart component

Line chart with 4 metric toggle × 4 time range buttons.
Empty states for 0/1 data points. Mocks recharts in tests."
```

---

## Task 4: 创建 AllocationDonut.tsx + 测试

**Files:**
- Modify: `apps/desktop/tests/net-worth-components.test.tsx`（追加测试）
- Create: `apps/desktop/src/renderer/src/components/net-worth/AllocationDonut.tsx`

- [ ] **Step 1: 追加测试到 net-worth-components.test.tsx**

在文件**顶部 import 区**追加：

```typescript
import { AllocationDonut } from '@renderer/components/net-worth/AllocationDonut.js';
import type { AllocationData } from '@renderer/components/net-worth/net-worth-constants.js';
```

在文件**末尾**追加：

```typescript
describe('AllocationDonut', () => {
  const emptyData: AllocationData = { items: [], netWorth: 0, totalAssets: 0, hasData: false };

  const validData: AllocationData = {
    items: [
      { name: '流动资产', value: 1000, color: '#3B82F6', percent: 25 },
      { name: '投资资产', value: 2000, color: '#8B5CF6', percent: 50 },
      { name: '使用资产', value: 1000, color: '#F59E0B', percent: 25 },
      { name: '负债', value: -500, color: '#EF4444', percent: -12.5 },
    ],
    netWorth: 3500,
    totalAssets: 4000,
    hasData: true,
  };

  it('空数据显示空状态提示', () => {
    render(<AllocationDonut data={emptyData} loading={false} />);
    expect(screen.getByText('暂无配比数据')).toBeInTheDocument();
  });

  it('loading 显示加载中', () => {
    render(<AllocationDonut data={emptyData} loading={true} />);
    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  it('有数据时渲染饼图', () => {
    render(<AllocationDonut data={validData} loading={false} />);
    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
  });

  it('有数据时显示净资产中心值', () => {
    render(<AllocationDonut data={validData} loading={false} />);
    expect(screen.getByText('¥3,500.00')).toBeInTheDocument();
  });

  it('渲染标题"资产配比（最新月份）"', () => {
    render(<AllocationDonut data={validData} loading={false} />);
    expect(screen.getByText('资产配比（最新月份）')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
cd "/workspace/apps/desktop" && pnpm test -- tests/net-worth-components.test.tsx 2>&1 | tail -20
```

Expected: FAIL with "Cannot find module '@renderer/components/net-worth/AllocationDonut.js'"

- [ ] **Step 3: 写实现**

创建 `apps/desktop/src/renderer/src/components/net-worth/AllocationDonut.tsx`：

```typescript
// 资产配比环形图 / Allocation donut chart
// Recharts PieChart，展示最新月份 4 类资产占比
// Recharts PieChart, showing latest month 4-class asset allocation

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Card } from '../base/Card.js';
import { EmptyState } from '../auxiliary/EmptyState.js';
import { formatAmount } from '../transactions/transaction-constants.js';
import type { AllocationData } from './net-worth-constants.js';

interface AllocationDonutProps {
  data: AllocationData;
  loading: boolean;
}

export function AllocationDonut({ data, loading }: AllocationDonutProps) {
  return (
    <Card title="资产配比（最新月份）">
      {loading ? (
        <div className="py-12 text-center text-gray-400">加载中...</div>
      ) : !data.hasData ? (
        <EmptyState title="暂无配比数据" description="继续使用以积累" />
      ) : (
        <div className="relative h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.items}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
              >
                {data.items.map((item, index) => (
                  <Cell key={index} fill={item.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          {/* 中心显示净资产 */}
          {/* Center: net worth */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xs text-gray-500">净资产</span>
            <span className="text-lg font-semibold text-gray-900">{formatAmount(data.netWorth)}</span>
          </div>
        </div>
      )}
    </Card>
  );
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
cd "/workspace/apps/desktop" && pnpm test -- tests/net-worth-components.test.tsx 2>&1 | tail -20
```

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git -C /workspace add apps/desktop/src/renderer/src/components/net-worth/AllocationDonut.tsx apps/desktop/tests/net-worth-components.test.tsx
git -C /workspace commit -m "feat(net-worth): add AllocationDonut component

PieChart with 4-color cells, center net worth display.
Empty state for no data."
```

---

## Task 5: 创建 AllocationDetail.tsx + 测试

**Files:**
- Modify: `apps/desktop/tests/net-worth-components.test.tsx`（追加测试）
- Create: `apps/desktop/src/renderer/src/components/net-worth/AllocationDetail.tsx`

- [ ] **Step 1: 追加测试到 net-worth-components.test.tsx**

在文件**顶部 import 区**追加：

```typescript
import { AllocationDetail } from '@renderer/components/net-worth/AllocationDetail.js';
```

在文件**末尾**追加：

```typescript
describe('AllocationDetail', () => {
  const emptyData: AllocationData = { items: [], netWorth: 0, totalAssets: 0, hasData: false };

  const validData: AllocationData = {
    items: [
      { name: '流动资产', value: 1000, color: '#3B82F6', percent: 25 },
      { name: '投资资产', value: 2000, color: '#8B5CF6', percent: 50 },
      { name: '使用资产', value: 1000, color: '#F59E0B', percent: 25 },
      { name: '负债', value: -500, color: '#EF4444', percent: -12.5 },
    ],
    netWorth: 3500,
    totalAssets: 4000,
    hasData: true,
  };

  it('空数据显示空状态提示', () => {
    render(<AllocationDetail data={emptyData} />);
    expect(screen.getByText('暂无明细数据')).toBeInTheDocument();
  });

  it('有数据时显示 4 类资产', () => {
    render(<AllocationDetail data={validData} />);
    expect(screen.getByText('流动资产')).toBeInTheDocument();
    expect(screen.getByText('投资资产')).toBeInTheDocument();
    expect(screen.getByText('使用资产')).toBeInTheDocument();
    expect(screen.getByText('负债')).toBeInTheDocument();
  });

  it('显示金额', () => {
    render(<AllocationDetail data={validData} />);
    expect(screen.getByText('¥1,000.00')).toBeInTheDocument();
    expect(screen.getByText('¥2,000.00')).toBeInTheDocument();
    expect(screen.getByText('¥-500.00')).toBeInTheDocument();
  });

  it('显示百分比', () => {
    render(<AllocationDetail data={validData} />);
    expect(screen.getByText('25.0%')).toBeInTheDocument();
    expect(screen.getByText('50.0%')).toBeInTheDocument();
    expect(screen.getByText('-12.5%')).toBeInTheDocument();
  });

  it('显示净资产合计', () => {
    render(<AllocationDetail data={validData} />);
    expect(screen.getByText('净资产')).toBeInTheDocument();
    expect(screen.getByText('¥3,500.00')).toBeInTheDocument();
  });

  it('渲染标题"明细"', () => {
    render(<AllocationDetail data={validData} />);
    expect(screen.getByText('明细')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
cd "/workspace/apps/desktop" && pnpm test -- tests/net-worth-components.test.tsx 2>&1 | tail -20
```

Expected: FAIL

- [ ] **Step 3: 写实现**

创建 `apps/desktop/src/renderer/src/components/net-worth/AllocationDetail.tsx`：

```typescript
// 配比明细列表 / Allocation detail list
// 展示 4 类资产金额+百分比，底部净资产合计
// Shows 4-class asset amount+percent, net worth total at bottom

import { Card } from '../base/Card.js';
import { EmptyState } from '../auxiliary/EmptyState.js';
import { formatAmount } from '../transactions/transaction-constants.js';
import type { AllocationData } from './net-worth-constants.js';

interface AllocationDetailProps {
  data: AllocationData;
}

export function AllocationDetail({ data }: AllocationDetailProps) {
  return (
    <Card title="明细">
      {!data.hasData ? (
        <EmptyState title="暂无明细数据" description="继续使用以积累" />
      ) : (
        <div className="space-y-3">
          {/* 4 类资产明细 */}
          {/* 4-class asset details */}
          {data.items.map(item => (
            <div key={item.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm text-gray-700">{item.name}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-900">{formatAmount(item.value)}</span>
                <span className="text-sm text-gray-500 w-16 text-right">{item.percent.toFixed(1)}%</span>
              </div>
            </div>
          ))}

          {/* 分隔线 */}
          {/* Divider */}
          <div className="border-t border-gray-200 my-2" />

          {/* 净资产合计 */}
          {/* Net worth total */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-900">净资产</span>
            <span className={`text-sm font-semibold ${data.netWorth < 0 ? 'text-red-600' : 'text-gray-900'}`}>
              {formatAmount(data.netWorth)}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
cd "/workspace/apps/desktop" && pnpm test -- tests/net-worth-components.test.tsx 2>&1 | tail -20
```

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git -C /workspace add apps/desktop/src/renderer/src/components/net-worth/AllocationDetail.tsx apps/desktop/tests/net-worth-components.test.tsx
git -C /workspace commit -m "feat(net-worth): add AllocationDetail component

4-class asset list with amount+percent, net worth total.
Red text for negative net worth."
```

---

## Task 6: 重写 NetWorthPage 容器 + 集成测试

**Files:**
- Modify: `apps/desktop/src/renderer/src/pages/NetWorthPage.tsx`（完全重写）
- Modify: `apps/desktop/tests/net-worth-components.test.tsx`（追加集成测试）

- [ ] **Step 1: 追加集成测试到 net-worth-components.test.tsx**

在文件**顶部 import 区**追加：

```typescript
import { NetWorthPage } from '@renderer/pages/NetWorthPage.js';
import { useAppStore } from '@renderer/stores/app-store.js';
import type { NetWorthSnapshot } from '@shared/types/index.js';
```

在文件**末尾**追加：

```typescript
function makeSnapshotForPage(overrides: Partial<NetWorthSnapshot>): NetWorthSnapshot {
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

describe('NetWorthPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({ currentUser: { id: 'user-1', display_name: '测试用户' } as any });
  });

  it('渲染页头"净资产趋势"', async () => {
    (window.dataAccess.snapshot.list as any).mockResolvedValue([]);
    render(<NetWorthPage />);
    expect(screen.getByText('净资产趋势')).toBeInTheDocument();
  });

  it('加载中显示加载状态', () => {
    (window.dataAccess.snapshot.list as any).mockReturnValue(new Promise(() => {}));
    render(<NetWorthPage />);
    // 加载中时趋势图显示加载中
    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  it('数据加载完成后渲染所有模块', async () => {
    const snapshots = [
      makeSnapshotForPage({ id: 's1', snapshot_year_month: '2026-01', net_worth: 100000, total_liquid: 50000 }),
      makeSnapshotForPage({ id: 's2', snapshot_year_month: '2026-02', net_worth: 200000, total_liquid: 80000 }),
    ];
    (window.dataAccess.snapshot.list as any).mockResolvedValue(snapshots);
    render(<NetWorthPage />);
    // 等待数据加载完成，趋势图渲染
    expect(await screen.findByTestId('line-chart')).toBeInTheDocument();
    // 配比图渲染
    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
    // 明细显示
    expect(screen.getByText('流动资产')).toBeInTheDocument();
  });

  it('数据加载失败显示错误提示', async () => {
    (window.dataAccess.snapshot.list as any).mockRejectedValue(new Error('网络错误'));
    render(<NetWorthPage />);
    expect(await screen.findByText('数据加载失败，请重试')).toBeInTheDocument();
  });

  it('空数据显示各模块空状态', async () => {
    (window.dataAccess.snapshot.list as any).mockResolvedValue([]);
    render(<NetWorthPage />);
    // 等待加载完成
    await screen.findByText('净资产趋势');
    // 趋势图空状态
    expect(screen.getByText('暂无趋势数据')).toBeInTheDocument();
    // 配比图空状态
    expect(screen.getByText('暂无配比数据')).toBeInTheDocument();
    // 明细空状态
    expect(screen.getByText('暂无明细数据')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
cd "/workspace/apps/desktop" && pnpm test -- tests/net-worth-components.test.tsx 2>&1 | tail -30
```

Expected: FAIL（NetWorthPage 还是占位页）

- [ ] **Step 3: 重写 NetWorthPage.tsx**

用以下内容**完全替换** `apps/desktop/src/renderer/src/pages/NetWorthPage.tsx`：

```typescript
// 净资产趋势页 / Net worth trend page
// 趋势折线图（4 指标×4 时间范围）+ 资产配比环形图 + 配比明细列表
// Trend line chart (4 metrics × 4 ranges) + allocation donut + detail list

import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../stores/app-store.js';
import { useSnapshotStore } from '../stores/snapshot-store.js';
import {
  filterByTimeRange,
  formatTrendForMetric,
  getAllocationData,
} from '../components/net-worth/net-worth-constants.js';
import type { TimeRangeKey, MetricKey } from '../components/net-worth/net-worth-constants.js';
import { TrendChart } from '../components/net-worth/TrendChart.js';
import { AllocationDonut } from '../components/net-worth/AllocationDonut.js';
import { AllocationDetail } from '../components/net-worth/AllocationDetail.js';

export function NetWorthPage() {
  const currentUser = useAppStore((s) => s.currentUser);
  const { snapshots, loading, error, fetchSnapshots } = useSnapshotStore();

  const [timeRange, setTimeRange] = useState<TimeRangeKey>('6m');
  const [metric, setMetric] = useState<MetricKey>('netWorth');

  useEffect(() => {
    if (currentUser) fetchSnapshots(currentUser.id);
  }, [currentUser]);

  const filteredSnapshots = useMemo(
    () => filterByTimeRange(snapshots, timeRange),
    [snapshots, timeRange]
  );
  const trendData = useMemo(
    () => formatTrendForMetric(filteredSnapshots, metric),
    [filteredSnapshots, metric]
  );
  const allocationData = useMemo(
    () => getAllocationData(snapshots),
    [snapshots]
  );

  return (
    <div className="p-8 space-y-6">
      {/* 页头 */}
      <h1 className="text-2xl font-bold text-gray-900">净资产趋势</h1>

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          数据加载失败，请重试
        </div>
      )}

      {/* 趋势折线图 */}
      <TrendChart
        data={trendData}
        metric={metric}
        timeRange={timeRange}
        loading={loading}
        onMetricChange={setMetric}
        onTimeRangeChange={setTimeRange}
      />

      {/* 资产配比 + 明细（grid 2 列） */}
      <div className="grid grid-cols-2 gap-4">
        <AllocationDonut data={allocationData} loading={loading} />
        <AllocationDetail data={allocationData} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
cd "/workspace/apps/desktop" && pnpm test -- tests/net-worth-components.test.tsx 2>&1 | tail -30
```

Expected: PASS（所有测试通过）

- [ ] **Step 5: 提交**

```bash
git -C /workspace add apps/desktop/src/renderer/src/pages/NetWorthPage.tsx apps/desktop/tests/net-worth-components.test.tsx
git -C /workspace commit -m "feat(net-worth): rewrite NetWorthPage as container

Fetch snapshots + useMemo derive 3 data sets (trend, allocation).
Grid-cols-2 for donut + detail. Error banner for fetch failures."
```

---

## Task 7: 全量测试 + tsc + 构建验证

**Files:** 无修改（除非发现 bug）

- [ ] **Step 1: 运行全量测试**

```bash
cd "/workspace/apps/desktop" && pnpm test 2>&1 | tail -30
```

Expected: 所有测试通过（M4 + dashboard + M5 测试，总数应在 150+ 个）

**如果失败**：排查具体原因（import 路径、类型不匹配、mock 配置），修复后重试。不要弱化断言。

- [ ] **Step 2: 运行 TypeScript 类型检查**

```bash
cd "/workspace/apps/desktop" && pnpm exec tsc --noEmit 2>&1 | grep -E "(error TS|net-worth|NetWorth|TrendChart|AllocationDonut|AllocationDetail|snapshot-store)" | head -20
```

Expected: 无 net-worth 相关错误（dashboard 代码零错误）。注：shared 包可能有 14 个预先存在的 better-sqlite3/uuid 错误，与 M5 无关。

**如果有 M5 类型错误**：根据报错修复。

- [ ] **Step 3: 运行构建验证**

```bash
cd "/workspace/apps/desktop" && pnpm build 2>&1 | tail -20
```

Expected: 构建成功，`out/renderer/` 生成。

- [ ] **Step 4: 提交修复（仅当 Step 1-3 有修复时）**

如果有修复：
```bash
git -C /workspace commit -am "fix(net-worth): pass type check and build"
```

如果无修复，跳过。

---

## Task 8: 推送 + CI 验证

**Files:** 无修改

- [ ] **Step 1: 推送**

```bash
git -C /workspace push origin main 2>&1
```

Expected: 推送成功（fast-forward）

- [ ] **Step 2: 监控 CI**

```bash
gh run list --repo Psychorayda/FIRE-APP --limit 1 2>&1
```

等待 CI 构建完成（约 3 分钟），确认 conclusion: success。

- [ ] **Step 3: 宣布完成**

AI 向用户报告：
- M5 净资产趋势页已实现并推送
- 测试通过数
- CI 构建状态
- 准备进入手动 GUI 验证

---

## Task 9: 手动 GUI 验证（可选，需用户参与）

**Files:** 无修改（除非发现 bug）

验证方式与 dashboard 升级验证一致：
1. 下载 CI artifact `fire-app-windows`
2. 运行 exe
3. 切到"净资产趋势"页
4. 验证项：
   - NW-1: 不再是占位页
   - NW-2: 趋势折线图显示
   - NW-3: 4 指标切换
   - NW-4: 4 时间范围切换
   - NW-5: 资产配比环形图
   - NW-6: 配比明细列表
   - NW-7: 空状态文案
5. 通过选项式对话收集结果
6. 如有 bug，执行修复流程

---

## Self-Review

### 1. Spec coverage

| Spec 章节 | 对应 Task |
|-----------|----------|
| §1 概述与目标 | 全部 Task 覆盖 |
| §2 架构与组件 | Task 1-6 |
| §3 数据流与状态 | Task 1（store）、Task 6（容器） |
| §4 纯函数模块 | Task 2 |
| §5 组件设计 | Task 3（TrendChart）、Task 4（AllocationDonut）、Task 5（AllocationDetail） |
| §6 容器 NetWorthPage | Task 6 |
| §7 错误处理与测试 | Task 2-6（测试）、Task 7（验证）、Task 9（手动 GUI） |
| §8 设计决策 | 全部体现在代码中 |
| §9 实施顺序 | 与 Task 1-8 一致 |

覆盖完整，无遗漏。

### 2. Placeholder scan

- 所有代码步骤都有完整代码，无 "TBD"/"TODO"
- 测试代码完整，无 "Write tests for the above"
- 命令都有 expected output
- 无 "Similar to Task N"（每个 Task 独立完整）

### 3. Type consistency

- `TrendPoint`：Task 2 定义 `{ month, value, snapshotDate }`，Task 3 使用一致
- `AllocationData`：Task 2 定义 `{ items, netWorth, totalAssets, hasData }`，Task 4/5/6 使用一致
- `AllocationItem`：Task 2 定义 `{ name, value, color, percent }`，Task 4/5 使用一致
- `TimeRangeKey`/`MetricKey`：Task 2 定义，Task 3/6 使用一致
- `filterByTimeRange`/`formatTrendForMetric`/`getAllocationData`：Task 2 定义签名，Task 6 调用一致
- `snapshot-store` 的 `fetchSnapshots`：Task 1 定义，Task 6 调用一致

无类型/命名不一致问题。
