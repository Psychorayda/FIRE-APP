# FIRE 计算APP 桌面 MVP — 里程碑 2：核心基础设施设计

> **版本**: 1.0
> **日期**: 2026-07-15
> **状态**: 待审核
> **前置文档**:
> - [前端架构设计 v1.0](./2026-07-15-fire-app-frontend-architecture-design.md)
> - [应用初始化设计 v1.0](./2026-07-15-fire-app-initialization-design.md)
> - [UI/UX 设计 v1.0](./2026-07-15-fire-app-ui-ux-design.md)
> - [里程碑 1 计划 v1.0](../plans/2026-07-15-fire-app-desktop-mvp-milestone1.md)

---

## 1. 设计概述

### 1.1 目标

里程碑 1 已完成 Electron + React 架构骨架的端到端验证（主进程持有 better-sqlite3 → IPC 桥 → React 渲染进程读取用户），证明数据通路打通。里程碑 2 在此基础上构建**核心基础设施**，为后续里程碑 3-7 的功能页面开发提供完整的数据、状态、路由、组件和引导能力，达成以下目标：

1. **数据层全量接入**：将前端架构文档定义的 36 个 IPC 通道全部实现，覆盖 7 张表的完整 CRUD；引入 `DataAccessPort` 接口和 `IpcDataAccess` 实现，让渲染进程面向接口编程。
2. **状态层结构化**：用 5 个职责清晰的 Zustand Store 替换临时的 `user-store`，分别承载应用、账户、交易、快照、场景状态，并提供跨 Store 刷新机制。
3. **路由层正式建立**：用 `createHashRouter` 替换直接渲染 `TestPage` 的根组件，建立 6 条路由 + `RequireInit` 守卫，区分首次启动与后续启动。
4. **组件库基线**：交付 14 个基础组件（3 布局 + 9 基础 + 2 辅助），对齐 UI/UX 设计文档的视觉规范，作为里程碑 3+ 页面开发的拼装基础。
5. **首次启动闭环**：实现 5 步 Onboarding 向导，完成用户档案创建 + 18 个种子分类初始化，让新用户首次启动即可进入主界面。

### 1.2 范围边界

**包含**：
- 36 个 IPC 通道实现（31 个新增 + 5 个已有）
- `DataAccessPort` 接口 + `IpcDataAccess` 实现 + `data-access.ts` 单例导出
- `preload/index.ts` 扩展为 36 个方法的分组 API
- `types/ipc.d.ts` 类型声明同步扩展
- `packages/shared` 新增 `getTransactionsByUser` 函数
- 5 个 Zustand Store：`app-store`、`account-store`、`transaction-store`、`snapshot-store`、`scenario-store`
- 删除临时的 `user-store.ts`
- `createHashRouter` + 6 条路由 + `RequireInit` 路由守卫
- `App.tsx` 重构为 `RouterProvider`
- 4 个占位页面：`AccountsPage`、`TransactionsPage`、`NetWorthPage`、`FireCalculatorPage`（仅显示标题）
- `DashboardPage` 简单占位页（显示欢迎信息和用户名）
- 14 个组件文件：3 布局组件（`AppLayout`、`Sidebar`、`PageHeader`）+ 9 基础组件（`Button`、`Input`、`Select`、`Table`、`Card`、`Modal`、`ConfirmDialog`、`Tag`、`ChartContainer`）+ 2 辅助组件（`Toast`、`EmptyState`）
- `OnboardingPage` 完整实现（5 步向导 + 表单校验 + 市场默认值 + 创建用户 + 种子分类）
- 删除 `TestPage.tsx`

**不包含**（明确排除，留待后续里程碑）：
- 账户管理页的列表/新增/编辑/删除业务实现（里程碑 3）
- 交易记录页的列表/筛选/弹窗业务实现（里程碑 4）
- 净资产趋势页的折线图/环形图实现（里程碑 5）
- FIRE 计算器页的场景表单/投影图表实现（里程碑 6）
- 设置页（里程碑 7）
- 经常性交易管理 UI（里程碑 4 之后）
- 概览卡片组件（资产总览、负债总览、净资产等聚合卡片）
- 表单级业务组件（AccountForm、TransactionForm 等）
- 图表业务组件（NetWorthTrendChart、AssetAllocationChart 等，仅交付 `ChartContainer` 容器）
- 数据导出/导入 UI（阶段 2）
- 同步层 UI（阶段 2）
- 安全/加密 UI（阶段 2）

### 1.3 设计原则

| 原则 | 说明 |
|------|------|
| **接口先行** | `DataAccessPort` 接口必须先于 `IpcDataAccess` 实现和 Store 编写，所有 Store 依赖接口而非具体实现 |
| **零改动复用 models** | `packages/shared/src/models/` 下现有函数签名保持不变，仅在主进程增加 IPC handler 包装层 |
| **职责单一** | 每个 Store 只管理一个实体的状态，不跨实体操作；跨实体刷新通过 `useXxxStore.getState().refresh()` 显式调用 |
| **占位优先** | 未到里程碑的功能页面仅渲染标题，不实现业务逻辑，避免过早设计 |
| **组件可独立测试** | 14 个组件均为纯展示组件（除 Toast 需配合 Store），Props 驱动，无业务耦合 |
| **Onboarding 闭环** | 向导必须完成"创建用户 + 种子分类 + 跳转主页"的完整链路，不允许中间断开 |
| **类型端到端** | IPC 通道参数/返回值、Store state/actions、组件 Props 均有 TypeScript 类型约束 |

### 1.4 与里程碑 1 的关系

里程碑 1 交付物作为里程碑 2 的起点：

| 里程碑 1 交付物 | 里程碑 2 处理方式 |
|---------------|-----------------|
| `main/ipc-handlers.ts`（5 个 handler） | 扩展为 36 个 handler，按实体拆分为多个文件 |
| `preload/index.ts`（5 个方法） | 扩展为 36 个方法的分组 API |
| `types/ipc.d.ts`（5 个方法声明） | 同步扩展为 36 个方法声明 |
| `stores/user-store.ts`（临时） | 删除，职责拆分到 5 个新 Store |
| `App.tsx`（直接渲染 TestPage） | 重构为 `RouterProvider` |
| `pages/TestPage.tsx`（验证页） | 删除 |
| `models/*`（已有 7 个文件） | 新增 `getTransactionsByUser` 到 `transaction.ts`，其余零改动 |
| `main/db-manager.ts`、`main/index.ts` | 保留不变 |

---

## 2. 任务分解总览

里程碑 2 按依赖关系分解为 5 个 Task，串行执行（部分内部步骤可并行）：

```
Task 1: 数据层（IPC + DataAccessPort）
   │
   ▼ 依赖
Task 2: 状态层（5 个 Zustand Store）
   │
   ▼ 依赖
Task 3: 路由层（createHashRouter + 守卫）
   │
   ▼ 依赖
Task 4: UI 组件（14 个组件文件）
   │
   ▼ 依赖
Task 5: 功能页面（Onboarding + Dashboard 占位）
```

