# 仪表盘升级设计文档 / Dashboard Upgrade Design

> **状态**：待实施
> **日期**：2026-07-28
> **关联**：[M4 交易管理设计](./2026-07-16-fire-app-milestone4-transaction-management-design.md) · [M4 验证报告](./2026-07-16-fire-app-milestone4-verification.md)
> **前置**：M1~M4 全部完成（账户 + 交易 + IPC + snapshot 服务就绪）

---

## §1 概述

### 1.1 目标

把现有占位 `DashboardPage` 升级为信息聚合中心，一屏展示用户财务全貌：净资产概览、本月收支、净资产趋势、近期交易。

### 1.2 背景

当前 `DashboardPage` 仅显示"欢迎回来，{用户}"占位文案。但后端基础设施已完备：
- `getAccounts` / `getNetWorth` — 账户与净资产查询
- `getTransactionsByUser` — 交易查询
- `getSnapshots` / `generateMonthlySnapshot` — 月度快照

本里程碑纯前端工作：**无需新增任何后端 IPC handler**，全部通过现有 DataAccessPort 聚合数据 + renderer 层派生计算。

### 1.3 范围

- 重写 `DashboardPage` 为容器
- 新建 4 个子组件 + 1 个纯函数模块
- 新增 Recharts 依赖用于趋势图
- 完整 renderer 测试覆盖

---

## §2 架构设计

### 2.1 组件结构

```
DashboardPage.tsx                   # 容器：拉数据 + 派生计算 + 组合子组件
├── components/dashboard/
│   ├── dashboard-constants.ts       # 纯函数 + 类型定义
│   ├── NetWorthCards.tsx            # 净资产 3 卡
│   ├── MonthlyOverviewCards.tsx     # 本月收支 3 卡
│   ├── NetWorthTrendChart.tsx       # Recharts 趋势折线图
│   └── RecentTransactions.tsx       # 近期交易精简表
```

### 2.2 技术选型

| 项 | 选择 | 理由 |
|----|------|------|
| 图表库 | Recharts 2.x | React 生态主流，声明式 API |
| 状态管理 | 容器层 useState + useMemo | 无需新 store，局部状态足够 |
| 数据获取 | DataAccessPort（现有） | 接口已完备 |
| 测试 | vitest + jsdom + @testing-library/react | 沿用 M4 基础设施 |

### 2.3 数据流

```
DashboardPage (useEffect)
  ├─ Promise.all([getAccounts, getTransactionsByUser, getSnapshots])
  ├─ generateMonthlySnapshot (异步，不阻塞主流程)
  │
  └─ useMemo 派生
      ├─ computeNetWorthSummary(accounts) → NetWorthCards
      ├─ filterCurrentMonthTransactions(txs) → computeOverview → MonthlyOverviewCards
      ├─ formatTrendData(snapshots) → NetWorthTrendChart
      └─ getRecentTransactions(txs) → RecentTransactions
```

---

## §3 组件设计

### 3.1 容器：DashboardPage.tsx

**职责**：
- 并行拉取 3 类数据
- 启动时自动生成当月快照（`generateMonthlySnapshot` 内部已去重）
- `useMemo` 派生 4 类数据传给子组件
- 统一错误处理

**关键代码结构**：

```typescript
export function DashboardPage() {
  const currentUser = useAppStore((s) => s.currentUser);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [snapshots, setSnapshots] = useState<NetWorthSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 拉数据 + 自动生成当月快照
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

    // 快照生成不阻塞主流程，静默失败
    dataAccess.generateMonthlySnapshot(userId).then((newSnapshot) => {
      if (newSnapshot) {
        // 新生成快照，刷新列表
        dataAccess.getSnapshots(userId).then(setSnapshots).catch(() => {});
      }
    }).catch(() => {});
  }, [currentUser]);

  // 派生数据
  const netWorthSummary = useMemo(() => computeNetWorthSummary(accounts), [accounts]);
  const monthlyOverview = useMemo(() => {
    const monthlyTxs = filterCurrentMonthTransactions(transactions);
    return computeOverview(monthlyTxs);
  }, [transactions]);
  const trendData = useMemo(() => formatTrendData(snapshots), [snapshots]);
  const recentTransactions = useMemo(() => getRecentTransactions(transactions, 10), [transactions]);

  return (...);
}
```

### 3.2 NetWorthCards.tsx

**展示**：3 张卡（总资产 / 总负债 / 净资产），grid-cols-3 布局

```typescript
interface NetWorthCardsProps {
  summary: {
    totalAssets: number;    // liquid + invested + use_asset
    totalLiability: number; // 负数
    netWorth: number;
  };
}
```

| 卡 | 色点 | 文字颜色 |
|----|------|---------|
| 总资产 | 蓝色 | gray-900 |
| 总负债 | 红色 | gray-900 |
| 净资产 | 绿色（正）/ 红色（负） | 绿色（正）/ 红色（负） |

### 3.3 MonthlyOverviewCards.tsx

**展示**：3 张卡（本月收入 / 本月支出 / 本月结余），复用 M4 `TransactionOverview` 类型

