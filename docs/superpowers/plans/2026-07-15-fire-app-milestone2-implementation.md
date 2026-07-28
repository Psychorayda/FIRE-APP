# FIRE 计算APP 桌面 MVP — 里程碑 2：核心基础设施实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在里程碑 1 架构骨架基础上，交付完整的数据层（36 个 IPC 通道 + DataAccessPort）、状态层（5 个 Zustand Store）、路由层（createHashRouter + 守卫）、UI 组件库（14 个组件 + toast-store）和 Onboarding 向导，为后续里程碑 3-7 的功能页面开发提供基础设施。

**Architecture:** 主进程按实体拆分 IPC handler 文件，统一通过 `registerHandler` 包装器注册（含错误处理）。渲染进程通过 `DataAccessPort` 接口 + `IpcDataAccess` 实现访问数据，5 个 Zustand Store 按实体职责拆分，跨 Store 刷新通过 `getState()` 显式调用。路由使用 `createHashRouter` 适配 Electron `file://` 加载，`RequireInit` 守卫区分首次启动与后续启动。组件均为纯展示组件，Props 驱动，对齐 UI/UX 设计文档视觉规范。

**Tech Stack:** Electron 31, electron-vite 2, React 19, Zustand 5, React Router 7, Tailwind CSS 4, better-sqlite3 11, TypeScript 5.5, vitest 2

**Spec:** `docs/superpowers/specs/2026-07-15-fire-app-milestone2-design.md`

---

## 文件结构

本里程碑创建/修改/删除的文件：

```
FIRE APP/
├── packages/shared/src/
│   ├── models/transaction.ts              # Task 1: 新增 getTransactionsByUser
│   └── tests/models/
│       └── transaction.test.ts            # Task 1: 新增 getTransactionsByUser 测试
├── apps/desktop/src/
│   ├── main/
│   │   ├── ipc/                           # Task 1: 新增 IPC handler 目录
│   │   │   ├── register-handlers.ts       #   统一错误处理包装器
│   │   │   ├── db-handlers.ts             #   db:init + db:close
│   │   │   ├── user-handlers.ts           #   4 个 user handler
│   │   │   ├── account-handlers.ts        #   8 个 account handler
│   │   │   ├── category-handlers.ts       #   4 个 category handler
│   │   │   ├── transaction-handlers.ts    #   6 个 tx handler
│   │   │   ├── recurring-handlers.ts      #   4 个 recurring handler
│   │   │   ├── scenario-handlers.ts       #   4 个 scenario handler
│   │   │   ├── snapshot-handlers.ts       #   3 个 snapshot handler
│   │   │   └── fire-calc-handlers.ts      #   1 个 fireCalc handler
│   │   └── ipc-handlers.ts                # Task 1: 重构为聚合入口
│   ├── preload/
│   │   └── index.ts                       # Task 1: 扩展为 36 个方法
│   └── renderer/src/
│       ├── data/                          # Task 1: 新增数据访问层
│       │   ├── data-access-port.ts        #   DataAccessPort 接口
│       │   ├── ipc-data-access.ts         #   IPC 实现
│       │   └── data-access.ts             #   单例导出
│       ├── types/
│       │   └── ipc.d.ts                   # Task 1: 扩展为 36 个方法声明
│       ├── stores/                        # Task 2: 重构状态层
│       │   ├── app-store.ts               #   新增
│       │   ├── account-store.ts           #   新增
│       │   ├── transaction-store.ts       #   新增
│       │   ├── snapshot-store.ts          #   新增
│       │   ├── scenario-store.ts          #   新增
│       │   ├── toast-store.ts             #   新增（Task 4 创建）
│       │   ├── index.ts                   #   统一导出
│       │   └── user-store.ts              #   删除
│       ├── router/                        # Task 3: 新增路由层
│       │   ├── index.tsx                  #   路由配置
│       │   └── RequireInit.tsx            #   初始化守卫
│       ├── components/                    # Task 4: 新增组件库
│       │   ├── layout/
│       │   │   ├── AppLayout.tsx
│       │   │   ├── Sidebar.tsx
│       │   │   └── PageHeader.tsx
│       │   ├── base/
│       │   │   ├── Button.tsx
│       │   │   ├── Input.tsx
│       │   │   ├── Select.tsx
│       │   │   ├── Table.tsx
│       │   │   ├── Card.tsx
│       │   │   ├── Modal.tsx
│       │   │   ├── ConfirmDialog.tsx
│       │   │   ├── Tag.tsx
│       │   │   └── ChartContainer.tsx
│       │   └── auxiliary/
│       │       ├── Toast.tsx
│       │       └── EmptyState.tsx
│       ├── pages/
│       │   ├── OnboardingPage.tsx         # Task 5: 新增（5 步向导）
│       │   ├── DashboardPage.tsx          # Task 3: 新增（占位）
│       │   ├── AccountsPage.tsx           # Task 3: 新增（占位）
│       │   ├── TransactionsPage.tsx       # Task 3: 新增（占位）
│       │   ├── NetWorthPage.tsx           # Task 3: 新增（占位）
│       │   ├── FireCalculatorPage.tsx     # Task 3: 新增（占位）
│       │   └── TestPage.tsx               # Task 5: 删除
│       └── App.tsx                        # Task 3: 重构为 RouterProvider
```

---

## Task 1: 数据层（IPC 通道 + DataAccessPort）

**目标:** 实现 36 个 IPC 通道，建立 DataAccessPort 接口和 IpcDataAccess 实现。

**Files:**
- Modify: `packages/shared/src/models/transaction.ts`
- Create: `packages/shared/tests/models/transaction.test.ts`
- Create: `apps/desktop/src/main/ipc/register-handlers.ts`
- Create: `apps/desktop/src/main/ipc/db-handlers.ts`
- Create: `apps/desktop/src/main/ipc/user-handlers.ts`
- Create: `apps/desktop/src/main/ipc/account-handlers.ts`
- Create: `apps/desktop/src/main/ipc/category-handlers.ts`
- Create: `apps/desktop/src/main/ipc/transaction-handlers.ts`
- Create: `apps/desktop/src/main/ipc/recurring-handlers.ts`
- Create: `apps/desktop/src/main/ipc/scenario-handlers.ts`
- Create: `apps/desktop/src/main/ipc/snapshot-handlers.ts`
- Create: `apps/desktop/src/main/ipc/fire-calc-handlers.ts`
- Modify: `apps/desktop/src/main/ipc-handlers.ts`
- Modify: `apps/desktop/src/preload/index.ts`
- Modify: `apps/desktop/src/renderer/src/types/ipc.d.ts`
- Create: `apps/desktop/src/renderer/src/data/data-access-port.ts`
- Create: `apps/desktop/src/renderer/src/data/ipc-data-access.ts`
- Create: `apps/desktop/src/renderer/src/data/data-access.ts`

### Step 1.1: 编写 getTransactionsByUser 的失败测试

- [ ] **创建测试文件 `packages/shared/tests/models/transaction.test.ts`**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, closeDatabase } from '../../src/db/connection.js';
import { initSchema } from '../../src/db/schema.js';
import { createUser } from '../../src/models/user.js';
import { createAccount } from '../../src/models/account.js';
import { createCategory } from '../../src/models/category.js';
import { getTransactionsByUser } from '../../src/models/transaction.js';
import { createTransaction } from '../../src/services/transaction-service.js';
import type { Database as DatabaseType } from 'better-sqlite3';

describe('transaction model', () => {
  let db: DatabaseType;
  let userId: string;
  let accountId: string;
  let categoryId: string;

  beforeEach(() => {
    db = createDatabase(':memory:');
    initSchema(db);
    userId = 'test-user-id';
    createUser(db, { id: userId, display_name: '测试' });
    const acc = createAccount(db, { user_id: userId, name: '活期', asset_class: 'liquid', account_type: 'checking' });
    accountId = acc.id;
    const cat = createCategory(db, { user_id: userId, name: '工资', type: 'income' });
    categoryId = cat.id;
  });

  afterEach(() => { closeDatabase(db); });

  it('getTransactionsByUser: 返回用户所有交易（按日期倒序）', () => {
    createTransaction(db, { user_id: userId, account_id: accountId, category_id: categoryId, transaction_type: 'income', amount: 1000, transaction_date: 1000000 });
    createTransaction(db, { user_id: userId, account_id: accountId, category_id: categoryId, transaction_type: 'expense', amount: 500, transaction_date: 3000000 });
    createTransaction(db, { user_id: userId, account_id: accountId, category_id: categoryId, transaction_type: 'income', amount: 2000, transaction_date: 2000000 });

    const txs = getTransactionsByUser(db, userId);
    expect(txs).toHaveLength(3);
    expect(txs[0].transaction_date).toBe(3000000);
    expect(txs[1].transaction_date).toBe(2000000);
    expect(txs[2].transaction_date).toBe(1000000);
  });

  it('getTransactionsByUser: 排除已删除交易', () => {
    const tx1 = createTransaction(db, { user_id: userId, account_id: accountId, category_id: categoryId, transaction_type: 'income', amount: 1000, transaction_date: 1000000 });
    createTransaction(db, { user_id: userId, account_id: accountId, category_id: categoryId, transaction_type: 'expense', amount: 500, transaction_date: 2000000 });

    // 软删除第一笔
    db.prepare('UPDATE transactions SET deleted_flag = 1 WHERE id = ?').run(tx1.id);

    const txs = getTransactionsByUser(db, userId);
    expect(txs).toHaveLength(1);
    expect(txs[0].amount).toBe(500);
  });

  it('getTransactionsByUser: 无交易时返回空数组', () => {
    const txs = getTransactionsByUser(db, userId);
    expect(txs).toHaveLength(0);
  });
});
```

### Step 1.2: 运行测试确认失败

- [ ] **运行测试**

Run: `cd /workspace/FIRE\ APP && pnpm --filter @fire-app/shared test -- tests/models/transaction.test.ts`

Expected: FAIL — `getTransactionsByUser` 未导出/未定义

### Step 1.3: 实现 getTransactionsByUser

- [ ] **在 `packages/shared/src/models/transaction.ts` 末尾追加函数**

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

### Step 1.4: 运行测试确认通过

- [ ] **运行测试**

Run: `cd /workspace/FIRE\ APP && pnpm --filter @fire-app/shared test -- tests/models/transaction.test.ts`

Expected: PASS — 3 个测试全部通过

### Step 1.5: 创建 IPC 错误处理包装器

- [ ] **创建 `apps/desktop/src/main/ipc/register-handlers.ts`**

```typescript
// IPC handler 注册器：统一错误处理包装
// IPC handler registrar: unified error handling wrapper

