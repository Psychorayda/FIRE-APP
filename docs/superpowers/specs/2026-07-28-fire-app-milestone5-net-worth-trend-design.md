# M5 净资产趋势页设计文档 / M5 Net Worth Trend Page Design

> **里程碑 / Milestone:** M5 — 净资产趋势页（Net Worth Trend Page）
> **日期 / Date:** 2026-07-28
> **状态 / Status:** 设计已批准，待写实施计划 / Design approved, pending implementation plan
> **前置 / Prerequisites:** M1 初始化、M2 数据层、M3 账户管理、M4 交易管理、dashboard 升级已完成
> **UI/UX 参考:** `docs/superpowers/specs/2026-07-15-fire-app-ui-ux-design.md` §3.3

---

## 1. 概述 / Overview

M5 实现 FIRE App 的净资产趋势页：完整的趋势可视化分析，替换当前占位页（`NetWorthPage.tsx`）。

**数据层已就位（M2 里程碑完成）：** `models/snapshot.ts`、`services/snapshot-service.ts`、`snapshot-handlers.ts`（IPC 通道）、`dataAccess.getSnapshots(userId)`。M5 工作集中在 UI 层。

### 1.1 目标 / Goals

- 趋势折线图：4 指标切换（净资产/流动/投资/负债）× 4 时间范围（近3月/近6月/近1年/全部）
- 资产配比环形图：最新月份快照，4 类资产分色占比
- 配比明细列表：配比图右侧，展示各类资产金额+百分比+净资产合计
- 空状态处理：0 条/1 条数据的引导文案
- 复用 Recharts 2.x（LineChart + PieChart）

### 1.2 非目标 / Non-Goals

- 不改动数据层（snapshot model/service/IPC 已就位）
- 不实现快照手动生成/编辑/删除
- 不实现导出功能
- 不复用 dashboard 的 NetWorthTrendChart（功能差异大，独立实现）
- 不实现独立的历史快照明细表（对齐 UI/UX §3.3，明细是配比图右侧列表）

### 1.3 与 dashboard 的关系

dashboard 的 NetWorthTrendChart 是**简化版**（固定净资产线、固定近 6 个月、无交互切换），M5 是**完整版**（4 指标切换、4 时间范围、配比图）。两者独立，不共享代码，避免强耦合。

---

## 2. 架构设计 / Architecture

### 2.1 架构方案（选定方案 A：复刻 M4 模式）

容器组件 + 纯展示子组件 + 纯函数模块，与 M3/M4/dashboard 完全一致的代码组织。

### 2.2 文件结构

```
apps/desktop/src/renderer/src/
├── pages/
│   └── NetWorthPage.tsx                    # 容器：拉数据 + 状态管理 + 组装
├── components/
│   └── net-worth/                          # 新建目录
│       ├── net-worth-constants.ts          # 纯函数：筛选/格式化/指标配置
│       ├── TrendChart.tsx                  # 趋势折线图（含时间范围+指标切换控件）
│       ├── AllocationDonut.tsx             # 资产配比环形图
│       └── AllocationDetail.tsx            # 配比明细列表
└── stores/
    └── snapshot-store.ts                   # 新建：snapshot 数据管理

apps/desktop/tests/
├── net-worth-constants.test.ts             # 纯函数测试
└── net-worth-components.test.tsx           # 组件测试
```

### 2.3 组件职责

| 组件 | 职责 | 依赖 |
|------|------|------|
| **NetWorthPage** | 容器：拉 snapshots、管理 timeRange/metric 状态、useMemo 派生数据、组装子组件 | useSnapshotStore、useAppStore |
| **TrendChart** | 折线图 + 时间范围按钮组 + 指标单选；处理空状态 | Recharts LineChart |
| **AllocationDonut** | 环形图（PieChart + Cell 分色）；处理空状态 | Recharts PieChart |
| **AllocationDetail** | 明细列表：4 类资产金额+百分比+净资产合计 | 无 |
| **net-worth-constants.ts** | filterByTimeRange、formatTrendForMetric、getAllocationData、配置常量 | 纯函数 |
| **snapshot-store.ts** | fetchSnapshots(userId) + loading/error | dataAccess.getSnapshots |

