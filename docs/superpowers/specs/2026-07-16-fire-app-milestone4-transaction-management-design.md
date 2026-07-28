# M4 交易管理设计文档 / M4 Transaction Management Design

> **里程碑 / Milestone:** M4 — 交易管理（Transaction Management）
> **日期 / Date:** 2026-07-16
> **状态 / Status:** 设计已批准，待写实施计划 / Design approved, pending implementation plan

---

## 1. 概述 / Overview

M4 实现 FIRE App 的交易记录管理功能：完整的 CRUD 交互、多维度筛选、汇总概览，以及与账户余额的联动。

**数据层已就位（M2 里程碑完成）：** `models/transaction.ts`、`services/transaction-service.ts`、`transaction-handlers.ts`（6 个 IPC 通道）、`preload/index.ts`、`ipc-data-access.ts`、`transaction-store.ts`、`db/schema.ts`（4 个索引 + CHECK 约束）。M4 工作集中在 UI 层 + 新增 category-store + 测试基础设施。

### 1.1 目标 / Goals

- 交易 CRUD：新增、编辑、删除（软删除 + 余额反向冲销）
- 4 种交易类型支持：income / expense / transfer / initial_balance
- 多维度筛选：类型、账户、分类、日期范围
- 汇总概览：收入、支出、结余（跟随筛选结果）
- Category 前端管理：useCategoryStore + 自动 seed 兜底
- 完整 renderer 测试：vitest + jsdom + @testing-library/react

### 1.2 非目标 / Non-Goals

- 不改动数据层（schema / model / service / IPC / preload）
- 不实现分类管理页面（category CRUD 仅 store + seed 兜底）
- 不实现交易导入/导出
- 不实现交易搜索（按描述文本搜索）
- 不实现交易分页（前端内存筛选，全量加载）

---

## 2. 设计决策汇总 / Design Decisions

| # | 决策点 | 选择 | 理由 |
|---|--------|------|------|
| 1 | 筛选方式 | 前端内存筛选（getTransactionsByUser + useMemo） | 数据量小（个人财务），零数据层改动，useMemo 派生足够 |
| 2 | Category 组织 | 新建 useCategoryStore + 自动 seed 兜底 | 与 useAccountStore 模式一致，解决 seedCategories 从未被调用的问题 |
| 3 | seed 触发条件 | `length === 0` 就 seed | 逻辑最简，覆盖新用户场景 |
| 4 | Type 选择器 | 4 种类型都可选 | 用户明确要求灵活性 |
| 5 | Transfer 联动 | to_account_id 必填，category 保留可选 | to_account 语义必须，category 可作转账备注 |
| 6 | 概览卡 | 3 张卡跟随筛选 | 收入（含 initial_balance）/ 支出 / 结余，transfer 不计入结余 |
| 7 | 架构方案 | 方案 A：复刻 M3 accounts 4 件套 + 独立筛选组件 | 与 M3 一致的代码组织，0 学习成本 |
| 8 | 测试策略 | 完整 renderer 测试 | 核心逻辑回归保护，手动验证精简至 5 项 |

---

## 3. 架构设计 / Architecture

### 3.1 架构方案对比（选定方案 A）

**方案 A（选定）：严格复刻 M3 accounts 模式**
- 4 件套组件 + TransactionsPage 本地 useState 筛选 + 独立 useCategoryStore
- 与 M3 完全一致的代码组织

**方案 B（未选）：筛选状态放进 transaction-store**
- store 增加 filters 字段 + setFilter action + 派生 filteredTransactions
- 否决理由：YAGNI——M4 只有 1 个交易页；与 account-store 模式不一致

**方案 C（未选）：抽出 useTransactionFilters hook**
- 额外抽 hooks/useTransactionFilters.ts 封装筛选逻辑
- 否决理由：M4 单页面用不到复用，过度抽象

### 3.2 组件依赖关系

```
TransactionsPage
├── useAppStore (currentUser)
├── useTransactionStore (transactions, CRUD)
├── useAccountStore (accounts —— 表单下拉 + 筛选)
├── useCategoryStore (categories —— 表单下拉 + 筛选，新建)
├── TransactionOverviewCards ← filtered (useMemo)
├── TransactionFilters       ← filters state (local)
├── TransactionListTable     ← filtered + sort (local)
├── TransactionFormModal     ← accounts + categories
└── ConfirmDialog (复用 base)
```