**依赖理由**：
- Task 2 的 Store 调用 Task 1 的 `DataAccessPort`，必须先有接口
- Task 3 的路由守卫读取 Task 2 的 `app-store` 初始化状态
- Task 5 的 Onboarding 页面使用 Task 4 的 `Button`、`Input`、`Select` 组件
- Task 3 和 Task 4 之间无强依赖，但因 Task 5 依赖两者，统一串行以便验证

---

## 3. Task 1：数据层（IPC 通道 + DataAccessPort）

### 3.1 目标

将前端架构文档 4.3 节定义的 36 个 IPC 通道全部实现，建立 `DataAccessPort` 接口和 `IpcDataAccess` 实现，让渲染进程通过接口而非直接 IPC 调用数据。

### 3.2 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `packages/shared/src/models/transaction.ts` | 修改 | 新增 `getTransactionsByUser(db, userId)` 函数 |
| `apps/desktop/src/main/ipc-handlers.ts` | 修改 | 扩展为 36 个 handler，按实体分组 |
| `apps/desktop/src/main/ipc/register-handlers.ts` | 新增 | 统一错误处理包装器 + `IpcError` 类型 |
| `apps/desktop/src/preload/index.ts` | 修改 | 扩展为 36 个方法的分组 API |
| `apps/desktop/src/renderer/src/data/data-access-port.ts` | 新增 | `DataAccessPort` 接口定义 + Input 类型 |
| `apps/desktop/src/renderer/src/data/ipc-data-access.ts` | 新增 | `IpcDataAccess` 实现（调用 `window.dataAccess`） |
| `apps/desktop/src/renderer/src/data/data-access.ts` | 新增 | 导出 `dataAccess` 单例（`new IpcDataAccess()`） |
| `apps/desktop/src/renderer/src/types/ipc.d.ts` | 修改 | 同步扩展为 36 个方法声明 |

### 3.3 `getTransactionsByUser` 函数

在 `packages/shared/src/models/transaction.ts` 末尾新增：

```typescript
/**
 * 获取用户的所有交易列表（排除已删除，按日期倒序）
 * Get all transactions for a user (excludes deleted, sorted by date desc)
 * @param db 数据库实例 / Database instance
 * @param userId 用户 ID / User ID
 * @returns 交易列表 / Transaction list
 */
export function getTransactionsByUser(db: DatabaseType, userId: string): Transaction[] {
  return db.prepare(
    'SELECT * FROM transactions WHERE user_id = ? AND deleted_flag = 0 ORDER BY transaction_date DESC, updated_at DESC'
  ).all(userId) as Transaction[];
}
```

**理由**：现有 `transaction.ts` 仅有 `getTransaction`（按 ID）和 `getTransactionById`（含已删除），缺少按用户列出交易的方法。UI 交易列表页需要此方法。索引 `idx_tx_user_date` 已在 schema 中定义，查询性能有保障。

### 3.4 `DataAccessPort` 接口

完整接口定义见前端架构文档 4.2 节，本里程碑按其原样实现，包含 36 个方法，按实体分组：

- **数据库管理**（2）：`initDatabase`、`closeDatabase`
- **User**（4）：`createUser`、`getUser`、`updateUser`、`getFirstUser`
- **Account**（8）：`createAccount`、`getAccount`、`getAccounts`、`updateAccountBalance`、`getInvestableBalance`、`getNetWorth`、`hasTransactions`、`softDeleteAccount`
- **Category**（4）：`createCategory`、`getCategory`、`getCategories`、`seedCategories`
- **Transaction**（6）：`getTransaction`、`getTransactionById`、`getTransactionsByUser`、`createTransaction`、`editTransaction`、`deleteTransaction`
- **Recurring**（4）：`createRecurring`、`getActiveRecurring`、`updateRecurring`、`processRecurringTransactions`
- **Scenario**（4）：`createScenario`、`getScenario`、`getScenarios`、`updateScenario`
- **Snapshot**（3）：`getSnapshots`、`getSnapshotByMonth`、`generateMonthlySnapshot`
- **FireCalc**（1）：`runProjection`

> **注**：Input 类型（`CreateUserInput`、`CreateAccountInput` 等）从 `@shared/models/*` 直接导入，不重复定义。前端架构文档 4.2 节中重复定义的 Input 类型仅作为接口文档说明，实际代码从 models 文件导入，避免类型重复维护。

### 3.5 `IpcDataAccess` 实现

```typescript
// apps/desktop/src/renderer/src/data/ipc-data-access.ts
// IpcDataAccess: DataAccessPort 的 IPC 实现
// IpcDataAccess: IPC implementation of DataAccessPort

import type { DataAccessPort } from './data-access-port.js';
// Input 类型从 shared models 导入
import type { CreateUserInput, UpdateUserInput } from '@shared/models/user.js';
import type { CreateAccountInput } from '@shared/models/account.js';
import type { CreateCategoryInput } from '@shared/models/category.js';
import type { CreateRecurringInput } from '@shared/models/recurring.js';
import type { CreateScenarioInput } from '@shared/models/scenario.js';
// Transaction 的 Input 类型由 transaction-service 提供
import type { CreateTransactionInput, EditTransactionInput } from '@shared/services/transaction-service.js';
import type {
  User, Account, Category, Transaction, RecurringTransaction,
  NetWorthSnapshot, FireScenario, CategoryType,
} from '@shared/types/index.js';
import type { ProjectionResult } from '@shared/services/fire-calc.js';

/**
 * DataAccessPort 的 IPC 实现
 * IPC implementation of DataAccessPort
 * 所有方法通过 window.dataAccess 调用 preload 暴露的 IPC 通道
 */
export class IpcDataAccess implements DataAccessPort {
  // ===== 数据库管理 =====
  initDatabase() { return window.dataAccess.initDatabase(); }
  closeDatabase() { return window.dataAccess.closeDatabase(); }

  // ===== User =====
  createUser(input: CreateUserInput) { return window.dataAccess.user.create(input); }
  getUser(id: string) { return window.dataAccess.user.get(id); }
  updateUser(id: string, input: UpdateUserInput) { return window.dataAccess.user.update(id, input); }
  getFirstUser() { return window.dataAccess.user.getFirst(); }

  // ===== Account =====
  createAccount(input: CreateAccountInput) { return window.dataAccess.account.create(input); }
  getAccount(id: string) { return window.dataAccess.account.get(id); }
  getAccounts(userId: string) { return window.dataAccess.account.list(userId); }
  updateAccountBalance(id: string, newBalance: number) { return window.dataAccess.account.updateBalance(id, newBalance); }
  getInvestableBalance(userId: string) { return window.dataAccess.account.investableBalance(userId); }
  getNetWorth(userId: string) { return window.dataAccess.account.netWorth(userId); }
  hasTransactions(accountId: string) { return window.dataAccess.account.hasTransactions(accountId); }
  softDeleteAccount(id: string) { return window.dataAccess.account.softDelete(id); }

  // ===== Category =====
  createCategory(input: CreateCategoryInput) { return window.dataAccess.category.create(input); }
  getCategory(id: string) { return window.dataAccess.category.get(id); }
  getCategories(userId: string, type?: CategoryType) { return window.dataAccess.category.list(userId, type); }
  seedCategories(userId: string) { return window.dataAccess.category.seed(userId); }

  // ===== Transaction =====
  getTransaction(id: string) { return window.dataAccess.tx.get(id); }
  getTransactionById(id: string) { return window.dataAccess.tx.getById(id); }
  getTransactionsByUser(userId: string) { return window.dataAccess.tx.listByUser(userId); }
  createTransaction(input: CreateTransactionInput) { return window.dataAccess.tx.create(input); }
  editTransaction(id: string, input: EditTransactionInput) { return window.dataAccess.tx.edit(id, input); }
  deleteTransaction(id: string) { return window.dataAccess.tx.delete(id); }

  // ===== Recurring =====
  createRecurring(input: CreateRecurringInput) { return window.dataAccess.recurring.create(input); }
  getActiveRecurring(userId: string) { return window.dataAccess.recurring.listActive(userId); }
  updateRecurring(id: string, updates: Partial<RecurringTransaction>) { return window.dataAccess.recurring.update(id, updates); }
  processRecurringTransactions(userId: string) { return window.dataAccess.recurring.process(userId); }

  // ===== Scenario =====
  createScenario(input: CreateScenarioInput) { return window.dataAccess.scenario.create(input); }
  getScenario(id: string) { return window.dataAccess.scenario.get(id); }
  getScenarios(userId: string) { return window.dataAccess.scenario.list(userId); }
  updateScenario(id: string, updates: Partial<FireScenario>) { return window.dataAccess.scenario.update(id, updates); }

  // ===== Snapshot =====
  getSnapshots(userId: string) { return window.dataAccess.snapshot.list(userId); }
  getSnapshotByMonth(userId: string, yearMonth: string) { return window.dataAccess.snapshot.getByMonth(userId, yearMonth); }
  generateMonthlySnapshot(userId: string) { return window.dataAccess.snapshot.generateMonthly(userId); }

  // ===== FireCalc =====
  runProjection(scenario: FireScenario) { return window.dataAccess.fireCalc.runProjection(scenario); }
}
```