```typescript
interface MonthlyOverviewCardsProps {
  overview: TransactionOverview;  // 复用 M4 类型
}
```

| 卡 | 色点 | 文字颜色 |
|----|------|---------|
| 收入 | 绿色 | gray-900 |
| 支出 | 红色 | gray-900 |
| 结余 | 蓝色 | 绿色（正）/ 红色（负） |

### 3.4 NetWorthTrendChart.tsx

**展示**：Recharts 折线图，近 6 个月净资产变化

```typescript
interface NetWorthTrendChartProps {
  data: { month: string; netWorth: number }[];
  loading: boolean;
}
```

**行为**：
- `data.length === 0` → 空状态"暂无趋势数据，继续使用以积累"
- `data.length === 1` → 空状态"仅 1 个月数据，需至少 2 个月显示趋势"
- `data.length >= 2` → 渲染折线图
- `loading === true` → 显示加载占位

**图表配置**：
- 单条折线，蓝色（`#3b82f6`）
- 无网格线（缩略图风格）
- X 轴：月份（YYYY-MM）
- Y 轴：隐藏（缩略图不显示刻度）
- Tooltip：悬停显示月份 + 金额（元）

### 3.5 RecentTransactions.tsx

**展示**：精简版交易表，最近 10 笔，4 列

```typescript
interface RecentTransactionsProps {
  transactions: Transaction[];
  accounts: Account[];
}
```

**列定义**：
| 列 | 内容 |
|----|------|
| 类型 | 色点 + 标签（复用 `TRANSACTION_TYPE_CONFIG`） |
| 日期 | `formatDate(transaction_date)` |
| 账户 | 账户名（transfer 显示 `source → target`） |
| 金额 | `sign + formatAmount`，按类型着色 |

**与 M4 TransactionListTable 的区别**：
- 无排序控件
- 无操作列（编辑/删除）
- 无筛选区
- 固定 10 笔限制

---

## §4 纯函数设计

### 4.1 dashboard-constants.ts

```typescript
// 净资产汇总
export interface NetWorthSummary {
  totalLiquid: number;
  totalInvested: number;
  totalUseAsset: number;
  totalLiability: number;  // 负数
  totalAssets: number;      // liquid + invested + use_asset
  netWorth: number;         // totalAssets + totalLiability
}

export function computeNetWorthSummary(accounts: Account[]): NetWorthSummary;

// 本月交易筛选
export function filterCurrentMonthTransactions(txs: Transaction[]): Transaction[];

// 近期交易切片
export function getRecentTransactions(txs: Transaction[], limit: number): Transaction[];

// 趋势数据格式化
export interface TrendPoint {
  month: string;     // YYYY-MM
  netWorth: number;  // 元（已转元）
}

export function formatTrendData(snapshots: NetWorthSnapshot[]): TrendPoint[];
```

### 4.2 计算逻辑

**computeNetWorthSummary**：
- 按 `asset_class` 分组求和
- `totalAssets = liquid + invested + use_asset`
- `netWorth = totalAssets + totalLiability`（liability 为负数）

**filterCurrentMonthTransactions**：
- 基于本地时区 `new Date()` 计算本月起止时间戳
- 按 `transaction_date` 筛选

**getRecentTransactions**：
- 按 `transaction_date` 降序排序
- 取前 `limit` 笔

**formatTrendData**：
- 按 `snapshot_year_month` 升序排序
- 取近 6 个月
- `netWorth` 从分转元（`centsToYuan`）
- `month` 取 `snapshot_year_month`

---

## §5 测试策略

### 5.1 测试范围

| 层级 | 文件 | 覆盖 |
|------|------|------|
| 纯函数 | `tests/dashboard-constants.test.ts` | 4 个函数的边界情况 |
| 组件 | `tests/dashboard-components.test.tsx` | 4 个子组件 + 容器 |

### 5.2 纯函数测试要点

**computeNetWorthSummary**：
- 4 种 asset_class 正确分组
- 空数组返回全 0
- liability 为负数时正确计入净资产
- mixed 场景（有资产有负债）

**filterCurrentMonthTransactions**：
- 只返回本月交易
- 跨月交易被排除
- 空数组返回空
- 月初/月末边界

**getRecentTransactions**：
- 按日期降序排序
- 限制返回前 N 笔
- 不足 N 笔返回全部
- 空数组返回空

**formatTrendData**：
- snapshot 数组转 Recharts 格式
- 按 year_month 升序
- 限制近 6 个月
- 空数组返回空
- 单条 snapshot 返回 1 个点

### 5.3 组件测试要点

| 组件 | 测试点 |
|------|--------|
| NetWorthCards | 3 卡渲染 / 正负数颜色 / 空状态 ¥0.00 |
| MonthlyOverviewCards | 复用 computeOverview 结果正确渲染 / 3 卡显示 |
| NetWorthTrendChart | 空数据显示提示 / 1 个数据显示提示 / 多数据渲染图表 / loading 状态 |
| RecentTransactions | 10 笔限制 / 账户名解析 / transfer 显示 source→target / 空状态 |
| DashboardPage | 并行拉取 / 错误处理 / 子组件收到正确数据 |

