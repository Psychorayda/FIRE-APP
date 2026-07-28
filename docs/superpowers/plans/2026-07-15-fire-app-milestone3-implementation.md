# FIRE APP 里程碑 3：账户管理页 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现账户管理页（AccountsPage），覆盖账户的新增、编辑、删除、查看与资产概览，补齐 `db:account:update` IPC 通道（第 37 个）。

**Architecture:** 数据层先 TDD 新增 `updateAccount` model 函数与 `EditAccountInput`，再沿 IPC 链（handler → preload → ipc.d.ts → DataAccessPort → IpcDataAccess → account-store）贯通编辑能力；前端按 `components/accounts/` 功能域拆分为 4 个新文件（account-constants、AccountOverviewCards、AccountListTable、AccountFormModal），由 AccountsPage 组合复用 M2 的 14 个基础组件，概览卡片在已加载的 `accounts` 数组上前端聚合。

**Tech Stack:** Electron 31 + electron-vite 2 + React 19 + Zustand 5 + better-sqlite3 11 + Tailwind CSS 4 + vitest 2（仅 shared 包）

**对应设计文档:** [2026-07-15-fire-app-milestone3-design.md](../specs/2026-07-15-fire-app-milestone3-design.md)

---

## 关键约定与口径

### 金额单位
- 数据库存储为**整数分**（cents），例如 `500000` 表示 5000 元。
- `@shared/utils/money.ts` 提供 `yuanToCents`（元→分，两阶段取整）与 `centsToYuan`（分→元）。
- 表单输入为**元**，提交时 `yuanToCents` 转分；展示时 `centsToYuan` 转元。
- 负债账户 `current_balance` 为负数（如 `-20000` 分 = -200 元）。

### 金额存储字段
- `CreateAccountInput.initial_balance` 与 `Account.current_balance` 均为**分**。
- `EditAccountInput` **不含**余额字段——余额由交易创建/编辑/删除自动维护，用户不可直接编辑。

### 验证命令（在仓库根目录 `/workspace/FIRE APP` 执行）
| 用途 | 命令 |
|------|------|
| shared model 测试 | `pnpm --filter @fire-app/shared test` |
| 渲染层 + preload 类型检查 | `pnpm --filter @fire-app/desktop exec tsc --noEmit -p tsconfig.json` |
| 主进程类型检查 | `pnpm --filter @fire-app/desktop exec tsc --noEmit -p tsconfig.node.json` |
| 桌面端构建 | `pnpm --filter @fire-app/desktop build` |

> 说明：`apps/desktop/tsconfig.json` 覆盖 `src/renderer/**` + `src/preload/**`；`tsconfig.node.json` 覆盖 `src/main/**`。两者均通过 `@shared/*` 路径别名引用 shared 源码。

---

## 与设计文档的偏差说明（实施前必读）

设计文档（spec）已获用户批准，但实施时发现 M2 基础组件 API 与 spec 部分描述存在冲突。本计划在**不修改 M2 任何基础组件**（spec §5.3 硬约束）的前提下，做以下偏差处理：

| # | spec 原文 | 冲突点 | 本计划处理 |
|---|----------|--------|-----------|
| 1 | §3.4 表格列"操作"用 `<Button variant="ghost" size="sm">` | M2 Button 无 `ghost` 变体（仅 primary/secondary/danger） | 编辑按钮用 `variant="secondary"`，删除按钮用 `variant="danger"`，均 `size="sm"` |
| 2 | §3.4 资产分类列用 `<Tag>` 带紫色/橙色 | M2 Tag 仅支持 blue/green/red/amber/gray，无 purple/orange | 改用原生 `<span>` 拼接 `ASSET_CLASS_CONFIG[cls].tagClass`（已是 raw Tailwind 类），视觉与 Tag 一致 |
| 3 | §3.4"点击表头切换排序" | M2 Table 的 `title` 为纯字符串，表头不可点击，且不得修改 Table | 改为表格上方一个排序 `<Select>`（默认顺序 / 名称升降序 / 余额升降序），数据排序逻辑不变 |
| 4 | §3.6 布局 `<PageHeader ... action={...}>` | M2 PageHeader Props 为 `extra`（无 `action`） | 使用 `extra={...}` |
| 5 | §3.5 AccountFormModalProps 未含 userId/loading | 表单需 `user_id` 才能构造完整 `CreateAccountInput`；提交按钮需 disabled 防重复提交（spec §4.4） | 新增 `userId?: string`（create 模式必填）与 `loading?: boolean` 两个 Props |

> 以上偏差均不改变 spec 的功能需求与交互流程，仅调整实现细节以适配 M2 组件实际 API。`onSubmit` 类型保持 spec 原样 `(input: CreateAccountInput \| EditAccountInput) => void`。