```typescript
// apps/desktop/src/renderer/src/data/data-access.ts
// 导出当前使用的 DataAccessPort 实例（IPC 实现）
// Export the currently used DataAccessPort instance (IPC implementation)

import { IpcDataAccess } from './ipc-data-access.js';

export const dataAccess: IpcDataAccess = new IpcDataAccess();
```

### 3.6 IPC Handler 注册

主进程将 IPC handler 按实体拆分到独立文件，统一通过 `registerHandler` 包装器注册（含错误处理）。

**`register-handlers.ts`** 实现前端架构文档 4.5 节的错误处理包装器，所有 handler 通过它注册，同步异常被捕获并转为 `IpcError` 抛出，`ipcRenderer.invoke` 的 Promise 会 reject，渲染进程通过 try-catch 捕获。

**`ipc-handlers.ts`** 重构为按实体导入并聚合注册：

```typescript
// apps/desktop/src/main/ipc-handlers.ts
// IPC handler 注册总入口 / IPC handler registration entry

import { getDatabase } from './db-manager.js';
import { registerUserHandlers } from './ipc/user-handlers.js';
import { registerAccountHandlers } from './ipc/account-handlers.js';
import { registerCategoryHandlers } from './ipc/category-handlers.js';
import { registerTransactionHandlers } from './ipc/transaction-handlers.js';
import { registerRecurringHandlers } from './ipc/recurring-handlers.js';
import { registerScenarioHandlers } from './ipc/scenario-handlers.js';
import { registerSnapshotHandlers } from './ipc/snapshot-handlers.js';
import { registerFireCalcHandlers } from './ipc/fire-calc-handlers.js';
import { registerDbHandlers } from './ipc/db-handlers.js';

/**
 * 注册所有 IPC handler / Register all IPC handlers
 */
export function registerIpcHandlers(): void {
  const db = getDatabase();

  registerDbHandlers(db);
  registerUserHandlers(db);
  registerAccountHandlers(db);
  registerCategoryHandlers(db);
  registerTransactionHandlers(db);
  registerRecurringHandlers(db);
  registerScenarioHandlers(db);
  registerSnapshotHandlers(db);
  registerFireCalcHandlers(db);
}
```

每个实体 handler 文件结构一致，例如 `user-handlers.ts`：

```typescript
// apps/desktop/src/main/ipc/user-handlers.ts
import { registerHandler } from './register-handlers.js';
import { createUser, getUser, updateUser, getFirstUser } from '@shared/models/user.js';
import type { Database as DatabaseType } from 'better-sqlite3';
import type { CreateUserInput, UpdateUserInput } from '@shared/models/user.js';

export function registerUserHandlers(db: DatabaseType): void {
  registerHandler('db:user:create', (_db, input: CreateUserInput) => createUser(_db, input), db);
  registerHandler('db:user:get', (_db, id: string) => getUser(_db, id), db);
  registerHandler('db:user:update', (_db, id: string, input: UpdateUserInput) => updateUser(_db, id, input), db);
  registerHandler('db:user:getFirst', (_db) => getFirstUser(_db), db);
}
```

### 3.7 Preload 脚本扩展

`preload/index.ts` 扩展为 36 个方法的分组 API，结构与 `DataAccessPort` 一一对应：