import { ipcMain } from 'electron';
import type { Database as DatabaseType } from 'better-sqlite3';

/**
 * 标准化 IPC 错误对象
 * Standardized IPC error object
 */
export interface IpcError {
  code: string;
  message: string;
  entity?: string;
}

/**
 * 包装 IPC handler，统一错误处理
 * Wrap IPC handler with unified error handling
 * @param channel IPC 通道名 / IPC channel name
 * @param handler 业务处理函数 / Business handler function
 * @param db 数据库实例 / Database instance
 */
export function registerHandler<TArgs extends unknown[], TResult>(
  channel: string,
  handler: (db: DatabaseType, ...args: TArgs) => TResult,
  db: DatabaseType,
): void {
  ipcMain.handle(channel, async (_event, ...args: TArgs): Promise<TResult> => {
    try {
      return handler(db, ...args);
    } catch (error) {
      const ipcError: IpcError = {
        code: error instanceof Error && error.message.includes('not found') ? 'NOT_FOUND' : 'DB_ERROR',
        message: error instanceof Error ? error.message : String(error),
      };
      throw ipcError;
    }
  });
}
```

### Step 1.6: 创建 9 个实体 IPC handler 文件

- [ ] **创建 `apps/desktop/src/main/ipc/db-handlers.ts`**

```typescript
import { registerHandler } from './register-handlers.js';
import { closeDatabase } from '@shared/db/connection.js';
import type { Database as DatabaseType } from 'better-sqlite3';

export function registerDbHandlers(db: DatabaseType): void {
  // db:init — 主进程已初始化，此处仅返回确认（幂等）
  registerHandler('db:init', () => undefined, db);
  // db:close — 关闭数据库连接
  registerHandler('db:close', (_db) => { closeDatabase(_db); }, db);
}
```

- [ ] **创建 `apps/desktop/src/main/ipc/user-handlers.ts`**

```typescript
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

- [ ] **创建 `apps/desktop/src/main/ipc/account-handlers.ts`**

```typescript
import { registerHandler } from './register-handlers.js';
import {
  createAccount, getAccount, getAccounts, updateAccountBalance,
  getInvestableBalance, getNetWorth, hasTransactions, softDeleteAccount,
} from '@shared/models/account.js';
import type { Database as DatabaseType } from 'better-sqlite3';
import type { CreateAccountInput } from '@shared/models/account.js';

export function registerAccountHandlers(db: DatabaseType): void {
  registerHandler('db:account:create', (_db, input: CreateAccountInput) => createAccount(_db, input), db);
  registerHandler('db:account:get', (_db, id: string) => getAccount(_db, id), db);
  registerHandler('db:account:list', (_db, userId: string) => getAccounts(_db, userId), db);
  registerHandler('db:account:updateBalance', (_db, id: string, newBalance: number) => { updateAccountBalance(_db, id, newBalance); }, db);
  registerHandler('db:account:investableBalance', (_db, userId: string) => getInvestableBalance(_db, userId), db);
  registerHandler('db:account:netWorth', (_db, userId: string) => getNetWorth(_db, userId), db);
  registerHandler('db:account:hasTransactions', (_db, accountId: string) => hasTransactions(_db, accountId), db);
  registerHandler('db:account:softDelete', (_db, id: string) => { softDeleteAccount(_db, id); }, db);
}
```

- [ ] **创建 `apps/desktop/src/main/ipc/category-handlers.ts`**

```typescript
import { registerHandler } from './register-handlers.js';
import { createCategory, getCategory, getCategories, seedCategories } from '@shared/models/category.js';
import type { Database as DatabaseType } from 'better-sqlite3';
import type { CreateCategoryInput } from '@shared/models/category.js';
import type { CategoryType } from '@shared/types/index.js';

export function registerCategoryHandlers(db: DatabaseType): void {
  registerHandler('db:category:create', (_db, input: CreateCategoryInput) => createCategory(_db, input), db);
  registerHandler('db:category:get', (_db, id: string) => getCategory(_db, id), db);
  registerHandler('db:category:list', (_db, userId: string, type?: CategoryType) => getCategories(_db, userId, type), db);
  registerHandler('db:category:seed', (_db, userId: string) => { seedCategories(_db, userId); }, db);
}
```

- [ ] **创建 `apps/desktop/src/main/ipc/transaction-handlers.ts`**

```typescript
import { registerHandler } from './register-handlers.js';
import { getTransaction, getTransactionById, getTransactionsByUser } from '@shared/models/transaction.js';
import { createTransaction, editTransaction, deleteTransaction } from '@shared/services/transaction-service.js';
import type { Database as DatabaseType } from 'better-sqlite3';
import type { CreateTransactionInput, EditTransactionInput } from '@shared/services/transaction-service.js';

export function registerTransactionHandlers(db: DatabaseType): void {
  registerHandler('db:tx:get', (_db, id: string) => getTransaction(_db, id), db);
  registerHandler('db:tx:getById', (_db, id: string) => getTransactionById(_db, id), db);
  registerHandler('db:tx:listByUser', (_db, userId: string) => getTransactionsByUser(_db, userId), db);
  registerHandler('db:tx:create', (_db, input: CreateTransactionInput) => createTransaction(_db, input), db);
  registerHandler('db:tx:edit', (_db, id: string, input: EditTransactionInput) => editTransaction(_db, id, input), db);
  registerHandler('db:tx:delete', (_db, id: string) => { deleteTransaction(_db, id); }, db);
}
```

- [ ] **创建 `apps/desktop/src/main/ipc/recurring-handlers.ts`**

```typescript
import { registerHandler } from './register-handlers.js';
import { createRecurring, getActiveRecurring, updateRecurring } from '@shared/models/recurring.js';
import { processRecurringTransactions } from '@shared/services/recurring-service.js';
import type { Database as DatabaseType } from 'better-sqlite3';
import type { CreateRecurringInput } from '@shared/models/recurring.js';
import type { RecurringTransaction } from '@shared/types/index.js';

export function registerRecurringHandlers(db: DatabaseType): void {
  registerHandler('db:recurring:create', (_db, input: CreateRecurringInput) => createRecurring(_db, input), db);
  registerHandler('db:recurring:listActive', (_db, userId: string) => getActiveRecurring(_db, userId), db);
  registerHandler('db:recurring:update', (_db, id: string, updates: Partial<RecurringTransaction>) => { updateRecurring(_db, id, updates); }, db);
  registerHandler('db:recurring:process', (_db, userId: string) => processRecurringTransactions(_db, userId), db);
}
```

- [ ] **创建 `apps/desktop/src/main/ipc/scenario-handlers.ts`**

```typescript
import { registerHandler } from './register-handlers.js';
import { createScenario, getScenario, getScenarios, updateScenario } from '@shared/models/scenario.js';
import type { Database as DatabaseType } from 'better-sqlite3';
import type { CreateScenarioInput } from '@shared/models/scenario.js';
import type { FireScenario } from '@shared/types/index.js';

export function registerScenarioHandlers(db: DatabaseType): void {
  registerHandler('db:scenario:create', (_db, input: CreateScenarioInput) => createScenario(_db, input), db);
  registerHandler('db:scenario:get', (_db, id: string) => getScenario(_db, id), db);
  registerHandler('db:scenario:list', (_db, userId: string) => getScenarios(_db, userId), db);
  registerHandler('db:scenario:update', (_db, id: string, updates: Partial<FireScenario>) => updateScenario(_db, id, updates), db);
}
```

- [ ] **创建 `apps/desktop/src/main/ipc/snapshot-handlers.ts`**

```typescript
import { registerHandler } from './register-handlers.js';
import { getSnapshotByMonth } from '@shared/models/snapshot.js';
import { getSnapshots, generateMonthlySnapshot } from '@shared/services/snapshot-service.js';
import type { Database as DatabaseType } from 'better-sqlite3';

export function registerSnapshotHandlers(db: DatabaseType): void {
  registerHandler('db:snapshot:list', (_db, userId: string) => getSnapshots(_db, userId), db);
  registerHandler('db:snapshot:getByMonth', (_db, userId: string, yearMonth: string) => getSnapshotByMonth(_db, userId, yearMonth), db);
  registerHandler('db:snapshot:generateMonthly', (_db, userId: string) => generateMonthlySnapshot(_db, userId), db);
}
```

- [ ] **创建 `apps/desktop/src/main/ipc/fire-calc-handlers.ts`**

```typescript
import { registerHandler } from './register-handlers.js';
import { runProjection } from '@shared/services/fire-calc.js';
import type { Database as DatabaseType } from 'better-sqlite3';
import type { FireScenario } from '@shared/types/index.js';

export function registerFireCalcHandlers(db: DatabaseType): void {
  registerHandler('db:fireCalc:runProjection', (_db, scenario: FireScenario) => runProjection(_db, scenario), db);
}
```

### Step 1.7: 重构 ipc-handlers.ts 为聚合入口

- [ ] **替换 `apps/desktop/src/main/ipc-handlers.ts` 全部内容**