---

## 3. 数据流与状态 / Data Flow & State

### 3.1 数据来源

snapshot 数据已就位：
- `dataAccess.getSnapshots(userId)` → `NetWorthSnapshot[]`（按 `snapshot_year_month` 升序）
- 每个 snapshot 含：`snapshot_year_month`、`net_worth`、`total_liquid`、`total_invested`、`total_use_asset`、`total_liability`、`snapshot_date`

### 3.2 状态管理

**snapshot-store.ts**（新建，与 account/transaction store 模式一致）：

```typescript
interface SnapshotStore {
  snapshots: NetWorthSnapshot[];
  loading: boolean;
  error: string | null;
  fetchSnapshots: (userId: string) => Promise<void>;
  clear: () => void;
}
```

**NetWorthPage 本地状态**（useState）：
- `timeRange: TimeRangeKey`（默认 `'6m'`）
- `metric: MetricKey`（默认 `'netWorth'`）

### 3.3 数据流图

```
NetWorthPage
├── useAppStore (currentUser)
├── useSnapshotStore (snapshots, fetchSnapshots)
├── useState (timeRange, metric)
├── useMemo: filteredSnapshots = filterByTimeRange(snapshots, timeRange)
├── useMemo: trendData = formatTrendForMetric(filteredSnapshots, metric)
├── useMemo: allocationData = getAllocationData(snapshots) // 取最新月份
├── TrendChart        ← trendData, metric, timeRange, onMetricChange, onTimeRangeChange
├── AllocationDonut   ← allocationData
└── AllocationDetail  ← allocationData
```

### 3.4 时间范围筛选逻辑

- `3m`：取最近 3 个 `snapshot_year_month`（非日历月，以数据中实际存在的月份为准）
- `6m`：最近 6 个月
- `1y`：最近 12 个月
- `all`：全部

实现：按 `snapshot_year_month` 降序取 N 条，再升序返回（折线图需要时间升序）。

---

## 4. 纯函数模块 net-worth-constants.ts / Pure Functions

### 4.1 配置常量

```typescript
export const TIME_RANGE_CONFIG = [
  { key: '3m', label: '近3月', months: 3 },
  { key: '6m', label: '近6月', months: 6 },
  { key: '1y', label: '近1年', months: 12 },
  { key: 'all', label: '全部', months: Infinity },
] as const;

export type TimeRangeKey = '3m' | '6m' | '1y' | 'all';

export const METRIC_CONFIG = [
  { key: 'netWorth', label: '净资产', dataKey: 'net_worth', color: '#3b82f6' },
  { key: 'liquid', label: '流动', dataKey: 'total_liquid', color: '#3b82f6' },
  { key: 'invested', label: '投资', dataKey: 'total_invested', color: '#8b5cf6' },
  { key: 'liability', label: '负债', dataKey: 'total_liability', color: '#ef4444' },
] as const;

export type MetricKey = 'netWorth' | 'liquid' | 'invested' | 'liability';
```

### 4.2 filterByTimeRange(snapshots, timeRange)

按时间范围筛选 snapshots。

```typescript
export function filterByTimeRange(
  snapshots: NetWorthSnapshot[],
  timeRange: TimeRangeKey
): NetWorthSnapshot[] {
  const config = TIME_RANGE_CONFIG.find(c => c.key === timeRange)!;
  if (config.months === Infinity) {
    return [...snapshots].sort((a, b) => a.snapshot_year_month.localeCompare(b.snapshot_year_month));
  }
  // 按 year_month 降序取 N 条，再升序返回
  return [...snapshots]
    .sort((a, b) => b.snapshot_year_month.localeCompare(a.snapshot_year_month))
    .slice(0, config.months)
    .sort((a, b) => a.snapshot_year_month.localeCompare(b.snapshot_year_month));
}
```

### 4.3 formatTrendForMetric(snapshots, metric)

格式化折线图数据。