---

## 文件结构总览

### 新建文件（4 个，均在 `apps/desktop/src/renderer/src/components/accounts/`）
| 文件 | 职责 |
|------|------|
| `account-constants.ts` | ASSET_CLASS_CONFIG / ACCOUNT_TYPE_LABELS / Select 选项 / formatBalance / computeOverview |
| `AccountOverviewCards.tsx` | 5 张资产概览卡片（4 分类 + 净资产） |
| `AccountListTable.tsx` | 账户列表表格 + 排序 + 行操作 |
| `AccountFormModal.tsx` | 新增/编辑表单弹窗 |

### 修改文件（8 个）
| 文件 | 变更 | 所属 tsconfig |
|------|------|---------------|
| `packages/shared/src/models/account.ts` | 新增 `EditAccountInput` + `updateAccount` | （被两端引用） |
| `apps/desktop/src/main/ipc/account-handlers.ts` | 新增 `db:account:update` handler | tsconfig.node.json |
| `apps/desktop/src/preload/index.ts` | account 组新增 `update` | tsconfig.json |
| `apps/desktop/src/renderer/src/types/ipc.d.ts` | DataAccessAPI.account 新增 `update` 声明 | tsconfig.json |
| `apps/desktop/src/renderer/src/data/data-access-port.ts` | 新增 `updateAccount` 声明 | tsconfig.json |
| `apps/desktop/src/renderer/src/data/ipc-data-access.ts` | 新增 `updateAccount` 实现 | tsconfig.json |
| `apps/desktop/src/renderer/src/stores/account-store.ts` | 新增 `updateAccount` 方法 | tsconfig.json |
| `apps/desktop/src/renderer/src/pages/AccountsPage.tsx` | 替换 M2 占位页为完整实现 | tsconfig.json |

---

## Task 1: 数据层 — updateAccount model + IPC 链 + store

**目标:** TDD 新增 `updateAccount` model 函数，沿 IPC 链贯通到 store，提供编辑账户能力。

**Files:**
- Modify: `packages/shared/src/models/account.ts`
- Modify: `packages/shared/tests/models/account.test.ts`
- Modify: `apps/desktop/src/main/ipc/account-handlers.ts`
- Modify: `apps/desktop/src/preload/index.ts`
- Modify: `apps/desktop/src/renderer/src/types/ipc.d.ts`
- Modify: `apps/desktop/src/renderer/src/data/data-access-port.ts`
- Modify: `apps/desktop/src/renderer/src/data/ipc-data-access.ts`
- Modify: `apps/desktop/src/renderer/src/stores/account-store.ts`

### - [ ] Step 1: 在 account.test.ts 新增 4 个失败测试

打开 `packages/shared/tests/models/account.test.ts`，在文件顶部 import 块中追加 `updateAccount`：

```typescript
import {
  createAccount,
  getAccount,
  getAccounts,
  getInvestableBalance,
  getNetWorth,
  softDeleteAccount,
  hasTransactions,
  updateAccountBalance,
  updateAccount,
} from '../../src/models/account.js';
```

然后在 `describe('account model', () => { ... })` 块的**末尾**（`softDeleteAccount: 无关联交易 → 成功` 测试之后、闭合 `});` 之前）追加 4 个测试：

```typescript
  it('updateAccount: 更新名称 → 返回更新后的 Account', () => {
    const acc = createAccount(db, {
      user_id: userId, name: '测试', asset_class: 'liquid', account_type: 'checking',
    });
    const updated = updateAccount(db, acc.id, { name: '新名称' });
    expect(updated.name).toBe('新名称');
    expect(updated.id).toBe(acc.id);
  });

  it('updateAccount: 更新多个字段 → 所有字段更新 + sync_version 递增', () => {
    const acc = createAccount(db, {
      user_id: userId, name: '测试', asset_class: 'liquid', account_type: 'checking',
    });
    const updated = updateAccount(db, acc.id, {
      name: '基金账户', asset_class: 'invested', account_type: 'fund', note: '长期持有',
    });
    expect(updated.name).toBe('基金账户');
    expect(updated.asset_class).toBe('invested');
    expect(updated.account_type).toBe('fund');
    expect(updated.note).toBe('长期持有');
    expect(updated.sync_version).toBe(acc.sync_version + 1);
  });

  it('updateAccount: 空输入 → 返回原 Account 不变', () => {
    const acc = createAccount(db, {
      user_id: userId, name: '测试', asset_class: 'liquid', account_type: 'checking',
    });
    const updated = updateAccount(db, acc.id, {});
    expect(updated.name).toBe('测试');
    expect(updated.sync_version).toBe(acc.sync_version);
  });

  it('updateAccount: 不存在的 ID → 抛出错误', () => {
    expect(() => updateAccount(db, 'nonexistent-id', { name: 'x' })).toThrow(/Account not found/);
  });
```