```typescript
// IPC handler 注册总入口 / IPC handler registration entry
// 主进程注册 ipcMain.handle 通道，供渲染进程通过 IPC 调用数据层

import { getDatabase } from './db-manager.js';
import { registerDbHandlers } from './ipc/db-handlers.js';
import { registerUserHandlers } from './ipc/user-handlers.js';
import { registerAccountHandlers } from './ipc/account-handlers.js';
import { registerCategoryHandlers } from './ipc/category-handlers.js';
import { registerTransactionHandlers } from './ipc/transaction-handlers.js';
import { registerRecurringHandlers } from './ipc/recurring-handlers.js';
import { registerScenarioHandlers } from './ipc/scenario-handlers.js';
import { registerSnapshotHandlers } from './ipc/snapshot-handlers.js';
import { registerFireCalcHandlers } from './ipc/fire-calc-handlers.js';

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

  console.log('[IPC] 已注册 36 个 IPC handler');
}
```

### Step 1.8: 扩展 preload 脚本

- [ ] **替换 `apps/desktop/src/preload/index.ts` 全部内容**

```typescript
// Preload 脚本 / Preload script
// 通过 contextBridge 将 IPC 调用安全地暴露给渲染进程

import { contextBridge, ipcRenderer } from 'electron';

// 暴露给渲染进程的数据访问 API
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

// 将 dataAccess 挂载到 window 上
contextBridge.exposeInMainWorld('dataAccess', dataAccess);

// 类型声明：告诉 TypeScript window.dataAccess 存在
export type DataAccess = typeof dataAccess;
```

### Step 1.9: 扩展 ipc.d.ts 类型声明

- [ ] **替换 `apps/desktop/src/renderer/src/types/ipc.d.ts` 全部内容**

```typescript
// 渲染进程 IPC 类型声明 / Renderer IPC type declarations
// 声明 window.dataAccess 的类型，供渲染进程使用

import type {
  User, Account, Category, Transaction, RecurringTransaction,
  NetWorthSnapshot, FireScenario, CategoryType,
} from '@shared/types/index.js';
import type { CreateUserInput, UpdateUserInput } from '@shared/models/user.js';
import type { CreateAccountInput } from '@shared/models/account.js';
import type { CreateCategoryInput } from '@shared/models/category.js';
import type { CreateRecurringInput } from '@shared/models/recurring.js';
import type { CreateScenarioInput } from '@shared/models/scenario.js';
import type { CreateTransactionInput, EditTransactionInput } from '@shared/services/transaction-service.js';
import type { ProjectionResult } from '@shared/services/fire-calc.js';

export interface DataAccessAPI {
  // 数据库管理 / Database
  initDatabase(): Promise<void>;
  closeDatabase(): Promise<void>;

  // 用户 / User
  user: {
    create(input: CreateUserInput): Promise<User>;
    get(id: string): Promise<User | null>;
    update(id: string, input: UpdateUserInput): Promise<User>;
    getFirst(): Promise<User | null>;
  };

  // 账户 / Account
  account: {
    create(input: CreateAccountInput): Promise<Account>;
    get(id: string): Promise<Account | null>;
    list(userId: string): Promise<Account[]>;
    updateBalance(id: string, newBalance: number): Promise<void>;
    investableBalance(userId: string): Promise<number>;
    netWorth(userId: string): Promise<number>;
    hasTransactions(accountId: string): Promise<boolean>;
    softDelete(id: string): Promise<void>;
  };

  // 分类 / Category
  category: {
    create(input: CreateCategoryInput): Promise<Category>;
    get(id: string): Promise<Category | null>;
    list(userId: string, type?: CategoryType): Promise<Category[]>;
    seed(userId: string): Promise<void>;
  };

  // 交易 / Transaction
  tx: {
    get(id: string): Promise<Transaction | null>;
    getById(id: string): Promise<Transaction | null>;
    listByUser(userId: string): Promise<Transaction[]>;
    create(input: CreateTransactionInput): Promise<Transaction>;
    edit(id: string, input: EditTransactionInput): Promise<Transaction>;
    delete(id: string): Promise<void>;
  };

  // 经常性交易 / Recurring
  recurring: {
    create(input: CreateRecurringInput): Promise<RecurringTransaction>;
    listActive(userId: string): Promise<RecurringTransaction[]>;
    update(id: string, updates: Partial<RecurringTransaction>): Promise<void>;
    process(userId: string): Promise<Transaction[]>;
  };

  // 场景 / Scenario
  scenario: {
    create(input: CreateScenarioInput): Promise<FireScenario>;
    get(id: string): Promise<FireScenario | null>;
    list(userId: string): Promise<FireScenario[]>;
    update(id: string, updates: Partial<FireScenario>): Promise<FireScenario>;
  };

  // 快照 / Snapshot
  snapshot: {
    list(userId: string): Promise<NetWorthSnapshot[]>;
    getByMonth(userId: string, yearMonth: string): Promise<NetWorthSnapshot | null>;
    generateMonthly(userId: string): Promise<NetWorthSnapshot | null>;
  };

  // FIRE 计算 / FireCalc
  fireCalc: {
    runProjection(scenario: FireScenario): Promise<ProjectionResult>;
  };
}

declare global {
  interface Window {
    dataAccess: DataAccessAPI;
  }
}
```

### Step 1.10: 创建 DataAccessPort 接口

- [ ] **创建 `apps/desktop/src/renderer/src/data/data-access-port.ts`**

```typescript
// DataAccessPort 接口：渲染进程的数据访问抽象层
// DataAccessPort interface: data access abstraction for the renderer process
// 桌面端通过 IPC 实现，移动端可通过 react-native-quick-sqlite 实现

import type {
  User, Account, Category, Transaction, RecurringTransaction,
  NetWorthSnapshot, FireScenario, CategoryType,
} from '@shared/types/index.js';
import type { CreateUserInput, UpdateUserInput } from '@shared/models/user.js';
import type { CreateAccountInput } from '@shared/models/account.js';
import type { CreateCategoryInput } from '@shared/models/category.js';
import type { CreateRecurringInput } from '@shared/models/recurring.js';
import type { CreateScenarioInput } from '@shared/models/scenario.js';
import type { CreateTransactionInput, EditTransactionInput } from '@shared/services/transaction-service.js';
import type { ProjectionResult } from '@shared/services/fire-calc.js';

/**
 * 数据访问端口接口
 * Data access port interface
 *
 * 渲染进程通过此接口访问所有数据操作。
 * 桌面端使用 IpcDataAccess 实现（通过 IPC 调用主进程）。
 * 移动端预留使用 QuickSqliteDataAccess 实现（直接操作本地 SQLite）。
 */
export interface DataAccessPort {
  // ===== 数据库管理 / Database management =====
  initDatabase(): Promise<void>;
  closeDatabase(): Promise<void>;

  // ===== User =====
  createUser(input: CreateUserInput): Promise<User>;
  getUser(id: string): Promise<User | null>;
  updateUser(id: string, input: UpdateUserInput): Promise<User>;
  getFirstUser(): Promise<User | null>;

  // ===== Account =====
  createAccount(input: CreateAccountInput): Promise<Account>;
  getAccount(id: string): Promise<Account | null>;
  getAccounts(userId: string): Promise<Account[]>;
  updateAccountBalance(id: string, newBalance: number): Promise<void>;
  getInvestableBalance(userId: string): Promise<number>;
  getNetWorth(userId: string): Promise<number>;
  hasTransactions(accountId: string): Promise<boolean>;
  softDeleteAccount(id: string): Promise<void>;

  // ===== Category =====
  createCategory(input: CreateCategoryInput): Promise<Category>;
  getCategory(id: string): Promise<Category | null>;
  getCategories(userId: string, type?: CategoryType): Promise<Category[]>;
  seedCategories(userId: string): Promise<void>;

  // ===== Transaction =====
  getTransaction(id: string): Promise<Transaction | null>;
  getTransactionById(id: string): Promise<Transaction | null>;
  getTransactionsByUser(userId: string): Promise<Transaction[]>;
  createTransaction(input: CreateTransactionInput): Promise<Transaction>;
  editTransaction(id: string, input: EditTransactionInput): Promise<Transaction>;
  deleteTransaction(id: string): Promise<void>;

  // ===== Recurring Transaction =====
  createRecurring(input: CreateRecurringInput): Promise<RecurringTransaction>;
  getActiveRecurring(userId: string): Promise<RecurringTransaction[]>;
  updateRecurring(id: string, updates: Partial<RecurringTransaction>): Promise<void>;
  processRecurringTransactions(userId: string): Promise<Transaction[]>;

  // ===== Scenario =====
  createScenario(input: CreateScenarioInput): Promise<FireScenario>;
  getScenario(id: string): Promise<FireScenario | null>;
  getScenarios(userId: string): Promise<FireScenario[]>;
  updateScenario(id: string, updates: Partial<FireScenario>): Promise<FireScenario>;

  // ===== Snapshot =====
  getSnapshots(userId: string): Promise<NetWorthSnapshot[]>;
  getSnapshotByMonth(userId: string, yearMonth: string): Promise<NetWorthSnapshot | null>;
  generateMonthlySnapshot(userId: string): Promise<NetWorthSnapshot | null>;

  // ===== FireCalc =====
  runProjection(scenario: FireScenario): Promise<ProjectionResult>;
}
```

### Step 1.11: 创建 IpcDataAccess 实现

- [ ] **创建 `apps/desktop/src/renderer/src/data/ipc-data-access.ts`**

```typescript
// IpcDataAccess: DataAccessPort 的 IPC 实现
// IpcDataAccess: IPC implementation of DataAccessPort

import type { DataAccessPort } from './data-access-port.js';
import type { CreateUserInput, UpdateUserInput } from '@shared/models/user.js';
import type { CreateAccountInput } from '@shared/models/account.js';
import type { CreateCategoryInput } from '@shared/models/category.js';
import type { CreateRecurringInput } from '@shared/models/recurring.js';
import type { CreateScenarioInput } from '@shared/models/scenario.js';
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

### Step 1.12: 创建 data-access 单例导出

- [ ] **创建 `apps/desktop/src/renderer/src/data/data-access.ts`**

```typescript
// 导出当前使用的 DataAccessPort 实例（IPC 实现）
// Export the currently used DataAccessPort instance (IPC implementation)

