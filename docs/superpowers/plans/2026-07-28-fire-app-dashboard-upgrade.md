# 仪表盘升级实施计划 / Dashboard Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把占位 DashboardPage 升级为信息聚合中心，展示净资产 3 卡 + 本月收支 3 卡 + 净资产趋势图 + 近期交易表。

**Architecture:** 容器组件 `DashboardPage` 并行拉取 accounts/transactions/snapshots，用 `useMemo` 派生 4 类数据传给 4 个纯展示子组件。复用 M4 的 `computeOverview`/`formatAmount`/`TRANSACTION_TYPE_CONFIG` 和 `base/Card`/`base/Table`/`auxiliary/EmptyState`。新增 Recharts 2.x 用于趋势折线图。

**Tech Stack:** React 19 + Zustand 5 + Recharts 2.x + Tailwind 4 + vitest 2 + @testing-library/react 16

**Spec:** `docs/superpowers/specs/2026-07-28-fire-app-dashboard-upgrade-design.md`

---

## 文件结构

### 新建文件（7 个）

| 文件 | 职责 |
|------|------|
| `apps/desktop/src/renderer/src/components/dashboard/dashboard-constants.ts` | 纯函数：`computeNetWorthSummary`、`filterCurrentMonthTransactions`、`getRecentTransactions`、`formatTrendData` + 类型 `NetWorthSummary`、`TrendPoint` |
| `apps/desktop/src/renderer/src/components/dashboard/NetWorthCards.tsx` | 净资产 3 卡（总资产/总负债/净资产） |
| `apps/desktop/src/renderer/src/components/dashboard/MonthlyOverviewCards.tsx` | 本月收支 3 卡（收入/支出/结余），复用 M4 `computeOverview` |
| `apps/desktop/src/renderer/src/components/dashboard/NetWorthTrendChart.tsx` | Recharts 折线图（近 6 个月净资产） |
| `apps/desktop/src/renderer/src/components/dashboard/RecentTransactions.tsx` | 近期交易精简表（10 笔，4 列） |
| `apps/desktop/tests/dashboard-constants.test.ts` | 纯函数单元测试 |
| `apps/desktop/tests/dashboard-components.test.tsx` | 组件 + 容器测试（含 recharts mock） |

### 修改文件（2 个）

| 文件 | 修改 |
|------|------|
| `apps/desktop/src/renderer/src/pages/DashboardPage.tsx` | 重写为容器，组合 4 个子组件 |
| `apps/desktop/package.json` | 新增 `recharts` 依赖 |

### 关键复用

- `@renderer/components/transactions/transaction-constants.js` — `computeOverview`、`formatAmount`、`formatDate`、`TRANSACTION_TYPE_CONFIG`、`TransactionOverview` 类型
- `@renderer/components/base/Card.js` — 卡片容器
- `@renderer/components/base/Table.js` — 表格组件（含 `TableColumn<T>` 类型）
- `@renderer/components/auxiliary/EmptyState.js` — 空状态
- `@shared/utils/money.js` — `centsToYuan`（分转元）
- `@shared/types/index.js` — `Account`、`Transaction`、`NetWorthSnapshot` 类型
- `@renderer/stores/app-store.js` — `useAppStore`（获取 `currentUser`）

### 测试基础设施（已就绪，无需修改）

- `vitest.config.ts` — jsdom + alias（`@shared`、`@renderer`）
- `vitest.setup.ts` — `window.dataAccess` 命名空间 mock + `afterEach(cleanup)`
- 组件通过 `import { dataAccess } from '../data/data-access.js'` 调用扁平方法，底层命中 `window.dataAccess.account.list` 等 mock

### 金额单位约定

- 数据库存储：整数分（cents）
- UI 展示：元（通过 `centsToYuan` 转换）
- `formatAmount(cents)` 返回人民币货币字符串（如 `¥1,234.56`）

---

## Task 1: 安装 recharts + 创建纯函数模块

**Files:**
- Modify: `apps/desktop/package.json`（新增 recharts 依赖）
- Create: `apps/desktop/src/renderer/src/components/dashboard/dashboard-constants.ts`
- Test: `apps/desktop/tests/dashboard-constants.test.ts`

- [ ] **Step 1: 安装 recharts**

Run:
```bash
cd apps/desktop && pnpm add recharts
```

Expected: `package.json` 的 `dependencies` 新增 `"recharts": "^2.x.x"`

- [ ] **Step 2: 确认 React 19 兼容性**

Run:
```bash
cd apps/desktop && pnpm list recharts react
```

Expected: recharts 2.x + react 19.x。如果 recharts 安装失败或 peer dependency 冲突，执行 `pnpm add recharts --legacy-peer-deps` 或在 `.npmrc` 加 `auto-install-peers=false`。

- [ ] **Step 3: 创建 dashboard-constants.ts**

Create `apps/desktop/src/renderer/src/components/dashboard/dashboard-constants.ts`:

```typescript
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

/** 筛选本月交易（基于本地时区） */
// Filter transactions in current month (local timezone)
export function filterCurrentMonthTransactions(txs: Transaction[]): Transaction[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthStart = new Date(year, month, 1).getTime();
  const monthEnd = new Date(year, month + 1, 1).getTime();
  return txs.filter(tx => tx.transaction_date >= monthStart && tx.transaction_date < monthEnd);
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
```

- [ ] **Step 4: 创建纯函数测试**

Create `apps/desktop/tests/dashboard-constants.test.ts`:

```typescript
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
```

- [ ] **Step 5: 运行纯函数测试**

Run:
```bash
cd apps/desktop && pnpm test -- tests/dashboard-constants.test.ts
```

Expected: PASS（所有测试通过）

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/package.json apps/desktop/pnpm-lock.yaml \
  apps/desktop/src/renderer/src/components/dashboard/dashboard-constants.ts \
  apps/desktop/tests/dashboard-constants.test.ts
git commit -m "feat(dashboard): add recharts + pure functions module

- Install recharts 2.x for trend chart
- Add dashboard-constants.ts: computeNetWorthSummary,
  filterCurrentMonthTransactions, getRecentTransactions, formatTrendData
- Full unit test coverage for all 4 pure functions"
```

---

## Task 2: NetWorthCards 组件

**Files:**
- Create: `apps/desktop/src/renderer/src/components/dashboard/NetWorthCards.tsx`
- Test: `apps/desktop/tests/dashboard-components.test.tsx`（本 Task 创建文件，仅写 NetWorthCards 测试）

- [ ] **Step 1: 创建测试文件（仅 NetWorthCards 部分）**

Create `apps/desktop/tests/dashboard-components.test.tsx`:

```typescript
// 仪表盘组件测试 / Dashboard component tests

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Account } from '@shared/types/index.js';
import { NetWorthCards } from '@renderer/components/dashboard/NetWorthCards.js';

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