### - [ ] Step 2: 运行测试，确认失败

Run: `pnpm --filter @fire-app/shared test`
Expected: FAIL — `updateAccount is not a function`（或导入失败），4 个新测试均失败。

### - [ ] Step 3: 在 account.ts 实现 EditAccountInput + updateAccount

打开 `packages/shared/src/models/account.ts`。

在 `CreateAccountInput` 接口（第 7-15 行）之后、`createAccount` 函数之前，插入 `EditAccountInput` 接口：

```typescript
export interface EditAccountInput {
  name?: string;
  asset_class?: AssetClass;
  account_type?: AccountType;
  note?: string | null;
  display_order?: number;
}
```

在 `updateAccountBalance` 函数（第 59-63 行）之后，插入 `updateAccount` 函数：

```typescript
/**
 * 更新账户字段（partial update，余额不可直接编辑）
 * 每次更新递增 sync_version，为后续同步层预留
 */
export function updateAccount(db: DatabaseType, id: string, input: EditAccountInput): Account {
  const current = getAccount(db, id);
  if (!current) { throw new Error(`Account not found: ${id}`); }

  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (input.name !== undefined) { fields.push('name = ?'); values.push(input.name); }
  if (input.asset_class !== undefined) { fields.push('asset_class = ?'); values.push(input.asset_class); }
  if (input.account_type !== undefined) { fields.push('account_type = ?'); values.push(input.account_type); }
  if (input.note !== undefined) { fields.push('note = ?'); values.push(input.note); }
  if (input.display_order !== undefined) { fields.push('display_order = ?'); values.push(input.display_order); }

  if (fields.length === 0) { return current; }

  fields.push('sync_version = ?'); values.push(current.sync_version + 1);
  fields.push('updated_at = ?'); values.push(nowMs());
  values.push(id);

  db.prepare(`UPDATE accounts SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  return getAccount(db, id)!;
}
```

> 注：`AssetClass`、`AccountType` 已在第 5 行 import；`nowMs` 已在第 4 行 import；`getAccount` 已定义。无需新增 import。

### - [ ] Step 4: 运行测试，确认通过

Run: `pnpm --filter @fire-app/shared test`
Expected: PASS — 所有 account model 测试（含 4 个新测试）全绿。

### - [ ] Step 5: 在 account-handlers.ts 新增 db:account:update handler

打开 `apps/desktop/src/main/ipc/account-handlers.ts`。

将 import 块替换为（新增 `updateAccount` 与 `EditAccountInput`）：

```typescript
import { registerHandler } from './register-handlers.js';
import {
  createAccount, getAccount, getAccounts, updateAccount, updateAccountBalance,
  getInvestableBalance, getNetWorth, hasTransactions, softDeleteAccount,
} from '@shared/models/account.js';
import type { Database as DatabaseType } from 'better-sqlite3';
import type { CreateAccountInput, EditAccountInput } from '@shared/models/account.js';
```

在 `registerAccountHandlers` 函数内，`db:account:list` 行之后新增一行 handler：

```typescript
  registerHandler('db:account:update', (_db, id: string, input: EditAccountInput) => updateAccount(_db, id, input), db);
```

### - [ ] Step 6: 在 preload/index.ts 暴露 update 方法

打开 `apps/desktop/src/preload/index.ts`。

在 `account` 对象的 `list` 行之后新增 `update` 方法：

```typescript
    update: (id: string, input: unknown) => ipcRenderer.invoke('db:account:update', id, input),
```

### - [ ] Step 7: 在 ipc.d.ts 新增 update 类型声明

打开 `apps/desktop/src/renderer/src/types/ipc.d.ts`。

将第 9 行的 import 替换为（新增 `EditAccountInput`）：

```typescript
import type { CreateAccountInput, EditAccountInput } from '@shared/models/account.js';
```

在 `DataAccessAPI.account` 类型块的 `list` 行之后新增 `update` 声明：

```typescript
    update(id: string, input: EditAccountInput): Promise<Account>;
```

### - [ ] Step 8: 在 data-access-port.ts 新增 updateAccount 声明

打开 `apps/desktop/src/renderer/src/data/data-access-port.ts`。

将第 10 行的 import 替换为（新增 `EditAccountInput`）：

```typescript
import type { CreateAccountInput, EditAccountInput } from '@shared/models/account.js';
```

在 `DataAccessPort` 接口的 `getAccounts` 行之后新增方法声明：

```typescript
  updateAccount(id: string, input: EditAccountInput): Promise<Account>;