import { IpcDataAccess } from './ipc-data-access.js';

export const dataAccess: IpcDataAccess = new IpcDataAccess();
```

### Step 1.13: 类型检查 + 提交

- [ ] **运行 shared 包测试**

Run: `cd /workspace/FIRE\ APP && pnpm --filter @fire-app/shared test`

Expected: 所有测试通过（含新增的 transaction.test.ts 3 个测试）

- [ ] **运行 shared 包类型检查**

Run: `cd /workspace/FIRE\ APP/packages/shared && npx tsc --noEmit`

Expected: 无错误

- [ ] **运行 desktop 渲染进程类型检查**

Run: `cd /workspace/FIRE\ APP/apps/desktop && npx tsc --noEmit -p tsconfig.json`

Expected: 无错误

- [ ] **运行 desktop 主进程类型检查**

Run: `cd /workspace/FIRE\ APP/apps/desktop && npx tsc --noEmit -p tsconfig.node.json`

Expected: 无错误

- [ ] **提交**

```bash
cd /workspace/FIRE\ APP
git add packages/shared/src/models/transaction.ts packages/shared/tests/models/transaction.test.ts
git add apps/desktop/src/main/ipc/ apps/desktop/src/main/ipc-handlers.ts
git add apps/desktop/src/preload/index.ts apps/desktop/src/renderer/src/types/ipc.d.ts
git add apps/desktop/src/renderer/src/data/
git commit -m "feat(milestone2): 实现数据层 36 个 IPC 通道 + DataAccessPort 接口

- 新增 getTransactionsByUser 函数 + 单元测试
- 按实体拆分 9 个 IPC handler 文件 + register-handlers 统一错误处理
- 扩展 preload 为 36 个方法分组 API
- 扩展 ipc.d.ts 类型声明
- 新增 DataAccessPort 接口 + IpcDataAccess 实现 + 单例导出"
```

---

## Task 2: 状态层（5 个 Zustand Store）

**目标:** 用 5 个 Store 替换临时的 user-store，提供跨 Store 刷新机制。

**Files:**
- Delete: `apps/desktop/src/renderer/src/stores/user-store.ts`
- Create: `apps/desktop/src/renderer/src/stores/app-store.ts`
- Create: `apps/desktop/src/renderer/src/stores/account-store.ts`
- Create: `apps/desktop/src/renderer/src/stores/transaction-store.ts`
- Create: `apps/desktop/src/renderer/src/stores/snapshot-store.ts`
- Create: `apps/desktop/src/renderer/src/stores/scenario-store.ts`
- Create: `apps/desktop/src/renderer/src/stores/index.ts`

### Step 2.1: 创建 app-store

- [ ] **创建 `apps/desktop/src/renderer/src/stores/app-store.ts`**

```typescript
// 应用全局状态管理 / App global state management
// 承载当前用户、初始化标志、全局加载/错误

import { create } from 'zustand';
import type { User } from '@shared/types/index.js';
import { dataAccess } from '../data/data-access.js';

interface AppStore {
  currentUser: User | null;
  initialized: boolean;
  loading: boolean;
  error: string | null;

  initialize: () => Promise<void>;
  completeOnboarding: (user: User) => void;
  setCurrentUser: (user: User | null) => void;
  clearError: () => void;
}