```typescript
// apps/desktop/src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';

const dataAccess = {
  // 数据库管理 / Database
  initDatabase: () => ipcRenderer.invoke('db:init'),
  closeDatabase: () => ipcRenderer.invoke('db:close'),

  // 用户 / User
  user: {
    create: (input: unknown) => ipcRenderer.invoke('db:user:create', input),
    get: (id: string) => ipcRenderer.invoke('db:user:get', id),
    update: (id: string, input: unknown) => ipcRenderer.invoke('db:user:update', id, input),
    getFirst: () => ipcRenderer.invoke('db:user:getFirst'),
  },

  // 账户 / Account
  account: {
    create: (input: unknown) => ipcRenderer.invoke('db:account:create', input),
    get: (id: string) => ipcRenderer.invoke('db:account:get', id),
    list: (userId: string) => ipcRenderer.invoke('db:account:list', userId),
    updateBalance: (id: string, newBalance: number) => ipcRenderer.invoke('db:account:updateBalance', id, newBalance),
    investableBalance: (userId: string) => ipcRenderer.invoke('db:account:investableBalance', userId),
    netWorth: (userId: string) => ipcRenderer.invoke('db:account:netWorth', userId),
    hasTransactions: (accountId: string) => ipcRenderer.invoke('db:account:hasTransactions', accountId),
    softDelete: (id: string) => ipcRenderer.invoke('db:account:softDelete', id),
  },

  // 分类 / Category
  category: {
    create: (input: unknown) => ipcRenderer.invoke('db:category:create', input),
    get: (id: string) => ipcRenderer.invoke('db:category:get', id),
    list: (userId: string, type?: string) => ipcRenderer.invoke('db:category:list', userId, type),
    seed: (userId: string) => ipcRenderer.invoke('db:category:seed', userId),
  },

  // 交易 / Transaction
  tx: {
    get: (id: string) => ipcRenderer.invoke('db:tx:get', id),
    getById: (id: string) => ipcRenderer.invoke('db:tx:getById', id),
    listByUser: (userId: string) => ipcRenderer.invoke('db:tx:listByUser', userId),
    create: (input: unknown) => ipcRenderer.invoke('db:tx:create', input),
    edit: (id: string, input: unknown) => ipcRenderer.invoke('db:tx:edit', id, input),
    delete: (id: string) => ipcRenderer.invoke('db:tx:delete', id),
  },

  // 经常性交易 / Recurring
  recurring: {
    create: (input: unknown) => ipcRenderer.invoke('db:recurring:create', input),
    listActive: (userId: string) => ipcRenderer.invoke('db:recurring:listActive', userId),
    update: (id: string, updates: unknown) => ipcRenderer.invoke('db:recurring:update', id, updates),
    process: (userId: string) => ipcRenderer.invoke('db:recurring:process', userId),
  },

  // 场景 / Scenario
  scenario: {
    create: (input: unknown) => ipcRenderer.invoke('db:scenario:create', input),
    get: (id: string) => ipcRenderer.invoke('db:scenario:get', id),
    list: (userId: string) => ipcRenderer.invoke('db:scenario:list', userId),
    update: (id: string, updates: unknown) => ipcRenderer.invoke('db:scenario:update', id, updates),
  },

  // 快照 / Snapshot
  snapshot: {
    list: (userId: string) => ipcRenderer.invoke('db:snapshot:list', userId),
    getByMonth: (userId: string, yearMonth: string) => ipcRenderer.invoke('db:snapshot:getByMonth', userId, yearMonth),
    generateMonthly: (userId: string) => ipcRenderer.invoke('db:snapshot:generateMonthly', userId),
  },

  // FIRE 计算 / FireCalc
  fireCalc: {
    runProjection: (scenario: unknown) => ipcRenderer.invoke('db:fireCalc:runProjection', scenario),
  },
};

contextBridge.exposeInMainWorld('dataAccess', dataAccess);

export type DataAccess = typeof dataAccess;
```

### 3.8 `ipc.d.ts` 类型声明

同步扩展为 36 个方法的类型声明，结构与 preload 一致，参数和返回值类型从 `@shared/types` 和 `@shared/models` 导入。完整声明覆盖 `DataAccessAPI` 接口，包含所有 36 个方法的精确签名。

### 3.9 验收标准

- `pnpm typecheck` 全部通过（shared + desktop）
- `pnpm dev` 启动应用，主进程控制台输出"已注册 36 个 IPC handler"
- 渲染进程 DevTools 控制台执行 `window.dataAccess.user.getFirst()` 返回 `User | null`，无未捕获异常
- 渲染进程执行 `window.dataAccess.tx.listByUser('test')` 返回数组（空数组或交易列表）

---

## 4. Task 2：状态层（5 个 Zustand Store）

### 4.1 目标

用 5 个职责清晰的 Zustand Store 替换临时的 `user-store`，分别承载应用、账户、交易、快照、场景状态，提供跨 Store 刷新机制。

### 4.2 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `apps/desktop/src/renderer/src/stores/user-store.ts` | 删除 | 职责拆分到 5 个新 Store |
| `apps/desktop/src/renderer/src/stores/app-store.ts` | 新增 | 应用全局状态（当前用户、初始化状态、加载、错误） |
| `apps/desktop/src/renderer/src/stores/account-store.ts` | 新增 | 账户列表状态 |
| `apps/desktop/src/renderer/src/stores/transaction-store.ts` | 新增 | 交易列表状态 |
| `apps/desktop/src/renderer/src/stores/snapshot-store.ts` | 新增 | 净资产快照列表状态 |
| `apps/desktop/src/renderer/src/stores/scenario-store.ts` | 新增 | FIRE 场景列表状态 |
| `apps/desktop/src/renderer/src/stores/index.ts` | 新增 | 统一导出所有 Store |

### 4.3 Store 设计

#### 4.3.1 `app-store.ts`

承载应用全局状态：当前用户、初始化标志、全局加载/错误。Onboarding 完成后写入 `currentUser` 和 `initialized = true`，路由守卫读取 `initialized` 判断是否跳转 `/onboarding`。

```typescript
interface AppStore {
  // 状态
  currentUser: User | null;
  initialized: boolean;       // 是否已完成初始化（首次启动向导完成或后续启动读取到用户）
  loading: boolean;
  error: string | null;

  // 操作
  initialize: () => Promise<void>;     // 启动时调用：读取第一个用户，有则 initialized=true
  completeOnboarding: (user: User) => void;  // 向导完成时调用
  setCurrentUser: (user: User | null) => void;
  clearError: () => void;
}
```

**`initialize()` 逻辑**：
1. 调用 `dataAccess.getFirstUser()`
2. 若返回 User：`set({ currentUser: user, initialized: true, loading: false })`
3. 若返回 null：`set({ initialized: false, loading: false })`（等待用户走 Onboarding）

#### 4.3.2 `account-store.ts`

```typescript
interface AccountStore {
  accounts: Account[];
  loading: boolean;
  error: string | null;

  fetchAccounts: (userId: string) => Promise<void>;
  createAccount: (input: CreateAccountInput) => Promise<void>;
  softDeleteAccount: (id: string, userId: string) => Promise<void>;
  clear: () => void;
}
```

每个写操作（create/delete）完成后自动调用 `fetchAccounts(userId)` 刷新列表。

#### 4.3.3 `transaction-store.ts`

```typescript
interface TransactionStore {
  transactions: Transaction[];
  loading: boolean;
  error: string | null;

  fetchTransactions: (userId: string) => Promise<void>;
  createTransaction: (input: CreateTransactionInput, userId: string) => Promise<void>;
  editTransaction: (id: string, input: EditTransactionInput, userId: string) => Promise<void>;
  deleteTransaction: (id: string, userId: string) => Promise<void>;
  clear: () => void;
}
```

写操作完成后自动调用 `fetchTransactions(userId)` 刷新。交易写入会影响账户余额，因此写操作后还需调用 `useAccountStore.getState().fetchAccounts(userId)` 刷新账户列表（跨 Store 刷新）。

#### 4.3.4 `snapshot-store.ts`