### 5.4 Recharts 测试处理

Recharts 在 jsdom 下渲染依赖 SVG `getBoundingClientRect`，会报错。解决方案：

```typescript
// tests/dashboard-components.test.tsx
vi.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="xaxis" />,
  YAxis: () => <div data-testid="yaxis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
}));
```

只验证"渲染了图表容器"和"传入的 data 正确"，不验证图表内部 SVG。

---

## §6 空状态与错误处理

### 6.1 空状态矩阵

| 场景 | 净资产卡 | 收支卡 | 趋势图 | 近期交易表 |
|------|---------|--------|--------|-----------|
| 无账户 | 3 卡 ¥0.00 + 提示"请先创建账户" | 3 卡 ¥0.00 | 空状态 | 空状态"暂无交易记录" |
| 有账户无交易 | 正常显示余额 | 3 卡 ¥0.00 | 空状态或 1 个点 | 空状态 |
| 有交易无 snapshot | 正常 | 正常 | 空状态"暂无趋势数据" | 正常 |
| 首次启动（全空） | 全部 ¥0.00 + 引导提示 | 全部 ¥0.00 | 空状态 | 空状态 |

### 6.2 错误处理

- 数据拉取失败：页面顶部显示错误提示条，已加载模块正常展示
- `generateMonthlySnapshot` 失败：静默失败，不阻塞主流程（快照非核心功能）

### 6.3 边界情况

1. **负债账户**：`asset_class = 'liability'` 余额为负数，`computeNetWorthSummary` 正确计入
2. **transfer 交易**：本月收支不计入收入/支出（复用 M4 `computeOverview`），仅影响账户余额
3. **跨月交易**：`filterCurrentMonthTransactions` 严格按 `transaction_date` 时间戳筛选
4. **快照时区**：`toYearMonth` 基于 UTC，`filterCurrentMonthTransactions` 基于本地时区，月初月末可能 1 天偏差，当前阶段可接受

---

## §7 文件清单

### 7.1 新建文件（7 个）

| 路径 | 职责 |
|------|------|
| `apps/desktop/src/renderer/src/components/dashboard/dashboard-constants.ts` | 纯函数 + 类型 |
| `apps/desktop/src/renderer/src/components/dashboard/NetWorthCards.tsx` | 净资产 3 卡 |
| `apps/desktop/src/renderer/src/components/dashboard/MonthlyOverviewCards.tsx` | 本月收支 3 卡 |
| `apps/desktop/src/renderer/src/components/dashboard/NetWorthTrendChart.tsx` | 趋势折线图 |
| `apps/desktop/src/renderer/src/components/dashboard/RecentTransactions.tsx` | 近期交易表 |
| `apps/desktop/tests/dashboard-constants.test.ts` | 纯函数测试 |
| `apps/desktop/tests/dashboard-components.test.tsx` | 组件测试 |

### 7.2 修改文件（3 个）

| 路径 | 修改 |
|------|------|
| `apps/desktop/src/renderer/src/pages/DashboardPage.tsx` | 重写为容器 |
| `apps/desktop/package.json` | 新增 `recharts` 依赖 |
| `apps/desktop/vitest.setup.ts` | 新增 recharts mock（如需要） |

### 7.3 不修改的文件

- `data-access-port.ts` — 接口已完备
- `ipc-handlers.ts` — 后端无改动
- `shared/services/snapshot-service.ts` — 逻辑已就绪
- `electron-builder.yml` — recharts 被 bundle，不影响打包

---

## §8 已知风险

| 风险 | 影响 | 对策 |
|------|------|------|
| Recharts 与 React 19 不兼容 | 趋势图无法渲染 | 安装前验证兼容性；不兼容则回退自定义 SVG |
| jsdom 下 Recharts 测试报错 | 测试失败 | mock recharts 模块 |
| 数据量增长后 `getTransactionsByUser` 拉全量性能 | 后续可能卡顿 | 当前阶段可接受；后续里程碑加后端聚合 |
| 账户余额实时性 | 交易增删后仪表盘不自动刷新 | 仪表盘 mount 时重新拉取；后续可加 store 订阅 |
| 快照时区偏差 | 月初月末可能错位 1 天 | 个人记账场景可接受，不处理 |

---

## §9 验收标准

| # | 标准 | 验证方式 |
|---|------|---------|
| D-1 | DashboardPage 不再是占位页，展示 4 个模块 | 启动应用访问仪表盘 |
| D-2 | 净资产 3 卡正确显示总资产/总负债/净资产 | 有账户时数值正确 |
| D-3 | 本月收支 3 卡正确显示收入/支出/结余 | 本月有交易时数值正确 |
| D-4 | 趋势图显示近 6 个月净资产变化 | 有 ≥2 个月 snapshot 时显示折线图 |
| D-5 | 近期交易显示最近 10 笔 | 有交易时列表正确 |
| D-6 | 空状态文案正确 | 无数据时各模块显示对应提示 |
| D-7 | 所有 renderer 测试通过 | `pnpm test:desktop` |
| D-8 | CI 构建成功 | push 后 Actions 通过 |