### 3.3 数据流

```
TransactionsPage mount (useEffect)
  ├─ fetchTransactions(userId)  → transaction-store.transactions
  ├─ fetchAccounts(userId)      → account-store.accounts
  └─ fetchCategories(userId)    → category-store.categories
                                   └─ 内部检测空 → seedCategories → 重新 fetch

TransactionsPage 本地状态：
  filters = useState({ type, account_id, dateFrom, dateTo, category_id })
  sortBy  = useState('date-desc')  // 默认按日期降序

派生数据（useMemo）：
  filtered = filterTransactions(transactions, filters)  // pure function
  overview = computeOverview(filtered)                   // pure function
  sorted   = sortTransactions(filtered, sortBy)          // pure function

渲染：
  TransactionOverviewCards ← overview
  TransactionFilters       ← filters + onFiltersChange
  TransactionListTable     ← sorted + onEdit/onDelete
  TransactionFormModal     ← accounts + categories（打开时）
```

**关键特性：** 概览卡和列表都消费 `filtered`，筛选变化时两者同步更新——这是把筛选状态放在页面本地（而非 store）的核心收益。

---

## 4. 文件清单 / File Inventory

### 4.1 新建文件（10 个）

| 文件 | 职责 |
|------|------|
| `apps/desktop/src/renderer/src/stores/category-store.ts` | useCategoryStore + 自动 seed 兜底（模块级 Promise 缓存防并发） |
| `apps/desktop/src/renderer/src/components/transactions/transaction-constants.ts` | TRANSACTION_TYPE_CONFIG、TRANSACTION_TYPE_OPTIONS、formatAmount、computeOverview、filterTransactions、sortTransactions（pure function） |
| `apps/desktop/src/renderer/src/components/transactions/TransactionOverviewCards.tsx` | 3 张汇总卡（收入/支出/结余） |
| `apps/desktop/src/renderer/src/components/transactions/TransactionFilters.tsx` | 筛选区（受控，4 个筛选项 + 重置） |
| `apps/desktop/src/renderer/src/components/transactions/TransactionListTable.tsx` | 列表表格 + 排序 |
| `apps/desktop/src/renderer/src/components/transactions/TransactionFormModal.tsx` | 表单弹窗（create/edit 共用，4 type + transfer 联动） |
| `apps/desktop/vitest.config.ts` | 测试配置（jsdom 环境 + alias 解析） |
| `apps/desktop/vitest.setup.ts` | jest-dom + window.dataAccess 全局 mock 工厂 |
| `apps/desktop/tests/**/*.test.ts(x)` | 8 个测试文件（~40 case） |
| `docs/superpowers/specs/2026-07-16-fire-app-milestone4-transaction-management-design.md` | 本设计文档 |

### 4.2 修改文件（4 个）