```typescript
interface SnapshotStore {
  snapshots: NetWorthSnapshot[];
  loading: boolean;
  error: string | null;

  fetchSnapshots: (userId: string) => Promise<void>;
  generateMonthly: (userId: string) => Promise<NetWorthSnapshot | null>;
  clear: () => void;
}
```

#### 4.3.5 `scenario-store.ts`

```typescript
interface ScenarioStore {
  scenarios: FireScenario[];
  loading: boolean;
  error: string | null;

  fetchScenarios: (userId: string) => Promise<void>;
  createScenario: (input: CreateScenarioInput, userId: string) => Promise<void>;
  updateScenario: (id: string, updates: Partial<FireScenario>, userId: string) => Promise<void>;
  clear: () => void;
}
```

### 4.4 跨 Store 刷新机制

Store 之间不直接依赖，通过 `useXxxStore.getState()` 在 action 内显式调用其他 Store 的刷新方法：

| 触发 Store | 触发操作 | 联动 Store | 联动方法 |
|-----------|---------|-----------|---------|
| `transaction-store` | `createTransaction` / `editTransaction` / `deleteTransaction` | `account-store` | `fetchAccounts(userId)` |
| `app-store` | `completeOnboarding` | 无 | Onboarding 完成后由 OnboardingPage 自行触发首页数据加载 |

**禁止循环依赖**：Store A 调用 Store B 的刷新，Store B 的刷新不能再回调 Store A。所有刷新方法均为终端操作（只读数据，不再触发其他 Store）。

### 4.5 错误处理约定

所有 Store 的 async action 统一采用以下模式：

```typescript
fetchAccounts: async (userId: string) => {
  set({ loading: true, error: null });
  try {
    const accounts = await dataAccess.getAccounts(userId);
    set({ accounts, loading: false });
  } catch (err) {
    set({ error: (err as Error).message, loading: false });
  }
},
```

错误信息存入 `error` 字段，UI 层通过 `useAccountStore(s => s.error)` 读取并展示 Toast。Store 不直接调用 Toast 组件，保持 Store 与 UI 解耦。

### 4.6 验收标准

- 删除 `user-store.ts` 后，`App.tsx` 和所有引用更新为新 Store，`pnpm typecheck` 通过
- `pnpm dev` 启动应用，DevTools 中执行 `useAppStore.getState().initialize()` 后，`useAppStore.getState().initialized` 反映正确状态
- Store 文件不直接 import 任何 React 组件，只依赖 `data-access` 和 `@shared/*` 类型

---

## 5. Task 3：路由层（createHashRouter + 守卫）

### 5.1 目标

用 `createHashRouter` 替换直接渲染 `TestPage` 的根组件，建立 6 条路由 + `RequireInit` 守卫，区分首次启动（跳转 `/onboarding`）与后续启动（跳转 `/`）。

### 5.2 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `apps/desktop/src/renderer/src/router/index.tsx` | 新增 | 路由配置 + `RequireInit` 守卫 |
| `apps/desktop/src/renderer/src/router/RequireInit.tsx` | 新增 | 初始化守卫组件 |
| `apps/desktop/src/renderer/src/App.tsx` | 修改 | 重构为 `RouterProvider` |
| `apps/desktop/src/renderer/src/pages/AccountsPage.tsx` | 新增 | 占位页（仅标题） |
| `apps/desktop/src/renderer/src/pages/TransactionsPage.tsx` | 新增 | 占位页（仅标题） |
| `apps/desktop/src/renderer/src/pages/NetWorthPage.tsx` | 新增 | 占位页（仅标题） |
| `apps/desktop/src/renderer/src/pages/FireCalculatorPage.tsx` | 新增 | 占位页（仅标题） |
| `apps/desktop/src/renderer/src/pages/DashboardPage.tsx` | 新增 | 简单占位页（欢迎信息 + 用户名） |

### 5.3 路由表

| 路径 | 组件 | 说明 | 守卫 |
|------|------|------|------|
| `/onboarding` | `OnboardingPage` | 首次启动向导 | 无（未初始化时唯一可访问） |
| `/` | `DashboardPage` | 仪表盘占位 | `RequireInit` |
| `/accounts` | `AccountsPage` | 账户管理（占位） | `RequireInit` |
| `/transactions` | `TransactionsPage` | 交易记录（占位） | `RequireInit` |
| `/net-worth` | `NetWorthPage` | 净资产趋势（占位） | `RequireInit` |
| `/fire-calculator` | `FireCalculatorPage` | FIRE 计算器（占位） | `RequireInit` |

### 5.4 `RequireInit` 守卫

```typescript
// apps/desktop/src/renderer/src/router/RequireInit.tsx
// 路由守卫：未初始化时重定向到 /onboarding
// Route guard: redirect to /onboarding if not initialized

import { Navigate, Outlet } from 'react-router-dom';
import { useAppStore } from '../stores/app-store';

export function RequireInit() {
  const initialized = useAppStore((s) => s.initialized);

  if (!initialized) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}
```

### 5.5 路由配置

```typescript
// apps/desktop/src/renderer/src/router/index.tsx
// 应用路由配置 / App router configuration

import { createHashRouter, Navigate } from 'react-router-dom';
import { RequireInit } from './RequireInit';
import { AppLayout } from '../components/layout/AppLayout';
import { OnboardingPage } from '../pages/OnboardingPage';
import { DashboardPage } from '../pages/DashboardPage';
import { AccountsPage } from '../pages/AccountsPage';
import { TransactionsPage } from '../pages/TransactionsPage';
import { NetWorthPage } from '../pages/NetWorthPage';
import { FireCalculatorPage } from '../pages/FireCalculatorPage';

export const router = createHashRouter([
  {
    path: '/onboarding',
    element: <OnboardingPage />,
  },
  {
    element: <RequireInit />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <DashboardPage /> },
          { path: '/accounts', element: <AccountsPage /> },
          { path: '/transactions', element: <TransactionsPage /> },
          { path: '/net-worth', element: <NetWorthPage /> },
          { path: '/fire-calculator', element: <FireCalculatorPage /> },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
```

**选择 `createHashRouter` 的理由**：Electron 通过 `file://` 协议加载渲染进程，BrowserHistory 会导致刷新时 404。HashRouter 使用 URL hash（`#/path`），不依赖服务器路由，适配 Electron 单文件加载场景。

### 5.6 `App.tsx` 重构

```typescript
// apps/desktop/src/renderer/src/App.tsx
// 应用根组件：挂载 RouterProvider + 启动时初始化 app-store

import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { useAppStore } from './stores/app-store';

export default function App() {
  const initialize = useAppStore((s) => s.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return <RouterProvider router={router} />;
}
```

### 5.7 占位页面模板

`AccountsPage`、`TransactionsPage`、`NetWorthPage`、`FireCalculatorPage` 结构一致：

```typescript
// 以 AccountsPage 为例
import { PageHeader } from '../components/layout/PageHeader';

export function AccountsPage() {
  return (
    <div>
      <PageHeader title="账户管理" subtitle="即将在里程碑 3 实现" />
    </div>
  );
}
```