```

### - [ ] Step 9: 在 ipc-data-access.ts 新增 updateAccount 实现

打开 `apps/desktop/src/renderer/src/data/ipc-data-access.ts`。

将第 6 行的 import 替换为（新增 `EditAccountInput`）：

```typescript
import type { CreateAccountInput, EditAccountInput } from '@shared/models/account.js';
```

在 `getAccounts` 行之后新增实现：

```typescript
  updateAccount(id: string, input: EditAccountInput) { return window.dataAccess.account.update(id, input); }
```

### - [ ] Step 10: 在 account-store.ts 新增 updateAccount 方法

打开 `apps/desktop/src/renderer/src/stores/account-store.ts`。

将第 5 行的 import 替换为（新增 `EditAccountInput`）：

```typescript
import type { CreateAccountInput, EditAccountInput } from '@shared/models/account.js';
```

在 `AccountStore` 接口的 `createAccount` 行之后新增方法声明：

```typescript
  updateAccount: (id: string, input: EditAccountInput, userId: string) => Promise<void>;
```

在 store 实现的 `createAccount` 方法之后、`softDeleteAccount` 之前，新增 `updateAccount` 实现：

```typescript
  updateAccount: async (id, input, userId) => {
    set({ loading: true, error: null });
    try {
      await dataAccess.updateAccount(id, input);
      const accounts = await dataAccess.getAccounts(userId);
      set({ accounts, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },
```

### - [ ] Step 11: 类型检查（渲染层 + 主进程）

Run: `pnpm --filter @fire-app/desktop exec tsc --noEmit -p tsconfig.json && pnpm --filter @fire-app/desktop exec tsc --noEmit -p tsconfig.node.json`
Expected: 两个命令均零错误退出。

### - [ ] Step 12: 提交

```bash
git add packages/shared/src/models/account.ts packages/shared/tests/models/account.test.ts apps/desktop/src/main/ipc/account-handlers.ts apps/desktop/src/preload/index.ts apps/desktop/src/renderer/src/types/ipc.d.ts apps/desktop/src/renderer/src/data/data-access-port.ts apps/desktop/src/renderer/src/data/ipc-data-access.ts apps/desktop/src/renderer/src/stores/account-store.ts
git commit -m "feat(account): 新增 updateAccount model + db:account:update IPC 通道 + store 方法"
```

---

## Task 2: account-constants.ts + AccountOverviewCards

**目标:** 创建纯常量与格式化函数文件，以及 5 张资产概览卡片组件。

**Files:**
- Create: `apps/desktop/src/renderer/src/components/accounts/account-constants.ts`
- Create: `apps/desktop/src/renderer/src/components/accounts/AccountOverviewCards.tsx`

### - [ ] Step 1: 创建 account-constants.ts

创建文件 `apps/desktop/src/renderer/src/components/accounts/account-constants.ts`，完整内容：

```typescript
// 账户相关常量与格式化函数 / Account constants and formatting helpers

import type { Account, AssetClass, AccountType } from '@shared/types/index.js';
import { centsToYuan } from '@shared/utils/money.js';

/** 资产分类配置：标签、色点类名、标签类名（raw Tailwind） */
export const ASSET_CLASS_CONFIG: Record<AssetClass, { label: string; dotClass: string; tagClass: string }> = {
  liquid: { label: '流动资产', dotClass: 'bg-blue-500', tagClass: 'bg-blue-100 text-blue-700' },
  invested: { label: '投资资产', dotClass: 'bg-purple-500', tagClass: 'bg-purple-100 text-purple-700' },
  use_asset: { label: '使用资产', dotClass: 'bg-orange-500', tagClass: 'bg-orange-100 text-orange-700' },
  liability: { label: '负债', dotClass: 'bg-red-500', tagClass: 'bg-red-100 text-red-700' },
};

/** 账户类型中文名映射 */
export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: '活期存款',
  savings: '储蓄账户',
  cash: '现金',
  investment: '投资账户',
  retirement: '退休账户',
  fund: '基金',
  real_estate: '房产',
  vehicle: '车辆',
  credit_card: '信用卡',
  loan: '贷款',
  mortgage: '房贷',
};

/** 资产分类选项（供 Select 组件使用） */
export const ASSET_CLASS_OPTIONS = (Object.keys(ASSET_CLASS_CONFIG) as AssetClass[]).map((cls) => ({
  label: ASSET_CLASS_CONFIG[cls].label,
  value: cls,
}));

/** 账户类型选项（供 Select 组件使用） */
export const ACCOUNT_TYPE_OPTIONS = (Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[]).map((t) => ({
  label: ACCOUNT_TYPE_LABELS[t],
  value: t,
}));

/** 分转元并格式化为人民币货币字符串（负数自然显示为 -¥） */
export function formatBalance(cents: number): string {
  const yuan = centsToYuan(cents);
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
  }).format(yuan);
}