| 文件 | 修改内容 |
|------|---------|
| `apps/desktop/src/renderer/src/stores/index.ts` | 追加 `export { useCategoryStore }` |
| `apps/desktop/src/renderer/src/pages/TransactionsPage.tsx` | 替换 M2 占位页为完整容器 |
| `apps/desktop/package.json` | 加 `test` / `test:watch` 脚本 + 测试依赖（vitest、jsdom、@testing-library/*） |
| `package.json`（根） | 加 `test:desktop` + `test:all` 脚本 |

### 4.3 不触碰的层（已就位）

- `packages/shared/src/db/schema.ts` — transactions 表 4 索引 + CHECK 约束
- `packages/shared/src/models/transaction.ts` — getTransaction / getTransactionById / getTransactionsByUser
- `packages/shared/src/services/transaction-service.ts` — createTransaction / editTransaction / deleteTransaction（含余额联动）
- `packages/shared/src/models/category.ts` — createCategory / getCategory / getCategories / seedCategories（18 个内置分类）
- `apps/desktop/src/main/ipc/transaction-handlers.ts` — 6 个 IPC 通道
- `apps/desktop/src/main/ipc/category-handlers.ts` — 4 个 IPC 通道
- `apps/desktop/src/preload/index.ts` — tx + category namespace
- `apps/desktop/src/renderer/src/data/ipc-data-access.ts` — 完整 DataAccessPort 实现
- `apps/desktop/src/renderer/src/stores/transaction-store.ts` — 已含 CRUD + 自动刷新账户余额

---

## 5. 组件细节 / Component Details

### 5.1 transaction-constants.ts

**类型配置：**

```typescript
export const TRANSACTION_TYPE_CONFIG: Record<TransactionType, {
  label: string; dotClass: string; tagClass: string; sign: '+' | '-' | '⟷';
}> = {
  income:           { label: '收入',     dotClass: 'bg-green-500',  tagClass: 'bg-green-100 text-green-700',  sign: '+' },
  expense:          { label: '支出',     dotClass: 'bg-red-500',    tagClass: 'bg-red-100 text-red-700',      sign: '-' },
  transfer:         { label: '转账',     dotClass: 'bg-blue-500',   tagClass: 'bg-blue-100 text-blue-700',    sign: '⟷' },
  initial_balance:  { label: '期初余额', dotClass: 'bg-purple-500', tagClass: 'bg-purple-100 text-purple-700', sign: '+' },
};
```

**Pure function 导出（可测试）：**

- `TRANSACTION_TYPE_OPTIONS` — 供 Select 组件使用
- `formatAmount(cents: number): string` — 分转元并格式化为 ¥ 货币字符串
- `computeOverview(txs: Transaction[]): TransactionOverview` — 收入/支出/结余/转账总额聚合
- `filterTransactions(txs: Transaction[], filters: TransactionFilters): Transaction[]` — 筛选逻辑
- `sortTransactions(txs: Transaction[], sortBy: string): Transaction[]` — 排序逻辑

**TransactionOverview 接口：**

```typescript
export interface TransactionOverview {
  income: number;   // income + initial_balance 合计
  expense: number;  // expense 合计
  transfer: number; // transfer 总额（不计入结余，仅展示用）
  balance: number;  // income - expense
}
```

**结余口径：** `income + initial_balance - expense`，transfer 余额中性不计入。

### 5.2 TransactionOverviewCards.tsx

3 张卡（grid-cols-3）：
- 收入卡（绿点）— `overview.income`，含 income + initial_balance
- 支出卡（红点）— `overview.expense`
- 结余卡（蓝点）— `overview.balance`，负数显示红色

**隐藏规则：** `filtered.length === 0` 时不渲染（避免显示 3 个 ¥0.00）。

### 5.3 TransactionFilters.tsx

**Props（受控组件）：**

```typescript
interface TransactionFiltersProps {
  filters: TransactionFilters;
  accounts: Account[];
  categories: Category[];
  onFiltersChange: (f: TransactionFilters) => void;
  onReset: () => void;
}
```

**筛选项（4 个 + 重置按钮）：**

| 字段 | 组件 | 值 |
|------|------|-----|
| type | Select | `''`（全部）/ income / expense / transfer / initial_balance |
| account_id | Select | `''`（全部账户）/ 各账户 id |
| category_id | Select | `''`（全部分类）/ 各分类 id |
| dateFrom / dateTo | Input date | 空字符串 / `YYYY-MM-DD` |

### 5.4 TransactionListTable.tsx

**Props：**

```typescript
interface TransactionListTableProps {
  transactions: Transaction[];   // 已筛选 + 已排序
  loading: boolean;
  accounts: Account[];
  categories: Category[];
  onEdit: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
}
```

**排序选项（内嵌 Select）：**

| value | 说明 |
|-------|------|
| `date-desc` | 日期降序（默认） |
| `date-asc` | 日期升序 |
| `amount-desc` | 金额降序 |
| `amount-asc` | 金额升序 |

**列（6 列）：**

| 列 | 渲染 |
|----|------|
| 类型 | 色点 + 类型标签（Tag） |
| 日期 | `YYYY-MM-DD`（从 Unix ms 格式化） |
| 账户 | account.name；transfer 时显示 `source → target` |
| 分类 | category.name 或 `—`（transfer/无分类时） |
| 金额 | `sign + formatAmount`；income/initial_balance 绿色，expense 红色，transfer 灰色 |
| 操作 | 编辑 / 删除按钮 |

**空状态（判断标准：`hasActiveFilters = filters 中任一字段非空字符串`）：**
- loading 时显示 loading Table
- `transactions.length === 0 && !hasActiveFilters` → "暂无交易记录，点击右上角新增"
- `transactions.length === 0 && hasActiveFilters` → "无匹配交易，试试调整筛选条件"

### 5.5 TransactionFormModal.tsx

**Props：** 与 M3 AccountFormModal 一致结构 + accounts + categories

**表单字段：**

| 字段 | 组件 | 必填 | 默认值 |
|------|------|------|--------|
| transaction_type | Select | ✓ | `expense` |
| account_id | Select | ✓ | 第一个账户 |
| to_account_id | Select | transfer 时必填，否则隐藏 | `''` |
| category_id | Select | 可选 | `''` |
| amount | Input number | ✓ | `''` |
| transaction_date | Input date | ✓ | 今天 |
| description | Input text | 可选 | `''` |

**Type 联动逻辑：**
- `transaction_type === 'transfer'`：显示 `to_account_id` 下拉（必填，校验 ≠ `account_id`）；`category_id` 保留显示但标记"可选"
- `transaction_type !== 'transfer'`：隐藏 `to_account_id`，提交时强制 `to_account_id = null`

**编辑预填：** 打开时根据 transaction 实体预填所有字段；`transaction_date` 从 Unix ms 转 `YYYY-MM-DD`；`to_account_id` 为 null 时填 `''`。

**校验（提交前）：**
- `account_id` 必填
- `amount` 必填且 > 0（service 层 CHECK 约束 `amount > 0` 兜底）
- `transaction_type === 'transfer'` 时 `to_account_id` 必填且 ≠ `account_id`
- `transaction_date` 必填

**提交构造：**
- create：`CreateTransactionInput`（含 user_id）
- edit：`EditTransactionInput`（不含 user_id）
- `to_account_id`：非 transfer 时强制 null；transfer 时取 Select 值
- `category_id`：空字符串 → null
- `amount`：`yuanToCents(Number(amount))`
- `transaction_date`：`new Date(dateStr).getTime()`（当日 00:00 时间戳）

---

## 6. 筛选逻辑细节 / Filter Logic

### 6.1 TransactionFilters 接口

```typescript
export interface TransactionFilters {
  type: string;          // '' = 全部
  account_id: string;    // '' = 全部
  category_id: string;   // '' = 全部
  dateFrom: string;      // '' = 不限，YYYY-MM-DD
  dateTo: string;        // '' = 不限，YYYY-MM-DD
}
```

### 6.2 筛选规则

| 字段 | 空值 | 非空值 |
|------|------|--------|
| type | 不过滤 | `tx.transaction_type === type` |
| account_id | 不过滤 | `tx.account_id === id` **或** `tx.to_account_id === id`（Transfer 双向匹配） |
| category_id | 不过滤 | `tx.category_id === id` |
| dateFrom | 不过滤 | `tx.transaction_date >= toTimestamp(dateFrom)` |
| dateTo | 不过滤 | `tx.transaction_date < toTimestamp(dateTo) + 1天`（含当天） |

**Transfer 账户筛选语义：** 筛选某账户时，该账户作为 source 或 target 的转账都应显示——"查看招行所有交易"应包含转入和转出。

### 6.3 金额符号显示规则

| transaction_type | 列表金额显示 | 概览卡归类 |
|------------------|-------------|-----------|
| income | `+ ¥100.00`（绿） | 计入收入 |
| initial_balance | `+ ¥100.00`（绿） | 计入收入 |
| expense | `- ¥100.00`（红） | 计入支出 |
| transfer | `¥100.00`（灰，无符号） | 不计入结余，单独展示总额 |

---

## 7. Category Store + 自动 Seed / Category Store + Auto Seed

### 7.1 useCategoryStore

```typescript
interface CategoryStore {
  categories: Category[];
  loading: boolean;
  error: string | null;
  fetchCategories: (userId: string) => Promise<void>;
  clear: () => void;
}
```

与 useAccountStore 模式一致，唯独 fetchCategories 内部多一层"空数据自动 seed 兜底"逻辑。

### 7.2 自动 Seed 逻辑

```typescript
// 模块级 Promise 缓存，防并发
let seedInProgress: Promise<void> | null = null;

// fetchCategories 内部
const list = await dataAccess.getCategories(userId);
if (list.length === 0) {
  if (!seedInProgress) {
    seedInProgress = dataAccess.seedCategories(userId)
      .finally(() => { seedInProgress = null; });
  }
  await seedInProgress;
  const reList = await dataAccess.getCategories(userId);
  set({ categories: reList, loading: false });
  return;
}
set({ categories: list, loading: false });
```

**触发条件：** `length === 0` 就 seed（覆盖新用户 + 用户删光后恢复）。

**并发安全：** 模块级 `seedInProgress` Promise 缓存，TransactionsPage + TransactionFormModal 同时 mount 时只触发一次 seed。

**失败处理：** seedCategories 失败时 try/catch 写入 error，categories 保持空数组，UI 显示空下拉。

---

## 8. 错误处理 / Error Handling

沿用 M3 AccountsPage 模式，无新设计：

| 场景 | 处理方式 |
|------|---------|
| fetchTransactions/Accounts/Categories 失败 | store 写入 `error`，TransactionsPage useEffect 监听 → `showError(error)` |
| create/edit/delete 失败 | store 写入 `error`，页面通过 `useTransactionStore.getState().error` 判定失败，不关闭弹窗 |
| create/edit/delete 成功 | 关闭弹窗 + `showSuccess` toast |
| 表单校验失败 | 不提交，Inline error 显示（Input/Select 的 `error` prop） |
| seedCategories 失败 | fetchCategories 内部 try/catch，写入 `error`，不重试 |

**关键约束：** store 方法内部捕获错误不抛出（与 account-store 一致），页面用 `getState().error` 判定成功/失败。

---

## 9. 边界情况 / Edge Cases

### 9.1 Category store 自动 seed
- 空 categories 触发 seed
- 并发安全（`seedInProgress` Promise 缓存）
- seed 失败不阻塞——try/catch 后 set error，categories 保持空数组

### 9.2 筛选逻辑
- Transfer 账户筛选：匹配 `account_id` 或 `to_account_id`
- 日期筛选：`dateTo` 含当天（`< nextDayTimestamp`）
- 筛选结果为空：列表显示"无匹配交易"空状态，概览卡隐藏
- 重置筛选：4 个字段全部回到 `''`，立即触发 useMemo 重算

### 9.3 表单联动
- Type 从 transfer 切回非 transfer：`to_account_id` 提交时强制 null（不清空 UI 值，避免来回切换丢数据）
- Type 切到 transfer：`to_account_id` 显示，校验 ≠ `account_id`
- 编辑 transfer 交易：`to_account_id` 预填
- 编辑非 transfer 交易：`to_account_id` 隐藏，提交时强制 null

### 9.4 金额处理
- 复用 `yuanToCents`（已修复负数对称 bug，M3 验证通过）
- amount 必填且 > 0（service 层 CHECK 约束兜底，UI 层先校验给出友好提示）
- 概览卡 `computeOverview`：transfer 不计入 income/expense/balance，单独累加 transfer 总额

### 9.5 账户联动
- create/edit/delete 内部已调用 `useAccountStore.getState().fetchAccounts(userId)` 刷新余额（transaction-store 已实现）
- M4 不需要手动刷新账户——交易变更后账户余额自动更新

### 9.6 空数据状态
- 无用户：不渲染页面（路由守卫已有）
- 无账户：列表显示空状态，"新增交易"按钮可点但表单 account 下拉为空 → 提示"请先创建账户"
- 无分类：category-store 自动 seed 兜底，正常情况不会出现
- 无交易：列表显示空状态，概览卡不渲染

---

## 10. 测试策略 / Testing Strategy

### 10.1 测试基础设施（新增到 desktop 包）

**新增 devDependencies：**
- `vitest` ^2.0.0（与 shared 包版本对齐）
- `jsdom`（DOM 环境）
- `@testing-library/react` ^16.0.0（React 19 兼容）
- `@testing-library/user-event` ^14.0.0（模拟交互）
- `@testing-library/jest-dom` ^6.0.0（DOM 断言扩展）

**新增配置文件：**
- `apps/desktop/vitest.config.ts` — jsdom 环境、setup 文件、alias 解析 `@shared` 和 `@renderer`
- `apps/desktop/vitest.setup.ts` — 导入 jest-dom、定义 `window.dataAccess` 全局 mock 工厂
- `apps/desktop/package.json` — 加 `"test": "vitest run"` 和 `"test:watch": "vitest"` 脚本
- 根 `package.json` — 加 `"test:desktop": "pnpm --filter @fire-app/desktop test"` + `"test:all": "pnpm test:shared && pnpm test:desktop"`

### 10.2 Mock 策略

**核心原则：** 不测真实 IPC，mock `dataAccess` 模块。store 和组件都通过 `dataAccess` 访问数据，mock 这一层即可隔离。

```typescript
// vitest.setup.ts
global.window = Object.assign(global.window, {
  dataAccess: {
    user: { create: vi.fn(), get: vi.fn(), getFirst: vi.fn(), update: vi.fn() },
    account: { create: vi.fn(), get: vi.fn(), list: vi.fn(), /* ... */ },
    category: { create: vi.fn(), get: vi.fn(), list: vi.fn(), seed: vi.fn() },
    tx: { get: vi.fn(), getById: vi.fn(), listByUser: vi.fn(), create: vi.fn(), edit: vi.fn(), delete: vi.fn() },
    // 其他 namespace 按需
  },
});
```

每个测试文件用 `vi.mock('../data/data-access.js', ...)` 或在 setup 中全局 mock + 测试内 `vi.mocked(...).mockResolvedValue(...)` 配置返回值。

### 10.3 测试范围

| 文件 | 测试目标 | 预估 case 数 |
|------|---------|-------------|
| `transaction-constants.test.ts` | computeOverview（4 种 type 归类、transfer 不计入结余）、formatAmount、TRANSACTION_TYPE_OPTIONS 生成、filterTransactions（type/account/date/category/transfer 双向匹配/空筛选）、sortTransactions | 14-18 |
| `category-store.test.ts` | fetchCategories 空数组触发 seed、并发安全（双调用单次 seed）、seed 失败 error 处理、非空不 seed | 4-5 |
| `TransactionOverviewCards.test.tsx` | 3 张卡渲染、空数据隐藏、负数结余红色 | 3 |
| `TransactionFilters.test.tsx` | 4 个筛选项交互、重置按钮回调 | 3-4 |
| `TransactionListTable.test.tsx` | 列渲染、排序切换、空状态两种文案、编辑/删除回调、transfer 显示 source→target | 5-6 |
| `TransactionFormModal.test.tsx` | create 空表单、edit 预填、transfer 联动显示/隐藏 to_account、校验（amount/transfer target）、提交构造 | 6-8 |
| `TransactionsPage.test.tsx` | 集成：mount 触发 3 个 fetch、筛选→概览→列表联动、新增/编辑/删除流程 | 4-5 |

**预估总 case 数：** 39-49 个

### 10.4 测试不覆盖（YAGNI）

- 不测 base 组件（Modal/Input/Select/Table）——它们是 M3 已验证的稳定组件
- 不测 Tailwind 样式——视觉靠手动验证
- 不测 IPC 真实往返——已由 shared 层 integration test 覆盖
- 不测 toast 通知——副作用，手动验证足够

### 10.5 关键设计：pure function 抽出

为了让筛选和排序逻辑可测，将 `filterTransactions` 和 `sortTransactions` 从 useMemo 中抽出，作为 `transaction-constants.ts` 的导出 pure function。

---

## 11. 验收标准 / Acceptance Criteria

### 11.1 自动化验证（必须全绿）

- `pnpm test:shared` — 已有 107 case 通过（无回归）
- `pnpm test:desktop` — 新增 ~40 case 通过
- `pnpm --filter @fire-app/desktop build` — tsc 类型检查通过

### 11.2 手动验证（5 项）

| # | 验证项 | 目的 |
|---|--------|------|
| H-1 | 启动 app，交易页正常加载 | 真实 sqlite + IPC 集成，确认 mock 未掩盖问题 |
| H-2 | 真实新增 1 笔 income + 1 笔 transfer | 数据库真实写入 + 余额真实联动 |
| H-3 | 真实编辑 + 删除各 1 笔 | 软删除 + 余额回滚真实生效 |
| H-4 | 视觉检查：概览卡颜色/布局、筛选区、列表、表单弹窗 | 自动化测试不覆盖视觉 |
| H-5 | 真实筛选 + 排序交互 | UI 响应真实流畅 |

### 11.3 自动化测试覆盖映射

| 手动验证项 | 自动化测试文件 |
|-----------|--------------|
| 首次加载 + seed | TransactionsPage.test + category-store.test |
| 新增 income/expense/transfer/initial_balance 联动 | TransactionsPage.test + TransactionFormModal.test |
| 编辑改类型 | TransactionsPage.test |
| 删除 + toast | TransactionsPage.test |
| 4 筛选组合 | filterTransactions.test + TransactionFilters.test |
| 筛选账户 transfer | filterTransactions.test |
| 重置筛选 | TransactionFilters.test |
| 排序切换 | sortTransactions.test |
| 空状态 | TransactionListTable.test |
| 筛选无结果 | TransactionListTable.test |
| 表单校验 | TransactionFormModal.test |

---

## 12. 已知风险 / Known Risks

| 风险 | 影响 | 缓解 |
|------|------|------|
| renderer 测试基础设施从零搭建 | 首次配置可能遇到 vitest + electron-vite alias 冲突 | 实施计划中独立 Task 处理配置，先跑通 hello world 测试再写业务测试 |
| @testing-library/react 16 与 React 19 兼容性 | 可能遇到类型或行为问题 | 实施时验证版本兼容性，必要时调整版本 |
| window.dataAccess mock 复杂度 | 多 namespace mock 可能遗漏方法 | setup 文件提供完整 mock 工厂，测试内按需配置返回值 |
| 筛选逻辑 Transfer 双向匹配可能遗漏 | 用户筛选某账户看不到转出交易 | pure function 测试专门覆盖 transfer 双向匹配 case |

---

## 附录 A：M3 accounts 4 件套对照 / M3 Pattern Reference

M4 复刻 M3 accounts 模式，对照如下：

| M3 accounts | M4 transactions | 差异 |
|-------------|----------------|------|
| `account-constants.ts` | `transaction-constants.ts` | M4 多 filterTransactions + sortTransactions pure function |
| `AccountOverviewCards.tsx` | `TransactionOverviewCards.tsx` | 3 张卡 vs M3 的 4+1 张 |
| `AccountListTable.tsx` | `TransactionListTable.tsx` | M4 多 6 列含 transfer source→target 显示 |
| `AccountFormModal.tsx` | `TransactionFormModal.tsx` | M4 多 type 联动 + transfer to_account_id |
| —（M3 无独立筛选组件） | `TransactionFilters.tsx` | M4 新增（4 维度筛选需独立组件） |
| `AccountsPage.tsx` | `TransactionsPage.tsx` | M4 多 filters 状态 + 派生 useMemo |

---

## 附录 B：设计决策过程 / Design Decision Process

### B.1 澄清问题（5 项，已全部确认）

1. **筛选方式** → 前端内存筛选
2. **Category 组织** → 新建 store + 自动 seed 兜底
3. **Type 选择器** → 4 种类型都可选
4. **Transfer 联动** → to_account_id 必填，category 保留可选
5. **概览卡设计** → 3 张卡跟随筛选

### B.2 架构方案对比

- 方案 A（选定）：复刻 M3 4 件套 + 页面本地 useState 筛选
- 方案 B（未选）：筛选状态入 store（YAGNI）
- 方案 C（未选）：抽出 useTransactionFilters hook（过度抽象）

### B.3 测试策略选择

- 完整 renderer 测试（选定）：vitest + jsdom + RTL，~40 case
- 仅 pure function 测试（未选）：覆盖不足
- 沿用 M3 无 renderer 测试（未选）：用户明确要求完整测试