`DashboardPage` 稍丰富，显示欢迎信息和当前用户名：

```typescript
import { PageHeader } from '../components/layout/PageHeader';
import { useAppStore } from '../stores/app-store';
import { Card } from '../components/base/Card';

export function DashboardPage() {
  const currentUser = useAppStore((s) => s.currentUser);

  return (
    <div>
      <PageHeader title="仪表盘" subtitle="FIRE 计算APP" />
      <Card>
        <p className="text-body text-gray-700">
          欢迎回来，{currentUser?.display_name ?? '用户'}！
        </p>
        <p className="text-caption text-gray-500 mt-2">
          各功能模块将在后续里程碑逐步开放。
        </p>
      </Card>
    </div>
  );
}
```

### 5.8 验收标准

- `pnpm dev` 启动应用：
  - 首次启动（无用户记录）：自动跳转 `#/onboarding`
  - 后续启动（有用户记录）：自动跳转 `#/`
- 点击侧边栏导航项，URL hash 切换正确，页面内容更新
- 直接在地址栏输入 `#/accounts` 等，能正确路由到对应页面

---

## 6. Task 4：UI 组件（14 个组件文件）

### 6.1 目标

交付 14 个组件（3 布局 + 9 基础 + 2 辅助），对齐 UI/UX 设计文档的视觉规范，作为里程碑 3+ 页面开发的拼装基础。组件均为纯展示组件（除 Toast 配合 Store），Props 驱动，无业务耦合。

### 6.2 文件变更清单

| 类别 | 文件 | 说明 |
|------|------|------|
| 布局 | `components/layout/AppLayout.tsx` | 应用主布局（Sidebar + 内容区 Outlet） |
| 布局 | `components/layout/Sidebar.tsx` | 侧边栏导航（5 个导航项 + 高亮当前） |
| 布局 | `components/layout/PageHeader.tsx` | 页面头部（标题 + 副标题 + 操作区） |
| 基础 | `components/base/Button.tsx` | 按钮（primary/secondary/danger × sm/md/lg） |
| 基础 | `components/base/Input.tsx` | 输入框（text/number/date + 标签 + 错误） |
| 基础 | `components/base/Select.tsx` | 下拉选择（options + 标签 + 错误） |
| 基础 | `components/base/Table.tsx` | 表格（columns + data + 泛型） |
| 基础 | `components/base/Card.tsx` | 卡片容器（标题 + 内容 + 操作区） |
| 基础 | `components/base/Modal.tsx` | 模态弹窗（open + title + children + onClose） |
| 基础 | `components/base/ConfirmDialog.tsx` | 确认对话框（基于 Modal，title + message + onConfirm + onCancel） |
| 基础 | `components/base/Tag.tsx` | 标签（颜色 + 文本） |
| 基础 | `components/base/ChartContainer.tsx` | 图表容器（loading + empty + error + children） |
| 辅助 | `components/auxiliary/Toast.tsx` | Toast 通知（配合 toast-store，success/error/warning/info） |
| 辅助 | `components/auxiliary/EmptyState.tsx` | 空状态占位（icon + title + description + action） |
| Store | `stores/toast-store.ts` | Toast 配套状态（toasts 数组 + show/remove/clear，见 6.6 节） |

### 6.3 组件 Props 规范

各组件 Props 接口对齐 UI/UX 设计文档 6.1 节，本里程碑按其原样实现。以下列出关键 Props 摘要，完整定义参考 UI/UX 设计文档。

**Button**：`variant: 'primary' | 'secondary' | 'danger'`、`size: 'sm' | 'md' | 'lg'`、`loading?`、`disabled?`、`icon?`、`onClick?`、`children`

**Input**：`type: 'text' | 'number' | 'date'`、`label?`、`value`、`error?`、`placeholder?`、`required?`、`disabled?`、`prefix?`、`suffix?`、`onChange?: (value: string) => void`

**Select**：`options: SelectOption[]`（`{ label, value }`）、`value`、`label?`、`error?`、`required?`、`disabled?`、`placeholder?`、`onChange?: (value: string) => void`

**Table**：`columns: TableColumn<T>[]`（`{ key, title, render?, width?, align? }`）、`data: T[]`、`loading?`、`emptyText?`、`onRowClick?`

**Card**：`title?`、`extra?`（操作区，ReactNode）、`children`、`padding?`

**Modal**：`open: boolean`、`title?`、`children`、`footer?`、`onClose: () => void`、`width?`

**ConfirmDialog**：`open: boolean`、`title: string`、`message: string`、`confirmText?`（默认"确认"）、`cancelText?`（默认"取消"）、`variant?: 'primary' | 'danger'`、`onConfirm: () => void`、`onCancel: () => void`

**Tag**：`color: 'blue' | 'green' | 'red' | 'amber' | 'gray'`、`children`

**ChartContainer**：`loading?: boolean`、`empty?: boolean`、`error?: string | null`、`height?: number`（默认 300）、`children`、`emptyText?`

**Toast**：配合 `toast-store`，组件渲染在 `AppLayout` 顶层，读取 store 的 toasts 数组，每个 toast 包含 `id`、`type`、`message`、`duration`，自动定时移除。

**EmptyState**：`icon?: ReactNode`、`title: string`、`description?: string`、`action?: ReactNode`

### 6.4 `AppLayout` 组件

```typescript
// apps/desktop/src/renderer/src/components/layout/AppLayout.tsx
// 应用主布局：侧边栏 + 内容区
// App layout: sidebar + content area

import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Toast } from '../auxiliary/Toast';

export function AppLayout() {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
      <Toast />
    </div>
  );
}
```

### 6.5 `Sidebar` 导航项

| 导航项 | 路径 | 图标 |
|--------|------|------|
| 仪表盘 | `/` | Home |
| 账户管理 | `/accounts` | Wallet |
| 交易记录 | `/transactions` | Receipt |
| 净资产趋势 | `/net-worth` | TrendingUp |
| FIRE 计算器 | `/fire-calculator` | Calculator |

图标使用内联 SVG（避免引入额外图标库），当前路由高亮显示（`useLocation` 判断）。

### 6.6 `toast-store`（Toast 组件配套）

```typescript
// apps/desktop/src/renderer/src/stores/toast-store.ts
interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration: number;  // 毫秒，0 表示不自动关闭
}

interface ToastStore {
  toasts: ToastItem[];
  show: (type: ToastItem['type'], message: string, duration?: number) => void;
  remove: (id: string) => void;
  clear: () => void;
}
```

`show` 默认 duration 为 3000ms，调用后通过 `setTimeout` 在 duration 后自动 `remove`。Store 提供 `showSuccess`、`showError`、`showWarning`、`showInfo` 便捷方法（内部调用 `show`）。

### 6.7 样式规范

所有组件使用 Tailwind CSS 4 类名，对齐 UI/UX 设计文档的色彩和间距规范：