/** 资产概览聚合结果 */
export interface AccountOverview {
  liquid: number;
  invested: number;
  use_asset: number;
  liability: number;
  net_worth: number;
  counts: { liquid: number; invested: number; use_asset: number; liability: number };
}

/** 从 accounts 数组前端计算资产概览（无 IPC 往返） */
export function computeOverview(accounts: Account[]): AccountOverview {
  const result: AccountOverview = {
    liquid: 0, invested: 0, use_asset: 0, liability: 0, net_worth: 0,
    counts: { liquid: 0, invested: 0, use_asset: 0, liability: 0 },
  };
  for (const acc of accounts) {
    result[acc.asset_class] += acc.current_balance;
    result.counts[acc.asset_class]++;
    result.net_worth += acc.current_balance;
  }
  return result;
}
```

### - [ ] Step 2: 创建 AccountOverviewCards.tsx

创建文件 `apps/desktop/src/renderer/src/components/accounts/AccountOverviewCards.tsx`，完整内容：

```tsx
// 账户概览卡片 / Account overview cards
// 展示 4 张分类卡 + 1 张净资产卡，数据从 accounts 数组前端聚合

import type { Account, AssetClass } from '@shared/types/index.js';
import { Card } from '../base/Card.js';
import { ASSET_CLASS_CONFIG, formatBalance, computeOverview } from './account-constants.js';

interface AccountOverviewCardsProps {
  accounts: Account[];
}

const ORDER: AssetClass[] = ['liquid', 'invested', 'use_asset', 'liability'];