describe('NetWorthCards', () => {
  it('渲染 3 张卡：总资产、总负债、净资产', () => {
    const summary = {
      totalLiquid: 100000,
      totalInvested: 200000,
      totalUseAsset: 500000,
      totalLiability: -80000,
      totalAssets: 800000,
      netWorth: 720000,
    };
    render(<NetWorthCards summary={summary} />);

    expect(screen.getByText('总资产')).toBeInTheDocument();
    expect(screen.getByText('总负债')).toBeInTheDocument();
    expect(screen.getByText('净资产')).toBeInTheDocument();
  });

  it('正确显示金额（分转元）', () => {
    const summary = {
      totalLiquid: 0,
      totalInvested: 0,
      totalUseAsset: 0,
      totalLiability: 0,
      totalAssets: 123456,
      totalLiability_dup: 0,
      netWorth: 65432,
    } as any;
    render(<NetWorthCards summary={summary} />);

    // 总资产 123456 分 = ¥1,234.56
    expect(screen.getByText('总资产').closest('.bg-white')!).toHaveTextContent('1,234.56');
    // 净资产 65432 分 = ¥654.32
    expect(screen.getByText('净资产').closest('.bg-white')!).toHaveTextContent('654.32');
  });

  it('空数据（全 0）正常渲染', () => {
    const summary = {
      totalLiquid: 0,
      totalInvested: 0,
      totalUseAsset: 0,
      totalLiability: 0,
      totalAssets: 0,
      netWorth: 0,
    };
    render(<NetWorthCards summary={summary} />);

    expect(screen.getByText('总资产').closest('.bg-white')!).toHaveTextContent('0.00');
    expect(screen.getByText('净资产').closest('.bg-white')!).toHaveTextContent('0.00');
  });

  it('净资产为负数时显示红色', () => {
    const summary = {
      totalLiquid: 10000,
      totalInvested: 0,
      totalUseAsset: 0,
      totalLiability: -50000,
      totalAssets: 10000,
      netWorth: -40000,
    };
    const { container } = render(<NetWorthCards summary={summary} />);

    const netWorthLabel = screen.getByText('净资产');
    const netWorthCard = netWorthLabel.closest('.bg-white')!;
    const netWorthValue = netWorthCard.querySelector('.text-xl')!;
    expect(netWorthValue.className).toContain('text-red-600');
  });

  it('净资产为正数时不显示红色', () => {
    const summary = {
      totalLiquid: 100000,
      totalInvested: 0,
      totalUseAsset: 0,
      totalLiability: 0,
      totalAssets: 100000,
      netWorth: 100000,
    };
    render(<NetWorthCards summary={summary} />);

    const netWorthLabel = screen.getByText('净资产');
    const netWorthCard = netWorthLabel.closest('.bg-white')!;
    const netWorthValue = netWorthCard.querySelector('.text-xl')!;
    expect(netWorthValue.className).not.toContain('text-red-600');
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run:
```bash
cd apps/desktop && pnpm test -- tests/dashboard-components.test.tsx
```

Expected: FAIL with "Cannot find module '@renderer/components/dashboard/NetWorthCards.js'"

- [ ] **Step 3: 创建 NetWorthCards.tsx**

Create `apps/desktop/src/renderer/src/components/dashboard/NetWorthCards.tsx`:

```typescript
// 净资产卡片 / Net worth cards
// 展示 3 张卡：总资产 / 总负债 / 净资产
// Display 3 cards: total assets / total liability / net worth

import { Card } from '../base/Card.js';
import { formatAmount } from '../transactions/transaction-constants.js';
import type { NetWorthSummary } from './dashboard-constants.js';

interface NetWorthCardsProps {
  summary: NetWorthSummary;
}

export function NetWorthCards({ summary }: NetWorthCardsProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {/* 总资产卡 / Total assets card */}
      <Card>
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-sm text-gray-500">总资产</span>
        </div>
        <div className="text-xl font-semibold text-gray-900">{formatAmount(summary.totalAssets)}</div>
      </Card>

      {/* 总负债卡 / Total liability card */}
      <Card>
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
          <span className="text-sm text-gray-500">总负债</span>
        </div>
        <div className="text-xl font-semibold text-gray-900">{formatAmount(summary.totalLiability)}</div>
      </Card>

      {/* 净资产卡 / Net worth card */}
      <Card>
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
          <span className="text-sm text-gray-500">净资产</span>
        </div>
        <div className={`text-xl font-semibold ${summary.netWorth < 0 ? 'text-red-600' : 'text-gray-900'}`}>
          {formatAmount(summary.netWorth)}
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: 运行测试验证通过**

Run:
```bash
cd apps/desktop && pnpm test -- tests/dashboard-components.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/renderer/src/components/dashboard/NetWorthCards.tsx \
  apps/desktop/tests/dashboard-components.test.tsx
git commit -m "feat(dashboard): add NetWorthCards component

Display total assets / total liability / net worth cards.
Net worth shows red text when negative."
```

---

## Task 3: MonthlyOverviewCards 组件

**Files:**
- Create: `apps/desktop/src/renderer/src/components/dashboard/MonthlyOverviewCards.tsx`
- Modify: `apps/desktop/tests/dashboard-components.test.tsx`（追加 MonthlyOverviewCards 测试）

- [ ] **Step 1: 追加测试到 dashboard-components.test.tsx**

在文件顶部 import 区追加:

```typescript
import { MonthlyOverviewCards } from '@renderer/components/dashboard/MonthlyOverviewCards.js';
import type { TransactionOverview } from '@renderer/components/transactions/transaction-constants.js';
```

在文件末尾追加:

```typescript
describe('MonthlyOverviewCards', () => {
  it('渲染 3 张卡：本月收入、本月支出、本月结余', () => {
    const overview: TransactionOverview = {
      income: 100000,
      expense: 30000,
      transfer: 50000,
      balance: 70000,
    };
    render(<MonthlyOverviewCards overview={overview} />);

    expect(screen.getByText('本月收入')).toBeInTheDocument();
    expect(screen.getByText('本月支出')).toBeInTheDocument();
    expect(screen.getByText('本月结余')).toBeInTheDocument();
  });

  it('正确显示金额', () => {
    const overview: TransactionOverview = {
      income: 100000,
      expense: 30000,
      transfer: 0,
      balance: 70000,
    };
    render(<MonthlyOverviewCards overview={overview} />);

    // 收入 100000 分 = ¥1,000.00
    expect(screen.getByText('本月收入').closest('.bg-white')!).toHaveTextContent('1,000.00');
    // 支出 30000 分 = ¥300.00
    expect(screen.getByText('本月支出').closest('.bg-white')!).toHaveTextContent('300.00');
    // 结余 70000 分 = ¥700.00
    expect(screen.getByText('本月结余').closest('.bg-white')!).toHaveTextContent('700.00');
  });

  it('空数据（全 0）正常渲染', () => {
    const overview: TransactionOverview = {
      income: 0,
      expense: 0,
      transfer: 0,
      balance: 0,
    };
    render(<MonthlyOverviewCards overview={overview} />);

    expect(screen.getByText('本月收入').closest('.bg-white')!).toHaveTextContent('0.00');
    expect(screen.getByText('本月结余').closest('.bg-white')!).toHaveTextContent('0.00');
  });

  it('结余为负数时显示红色', () => {
    const overview: TransactionOverview = {
      income: 50000,
      expense: 100000,
      transfer: 0,
      balance: -50000,
    };
    render(<MonthlyOverviewCards overview={overview} />);

    const balanceLabel = screen.getByText('本月结余');
    const balanceCard = balanceLabel.closest('.bg-white')!;
    const balanceValue = balanceCard.querySelector('.text-xl')!;
    expect(balanceValue.className).toContain('text-red-600');
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run:
```bash
cd apps/desktop && pnpm test -- tests/dashboard-components.test.tsx
```

Expected: FAIL with "Cannot find module '@renderer/components/dashboard/MonthlyOverviewCards.js'"

- [ ] **Step 3: 创建 MonthlyOverviewCards.tsx**

Create `apps/desktop/src/renderer/src/components/dashboard/MonthlyOverviewCards.tsx`:

```typescript
// 本月收支卡片 / Monthly overview cards
// 展示 3 张卡：本月收入 / 本月支出 / 本月结余
// 复用 M4 的 TransactionOverview 类型和 formatAmount
// Display 3 cards: monthly income / expense / balance

import { Card } from '../base/Card.js';
import { formatAmount, type TransactionOverview } from '../transactions/transaction-constants.js';

interface MonthlyOverviewCardsProps {
  overview: TransactionOverview;
}

export function MonthlyOverviewCards({ overview }: MonthlyOverviewCardsProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {/* 本月收入卡 / Monthly income card */}
      <Card>
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
          <span className="text-sm text-gray-500">本月收入</span>
        </div>
        <div className="text-xl font-semibold text-gray-900">{formatAmount(overview.income)}</div>
      </Card>

      {/* 本月支出卡 / Monthly expense card */}
      <Card>
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
          <span className="text-sm text-gray-500">本月支出</span>
        </div>
        <div className="text-xl font-semibold text-gray-900">{formatAmount(overview.expense)}</div>
      </Card>

      {/* 本月结余卡 / Monthly balance card */}
      <Card>
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-sm text-gray-500">本月结余</span>
        </div>
        <div className={`text-xl font-semibold ${overview.balance < 0 ? 'text-red-600' : 'text-gray-900'}`}>
          {formatAmount(overview.balance)}
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: 运行测试验证通过**

Run:
```bash
cd apps/desktop && pnpm test -- tests/dashboard-components.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/renderer/src/components/dashboard/MonthlyOverviewCards.tsx \
  apps/desktop/tests/dashboard-components.test.tsx
git commit -m "feat(dashboard): add MonthlyOverviewCards component

Display monthly income / expense / balance cards.
Reuses M4 TransactionOverview type and formatAmount."
```

---

## Task 4: NetWorthTrendChart 组件（Recharts）

**Files:**
- Create: `apps/desktop/src/renderer/src/components/dashboard/NetWorthTrendChart.tsx`
- Modify: `apps/desktop/tests/dashboard-components.test.tsx`（追加 NetWorthTrendChart 测试，含 recharts mock）

- [ ] **Step 1: 在测试文件顶部追加 recharts mock**

在 `apps/desktop/tests/dashboard-components.test.tsx` 的 import 区**之前**追加:

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
}));
```

同时在顶部 import 区追加:

```typescript
import { vi } from 'vitest';
import React from 'react';
import { NetWorthTrendChart } from '@renderer/components/dashboard/NetWorthTrendChart.js';
import type { TrendPoint } from '@renderer/components/dashboard/dashboard-constants.js';
```

- [ ] **Step 2: 追加测试到文件末尾**

```typescript
describe('NetWorthTrendChart', () => {
  it('空数据显示空状态提示', () => {
    render(<NetWorthTrendChart data={[]} loading={false} />);
    expect(screen.getByText('暂无趋势数据，继续使用以积累')).toBeInTheDocument();
  });

  it('仅 1 个数据点显示提示', () => {
    const data: TrendPoint[] = [{ month: '2026-07', netWorth: 1000 }];
    render(<NetWorthTrendChart data={data} loading={false} />);
    expect(screen.getByText('仅 1 个月数据，需至少 2 个月显示趋势')).toBeInTheDocument();
  });

  it('2 个及以上数据点渲染图表', () => {
    const data: TrendPoint[] = [
      { month: '2026-06', netWorth: 1000 },
      { month: '2026-07', netWorth: 1500 },
    ];
    render(<NetWorthTrendChart data={data} loading={false} />);
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  it('loading 时显示加载中', () => {
    render(<NetWorthTrendChart data={[]} loading={true} />);
    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: 运行测试验证失败**

Run:
```bash
cd apps/desktop && pnpm test -- tests/dashboard-components.test.tsx
```

Expected: FAIL with "Cannot find module '@renderer/components/dashboard/NetWorthTrendChart.js'"

- [ ] **Step 4: 创建 NetWorthTrendChart.tsx**

Create `apps/desktop/src/renderer/src/components/dashboard/NetWorthTrendChart.tsx`:

```typescript
// 净资产趋势图 / Net worth trend chart
// Recharts 折线图，展示近 6 个月净资产变化
// Recharts line chart, showing net worth over last 6 months

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Card } from '../base/Card.js';
import { EmptyState } from '../auxiliary/EmptyState.js';
import type { TrendPoint } from './dashboard-constants.js';

interface NetWorthTrendChartProps {
  data: TrendPoint[];
  loading: boolean;
}

export function NetWorthTrendChart({ data, loading }: NetWorthTrendChartProps) {
  return (
    <Card title="净资产趋势（近 6 个月）">
      {loading ? (
        <div className="py-12 text-center text-gray-400">加载中...</div>
      ) : data.length === 0 ? (
        <EmptyState
          title="暂无趋势数据"
          description="继续使用以积累"
        />
      ) : data.length === 1 ? (
        <EmptyState
          title="仅 1 个月数据"
          description="需至少 2 个月显示趋势"
        />
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#9ca3af" />
              <YAxis hide />
              <Tooltip
                formatter={(value: number) => [`¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`, '净资产']}
                labelFormatter={(label) => `月份: ${label}`}
              />
              <Line
                type="monotone"
                dataKey="netWorth"
                stroke="#3b82f6"
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

- [ ] **Step 5: 运行测试验证通过**

Run:
```bash
cd apps/desktop && pnpm test -- tests/dashboard-components.test.tsx
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/renderer/src/components/dashboard/NetWorthTrendChart.tsx \
  apps/desktop/tests/dashboard-components.test.tsx
git commit -m "feat(dashboard): add NetWorthTrendChart with Recharts

Line chart showing net worth over last 6 months.
Empty states for 0 and 1 data points. Mock recharts in tests."
```

---

## Task 5: RecentTransactions 组件

**Files:**
- Create: `apps/desktop/src/renderer/src/components/dashboard/RecentTransactions.tsx`
- Modify: `apps/desktop/tests/dashboard-components.test.tsx`（追加 RecentTransactions 测试）

- [ ] **Step 1: 追加 import 到测试文件**

在 `apps/desktop/tests/dashboard-components.test.tsx` 的 import 区追加:

```typescript
import { RecentTransactions } from '@renderer/components/dashboard/RecentTransactions.js';
import type { Transaction, Account } from '@shared/types/index.js';
```

- [ ] **Step 2: 追加测试到文件末尾**

```typescript
function makeAccountForRecent(overrides: Partial<Account>): Account {
  return {
    id: 'acc-1',
    user_id: 'user-1',
    name: '招商银行',
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

function makeTxForRecent(overrides: Partial<Transaction>): Transaction {
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

describe('RecentTransactions', () => {
  it('渲染标题"近期交易"', () => {
    render(<RecentTransactions transactions={[]} accounts={[]} />);
    expect(screen.getByText('近期交易')).toBeInTheDocument();
  });

  it('空交易显示空状态', () => {
    render(<RecentTransactions transactions={[]} accounts={[]} />);
    expect(screen.getByText('暂无交易记录')).toBeInTheDocument();
  });

  it('正确渲染交易行（类型、日期、账户、金额）', () => {
    const accounts = [makeAccountForRecent({ id: 'acc-1', name: '招商银行' })];
    const txs = [
      makeTxForRecent({
        id: 'tx-1',
        transaction_type: 'income',
        amount: 100000,
        transaction_date: new Date('2026-07-15').getTime(),
        account_id: 'acc-1',
      }),
    ];
    render(<RecentTransactions transactions={txs} accounts={accounts} />);

    // 类型标签"收入"
    expect(screen.getByText('收入')).toBeInTheDocument();
    // 日期 2026-07-15
    expect(screen.getByText('2026-07-15')).toBeInTheDocument();
    // 账户名"招商银行"
    expect(screen.getByText('招商银行')).toBeInTheDocument();
    // 金额 +¥1,000.00（100000 分 = 1000 元）
    expect(screen.getByText(/\+¥1,000.00/)).toBeInTheDocument();
  });

  it('transfer 显示 source → target', () => {
    const accounts = [
      makeAccountForRecent({ id: 'acc-1', name: '招商银行' }),
      makeAccountForRecent({ id: 'acc-2', name: '支付宝' }),
    ];
    const txs = [
      makeTxForRecent({
        id: 'tx-1',
        transaction_type: 'transfer',
        amount: 50000,
        account_id: 'acc-1',
        to_account_id: 'acc-2',
      }),
    ];
    render(<RecentTransactions transactions={txs} accounts={accounts} />);

    expect(screen.getByText('招商银行 → 支付宝')).toBeInTheDocument();
  });

  it('最多渲染 10 笔（由容器限制，组件渲染全部传入）', () => {
    const accounts = [makeAccountForRecent({ id: 'acc-1', name: '招商银行' })];
    const txs = Array.from({ length: 12 }, (_, i) =>
      makeTxForRecent({ id: `tx-${i}`, transaction_date: 1000 + i })
    );
    render(<RecentTransactions transactions={txs} accounts={accounts} />);
    // 组件渲染全部传入数据（容器负责 slice 10）
    const rows = screen.getAllByText('2026-07-01');
    // 每行都有日期，12 笔 12 行（日期相同因为是测试数据）
    expect(rows.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: 运行测试验证失败**

Run:
```bash
cd apps/desktop && pnpm test -- tests/dashboard-components.test.tsx
```

Expected: FAIL with "Cannot find module '@renderer/components/dashboard/RecentTransactions.js'"

- [ ] **Step 4: 创建 RecentTransactions.tsx**

Create `apps/desktop/src/renderer/src/components/dashboard/RecentTransactions.tsx`:

```typescript
// 近期交易表 / Recent transactions table
// 精简版交易列表：4 列（类型、日期、账户、金额），无排序无操作
// Simplified transaction list: 4 columns (type, date, account, amount), no sort/actions

import type { Transaction, Account } from '@shared/types/index.js';
import { Card } from '../base/Card.js';
import { Table, type TableColumn } from '../base/Table.js';
import { EmptyState } from '../auxiliary/EmptyState.js';
import {
  TRANSACTION_TYPE_CONFIG,
  formatAmount,
  formatDate,
} from '../transactions/transaction-constants.js';

interface RecentTransactionsProps {
  transactions: Transaction[];
  accounts: Account[];
}

// 辅助：查找账户名 / Helper: find account name
function getAccountName(accounts: Account[], id: string | null): string {
  if (!id) return '—';
  return accounts.find((a) => a.id === id)?.name ?? '—';
}

export function RecentTransactions({ transactions, accounts }: RecentTransactionsProps) {
  const columns: TableColumn<Transaction>[] = [
    // 类型：色点 + 标签 / Type: dot + tag
    {
      key: 'type',
      title: '类型',
      render: (r) => {
        const config = TRANSACTION_TYPE_CONFIG[r.transaction_type];
        return (
          <div className="flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-full ${config.dotClass}`} />
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.tagClass}`}>
              {config.label}
            </span>
          </div>
        );
      },
    },
    // 日期 / Date
    {
      key: 'date',
      title: '日期',
      render: (r) => <span className="text-gray-600">{formatDate(r.transaction_date)}</span>,
    },
    // 账户：transfer 显示 source → target / Account: transfer shows source → target
    {
      key: 'account',
      title: '账户',
      render: (r) => {
        if (r.transaction_type === 'transfer') {
          return (
            <span className="text-gray-600">
              {getAccountName(accounts, r.account_id)} → {getAccountName(accounts, r.to_account_id)}
            </span>
          );
        }
        return <span className="text-gray-600">{getAccountName(accounts, r.account_id)}</span>;
      },
    },
    // 金额：sign + formatAmount，颜色按 type / Amount: sign + formatAmount, color by type
    {
      key: 'amount',
      title: '金额',
      align: 'right',
      render: (r) => {
        const config = TRANSACTION_TYPE_CONFIG[r.transaction_type];
        const colorClass =
          r.transaction_type === 'income' || r.transaction_type === 'initial_balance'
            ? 'text-green-600'
            : r.transaction_type === 'expense'
              ? 'text-red-600'
              : 'text-blue-600';
        return (
          <span className={`font-medium ${colorClass}`}>
            {config.sign}{formatAmount(r.amount)}
          </span>
        );
      },
    },
  ];

  return (
    <Card title="近期交易">
      {transactions.length === 0 ? (
        <EmptyState title="暂无交易记录" description="点击「交易记录」开始记录" />
      ) : (
        <Table columns={columns} data={transactions} />
      )}
    </Card>
  );
}
```

- [ ] **Step 5: 运行测试验证通过**

Run:
```bash
cd apps/desktop && pnpm test -- tests/dashboard-components.test.tsx
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/renderer/src/components/dashboard/RecentTransactions.tsx \
  apps/desktop/tests/dashboard-components.test.tsx
git commit -m "feat(dashboard): add RecentTransactions component

Simplified transaction table: 4 columns (type, date, account, amount).
Transfer shows source → target. Reuses M4 TRANSACTION_TYPE_CONFIG."
```

---

## Task 6: DashboardPage 容器重写

**Files:**
- Modify: `apps/desktop/src/renderer/src/pages/DashboardPage.tsx`（重写）
- Modify: `apps/desktop/tests/dashboard-components.test.tsx`（追加容器集成测试）

- [ ] **Step 1: 追加容器测试到 dashboard-components.test.tsx**

在 `apps/desktop/tests/dashboard-components.test.tsx` 的 import 区追加:

```typescript
import { DashboardPage } from '@renderer/pages/DashboardPage.js';
import { useAppStore } from '@renderer/stores/app-store.js';
```

在文件末尾追加:

```typescript
describe('DashboardPage', () => {
  beforeEach(() => {
    // 重置 mock 调用记录 / Reset mock call records
    vi.clearAllMocks();
    // 设置当前用户 / Set current user
    useAppStore.setState({ currentUser: { id: 'user-1', display_name: '测试用户' } as any });
  });

  it('渲染页头"仪表盘"', async () => {
    (window.dataAccess.account.list as any).mockResolvedValue([]);
    (window.dataAccess.tx.listByUser as any).mockResolvedValue([]);
    (window.dataAccess.snapshot.list as any).mockResolvedValue([]);
    (window.dataAccess.snapshot.generateMonthly as any).mockResolvedValue(null);

    render(<DashboardPage />);

    expect(screen.getByText('仪表盘')).toBeInTheDocument();
  });

  it('加载中显示加载状态', () => {
    (window.dataAccess.account.list as any).mockReturnValue(new Promise(() => {}));
    (window.dataAccess.tx.listByUser as any).mockReturnValue(new Promise(() => {}));
    (window.dataAccess.snapshot.list as any).mockReturnValue(new Promise(() => {}));

    render(<DashboardPage />);

    // 加载中时净资产卡显示 0.00（初始值）
    expect(screen.getByText('总资产').closest('.bg-white')!).toHaveTextContent('0.00');
  });

  it('数据加载完成后渲染所有模块', async () => {
    const accounts = [
      makeAccountForRecent({ id: 'acc-1', asset_class: 'liquid', current_balance: 100000 }),
    ];
    const transactions = [
      makeTxForRecent({ id: 'tx-1', transaction_type: 'income', amount: 50000 }),
    ];
    const snapshots = [
      { id: 's1', user_id: 'user-1', snapshot_date: 0, snapshot_year_month: '2026-06', total_liquid: 0, total_invested: 0, total_use_asset: 0, total_liability: 0, net_worth: 100000, sync_version: 0, updated_at: 0, deleted_flag: 0 },
      { id: 's2', user_id: 'user-1', snapshot_date: 0, snapshot_year_month: '2026-07', total_liquid: 0, total_invested: 0, total_use_asset: 0, total_liability: 0, net_worth: 150000, sync_version: 0, updated_at: 0, deleted_flag: 0 },
    ];

    (window.dataAccess.account.list as any).mockResolvedValue(accounts);
    (window.dataAccess.tx.listByUser as any).mockResolvedValue(transactions);
    (window.dataAccess.snapshot.list as any).mockResolvedValue(snapshots);
    (window.dataAccess.snapshot.generateMonthly as any).mockResolvedValue(null);

    render(<DashboardPage />);

    // 等待数据加载完成 / Wait for data to load
    // 净资产卡：总资产 100000 分 = ¥1,000.00
    expect(await screen.findByText('¥1,000.00')).toBeInTheDocument();
    // 近期交易标题
    expect(screen.getByText('近期交易')).toBeInTheDocument();
    // 趋势图标题
    expect(screen.getByText('净资产趋势（近 6 个月）')).toBeInTheDocument();
  });

  it('数据加载失败显示错误提示', async () => {
    (window.dataAccess.account.list as any).mockRejectedValue(new Error('网络错误'));
    (window.dataAccess.tx.listByUser as any).mockResolvedValue([]);
    (window.dataAccess.snapshot.list as any).mockResolvedValue([]);

    render(<DashboardPage />);

    expect(await screen.findByText('数据加载失败，请重试')).toBeInTheDocument();
  });

  it('调用 generateMonthlySnapshot', async () => {
    (window.dataAccess.account.list as any).mockResolvedValue([]);
    (window.dataAccess.tx.listByUser as any).mockResolvedValue([]);
    (window.dataAccess.snapshot.list as any).mockResolvedValue([]);
    (window.dataAccess.snapshot.generateMonthly as any).mockResolvedValue(null);

    render(<DashboardPage />);

    // 等待 useEffect 执行 / Wait for useEffect
    await screen.findByText('仪表盘');

    expect(window.dataAccess.snapshot.generateMonthly).toHaveBeenCalledWith('user-1');
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run:
```bash
cd apps/desktop && pnpm test -- tests/dashboard-components.test.tsx
```

Expected: FAIL（DashboardPage 还是占位页，没有"总资产"等元素）

- [ ] **Step 3: 重写 DashboardPage.tsx**

Replace `apps/desktop/src/renderer/src/pages/DashboardPage.tsx` entirely:

```typescript
// 仪表盘页 / Dashboard page
// 信息聚合中心：净资产 3 卡 + 本月收支 3 卡 + 净资产趋势图 + 近期交易表
// Aggregation hub: net worth cards + monthly overview + trend chart + recent transactions

import { useEffect, useMemo, useState } from 'react';
import type { Account, Transaction, NetWorthSnapshot } from '@shared/types/index.js';
import { useAppStore } from '../stores/app-store.js';
import { dataAccess } from '../data/data-access.js';
import { computeOverview } from '../components/transactions/transaction-constants.js';
import {
  computeNetWorthSummary,
  filterCurrentMonthTransactions,
  getRecentTransactions,
  formatTrendData,
} from '../components/dashboard/dashboard-constants.js';
import { NetWorthCards } from '../components/dashboard/NetWorthCards.js';
import { MonthlyOverviewCards } from '../components/dashboard/MonthlyOverviewCards.js';
import { NetWorthTrendChart } from '../components/dashboard/NetWorthTrendChart.js';
import { RecentTransactions } from '../components/dashboard/RecentTransactions.js';

export function DashboardPage() {
  const currentUser = useAppStore((s) => s.currentUser);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [snapshots, setSnapshots] = useState<NetWorthSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 拉数据 + 自动生成当月快照 / Fetch data + auto-generate monthly snapshot
  useEffect(() => {
    if (!currentUser) return;
    const userId = currentUser.id;

    Promise.all([
      dataAccess.getAccounts(userId),
      dataAccess.getTransactionsByUser(userId),
      dataAccess.getSnapshots(userId),
    ])
      .then(([accs, txs, snaps]) => {
        setAccounts(accs);
        setTransactions(txs);
        setSnapshots(snaps);
      })
      .catch(() => setError('数据加载失败，请重试'))
      .finally(() => setLoading(false));

    // 快照生成不阻塞主流程，静默失败 / Snapshot generation doesn't block, silent fail
    dataAccess.generateMonthlySnapshot(userId)
      .then((newSnapshot) => {
        if (newSnapshot) {
          // 新生成了快照，刷新列表 / New snapshot generated, refresh list
          dataAccess.getSnapshots(userId).then(setSnapshots).catch(() => {});
        }
      })
      .catch(() => {});
  }, [currentUser]);

  // 派生数据 / Derived data
  const netWorthSummary = useMemo(() => computeNetWorthSummary(accounts), [accounts]);

  const monthlyOverview = useMemo(() => {
    const monthlyTxs = filterCurrentMonthTransactions(transactions);
    return computeOverview(monthlyTxs);
  }, [transactions]);

  const trendData = useMemo(() => formatTrendData(snapshots), [snapshots]);

  const recentTransactions = useMemo(() => getRecentTransactions(transactions, 10), [transactions]);

  return (
    <div className="p-8 space-y-6">
      {/* 页头 / Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">仪表盘</h1>
        {currentUser && (
          <span className="text-sm text-gray-500">欢迎回来，{currentUser.display_name}</span>
        )}
      </div>

      {/* 错误提示 / Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* 净资产 3 卡 / Net worth cards */}
      <NetWorthCards summary={netWorthSummary} />

      {/* 本月收支 3 卡 / Monthly overview cards */}
      <MonthlyOverviewCards overview={monthlyOverview} />

      {/* 净资产趋势图 / Net worth trend chart */}
      <NetWorthTrendChart data={trendData} loading={loading} />

      {/* 近期交易 / Recent transactions */}
      <RecentTransactions transactions={recentTransactions} accounts={accounts} />
    </div>
  );
}
```

- [ ] **Step 4: 运行测试验证通过**

Run:
```bash
cd apps/desktop && pnpm test -- tests/dashboard-components.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/renderer/src/pages/DashboardPage.tsx \
  apps/desktop/tests/dashboard-components.test.tsx
git commit -m "feat(dashboard): rewrite DashboardPage as container

Parallel fetch accounts/transactions/snapshots + auto-generate monthly
snapshot. useMemo derives 4 data sets passed to 4 child components.
Error banner for fetch failures."
```

---

## Task 7: 全量测试验证 + 构建验证

**Files:** 无修改

- [ ] **Step 1: 运行全量测试**

Run:
```bash
cd apps/desktop && pnpm test
```

Expected: 所有测试通过（M4 的 72 个 + 新增 dashboard 测试）

- [ ] **Step 2: 运行 TypeScript 类型检查**

Run:
```bash
cd apps/desktop && pnpm exec tsc --noEmit
```

Expected: 无类型错误。如果有错误，根据报错修复（通常是 import 路径或类型不匹配）。

- [ ] **Step 3: 运行构建验证**

Run:
```bash
cd apps/desktop && pnpm build
```

Expected: 构建成功，`out/renderer/`、`out/main/`、`out/preload/` 生成。如果 recharts 导致构建失败，检查 `electron.vite.config.ts` 的 `externalizeDepsPlugin` 配置（recharts 不应该被 externalize，应该 bundle 进 renderer）。

- [ ] **Step 4: 确认 recharts 被 bundle 进 renderer**

Run:
```bash
grep -l "recharts" apps/desktop/out/renderer/assets/*.js || echo "recharts not found in renderer output"
```

Expected: 找到包含 recharts 的文件（说明被正确 bundle）

- [ ] **Step 5: Commit（如有修复）**

如果前几步有修复，提交修复:

```bash
git add -A
git commit -m "fix(dashboard): pass type check and build"
```

如果无修复，跳过此步。

---

## Task 8: 提交推送 + 触发 CI

**Files:** 无修改

- [ ] **Step 1: 确认所有 commit 已推送**

Run:
```bash
cd "FIRE APP" && git log --oneline origin/main..HEAD
```

Expected: 如果有未推送的 commit，执行 `git push origin main`

- [ ] **Step 2: 推送到 GitHub**

Run:
```bash
cd "FIRE APP" && git push origin main
```

Expected: 推送成功

- [ ] **Step 3: 等待 CI 构建完成**

前往 GitHub → Actions → `Build & Release` workflow，等待构建完成（约 5-10 分钟）。

- [ ] **Step 4: 下载 Artifacts 验证**

下载 `fire-app-windows` artifact，解压运行 `.exe`，验证：
1. 应用启动正常
2. 仪表盘页显示 4 个模块（净资产卡 + 收支卡 + 趋势图 + 近期交易）
3. 数据正确加载
4. 无白屏/闪退

---

## 验收标准对照

| Spec 验收标准 | 对应 Task |
|--------------|----------|
| D-1 DashboardPage 不再是占位页 | Task 6 |
| D-2 净资产 3 卡正确显示 | Task 2 + Task 6 |
| D-3 本月收支 3 卡正确显示 | Task 3 + Task 6 |
| D-4 趋势图显示近 6 个月 | Task 4 + Task 6 |
| D-5 近期交易显示最近 10 笔 | Task 5 + Task 6 |
| D-6 空状态文案正确 | Task 2-5 各组件测试 |
| D-7 所有 renderer 测试通过 | Task 7 |
| D-8 CI 构建成功 | Task 8 |