- 主色：`blue-600`（primary）、`emerald-600`（secondary）、`red-500`（danger）
- 文字：`gray-900`（标题）、`gray-700`（正文）、`gray-500`（次要）、`gray-400`（占位）
- 背景：`white`（卡片）、`gray-50`（页面）
- 边框：`gray-200`（默认）、`red-200`（错误）
- 圆角：`rounded-lg`（卡片/弹窗）、`rounded-md`（按钮/输入框）
- 阴影：`shadow-sm`（卡片）、`shadow-lg`（弹窗）

### 6.8 验收标准

- 14 个组件文件全部创建，`pnpm typecheck` 通过
- 在 `DashboardPage` 中可拼装使用 `PageHeader` + `Card`，渲染正常
- `Button` 三种 variant 和三种尺寸视觉差异明显
- `Toast` 通过 `useToastStore.getState().showSuccess('测试')` 调用后，右上角显示绿色 Toast，3 秒后自动消失

---

## 7. Task 5：功能页面（Onboarding + Dashboard）

### 7.1 目标

实现 5 步 Onboarding 向导，完成用户档案创建 + 18 个种子分类初始化，让新用户首次启动即可进入主界面。同时交付简单的 `DashboardPage` 占位页。删除 `TestPage.tsx`。

### 7.2 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `apps/desktop/src/renderer/src/pages/OnboardingPage.tsx` | 新增 | 5 步向导完整实现 |
| `apps/desktop/src/renderer/src/pages/TestPage.tsx` | 删除 | 里程碑 1 验证页，不再需要 |

### 7.3 Onboarding 向导步骤

对齐应用初始化设计文档 3.3 节：

| 步骤 | 页面内容 | 表单字段 | 校验规则 |
|------|---------|---------|---------|
| 1. 欢迎页 | 应用介绍 + FIRE 理念简介 + "开始"按钮 | 无 | 无 |
| 2. 输入显示名称 | 文本输入框 + 示例占位符 | `display_name: string` | 非空，1-20 字符，不允许纯空格 |
| 3. 选择市场 | 单选：中国市场 / 全球市场 | `is_china_market: number` | 必选一项（默认选中"中国市场"） |
| 4. 确认默认利率偏好 | 展示基于市场选择的默认值，允许调整 | `default_withdrawal_rate: number`（基点）<br>`default_expected_return: number`（基点）<br>`default_inflation_rate: number`（基点） | 提现率：200-600；预期回报：0-2000；通胀率：0-1000 |
| 5. 完成 | 汇总信息 + "完成创建"按钮 | 无 | 显示所有已填信息供确认 |

### 7.4 市场默认值映射

| 市场选择 | `is_china_market` | `default_withdrawal_rate` | `default_expected_return` | `default_inflation_rate` | `base_currency` |
|---------|-------------------|--------------------------|--------------------------|--------------------------|-----------------|
| 中国市场 | 1 | 350 (3.5%) | 700 (7%) | 300 (3%) | CNY |
| 全球市场 | 0 | 400 (4%) | 700 (7%) | 300 (3%) | USD |

> **注**：以上默认值与 `createUser()` 函数（`user.ts` 第 30-41 行）中的默认逻辑完全一致。中国市场默认提现率 350 基点，全球市场默认 400 基点。步骤 4 选择市场时自动填充对应默认值，用户可手动调整。

### 7.5 表单状态管理

Onboarding 页面内部使用 React `useState` 管理表单数据，不引入额外表单库（保持 MVP 轻量）：

```typescript
interface OnboardingFormData {
  display_name: string;
  is_china_market: number;
  default_withdrawal_rate: number;
  default_expected_return: number;
  default_inflation_rate: number;
}

const [step, setStep] = useState(1);
const [formData, setFormData] = useState<OnboardingFormData>({
  display_name: '',
  is_china_market: 1,  // 默认中国市场
  default_withdrawal_rate: 350,
  default_expected_return: 700,
  default_inflation_rate: 300,
});
const [errors, setErrors] = useState<Partial<Record<keyof OnboardingFormData, string>>>({});
const [submitting, setSubmitting] = useState(false);
```

### 7.6 步骤校验逻辑

每步点击"下一步"时校验当前步骤字段：

- **步骤 2**（显示名称）：`display_name.trim()` 非空且长度 1-20，否则 `errors.display_name = '请输入 1-20 字符的显示名称'`
- **步骤 3**（市场）：`is_china_market` 必须为 0 或 1，默认选中无需校验
- **步骤 4**（利率偏好）：
  - `default_withdrawal_rate` ∈ [200, 600]
  - `default_expected_return` ∈ [0, 2000]
  - `default_inflation_rate` ∈ [0, 1000]
  - 选择市场切换时，自动填充对应默认值（用户已手动修改则保留用户值）

校验失败时 `errors` 写入对应字段，`Input` 组件显示错误信息，不进入下一步。

### 7.7 完成提交

步骤 5 点击"完成创建"按钮：

```typescript
const handleSubmit = async () => {
  setSubmitting(true);
  try {
    // 1. 创建用户
    const user = await dataAccess.createUser({
      display_name: formData.display_name.trim(),
      is_china_market: formData.is_china_market,
      base_currency: formData.is_china_market ? 'CNY' : 'USD',
      default_withdrawal_rate: formData.default_withdrawal_rate,
      default_expected_return: formData.default_expected_return,
      default_inflation_rate: formData.default_inflation_rate,
    });

    // 2. 创建种子分类（18 个内置分类）
    await dataAccess.seedCategories(user.id);

    // 3. 更新 app-store，触发路由守卫放行
    useAppStore.getState().completeOnboarding(user);

    // 4. 显示成功 Toast
    useToastStore.getState().showSuccess('账户创建成功，欢迎使用 FIRE 计算APP！');

    // 5. 跳转主页（由 RequireInit 守卫自动放行，因 initialized 已变 true）
    navigate('/');
  } catch (err) {
    useToastStore.getState().showError(`创建失败：${(err as Error).message}`);
  } finally {
    setSubmitting(false);
  }
};
```

### 7.8 步骤导航 UI

- 顶部显示步骤进度条（5 个圆点 + 连接线，当前步骤高亮）
- 底部显示"上一步"和"下一步/完成"按钮
- 步骤 1 无"上一步"，步骤 5 按钮文本为"完成创建"
- 提交中按钮显示 loading 状态，禁用点击

### 7.9 删除 `TestPage.tsx`

里程碑 1 的 `TestPage.tsx` 仅用于架构验证，里程碑 2 路由建立后不再需要，直接删除。`App.tsx` 已在 Task 3 重构为 `RouterProvider`，不再引用 `TestPage`。

### 7.10 验收标准

- `pnpm dev` 启动应用，首次启动（清空 `{userData}/fire-app/data/fire.db`）自动跳转 `#/onboarding`
- 完成 5 步向导后：
  - 数据库 `users` 表有 1 条记录，字段值与表单输入一致
  - 数据库 `categories` 表有 18 条记录，`is_system = 1`
  - 自动跳转 `#/`，显示 DashboardPage，欢迎信息显示用户输入的显示名称