export function AccountOverviewCards({ accounts }: AccountOverviewCardsProps) {
  const overview = computeOverview(accounts);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        {ORDER.map((cls) => {
          const config = ASSET_CLASS_CONFIG[cls];
          return (
            <Card key={cls}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`inline-block w-2 h-2 rounded-full ${config.dotClass}`} />
                <span className="text-sm text-gray-500">{config.label}</span>
              </div>
              <div className="text-xl font-semibold text-gray-900">{formatBalance(overview[cls])}</div>
              <div className="text-xs text-gray-400 mt-1">{overview.counts[cls]} 个账户</div>
            </Card>
          );
        })}
      </div>
      <Card>
        <div className="flex items-center justify-between">
          <span className="text-base font-medium text-gray-700">净资产</span>
          <span className={`text-2xl font-bold ${overview.net_worth < 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {formatBalance(overview.net_worth)}
          </span>
        </div>
      </Card>
    </div>
  );
}
```

### - [ ] Step 3: 类型检查

Run: `pnpm --filter @fire-app/desktop exec tsc --noEmit -p tsconfig.json`
Expected: 零错误。

### - [ ] Step 4: 提交

```bash
git add apps/desktop/src/renderer/src/components/accounts/account-constants.ts apps/desktop/src/renderer/src/components/accounts/AccountOverviewCards.tsx
git commit -m "feat(accounts): 新增 account-constants 与 AccountOverviewCards 概览卡片"
```

---

## Task 3: AccountListTable

**目标:** 创建账户列表表格组件，含色标列、资产分类标签、账户类型、余额、操作列，以及排序控制。

**Files:**
- Create: `apps/desktop/src/renderer/src/components/accounts/AccountListTable.tsx`

### - [ ] Step 1: 创建 AccountListTable.tsx

创建文件 `apps/desktop/src/renderer/src/components/accounts/AccountListTable.tsx`，完整内容：

```tsx
// 账户列表表格 / Account list table
// 展示账户列表，支持排序（Select 控制）与行内编辑/删除操作

import { useMemo, useState } from 'react';
import type { Account } from '@shared/types/index.js';
import { Table, type TableColumn } from '../base/Table.js';
import { Button } from '../base/Button.js';
import { Select } from '../base/Select.js';
import { EmptyState } from '../auxiliary/EmptyState.js';
import {
  ASSET_CLASS_CONFIG, ACCOUNT_TYPE_LABELS, formatBalance,
} from './account-constants.js';

interface AccountListTableProps {
  accounts: Account[];
  loading: boolean;
  onEdit: (account: Account) => void;
  onDelete: (account: Account) => void;
}

const SORT_OPTIONS = [
  { label: '默认顺序', value: 'default' },
  { label: '名称升序', value: 'name-asc' },
  { label: '名称降序', value: 'name-desc' },
  { label: '余额升序', value: 'balance-asc' },
  { label: '余额降序', value: 'balance-desc' },
];

export function AccountListTable({ accounts, loading, onEdit, onDelete }: AccountListTableProps) {
  const [sortBy, setSortBy] = useState('default');

  const sortedAccounts = useMemo(() => {
    const copy = [...accounts];
    switch (sortBy) {
      case 'name-asc': return copy.sort((a, b) => a.name.localeCompare(b.name));
      case 'name-desc': return copy.sort((a, b) => b.name.localeCompare(a.name));
      case 'balance-asc': return copy.sort((a, b) => a.current_balance - b.current_balance);
      case 'balance-desc': return copy.sort((a, b) => b.current_balance - a.current_balance);
      default: return copy; // 默认顺序：沿用 store 返回的 display_order, name 排序
    }
  }, [accounts, sortBy]);

  const columns: TableColumn<Account>[] = [
    {
      key: 'color',
      title: '',
      width: '40px',
      render: (r) => (
        <span className={`inline-block w-2 h-2 rounded-full ${ASSET_CLASS_CONFIG[r.asset_class].dotClass}`} />
      ),
    },
    {
      key: 'name',
      title: '账户名称',
      render: (r) => (
        <div>
          <div className="font-medium text-gray-900">{r.name}</div>
          {r.note && <div className="text-xs text-gray-400 mt-0.5">{r.note}</div>}
        </div>
      ),
    },
    {
      key: 'asset_class',
      title: '资产分类',
      render: (r) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ASSET_CLASS_CONFIG[r.asset_class].tagClass}`}>
          {ASSET_CLASS_CONFIG[r.asset_class].label}
        </span>
      ),
    },
    {
      key: 'account_type',
      title: '账户类型',
      render: (r) => <span className="text-gray-600">{ACCOUNT_TYPE_LABELS[r.account_type]}</span>,
    },
    {
      key: 'current_balance',
      title: '当前余额',
      align: 'right',
      render: (r) => (
        <span className={r.current_balance < 0 ? 'text-red-600 font-medium' : 'text-gray-900'}>
          {formatBalance(r.current_balance)}
        </span>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      align: 'right',
      render: (r) => (
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => onEdit(r)}>编辑</Button>
          <Button variant="danger" size="sm" onClick={() => onDelete(r)}>删除</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      {sortedAccounts.length > 0 && !loading && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">排序：</span>
          <div className="w-40">
            <Select options={SORT_OPTIONS} value={sortBy} onChange={setSortBy} />
          </div>
        </div>
      )}
      {loading ? (
        <Table columns={columns} data={[]} loading={true} />
      ) : sortedAccounts.length === 0 ? (
        <EmptyState title="暂无账户" description="点击右上角「新增账户」开始管理你的资产" />
      ) : (
        <Table columns={columns} data={sortedAccounts} />
      )}
    </div>
  );
}
```

### - [ ] Step 2: 类型检查

Run: `pnpm --filter @fire-app/desktop exec tsc --noEmit -p tsconfig.json`
Expected: 零错误。

### - [ ] Step 3: 提交

```bash
git add apps/desktop/src/renderer/src/components/accounts/AccountListTable.tsx
git commit -m "feat(accounts): 新增 AccountListTable 账户列表表格"
```

---

## Task 4: AccountFormModal

**目标:** 创建新增/编辑账户的表单弹窗，复用于 create 与 edit 两种模式，edit 模式余额只读。

**Files:**
- Create: `apps/desktop/src/renderer/src/components/accounts/AccountFormModal.tsx`

### - [ ] Step 1: 创建 AccountFormModal.tsx

创建文件 `apps/desktop/src/renderer/src/components/accounts/AccountFormModal.tsx`，完整内容：

```tsx
// 账户新增/编辑表单弹窗 / Account create/edit form modal
// mode='create' 空表单；mode='edit' 预填充且余额只读

import { useEffect, useState } from 'react';
import type { Account, AssetClass, AccountType } from '@shared/types/index.js';
import type { CreateAccountInput, EditAccountInput } from '@shared/models/account.js';
import { yuanToCents, centsToYuan } from '@shared/utils/money.js';
import { Modal } from '../base/Modal.js';
import { Input } from '../base/Input.js';
import { Select } from '../base/Select.js';
import { Button } from '../base/Button.js';
import { ASSET_CLASS_OPTIONS, ACCOUNT_TYPE_OPTIONS } from './account-constants.js';

interface AccountFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  account?: Account;
  userId?: string;        // create 模式必填，用于构造完整 CreateAccountInput
  loading?: boolean;      // 提交中状态，控制提交按钮 disabled 防重复提交
  onSubmit: (input: CreateAccountInput | EditAccountInput) => void;
  onClose: () => void;
}