export const useAppStore = create<AppStore>((set) => ({
  currentUser: null,
  initialized: false,
  loading: false,
  error: null,

  initialize: async () => {
    set({ loading: true, error: null });
    try {
      const user = await dataAccess.getFirstUser();
      if (user) {
        set({ currentUser: user, initialized: true, loading: false });
      } else {
        set({ initialized: false, loading: false });
      }
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  completeOnboarding: (user) => {
    set({ currentUser: user, initialized: true, error: null });
  },

  setCurrentUser: (user) => set({ currentUser: user }),

  clearError: () => set({ error: null }),
}));
```

### Step 2.2: 创建 account-store

- [ ] **创建 `apps/desktop/src/renderer/src/stores/account-store.ts`**

```typescript
// 账户状态管理 / Account state management

import { create } from 'zustand';
import type { Account } from '@shared/types/index.js';
import type { CreateAccountInput } from '@shared/models/account.js';
import { dataAccess } from '../data/data-access.js';

interface AccountStore {
  accounts: Account[];
  loading: boolean;
  error: string | null;

  fetchAccounts: (userId: string) => Promise<void>;
  createAccount: (input: CreateAccountInput, userId: string) => Promise<void>;
  softDeleteAccount: (id: string, userId: string) => Promise<void>;
  clear: () => void;
}

export const useAccountStore = create<AccountStore>((set) => ({
  accounts: [],
  loading: false,
  error: null,

  fetchAccounts: async (userId) => {
    set({ loading: true, error: null });
    try {
      const accounts = await dataAccess.getAccounts(userId);
      set({ accounts, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  createAccount: async (input, userId) => {
    set({ loading: true, error: null });
    try {
      await dataAccess.createAccount(input);
      const accounts = await dataAccess.getAccounts(userId);
      set({ accounts, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  softDeleteAccount: async (id, userId) => {
    set({ loading: true, error: null });
    try {
      await dataAccess.softDeleteAccount(id);
      const accounts = await dataAccess.getAccounts(userId);
      set({ accounts, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  clear: () => set({ accounts: [], error: null, loading: false }),
}));
```

### Step 2.3: 创建 transaction-store

- [ ] **创建 `apps/desktop/src/renderer/src/stores/transaction-store.ts`**

```typescript
// 交易状态管理 / Transaction state management
// 写操作后自动刷新交易列表 + 联动刷新账户列表

import { create } from 'zustand';
import type { Transaction } from '@shared/types/index.js';
import type { CreateTransactionInput, EditTransactionInput } from '@shared/services/transaction-service.js';
import { dataAccess } from '../data/data-access.js';
import { useAccountStore } from './account-store.js';

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

export const useTransactionStore = create<TransactionStore>((set) => ({
  transactions: [],
  loading: false,
  error: null,

  fetchTransactions: async (userId) => {
    set({ loading: true, error: null });
    try {
      const transactions = await dataAccess.getTransactionsByUser(userId);
      set({ transactions, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  createTransaction: async (input, userId) => {
    set({ loading: true, error: null });
    try {
      await dataAccess.createTransaction(input);
      const transactions = await dataAccess.getTransactionsByUser(userId);
      set({ transactions, loading: false });
      // 联动刷新账户列表（交易影响余额）
      useAccountStore.getState().fetchAccounts(userId);
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  editTransaction: async (id, input, userId) => {
    set({ loading: true, error: null });
    try {
      await dataAccess.editTransaction(id, input);
      const transactions = await dataAccess.getTransactionsByUser(userId);
      set({ transactions, loading: false });
      useAccountStore.getState().fetchAccounts(userId);
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  deleteTransaction: async (id, userId) => {
    set({ loading: true, error: null });
    try {
      await dataAccess.deleteTransaction(id);
      const transactions = await dataAccess.getTransactionsByUser(userId);
      set({ transactions, loading: false });
      useAccountStore.getState().fetchAccounts(userId);
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  clear: () => set({ transactions: [], error: null, loading: false }),
}));
```

### Step 2.4: 创建 snapshot-store

- [ ] **创建 `apps/desktop/src/renderer/src/stores/snapshot-store.ts`**

```typescript
// 净资产快照状态管理 / Net worth snapshot state management

import { create } from 'zustand';
import type { NetWorthSnapshot } from '@shared/types/index.js';
import { dataAccess } from '../data/data-access.js';

interface SnapshotStore {
  snapshots: NetWorthSnapshot[];
  loading: boolean;
  error: string | null;

  fetchSnapshots: (userId: string) => Promise<void>;
  generateMonthly: (userId: string) => Promise<NetWorthSnapshot | null>;
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

  generateMonthly: async (userId) => {
    set({ loading: true, error: null });
    try {
      const snapshot = await dataAccess.generateMonthlySnapshot(userId);
      const snapshots = await dataAccess.getSnapshots(userId);
      set({ snapshots, loading: false });
      return snapshot;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      return null;
    }
  },

  clear: () => set({ snapshots: [], error: null, loading: false }),
}));
```

### Step 2.5: 创建 scenario-store

- [ ] **创建 `apps/desktop/src/renderer/src/stores/scenario-store.ts`**

```typescript
// FIRE 场景状态管理 / FIRE scenario state management

import { create } from 'zustand';
import type { FireScenario } from '@shared/types/index.js';
import type { CreateScenarioInput } from '@shared/models/scenario.js';
import { dataAccess } from '../data/data-access.js';

interface ScenarioStore {
  scenarios: FireScenario[];
  loading: boolean;
  error: string | null;

  fetchScenarios: (userId: string) => Promise<void>;
  createScenario: (input: CreateScenarioInput, userId: string) => Promise<void>;
  updateScenario: (id: string, updates: Partial<FireScenario>, userId: string) => Promise<void>;
  clear: () => void;
}

export const useScenarioStore = create<ScenarioStore>((set) => ({
  scenarios: [],
  loading: false,
  error: null,

  fetchScenarios: async (userId) => {
    set({ loading: true, error: null });
    try {
      const scenarios = await dataAccess.getScenarios(userId);
      set({ scenarios, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  createScenario: async (input, userId) => {
    set({ loading: true, error: null });
    try {
      await dataAccess.createScenario(input);
      const scenarios = await dataAccess.getScenarios(userId);
      set({ scenarios, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  updateScenario: async (id, updates, userId) => {
    set({ loading: true, error: null });
    try {
      await dataAccess.updateScenario(id, updates);
      const scenarios = await dataAccess.getScenarios(userId);
      set({ scenarios, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  clear: () => set({ scenarios: [], error: null, loading: false }),
}));
```

### Step 2.6: 创建 stores/index.ts 统一导出

- [ ] **创建 `apps/desktop/src/renderer/src/stores/index.ts`**

```typescript
// Store 统一导出 / Store barrel export

export { useAppStore } from './app-store.js';
export { useAccountStore } from './account-store.js';
export { useTransactionStore } from './transaction-store.js';
export { useSnapshotStore } from './snapshot-store.js';
export { useScenarioStore } from './scenario-store.js';
export { useToastStore } from './toast-store.js';
```

> **注**：`toast-store.ts` 将在 Task 4 Step 4.1 创建。此处的导出在 Task 4 完成后才能通过类型检查。如果 Task 2 和 Task 4 之间需要独立验证，可先注释掉 toast-store 导出行，Task 4 完成后取消注释。

### Step 2.7: 删除 user-store.ts

- [ ] **删除 `apps/desktop/src/renderer/src/stores/user-store.ts`**

```bash
rm /workspace/FIRE\ APP/apps/desktop/src/renderer/src/stores/user-store.ts
```

### Step 2.8: 类型检查 + 提交

- [ ] **运行 desktop 渲染进程类型检查**

Run: `cd /workspace/FIRE\ APP/apps/desktop && npx tsc --noEmit -p tsconfig.json`

Expected: 可能有 `toast-store` 导入错误（Task 4 才创建）。如果报错，临时在 `stores/index.ts` 中注释掉 toast-store 导出行。其余应无错误。

- [ ] **提交**

```bash
cd /workspace/FIRE\ APP
git add apps/desktop/src/renderer/src/stores/
git rm apps/desktop/src/renderer/src/stores/user-store.ts
git commit -m "feat(milestone2): 重构状态层为 5 个 Zustand Store

- 新增 app-store（当前用户 + 初始化状态）
- 新增 account-store（账户列表 + CRUD）
- 新增 transaction-store（交易列表 + CRUD + 联动刷新账户）
- 新增 snapshot-store（净资产快照）
- 新增 scenario-store（FIRE 场景）
- 新增 stores/index.ts 统一导出
- 删除临时的 user-store.ts"
```

---

## Task 3: 路由层（createHashRouter + 守卫）

**目标:** 建立 6 条路由 + RequireInit 守卫，重构 App.tsx。

**Files:**
- Create: `apps/desktop/src/renderer/src/router/RequireInit.tsx`
- Create: `apps/desktop/src/renderer/src/router/index.tsx`
- Modify: `apps/desktop/src/renderer/src/App.tsx`
- Create: `apps/desktop/src/renderer/src/pages/DashboardPage.tsx`
- Create: `apps/desktop/src/renderer/src/pages/AccountsPage.tsx`
- Create: `apps/desktop/src/renderer/src/pages/TransactionsPage.tsx`
- Create: `apps/desktop/src/renderer/src/pages/NetWorthPage.tsx`
- Create: `apps/desktop/src/renderer/src/pages/FireCalculatorPage.tsx`

> **依赖说明**：路由配置引用了 `AppLayout`（Task 4 创建）和 `OnboardingPage`（Task 5 创建）。在 Task 3 完成时，这两个文件尚未创建，类型检查会报错。解决方案：Task 3 先创建路由文件，但类型检查在 Task 5 完成后统一执行。或者，Task 3 可临时创建 `AppLayout` 和 `OnboardingPage` 的最小占位版本，Task 4/5 再替换为完整实现。本计划采用后者。

### Step 3.1: 创建 RequireInit 守卫

- [ ] **创建 `apps/desktop/src/renderer/src/router/RequireInit.tsx`**

```typescript
// 路由守卫：未初始化时重定向到 /onboarding
// Route guard: redirect to /onboarding if not initialized

import { Navigate, Outlet } from 'react-router-dom';
import { useAppStore } from '../stores/app-store.js';

export function RequireInit() {
  const initialized = useAppStore((s) => s.initialized);

  if (!initialized) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}
```

### Step 3.2: 创建 4 个占位页面 + DashboardPage

- [ ] **创建 `apps/desktop/src/renderer/src/pages/AccountsPage.tsx`**

```typescript
// 账户管理页（占位） / Accounts page (placeholder)

export function AccountsPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900">账户管理</h1>
      <p className="text-gray-500 mt-2">即将在里程碑 3 实现</p>
    </div>
  );
}
```

- [ ] **创建 `apps/desktop/src/renderer/src/pages/TransactionsPage.tsx`**

```typescript
// 交易记录页（占位） / Transactions page (placeholder)

export function TransactionsPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900">交易记录</h1>
      <p className="text-gray-500 mt-2">即将在里程碑 4 实现</p>
    </div>
  );
}
```

- [ ] **创建 `apps/desktop/src/renderer/src/pages/NetWorthPage.tsx`**

```typescript
// 净资产趋势页（占位） / Net worth page (placeholder)

export function NetWorthPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900">净资产趋势</h1>
      <p className="text-gray-500 mt-2">即将在里程碑 5 实现</p>
    </div>
  );
}
```

- [ ] **创建 `apps/desktop/src/renderer/src/pages/FireCalculatorPage.tsx`**

```typescript
// FIRE 计算器页（占位） / FIRE calculator page (placeholder)

export function FireCalculatorPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900">FIRE 计算器</h1>
      <p className="text-gray-500 mt-2">即将在里程碑 6 实现</p>
    </div>
  );
}
```

- [ ] **创建 `apps/desktop/src/renderer/src/pages/DashboardPage.tsx`**

```typescript
// 仪表盘页（简单占位） / Dashboard page (simple placeholder)

import { useAppStore } from '../stores/app-store.js';

export function DashboardPage() {
  const currentUser = useAppStore((s) => s.currentUser);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900">仪表盘</h1>
      <div className="mt-4 bg-white rounded-lg shadow-sm p-6">
        <p className="text-gray-700">
          欢迎回来，{currentUser?.display_name ?? '用户'}！
        </p>
        <p className="text-gray-500 mt-2 text-sm">
          各功能模块将在后续里程碑逐步开放。
        </p>
      </div>
    </div>
  );
}
```

### Step 3.3: 创建临时占位的 AppLayout 和 OnboardingPage

> 这两个文件在 Task 4/5 会被完整版本替换。此处创建最小占位版本以通过类型检查。

- [ ] **创建临时 `apps/desktop/src/renderer/src/components/layout/AppLayout.tsx`**

```typescript
// 临时占位 AppLayout（Task 4 替换为完整版本）
import { Outlet } from 'react-router-dom';

export function AppLayout() {
  return (
    <div className="flex h-screen bg-gray-50">
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **创建临时 `apps/desktop/src/renderer/src/pages/OnboardingPage.tsx`**

```typescript
// 临时占位 OnboardingPage（Task 5 替换为完整版本）
import { useNavigate } from 'react-router-dom';

export function OnboardingPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">FIRE 计算APP</h1>
        <p className="text-gray-500 mt-2">Onboarding 向导将在 Task 5 实现</p>
        <button
          onClick={() => navigate('/')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          临时跳转
        </button>
      </div>
    </div>
  );
}
```

### Step 3.4: 创建路由配置

- [ ] **创建 `apps/desktop/src/renderer/src/router/index.tsx`**

```typescript
// 应用路由配置 / App router configuration

import { createHashRouter, Navigate } from 'react-router-dom';
import { RequireInit } from './RequireInit.js';
import { AppLayout } from '../components/layout/AppLayout.js';
import { OnboardingPage } from '../pages/OnboardingPage.js';
import { DashboardPage } from '../pages/DashboardPage.js';
import { AccountsPage } from '../pages/AccountsPage.js';
import { TransactionsPage } from '../pages/TransactionsPage.js';
import { NetWorthPage } from '../pages/NetWorthPage.js';
import { FireCalculatorPage } from '../pages/FireCalculatorPage.js';

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

### Step 3.5: 重构 App.tsx

- [ ] **替换 `apps/desktop/src/renderer/src/App.tsx` 全部内容**

```typescript
// 应用根组件：挂载 RouterProvider + 启动时初始化 app-store
// App root: mount RouterProvider + initialize app-store on startup

import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router/index.js';
import { useAppStore } from './stores/app-store.js';

export default function App() {
  const initialize = useAppStore((s) => s.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return <RouterProvider router={router} />;
}
```

### Step 3.6: 类型检查 + 提交

- [ ] **运行 desktop 渲染进程类型检查**

Run: `cd /workspace/FIRE\ APP/apps/desktop && npx tsc --noEmit -p tsconfig.json`

Expected: 无错误（临时占位的 AppLayout 和 OnboardingPage 已创建）

- [ ] **提交**

```bash
cd /workspace/FIRE\ APP
git add apps/desktop/src/renderer/src/router/ apps/desktop/src/renderer/src/App.tsx
git add apps/desktop/src/renderer/src/pages/DashboardPage.tsx apps/desktop/src/renderer/src/pages/AccountsPage.tsx
git add apps/desktop/src/renderer/src/pages/TransactionsPage.tsx apps/desktop/src/renderer/src/pages/NetWorthPage.tsx
git add apps/desktop/src/renderer/src/pages/FireCalculatorPage.tsx
git add apps/desktop/src/renderer/src/components/layout/AppLayout.tsx apps/desktop/src/renderer/src/pages/OnboardingPage.tsx
git commit -m "feat(milestone2): 建立路由层 createHashRouter + RequireInit 守卫

- 新增 RequireInit 路由守卫（未初始化重定向到 /onboarding）
- 新增 router/index.tsx 路由配置（6 条路由）
- 重构 App.tsx 为 RouterProvider + 启动时初始化
- 新增 DashboardPage + 4 个占位页面
- 临时占位 AppLayout 和 OnboardingPage（Task 4/5 替换）"
```

---

## Task 4: UI 组件（14 个组件 + toast-store）

**目标:** 交付 14 个组件 + toast-store，对齐 UI/UX 设计文档视觉规范。

**Files:**
- Create: `apps/desktop/src/renderer/src/stores/toast-store.ts`
- Replace: `apps/desktop/src/renderer/src/components/layout/AppLayout.tsx`
- Create: `apps/desktop/src/renderer/src/components/layout/Sidebar.tsx`
- Create: `apps/desktop/src/renderer/src/components/layout/PageHeader.tsx`
- Create: `apps/desktop/src/renderer/src/components/base/Button.tsx`
- Create: `apps/desktop/src/renderer/src/components/base/Input.tsx`
- Create: `apps/desktop/src/renderer/src/components/base/Select.tsx`
- Create: `apps/desktop/src/renderer/src/components/base/Table.tsx`
- Create: `apps/desktop/src/renderer/src/components/base/Card.tsx`
- Create: `apps/desktop/src/renderer/src/components/base/Modal.tsx`
- Create: `apps/desktop/src/renderer/src/components/base/ConfirmDialog.tsx`
- Create: `apps/desktop/src/renderer/src/components/base/Tag.tsx`
- Create: `apps/desktop/src/renderer/src/components/base/ChartContainer.tsx`
- Create: `apps/desktop/src/renderer/src/components/auxiliary/Toast.tsx`
- Create: `apps/desktop/src/renderer/src/components/auxiliary/EmptyState.tsx`

### Step 4.1: 创建 toast-store

- [ ] **创建 `apps/desktop/src/renderer/src/stores/toast-store.ts`**

```typescript
// Toast 通知状态管理 / Toast notification state management

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration: number;
}

interface ToastStore {
  toasts: ToastItem[];
  show: (type: ToastItem['type'], message: string, duration?: number) => void;
  showSuccess: (message: string, duration?: number) => void;
  showError: (message: string, duration?: number) => void;
  showWarning: (message: string, duration?: number) => void;
  showInfo: (message: string, duration?: number) => void;
  remove: (id: string) => void;
  clear: () => void;
}

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],

  show: (type, message, duration = 3000) => {
    const id = uuidv4();
    set((state) => ({ toasts: [...state.toasts, { id, type, message, duration }] }));
    if (duration > 0) {
      setTimeout(() => {
        get().remove(id);
      }, duration);
    }
  },

  showSuccess: (message, duration) => get().show('success', message, duration),
  showError: (message, duration) => get().show('error', message, duration),
  showWarning: (message, duration) => get().show('warning', message, duration),
  showInfo: (message, duration) => get().show('info', message, duration),

  remove: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));
```

### Step 4.2: 创建 3 个布局组件

- [ ] **替换 `apps/desktop/src/renderer/src/components/layout/AppLayout.tsx`（删除占位版本，写完整版本）**

```typescript
// 应用主布局：侧边栏 + 内容区 + Toast
// App layout: sidebar + content area + toast

import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar.js';
import { Toast } from '../auxiliary/Toast.js';

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

- [ ] **创建 `apps/desktop/src/renderer/src/components/layout/Sidebar.tsx`**

```typescript
// 侧边栏导航 / Sidebar navigation

import { NavLink } from 'react-router-dom';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: '仪表盘',
    path: '/',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    label: '账户管理',
    path: '/accounts',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
  {
    label: '交易记录',
    path: '/transactions',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    label: '净资产趋势',
    path: '/net-worth',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
  {
    label: 'FIRE 计算器',
    path: '/fire-calculator',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
];

export function Sidebar() {
  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="h-16 flex items-center justify-center border-b border-gray-200">
        <h1 className="text-lg font-bold text-gray-900">FIRE 计算APP</h1>
      </div>
      <nav className="flex-1 py-4">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-600 border-r-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
```

- [ ] **创建 `apps/desktop/src/renderer/src/components/layout/PageHeader.tsx`**

```typescript
// 页面头部 / Page header

import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  extra?: ReactNode;
}

export function PageHeader({ title, subtitle, extra }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between px-8 py-6 border-b border-gray-200">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {extra && <div className="flex items-center gap-2">{extra}</div>}
    </div>
  );
}
```

### Step 4.3: 创建 9 个基础组件

- [ ] **创建 `apps/desktop/src/renderer/src/components/base/Button.tsx`**

```typescript
// 按钮组件 / Button component

import type { ReactNode, MouseEvent } from 'react';

interface ButtonProps {
  variant: 'primary' | 'secondary' | 'danger';
  size: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonProps['variant'], string> = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white',
  secondary: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  danger: 'bg-red-500 hover:bg-red-600 text-white',
};

const SIZE_CLASSES: Record<ButtonProps['size'], string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

export function Button({ variant, size, loading, disabled, icon, onClick, children }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]}`}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {!loading && icon}
      {children}
    </button>
  );
}
```

- [ ] **创建 `apps/desktop/src/renderer/src/components/base/Input.tsx`**

```typescript
// 输入框组件 / Input component

interface InputProps {
  type: 'text' | 'number' | 'date';
  label?: string;
  value: string | number;
  error?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  prefix?: string;
  suffix?: string;
  onChange?: (value: string) => void;
}

export function Input({ type, label, value, error, placeholder, required, disabled, prefix, suffix, onChange }: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{prefix}</span>
        )}
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.value)}
          className={`w-full h-10 rounded-md border bg-white px-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed ${
            prefix ? 'pl-8' : ''
          } ${suffix ? 'pr-8' : ''} ${error ? 'border-red-300' : 'border-gray-300'}`}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{suffix}</span>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
```

- [ ] **创建 `apps/desktop/src/renderer/src/components/base/Select.tsx`**

```typescript
// 下拉选择组件 / Select component

interface SelectOption {
  label: string;
  value: string;
}

interface SelectProps {
  options: SelectOption[];
  value: string;
  label?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  onChange?: (value: string) => void;
}

export function Select({ options, value, label, error, required, disabled, placeholder, onChange }: SelectProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.value)}
        className={`w-full h-10 rounded-md border bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed ${
          error ? 'border-red-300' : 'border-gray-300'
        }`}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
```

- [ ] **创建 `apps/desktop/src/renderer/src/components/base/Table.tsx`**

```typescript
// 表格组件 / Table component

import type { ReactNode } from 'react';

export interface TableColumn<T> {
  key: string;
  title: string;
  render?: (record: T) => ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  loading?: boolean;
  emptyText?: string;
  onRowClick?: (record: T) => void;
}

export function Table<T extends { id?: string }>({ columns, data, loading, emptyText = '暂无数据', onRowClick }: TableProps<T>) {
  const alignClass = (align?: string) => {
    switch (align) {
      case 'center': return 'text-center';
      case 'right': return 'text-right';
      default: return 'text-left';
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400">
        加载中...
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-sm font-medium text-gray-600 ${alignClass(col.align)}`}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((record, index) => (
            <tr
              key={record.id ?? index}
              onClick={() => onRowClick?.(record)}
              className={`border-b border-gray-100 last:border-0 ${onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}`}
            >
              {columns.map((col) => (
                <td key={col.key} className={`px-4 py-3 text-sm text-gray-900 ${alignClass(col.align)}`}>
                  {col.render ? col.render(record) : (record as Record<string, unknown>)[col.key] as ReactNode}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **创建 `apps/desktop/src/renderer/src/components/base/Card.tsx`**

```typescript
// 卡片组件 / Card component

import type { ReactNode } from 'react';

interface CardProps {
  title?: string;
  extra?: ReactNode;
  children: ReactNode;
  padding?: boolean;
}

export function Card({ title, extra, children, padding = true }: CardProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {(title || extra) && (
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          {title && <h3 className="text-base font-semibold text-gray-900">{title}</h3>}
          {extra}
        </div>
      )}
      <div className={padding ? 'p-6' : ''}>{children}</div>
    </div>
  );
}
```

- [ ] **创建 `apps/desktop/src/renderer/src/components/base/Modal.tsx`**

```typescript
// 模态弹窗组件 / Modal component

import type { ReactNode } from 'react';
import { useEffect } from 'react';

interface ModalProps {
  open: boolean;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  width?: number;
}

export function Modal({ open, title, children, footer, onClose, width = 480 }: ModalProps) {
  useEffect(() => {
    if (open) {
      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black opacity-40" onClick={onClose} />
      <div
        className="relative bg-white rounded-lg shadow-lg"
        style={{ width: `${width}px` }}
      >
        {title && (
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          </div>
        )}
        <div className="px-6 py-4">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **创建 `apps/desktop/src/renderer/src/components/base/ConfirmDialog.tsx`**

```typescript
// 确认对话框组件 / Confirm dialog component

import { Modal } from './Modal.js';
import { Button } from './Button.js';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'primary' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  variant = 'primary',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      width={400}
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onCancel}>
            {cancelText}
          </Button>
          <Button variant={variant === 'danger' ? 'danger' : 'primary'} size="md" onClick={onConfirm}>
            {confirmText}
          </Button>
        </>
      }
    >
      <p className="text-sm text-gray-700">{message}</p>
    </Modal>
  );
}
```

- [ ] **创建 `apps/desktop/src/renderer/src/components/base/Tag.tsx`**

```typescript
// 标签组件 / Tag component

import type { ReactNode } from 'react';

interface TagProps {
  color: 'blue' | 'green' | 'red' | 'amber' | 'gray';
  children: ReactNode;
}

const COLOR_CLASSES: Record<TagProps['color'], string> = {
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  gray: 'bg-gray-50 text-gray-700 border-gray-200',
};

export function Tag({ color, children }: TagProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${COLOR_CLASSES[color]}`}>
      {children}
    </span>
  );
}
```

- [ ] **创建 `apps/desktop/src/renderer/src/components/base/ChartContainer.tsx`**

```typescript
// 图表容器组件 / Chart container component

import type { ReactNode } from 'react';

interface ChartContainerProps {
  loading?: boolean;
  empty?: boolean;
  error?: string | null;
  height?: number;
  children: ReactNode;
  emptyText?: string;
}

export function ChartContainer({ loading, empty, error, height = 300, children, emptyText = '暂无数据' }: ChartContainerProps) {
  const containerStyle = { height: `${height}px` };

  if (loading) {
    return (
      <div className="flex items-center justify-center bg-white rounded-lg border border-gray-200" style={containerStyle}>
        <span className="text-gray-400 text-sm">加载中...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center bg-white rounded-lg border border-red-200" style={containerStyle}>
        <span className="text-red-500 text-sm">{error}</span>
      </div>
    );
  }

  if (empty) {
    return (
      <div className="flex items-center justify-center bg-white rounded-lg border border-gray-200" style={containerStyle}>
        <span className="text-gray-400 text-sm">{emptyText}</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4" style={containerStyle}>
      {children}
    </div>
  );
}
```

### Step 4.4: 创建 2 个辅助组件

- [ ] **创建 `apps/desktop/src/renderer/src/components/auxiliary/Toast.tsx`**

```typescript
// Toast 通知组件 / Toast notification component

import { useToastStore } from '../../stores/toast-store.js';
import type { ToastItem } from '../../stores/toast-store.js';

const TYPE_CLASSES: Record<ToastItem['type'], string> = {
  success: 'bg-emerald-600 text-white',
  error: 'bg-red-500 text-white',
  warning: 'bg-amber-500 text-white',
  info: 'bg-blue-600 text-white',
};

const TYPE_ICONS: Record<ToastItem['type'], string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

export function Toast() {
  const toasts = useToastStore((s) => s.toasts);
  const remove = useToastStore((s) => s.remove);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-2 px-4 py-3 rounded-md shadow-lg min-w-64 ${TYPE_CLASSES[toast.type]}`}
        >
          <span className="font-bold">{TYPE_ICONS[toast.type]}</span>
          <span className="text-sm flex-1">{toast.message}</span>
          <button
            onClick={() => remove(toast.id)}
            className="text-white opacity-70 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **创建 `apps/desktop/src/renderer/src/components/auxiliary/EmptyState.tsx`**

```typescript
// 空状态占位组件 / Empty state component

import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon && <div className="mb-4 text-gray-300">{icon}</div>}
      <h3 className="text-base font-medium text-gray-900">{title}</h3>
      {description && <p className="mt-1 text-sm text-gray-500 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
```

### Step 4.5: 类型检查 + 提交

- [ ] **运行 desktop 渲染进程类型检查**

Run: `cd /workspace/FIRE\ APP/apps/desktop && npx tsc --noEmit -p tsconfig.json`

Expected: 无错误（所有组件和 toast-store 已创建）

- [ ] **提交**

```bash
cd /workspace/FIRE\ APP
git add apps/desktop/src/renderer/src/stores/toast-store.ts
git add apps/desktop/src/renderer/src/components/
git commit -m "feat(milestone2): 交付 14 个 UI 组件 + toast-store

- 新增 toast-store（Toast 配套状态管理）
- 新增 3 个布局组件：AppLayout、Sidebar、PageHeader
- 新增 9 个基础组件：Button、Input、Select、Table、Card、Modal、ConfirmDialog、Tag、ChartContainer
- 新增 2 个辅助组件：Toast、EmptyState
- 替换临时占位 AppLayout 为完整版本"
```

---

## Task 5: 功能页面（Onboarding + Dashboard 闭环）

**目标:** 实现 5 步 Onboarding 向导，删除 TestPage。

**Files:**
- Replace: `apps/desktop/src/renderer/src/pages/OnboardingPage.tsx`
- Delete: `apps/desktop/src/renderer/src/pages/TestPage.tsx`

### Step 5.1: 实现 OnboardingPage 完整版本

- [ ] **替换 `apps/desktop/src/renderer/src/pages/OnboardingPage.tsx` 全部内容**

```typescript
// Onboarding 向导页 / Onboarding wizard page
// 5 步引导：欢迎 → 显示名称 → 市场选择 → 利率偏好 → 确认完成

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/base/Button.js';
import { Input } from '../components/base/Input.js';
import { dataAccess } from '../data/data-access.js';
import { useAppStore } from '../stores/app-store.js';
import { useToastStore } from '../stores/toast-store.js';

interface OnboardingFormData {
  display_name: string;
  is_china_market: number;
  default_withdrawal_rate: number;
  default_expected_return: number;
  default_inflation_rate: number;
}

const MARKET_DEFAULTS = {
  china: { withdrawal: 350, expected: 700, inflation: 300, currency: 'CNY' },
  global: { withdrawal: 400, expected: 700, inflation: 300, currency: 'USD' },
};

export function OnboardingPage() {
  const navigate = useNavigate();
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  const showSuccess = useToastStore((s) => s.showSuccess);
  const showError = useToastStore((s) => s.showError);

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<OnboardingFormData>({
    display_name: '',
    is_china_market: 1,
    default_withdrawal_rate: 350,
    default_expected_return: 700,
    default_inflation_rate: 300,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof OnboardingFormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  const updateField = <K extends keyof OnboardingFormData>(field: K, value: OnboardingFormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleMarketChange = (isChina: number) => {
    const defaults = isChina ? MARKET_DEFAULTS.china : MARKET_DEFAULTS.global;
    setFormData((prev) => ({
      ...prev,
      is_china_market: isChina,
      default_withdrawal_rate: defaults.withdrawal,
      default_expected_return: defaults.expected,
      default_inflation_rate: defaults.inflation,
    }));
  };

  const validateStep = (stepNum: number): boolean => {
    const newErrors: Partial<Record<keyof OnboardingFormData, string>> = {};

    if (stepNum === 2) {
      const name = formData.display_name.trim();
      if (!name) {
        newErrors.display_name = '请输入显示名称';
      } else if (name.length > 20) {
        newErrors.display_name = '显示名称不能超过 20 字符';
      }
    }

    if (stepNum === 4) {
      if (formData.default_withdrawal_rate < 200 || formData.default_withdrawal_rate > 600) {
        newErrors.default_withdrawal_rate = '提现率范围为 200-600 基点';
      }
      if (formData.default_expected_return < 0 || formData.default_expected_return > 2000) {
        newErrors.default_expected_return = '预期回报范围为 0-2000 基点';
      }
      if (formData.default_inflation_rate < 0 || formData.default_inflation_rate > 1000) {
        newErrors.default_inflation_rate = '通胀率范围为 0-1000 基点';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((s) => Math.min(s + 1, 5));
    }
  };

  const handlePrev = () => {
    setStep((s) => Math.max(s - 1, 1));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const user = await dataAccess.createUser({
        display_name: formData.display_name.trim(),
        is_china_market: formData.is_china_market,
        base_currency: formData.is_china_market ? 'CNY' : 'USD',
        default_withdrawal_rate: formData.default_withdrawal_rate,
        default_expected_return: formData.default_expected_return,
        default_inflation_rate: formData.default_inflation_rate,
      });

      await dataAccess.seedCategories(user.id);

      completeOnboarding(user);
      showSuccess('账户创建成功，欢迎使用 FIRE 计算APP！');
      navigate('/');
    } catch (err) {
      showError(`创建失败：${(err as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-lg bg-white rounded-lg shadow-sm p-8">
        {/* 步骤进度条 */}
        <div className="flex items-center justify-center mb-8">
          {[1, 2, 3, 4, 5].map((s, i) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  s <= step ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'
                }`}
              >
                {s}
              </div>
              {i < 4 && <div className={`w-12 h-0.5 ${s < step ? 'bg-blue-600' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        {/* 步骤 1: 欢迎页 */}
        {step === 1 && (
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">FIRE 计算APP</h1>
            <p className="text-gray-600 mb-2"> Financial Independence, Retire Early</p>
            <p className="text-sm text-gray-500 mb-8">
              帮助你规划财务自由之路，从记账到退休投影，一站式管理你的 FIRE 旅程。
            </p>
            <Button variant="primary" size="lg" onClick={handleNext}>
              开始使用
            </Button>
          </div>
        )}

        {/* 步骤 2: 输入显示名称 */}
        {step === 2 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">输入显示名称</h2>
            <Input
              type="text"
              label="显示名称"
              value={formData.display_name}
              error={errors.display_name}
              placeholder="例如：张三"
              required
              onChange={(v) => updateField('display_name', v)}
            />
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="secondary" size="md" onClick={handlePrev}>上一步</Button>
              <Button variant="primary" size="md" onClick={handleNext}>下一步</Button>
            </div>
          </div>
        )}

        {/* 步骤 3: 选择市场 */}
        {step === 3 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">选择市场</h2>
            <p className="text-sm text-gray-500 mb-4">选择你的主要投资市场，影响默认利率偏好。</p>
            <div className="space-y-3">
              <label className={`flex items-center gap-3 p-4 rounded-md border cursor-pointer ${
                formData.is_china_market === 1 ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
              }`}>
                <input
                  type="radio"
                  name="market"
                  checked={formData.is_china_market === 1}
                  onChange={() => handleMarketChange(1)}
                  className="w-4 h-4"
                />
                <div>
                  <p className="font-medium text-gray-900">中国市场</p>
                  <p className="text-sm text-gray-500">货币：CNY，默认提现率 3.5%</p>
                </div>
              </label>
              <label className={`flex items-center gap-3 p-4 rounded-md border cursor-pointer ${
                formData.is_china_market === 0 ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
              }`}>
                <input
                  type="radio"
                  name="market"
                  checked={formData.is_china_market === 0}
                  onChange={() => handleMarketChange(0)}
                  className="w-4 h-4"
                />
                <div>
                  <p className="font-medium text-gray-900">全球市场</p>
                  <p className="text-sm text-gray-500">货币：USD，默认提现率 4%</p>
                </div>
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="secondary" size="md" onClick={handlePrev}>上一步</Button>
              <Button variant="primary" size="md" onClick={handleNext}>下一步</Button>
            </div>
          </div>
        )}

        {/* 步骤 4: 确认利率偏好 */}
        {step === 4 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">确认默认利率偏好</h2>
            <p className="text-sm text-gray-500 mb-4">以下为基于市场选择的默认值，可调整（单位：基点）。</p>
            <div className="space-y-4">
              <Input
                type="number"
                label="默认提现率"
                value={formData.default_withdrawal_rate}
                error={errors.default_withdrawal_rate}
                suffix="bps"
                onChange={(v) => updateField('default_withdrawal_rate', Number(v))}
              />
              <Input
                type="number"
                label="默认预期回报率"
                value={formData.default_expected_return}
                error={errors.default_expected_return}
                suffix="bps"
                onChange={(v) => updateField('default_expected_return', Number(v))}
              />
              <Input
                type="number"
                label="默认通胀率"
                value={formData.default_inflation_rate}
                error={errors.default_inflation_rate}
                suffix="bps"
                onChange={(v) => updateField('default_inflation_rate', Number(v))}
              />
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="secondary" size="md" onClick={handlePrev}>上一步</Button>
              <Button variant="primary" size="md" onClick={handleNext}>下一步</Button>
            </div>
          </div>
        )}

        {/* 步骤 5: 确认完成 */}
        {step === 5 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">确认信息</h2>
            <div className="space-y-3 bg-gray-50 rounded-md p-4">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">显示名称</span>
                <span className="text-sm font-medium text-gray-900">{formData.display_name.trim()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">市场</span>
                <span className="text-sm font-medium text-gray-900">
                  {formData.is_china_market ? '中国市场 (CNY)' : '全球市场 (USD)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">提现率</span>
                <span className="text-sm font-medium text-gray-900">{formData.default_withdrawal_rate} bps ({formData.default_withdrawal_rate / 100}%)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">预期回报率</span>
                <span className="text-sm font-medium text-gray-900">{formData.default_expected_return} bps ({formData.default_expected_return / 100}%)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">通胀率</span>
                <span className="text-sm font-medium text-gray-900">{formData.default_inflation_rate} bps ({formData.default_inflation_rate / 100}%)</span>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="secondary" size="md" onClick={handlePrev} disabled={submitting}>上一步</Button>
              <Button variant="primary" size="md" onClick={handleSubmit} loading={submitting}>
                完成创建
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

### Step 5.2: 删除 TestPage.tsx

- [ ] **删除 `apps/desktop/src/renderer/src/pages/TestPage.tsx`**

```bash
rm /workspace/FIRE\ APP/apps/desktop/src/renderer/src/pages/TestPage.tsx
```

### Step 5.3: 类型检查

- [ ] **运行 desktop 渲染进程类型检查**

Run: `cd /workspace/FIRE\ APP/apps/desktop && npx tsc --noEmit -p tsconfig.json`

Expected: 无错误

- [ ] **运行 desktop 主进程类型检查**

Run: `cd /workspace/FIRE\ APP/apps/desktop && npx tsc --noEmit -p tsconfig.node.json`

Expected: 无错误

- [ ] **运行 shared 包测试**

Run: `cd /workspace/FIRE\ APP && pnpm --filter @fire-app/shared test`

Expected: 所有测试通过

### Step 5.4: 端到端验证

- [ ] **首次启动验证（清空数据库）**

```bash
# 清空数据库（删除用户数据目录下的 fire.db）
rm -rf ~/Library/Application\ Support/fire-app/fire-app/data/  # macOS
# 或
rm -rf ~/.config/fire-app/fire-app/data/  # Linux
```

Run: `cd /workspace/FIRE\ APP && pnpm dev`

验证项：
1. 应用启动后自动跳转 `#/onboarding`
2. 步骤 1 显示欢迎页，点击"开始使用"进入步骤 2
3. 步骤 2 输入空名称，点击"下一步"显示错误"请输入显示名称"
4. 步骤 2 输入"测试用户"，点击"下一步"进入步骤 3
5. 步骤 3 选择"全球市场"，利率默认值变为 400/700/300
6. 步骤 4 输入提现率 100（超出范围），显示错误"提现率范围为 200-600 基点"
7. 步骤 4 改回 400，点击"下一步"进入步骤 5
8. 步骤 5 确认信息正确，点击"完成创建"
9. 显示成功 Toast"账户创建成功，欢迎使用 FIRE 计算APP！"
10. 自动跳转 `#/`，显示 DashboardPage，欢迎信息显示"测试用户"
11. 侧边栏 5 个导航项可点击切换，URL hash 变化正确

- [ ] **后续启动验证**

关闭应用后重新运行 `pnpm dev`，验证：
1. 自动跳转 `#/`（不进入 Onboarding）
2. DashboardPage 显示"测试用户"的欢迎信息

- [ ] **提交**

```bash
cd /workspace/FIRE\ APP
git add apps/desktop/src/renderer/src/pages/OnboardingPage.tsx
git rm apps/desktop/src/renderer/src/pages/TestPage.tsx
git commit -m "feat(milestone2): 实现 Onboarding 5 步向导 + 删除 TestPage

- 5 步向导：欢迎 → 显示名称 → 市场选择 → 利率偏好 → 确认完成
- 表单校验：显示名称非空+长度、利率范围校验
- 市场选择联动利率默认值（中国 350/全球 400）
- 完成提交：创建用户 + 种子分类 + 更新 app-store + 跳转主页
- 步骤进度条 + 上一步/下一步导航
- 删除里程碑 1 的 TestPage.tsx"
```

---

## 验证清单

完成所有 Task 后，执行以下最终验证：

- [ ] `pnpm --filter @fire-app/shared test` — 所有测试通过
- [ ] `cd packages/shared && npx tsc --noEmit` — shared 类型检查通过
- [ ] `cd apps/desktop && npx tsc --noEmit -p tsconfig.json` — 渲染进程类型检查通过
- [ ] `cd apps/desktop && npx tsc --noEmit -p tsconfig.node.json` — 主进程类型检查通过
- [ ] `pnpm dev` — 应用启动正常，主进程日志输出"已注册 36 个 IPC handler"
- [ ] 首次启动 → Onboarding 向导 → 完成 → Dashboard
- [ ] 后续启动 → 直接 Dashboard
- [ ] 侧边栏导航正常切换
- [ ] DevTools 执行 `window.dataAccess.user.getFirst()` 返回 User 对象

---

## Self-Review

### Spec coverage

| Spec 章节 | 对应 Task | 覆盖状态 |
|----------|----------|---------|
| 1.2 范围边界 - 36 个 IPC 通道 | Task 1 | ✓ |
| 1.2 范围边界 - DataAccessPort 接口 | Task 1 Step 1.10 | ✓ |
| 1.2 范围边界 - preload 扩展 | Task 1 Step 1.8 | ✓ |
| 1.2 范围边界 - ipc.d.ts 扩展 | Task 1 Step 1.9 | ✓ |
| 1.2 范围边界 - getTransactionsByUser | Task 1 Step 1.1-1.4 | ✓ |
| 1.2 范围边界 - 5 个 Store | Task 2 Step 2.1-2.5 | ✓ |
| 1.2 范围边界 - 删除 user-store | Task 2 Step 2.7 | ✓ |
| 1.2 范围边界 - createHashRouter | Task 3 Step 3.4 | ✓ |
| 1.2 范围边界 - RequireInit | Task 3 Step 3.1 | ✓ |
| 1.2 范围边界 - App.tsx 重构 | Task 3 Step 3.5 | ✓ |
| 1.2 范围边界 - 4 个占位页面 | Task 3 Step 3.2 | ✓ |
| 1.2 范围边界 - DashboardPage | Task 3 Step 3.2 | ✓ |
| 1.2 范围边界 - 14 个组件 | Task 4 Step 4.2-4.4 | ✓ |
| 1.2 范围边界 - OnboardingPage | Task 5 Step 5.1 | ✓ |
| 1.2 范围边界 - 删除 TestPage | Task 5 Step 5.2 | ✓ |
| 3.3 getTransactionsByUser | Task 1 Step 1.1-1.4 | ✓ |
| 3.5 IpcDataAccess | Task 1 Step 1.11 | ✓ |
| 3.6 IPC handler 按实体拆分 | Task 1 Step 1.5-1.7 | ✓ |
| 3.7 preload 36 方法 | Task 1 Step 1.8 | ✓ |
| 4.3 Store 设计 | Task 2 Step 2.1-2.5 | ✓ |
| 4.4 跨 Store 刷新 | Task 2 Step 2.3 (transaction-store 联动 account-store) | ✓ |
| 5.3 路由表 6 条路由 | Task 3 Step 3.4 | ✓ |
| 6.2 14 个组件 + toast-store | Task 4 Step 4.1-4.4 | ✓ |
| 7.3 Onboarding 5 步向导 | Task 5 Step 5.1 | ✓ |
| 7.4 市场默认值映射 | Task 5 Step 5.1 (MARKET_DEFAULTS) | ✓ |
| 7.6 步骤校验逻辑 | Task 5 Step 5.1 (validateStep) | ✓ |
| 7.7 完成提交流程 | Task 5 Step 5.1 (handleSubmit) | ✓ |

### Placeholder scan

无 TBD/TODO/待定。所有步骤包含完整代码。

### Type consistency

- `getTransactionsByUser(db, userId)` — Task 1 Step 1.3 定义，Task 1 Step 1.6 transaction-handlers 调用，签名一致 ✓
- `DataAccessPort` 接口 — Task 1 Step 1.10 定义，Task 1 Step 1.11 IpcDataAccess 实现，36 个方法签名一致 ✓
- `useAppStore` — Task 2 Step 2.1 定义 `completeOnboarding(user)`，Task 5 Step 5.1 调用 `completeOnboarding(user)`，签名一致 ✓
- `useToastStore` — Task 4 Step 4.1 定义 `showSuccess/showError`，Task 5 Step 5.1 调用 `showSuccess/showError`，签名一致 ✓
- `dataAccess.createUser` — Task 1 Step 1.11 定义，Task 5 Step 5.1 调用，签名一致 ✓
- `dataAccess.seedCategories` — Task 1 Step 1.11 定义，Task 5 Step 5.1 调用，签名一致 ✓