```typescript
export interface TrendPoint {
  month: string;        // YYYY-MM
  value: number;        // 元（已转换）
  snapshotDate: number; // 原始时间戳，用于 tooltip
}

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
```

### 4.4 getAllocationData(snapshots)

取最新月份配比数据。

```typescript
export interface AllocationItem {
  name: string;
  value: number;   // 元
  color: string;
  percent: number; // 0-100
}

export interface AllocationData {
  items: AllocationItem[];    // 4 类资产
  netWorth: number;            // 元
  totalAssets: number;         // 元（liquid + invested + use_asset）
  hasData: boolean;
}

export function getAllocationData(snapshots: NetWorthSnapshot[]): AllocationData {
  if (snapshots.length === 0) {
    return { items: [], netWorth: 0, totalAssets: 0, hasData: false };
  }
  // 取最新月份（year_month 最大的）
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

### 4.5 formatAmount 复用

金额格式化复用 `transaction-constants.ts` 的 `formatAmount`，保持全局一致。

---

## 5. 组件设计 / Component Design

### 5.1 TrendChart.tsx

```typescript
interface TrendChartProps {
  data: TrendPoint[];
  metric: MetricKey;
  timeRange: TimeRangeKey;
  loading: boolean;
  onMetricChange: (m: MetricKey) => void;
  onTimeRangeChange: (r: TimeRangeKey) => void;
}
```

**布局**：
- 顶行：时间范围按钮组（4 个 button）+ 指标单选组（4 个 radio label）
- 主体：Card 包裹的折线图

**空状态处理**：
- `loading` → "加载中..."
- `data.length === 0` → EmptyState "暂无趋势数据"
- `data.length === 1` → EmptyState "仅 1 个月数据，需至少 2 个月显示趋势"
- `data.length >= 2` → 渲染 LineChart

**LineChart 配置**：
- XAxis: `dataKey="month"`，fontSize 12
- YAxis: hide（避免金额过长）
- Tooltip: 显示月份 + 指标值（¥ 格式）+ 精确日期
- Line: `type="monotone"`，`dataKey="value"`，stroke 从 METRIC_CONFIG 取色

### 5.2 AllocationDonut.tsx

```typescript
interface AllocationDonutProps {
  data: AllocationData;
  loading: boolean;
}
```

**布局**：Card 包裹，标题"资产配比（最新月份）"

**空状态**：
- `loading` → "加载中..."
- `!data.hasData` → EmptyState "暂无配比数据"
- `data.hasData` → 渲染 PieChart（innerRadius 60, outerRadius 100）+ Cell 分色 + 中心显示净资产总额

### 5.3 AllocationDetail.tsx

```typescript
interface AllocationDetailProps {
  data: AllocationData;
}
```

**布局**：Card 包裹，标题"明细"

**内容**：
- 4 行：色点 + 资产名 + 金额 + 百分比
- 分隔线
- 净资产合计行：金额（负数红色）

**空状态**：`!data.hasData` → EmptyState "暂无明细数据"

---

## 6. 容器 NetWorthPage / Container

```typescript
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
      <h1 className="text-2xl font-bold text-gray-900">净资产趋势</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      <TrendChart
        data={trendData}
        metric={metric}
        timeRange={timeRange}
        loading={loading}
        onMetricChange={setMetric}
        onTimeRangeChange={setTimeRange}
      />

      <div className="grid grid-cols-2 gap-4">
        <AllocationDonut data={allocationData} loading={loading} />
        <AllocationDetail data={allocationData} />
      </div>
    </div>
  );
}
```

**关键点**：
- 配比图和明细用 `grid-cols-2` 并排（对齐 UI/UX §3.3.2 线框图）
- 配比数据取全部 snapshots 的最新月份（不受 timeRange 影响，因为展示的是"最新月份"快照）
- 趋势数据受 timeRange 和 metric 双重影响

---

## 7. 错误处理与测试 / Error Handling & Testing

### 7.1 错误处理

| 场景 | 处理 |
|------|------|
| fetchSnapshots 失败 | error 状态，页面显示红色错误横幅"数据加载失败，请重试" |
| 0 条 snapshot | 趋势图显示"暂无趋势数据"，配比图显示"暂无配比数据"，明细显示"暂无明细数据" |
| 1 条 snapshot | 趋势图显示"仅 1 个月数据，需至少 2 个月显示趋势"，配比图正常渲染（1 条数据可画环形图），明细正常 |
| 网络错误 | 同 fetchSnapshots 失败 |

### 7.2 测试策略

**net-worth-constants.test.ts**（纯函数，约 15 个用例）：
- filterByTimeRange：3m/6m/1y/all 各场景 + 边界（数据不足 N 条）
- formatTrendForMetric：4 种指标 + 金额转换正确性
- getAllocationData：正常数据 + 空数据 + 负净资产 + 总资产为 0（避免除零）
- 配置常量完整性

**net-worth-components.test.tsx**（组件，约 20 个用例）：
- TrendChart：空状态、1 条数据、多数据渲染、时间范围切换、指标切换、mock Recharts
- AllocationDonut：空状态、正常渲染、mock Recharts PieChart
- AllocationDetail：空状态、正常 4 行 + 净资产合计、负净资产红色
- NetWorthPage：页头、错误横幅、数据加载后渲染各模块、useEffect 调用 fetchSnapshots

**mock 策略**：
- Recharts mock（LineChart、PieChart、Cell 等）
- dataAccess mock（snapshot.list）
- useAppStore mock（currentUser）

### 7.3 验收标准

| # | 标准 | 验证方式 |
|---|------|---------|
| NW-1 | NetWorthPage 不再是占位页 | 手动 GUI |
| NW-2 | 趋势折线图显示净资产趋势 | 手动 GUI |
| NW-3 | 4 指标切换正确 | 手动 GUI |
| NW-4 | 4 时间范围切换正确 | 手动 GUI |
| NW-5 | 资产配比环形图显示最新月份占比 | 手动 GUI |
| NW-6 | 配比明细列表正确显示 | 手动 GUI |
| NW-7 | 空状态文案正确 | 手动 GUI |
| NW-8 | 所有 renderer 测试通过 | 自动化 |
| NW-9 | CI 构建成功 | CI |

---

## 8. 设计决策汇总 / Design Decisions

| # | 决策点 | 选择 | 理由 |
|---|--------|------|------|
| 1 | 架构方案 | 方案 A：复刻 M4 模式（容器+子组件+纯函数） | 与 M3/M4/dashboard 一致，0 学习成本，易测试 |
| 2 | 与 dashboard 关系 | 独立实现，不复用 NetWorthTrendChart | dashboard 是简化版，M5 是完整版，功能差异大，避免强耦合 |
| 3 | 历史明细形态 | 对齐 UI/UX §3.3，配比图右侧列表 | 不增加独立表格，YAGNI |
| 4 | 空状态策略 | 仅空状态文案，不提供示例数据 | 与 dashboard 一致，用户实际使用积累数据 |
| 5 | snapshot-store | 新建独立 store | 与 account/transaction store 模式一致 |
| 6 | 配比图数据源 | 取全部 snapshots 的最新月份 | 展示"最新月份"快照，不受 timeRange 影响 |
| 7 | 金额格式化 | 复用 transaction-constants 的 formatAmount | 保持全局一致 |
| 8 | 时间范围定义 | 以数据中实际存在的月份为准（非日历月） | 实现简单，符合个人财务场景 |

---

## 9. 实施顺序建议 / Implementation Order

1. **Task 1**：创建 snapshot-store.ts
2. **Task 2**：创建 net-worth-constants.ts + 测试（纯函数先行，TDD）
3. **Task 3**：创建 TrendChart.tsx + 测试
4. **Task 4**：创建 AllocationDonut.tsx + 测试
5. **Task 5**：创建 AllocationDetail.tsx + 测试
6. **Task 6**：重写 NetWorthPage.tsx 容器 + 集成测试
7. **Task 7**：全量测试 + tsc + 构建验证
8. **Task 8**：推送 + CI 验证
9. **Task 9**：手动 GUI 验证（打包 exe）