export function AccountFormModal({ open, mode, account, userId, loading, onSubmit, onClose }: AccountFormModalProps) {
  const [name, setName] = useState('');
  const [assetClass, setAssetClass] = useState<AssetClass>('liquid');
  const [accountType, setAccountType] = useState<AccountType>('checking');
  const [initialBalance, setInitialBalance] = useState('0');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<{ name?: string; initialBalance?: string }>({});

  // 打开时根据 mode 初始化表单值
  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && account) {
      setName(account.name);
      setAssetClass(account.asset_class);
      setAccountType(account.account_type);
      setInitialBalance(String(centsToYuan(account.current_balance)));
      setNote(account.note ?? '');
    } else {
      setName('');
      setAssetClass('liquid');
      setAccountType('checking');
      setInitialBalance('0');
      setNote('');
    }
    setErrors({});
  }, [open, mode, account]);

  const handleSubmit = () => {
    const errs: { name?: string; initialBalance?: string } = {};
    if (!name.trim()) errs.name = '请输入账户名称';
    if (mode === 'create') {
      if (initialBalance === '' || isNaN(Number(initialBalance))) {
        errs.initialBalance = '请输入有效金额';
      }
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    if (mode === 'create') {
      const input: CreateAccountInput = {
        user_id: userId ?? '',
        name: name.trim(),
        asset_class: assetClass,
        account_type: accountType,
        initial_balance: yuanToCents(Number(initialBalance) || 0),
        note: note.trim() || null,
      };
      onSubmit(input);
    } else {
      const input: EditAccountInput = {
        name: name.trim(),
        asset_class: assetClass,
        account_type: accountType,
        note: note.trim() || null,
      };
      onSubmit(input);
    }
  };

  return (
    <Modal
      open={open}
      title={mode === 'create' ? '新增账户' : '编辑账户'}
      onClose={onClose}
      width={520}
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose} disabled={loading}>取消</Button>
          <Button variant="primary" size="md" loading={loading} onClick={handleSubmit}>确定</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="账户名称"
          type="text"
          value={name}
          required
          error={errors.name}
          placeholder="例如：招商银行活期"
          onChange={setName}
        />
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="资产分类"
            options={ASSET_CLASS_OPTIONS}
            value={assetClass}
            required
            onChange={(v) => setAssetClass(v as AssetClass)}
          />
          <Select
            label="账户类型"
            options={ACCOUNT_TYPE_OPTIONS}
            value={accountType}
            required
            onChange={(v) => setAccountType(v as AccountType)}
          />
        </div>
        <Input
          label="初始余额"
          type="number"
          value={initialBalance}
          prefix="¥"
          error={errors.initialBalance}
          disabled={mode === 'edit'}
          onChange={setInitialBalance}
        />
        <Input
          label="备注"
          type="text"
          value={note}
          placeholder="可选，账户备注说明"
          onChange={setNote}
        />
      </div>
    </Modal>
  );
}
```

### - [ ] Step 2: 类型检查

Run: `pnpm --filter @fire-app/desktop exec tsc --noEmit -p tsconfig.json`
Expected: 零错误。

### - [ ] Step 3: 提交

```bash
git add apps/desktop/src/renderer/src/components/accounts/AccountFormModal.tsx
git commit -m "feat(accounts): 新增 AccountFormModal 新增/编辑表单"
```

---

## Task 5: AccountsPage 完整实现

**目标:** 替换 M2 占位页，组合 4 个新组件与 3 个 store，完成账户 CRUD 全流程。

**Files:**
- Modify: `apps/desktop/src/renderer/src/pages/AccountsPage.tsx`（整体替换）

### - [ ] Step 1: 整体替换 AccountsPage.tsx

打开 `apps/desktop/src/renderer/src/pages/AccountsPage.tsx`，将整个文件内容替换为：

```tsx
// 账户管理页 / Accounts page
// 组合概览卡片、列表表格、表单弹窗、删除确认，完成账户 CRUD

import { useEffect, useState } from 'react';
import type { Account } from '@shared/types/index.js';
import type { CreateAccountInput, EditAccountInput } from '@shared/models/account.js';
import { useAccountStore } from '../stores/account-store.js';
import { useAppStore } from '../stores/app-store.js';
import { useToastStore } from '../stores/toast-store.js';
import { PageHeader } from '../components/layout/PageHeader.js';
import { Button } from '../components/base/Button.js';
import { ConfirmDialog } from '../components/base/ConfirmDialog.js';
import { AccountOverviewCards } from '../components/accounts/AccountOverviewCards.js';
import { AccountListTable } from '../components/accounts/AccountListTable.js';
import { AccountFormModal } from '../components/accounts/AccountFormModal.js';