- 关闭应用后重新启动，自动跳转 `#/`（不进入 Onboarding）
- 步骤 2 输入空名称或纯空格，点击"下一步"显示错误，不进入下一步
- 步骤 4 输入超出范围的利率值，显示错误

---

## 8. 依赖与执行顺序

### 8.1 Task 间依赖

```
Task 1（数据层）
  ├─ 产出：DataAccessPort 接口 + dataAccess 单例
  └─ 被依赖：Task 2 的 Store 调用 dataAccess
        │
        ▼
Task 2（状态层）
  ├─ 产出：5 个 Store + app-store.initialized
  └─ 被依赖：Task 3 的 RequireInit 读取 app-store.initialized
        │
        ▼
Task 3（路由层）
  ├─ 产出：router + RequireInit + App.tsx 重构
  └─ 被依赖：Task 5 的 OnboardingPage 通过 navigate 跳转
        │
        ▼
Task 4（UI 组件）
  ├─ 产出：14 个组件文件
  └─ 被依赖：Task 5 的 OnboardingPage 使用 Button/Input/Select
        │
        ▼
Task 5（功能页面）
  └─ 产出：OnboardingPage + DashboardPage + 删除 TestPage
```

### 8.2 Task 内部并行点

- **Task 1**：`getTransactionsByUser`（shared）与主进程 IPC handler 拆分可并行；preload 扩展和 `ipc.d.ts` 扩展可并行
- **Task 2**：5 个 Store 文件可并行编写，但 `index.ts` 需等全部完成后导出
- **Task 3**：4 个占位页面可并行编写；`RequireInit` 和路由配置可并行
- **Task 4**：14 个组件文件可并行编写（除 `Toast` 依赖 `toast-store`，需先建 Store）
- **Task 5**：OnboardingPage 是单一文件，内部串行

### 8.3 验证里程碑

每个 Task 完成后执行验证：

| Task | 验证命令/操作 |
|------|-------------|
| Task 1 | `pnpm typecheck` + DevTools 调用 `window.dataAccess.user.getFirst()` |
| Task 2 | `pnpm typecheck` + DevTools 调用 `useAppStore.getState().initialize()` |
| Task 3 | `pnpm dev` + 观察首次启动跳转 `/onboarding`，后续启动跳转 `/` |
| Task 4 | `pnpm typecheck` + 在 DashboardPage 临时拼装组件验证渲染 |
| Task 5 | 端到端：清空 DB → 启动 → 完成 Onboarding → 验证 DB 数据 → 重启验证跳过 Onboarding |

---

## 9. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 36 个 IPC handler 一次性新增易出错 | 主进程启动失败或部分通道未注册 | Task 1 完成后在主进程启动日志输出已注册数量，与预期 36 对比 |
| Store 跨实体刷新链路复杂 | 刷新遗漏导致 UI 数据不同步 | 明确刷新矩阵（见 4.4 节），写操作后必须调用对应刷新方法 |
| Onboarding 表单校验遗漏 | 用户输入非法值导致 DB 约束错误 | 校验在 UI 层完成，主进程 IPC handler 的错误包装器捕获 DB 约束错误并返回 IpcError |
| `createHashRouter` 与 Electron 兼容性 | 路由不生效或刷新 404 | 已在里程碑 1 验证 `file://` 加载方式，HashRouter 适配该场景 |
| 组件 Props 与 UI/UX 设计文档不一致 | 后续页面拼装时 Props 不匹配 | 严格按 UI/UX 设计文档 6.1 节 Props 定义实现，验收时逐项核对 |

---

## 10. 与后续里程碑的衔接

里程碑 2 交付的基础设施为后续里程碑提供拼装基础：

| 后续里程碑 | 复用的里程碑 2 产出 |
|----------|-------------------|
| 里程碑 3（账户管理页） | `account-store` + `Account`/`Input`/`Select`/`Table`/`Modal`/`ConfirmDialog` 组件 + `AccountsPage` 占位 |
| 里程碑 4（交易记录页） | `transaction-store` + `transaction-store` 跨 Store 刷新 `account-store` 机制 + 交易相关组件 |
| 里程碑 5（净资产趋势页） | `snapshot-store` + `ChartContainer` 组件 + `NetWorthPage` 占位 |
| 里程碑 6（FIRE 计算器页） | `scenario-store` + `ChartContainer` + `FireCalculatorPage` 占位 |
| 里程碑 7（设置页） | `app-store` 的 `currentUser` + `Modal`/`Input` 组件 |

每个后续里程碑只需聚焦业务逻辑实现，基础设施直接复用，无需重复搭建。

---

## 附录：决策记录

| # | 决策项 | 选择 | 日期 | 理由 |
|---|--------|------|------|------|
| 1 | 里程碑 2 范围 | 全部包含（数据+状态+路由+组件+Onboarding） | 2026-07-15 | 一次交付完整基础设施，避免后续里程碑反复修补 |
| 2 | DashboardPage 实现 | 简单占位页 | 2026-07-15 | 概览卡片依赖聚合查询，留待里程碑 3+ 数据齐备后再设计 |
| 3 | 功能页面范围 | 仅 Onboarding + Dashboard | 2026-07-15 | 其他页面在各自里程碑实现业务逻辑，本里程碑仅占位 |
| 4 | 表单组件 | 不含业务表单组件 | 2026-07-15 | AccountForm/TransactionForm 等业务表单依赖具体实体逻辑，留待后续里程碑 |
| 5 | 图表组件 | 仅 ChartContainer | 2026-07-15 | 图表业务组件（折线图/环形图）依赖具体数据结构，留待里程碑 5/6 |
| 6 | 辅助组件 | 包含 Toast + EmptyState | 2026-07-15 | Toast 是所有页面通用的反馈机制，EmptyState 是空数据占位，均为基础设施 |
| 7 | 概览卡片 | 不含 | 2026-07-15 | 概览卡片依赖聚合数据（净资产/可投资余额等），留待里程碑 3+ 数据齐备后设计 |
| 8 | 布局组件 | 包含 3 个（AppLayout/Sidebar/PageHeader） | 2026-07-15 | 这 3 个组件是所有页面的通用骨架，必须先行 |
| 9 | Task 分组 | 方案 A：5 Task 按依赖串行 | 2026-07-15 | 依赖关系清晰，串行验证简单，避免并行导致的集成冲突 |
| 10 | 路由方案 | createHashRouter | 2026-07-15 | Electron `file://` 加载适配，避免刷新 404 |
| 11 | Store 状态管理 | Zustand + 跨 Store getState 刷新 | 2026-07-15 | Zustand 轻量，getState 跨 Store 调用避免 Context 嵌套 |
| 12 | Onboarding 表单 | React useState，不引入表单库 | 2026-07-15 | MVP 轻量，5 步表单用 useState 足够，避免过度工程化 |