export function AccountsPage() {
  const { accounts, loading, error, fetchAccounts, createAccount, updateAccount, softDeleteAccount } = useAccountStore();
  const { currentUser } = useAppStore();
  const { showSuccess, showError } = useToastStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);

  // 初始加载账户列表
  useEffect(() => {
    if (currentUser) fetchAccounts(currentUser.id);
  }, [currentUser, fetchAccounts]);

  // 监听 store error，自动弹出错误 Toast
  useEffect(() => {
    if (error) showError(error);
  }, [error, showError]);

  const openCreateModal = () => {
    setModalMode('create');
    setEditingAccount(null);
    setModalOpen(true);
  };

  const openEditModal = (account: Account) => {
    setModalMode('edit');
    setEditingAccount(account);
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const openConfirm = (account: Account) => {
    setDeleteTarget(account);
    setConfirmOpen(true);
  };

  const closeConfirm = () => {
    setConfirmOpen(false);
    setDeleteTarget(null);
  };

  // 表单提交：create 调 createAccount，edit 调 updateAccount
  // store 方法内部捕获错误并写入 state.error（不抛出），故用 getState().error 判定成功/失败
  const handleSubmit = async (input: CreateAccountInput | EditAccountInput) => {
    if (!currentUser) return;
    if (modalMode === 'create') {
      await createAccount(input as CreateAccountInput, currentUser.id);
    } else if (editingAccount) {
      await updateAccount(editingAccount.id, input as EditAccountInput, currentUser.id);
    }
    if (!useAccountStore.getState().error) {
      setModalOpen(false);
      showSuccess(modalMode === 'create' ? '账户创建成功' : '账户更新成功');
    }
  };

  const handleDelete = async () => {
    if (!currentUser || !deleteTarget) return;
    const targetName = deleteTarget.name;
    setConfirmOpen(false);
    await softDeleteAccount(deleteTarget.id, currentUser.id);
    if (!useAccountStore.getState().error) {
      showSuccess(`账户「${targetName}」已删除`);
    }
    setDeleteTarget(null);
  };

  return (
    <div>
      <PageHeader
        title="账户管理"
        extra={<Button variant="primary" size="md" onClick={openCreateModal}>+ 新增账户</Button>}
      />
      <div className="p-8 space-y-6">
        <AccountOverviewCards accounts={accounts} />
        <AccountListTable
          accounts={accounts}
          loading={loading}
          onEdit={openEditModal}
          onDelete={openConfirm}
        />
      </div>
      <AccountFormModal
        open={modalOpen}
        mode={modalMode}
        account={editingAccount ?? undefined}
        userId={currentUser?.id}
        loading={loading}
        onSubmit={handleSubmit}
        onClose={closeModal}
      />
      <ConfirmDialog
        open={confirmOpen}
        title="删除账户"
        message={`确定删除账户「${deleteTarget?.name ?? ''}」吗？此操作不可撤销。`}
        variant="danger"
        confirmText="删除"
        cancelText="取消"
        onConfirm={handleDelete}
        onCancel={closeConfirm}
      />
    </div>
  );
}
```

### - [ ] Step 2: 类型检查（渲染层 + 主进程，确保无回归）

Run: `pnpm --filter @fire-app/desktop exec tsc --noEmit -p tsconfig.json && pnpm --filter @fire-app/desktop exec tsc --noEmit -p tsconfig.node.json`
Expected: 两个命令均零错误。

### - [ ] Step 3: 桌面端构建

Run: `pnpm --filter @fire-app/desktop build`
Expected: 构建成功（main / preload / renderer 三段均产出 `out/` 目录，无错误退出）。

### - [ ] Step 4: 提交

```bash
git add apps/desktop/src/renderer/src/pages/AccountsPage.tsx
git commit -m "feat(accounts): 实现 AccountsPage 完整账户管理页"
```

---

## 完成验证清单（全部 Task 完成后）

- [ ] `pnpm --filter @fire-app/shared test` — account model 测试全绿（含 4 个 updateAccount 用例）
- [ ] `pnpm --filter @fire-app/desktop exec tsc --noEmit -p tsconfig.json` — 渲染层零错误
- [ ] `pnpm --filter @fire-app/desktop exec tsc --noEmit -p tsconfig.node.json` — 主进程零错误
- [ ] `pnpm --filter @fire-app/desktop build` — 构建成功
- [ ] 启动应用（`pnpm --filter @fire-app/desktop dev`）手动验证：
  - 新增账户 → 概览卡片与列表刷新、Toast「账户创建成功」
  - 编辑账户 → 字段预填充、余额只读、更新后刷新
  - 删除无交易账户 → 成功删除
  - 删除有交易账户 → Toast 显示「该账户下有关联交易，无法删除…」
  - 排序 Select 切换 → 列表按名称/余额升降序排列
  - 空账户状态 → 显示 EmptyState 提示
