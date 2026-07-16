# M4 交易管理实施计划 / M4 Transaction Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 FIRE App 交易记录管理功能：完整 CRUD、多维度筛选、汇总概览、Category 自动 seed 兜底，以及完整 renderer 测试基础设施。

**Architecture:** 复刻 M3 accounts 4 件套模式（constants + overview cards + list table + form modal）+ 独立筛选组件。筛选状态在 TransactionsPage 本地 useState，用 useMemo 派生 filtered + overview。新增 useCategoryStore 带自动 seed 兜底。从零搭建 renderer 测试基础设施（vitest + jsdom + @testing-library/react）。

**Tech Stack:** React 19, Zustand 5, TypeScript 5.5, Tailwind CSS 4, vitest 2, jsdom, @testing-library/react 16, @testing-library/user-event 14, @testing-library/jest-dom 6

**Spec:** `docs/superpowers/specs/2026-07-16-fire-app-milestone4-transaction-management-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `apps/desktop/vitest.config.ts` | vitest 配置：jsdom + alias + setupFiles |
| Create | `apps/desktop/vitest.setup.ts` | 全局测试设置：jest-dom + window.dataAccess mock |
| Create | `apps/desktop/tests/hello.test.tsx` | 配置验证冒烟测试 |
| Modify | `apps/desktop/package.json` | 添加 test 脚本 + 测试 devDependencies |
| Modify | `package.json` (root) | 添加 test:desktop / test:all 脚本 |
| Create | `apps/desktop/src/renderer/src/components/transactions/transaction-constants.ts` | 纯函数：类型配置、格式化、筛选、排序、概览计算 |
| Create | `apps/desktop/tests/transaction-constants.test.ts` | transaction-constants 单元测试 |
| Create | `apps/desktop/src/renderer/src/stores/category-store.ts` | Category 状态管理 + 自动 seed 兜底 |
| Modify | `apps/desktop/src/renderer/src/stores/index.ts` | 追加 useCategoryStore 导出 |
| Create | `apps/desktop/tests/category-store.test.ts` | category-store 单元测试 |
| Create | `apps/desktop/src/renderer/src/components/transactions/TransactionOverviewCards.tsx` | 3 张概览卡（收入/支出/结余） |
| Create | `apps/desktop/tests/TransactionOverviewCards.test.tsx` | 概览卡组件测试 |
| Create | `apps/desktop/src/renderer/src/components/transactions/TransactionFilters.tsx` | 筛选组件（类型/账户/分类/日期） |
| Create | `apps/desktop/tests/TransactionFilters.test.tsx` | 筛选组件测试 |
| Create | `apps/desktop/src/renderer/src/components/transactions/TransactionListTable.tsx` | 列表表格 + 内嵌排序 + 空状态 |
| Create | `apps/desktop/tests/TransactionListTable.test.tsx` | 列表表格组件测试 |
| Create | `apps/desktop/src/renderer/src/components/transactions/TransactionFormModal.tsx` | 新增/编辑表单弹窗 |
| Create | `apps/desktop/tests/TransactionFormModal.test.tsx` | 表单弹窗组件测试 |
| Modify | `apps/desktop/src/renderer/src/pages/TransactionsPage.tsx` | 替换占位页，组合全部组件 |
| Create | `apps/desktop/tests/TransactionsPage.test.tsx` | 页面集成测试 |

### 关键设计决策

1. **筛选方式**：前端内存筛选（getTransactionsByUser + useMemo），无 IPC 往返
2. **Category 组织**：新建 useCategoryStore + 自动 seed 兜底（length===0 触发，模块级 Promise 缓存防并发）
3. **Type 选择器**：4 种类型都可选（income / expense / transfer / initial_balance）
4. **Transfer 联动**：to_account_id 必填，category 保留可选；非 transfer 时 to_account_id 提交强制 null
5. **概览卡**：3 张卡（收入含 initial_balance / 支出 / 结余），transfer 不计入结余；filtered.length===0 时隐藏
6. **筛选逻辑**：Transfer 账户筛选双向匹配（account_id 或 to_account_id）；dateTo 含当天
7. **空状态判断**：`hasActiveFilters = filters 中任一字段非空字符串`
8. **测试策略**：完整 renderer 测试，mock dataAccess 模块

### Mock 路径约定

测试文件位于 `apps/desktop/tests/` 目录。源码中的 `data-access.ts` 位于 `apps/desktop/src/renderer/src/data/data-access.ts`。

- **vi.mock 路径**（相对于测试文件）：`../src/renderer/src/data/data-access.js`
- **import 路径**（使用 alias）：`@renderer/data/data-access.js` 或 `@renderer/stores/category-store.js`
- **@shared 路径**：`@shared/types/index.js`、`@shared/utils/money.js`

### 基础组件 API 速查

```tsx
// Card: { title?, extra?, children, padding? }  — 无 className prop
<Card title="标题" extra={<Button/>}>内容</Card>

// Table<T extends { id?: string }>: { columns, data, loading?, emptyText?, onRowClick? }
// TableColumn<T>: { key, title, render?, width?, align? }

// Modal: { open, title?, children, footer?, onClose, width? }  — open=false 返回 null

// Button: { variant: 'primary'|'secondary'|'danger', size: 'sm'|'md'|'lg', loading?, disabled?, icon?, onClick?, children }
// secondary=绿色(emerald), primary=蓝色(blue), danger=红色

// Input: { type: 'text'|'number'|'date', label?, value, error?, placeholder?, required?, disabled?, prefix?, suffix?, onChange?(value:string) }

// Select: { options: {label,value}[], value: string, label?, error?, required?, disabled?, placeholder?, onChange?(value:string) }
// value 只接受 string，null 字段用 '' 占位

// ConfirmDialog: { open, title, message, confirmText?, cancelText?, variant?, onConfirm, onCancel }

// EmptyState: { icon?, title, description?, action? }

// PageHeader: { title, subtitle?, extra? }
```

---

## Task 1: 测试基础设施搭建

**Files:**
- Create: `apps/desktop/vitest.config.ts`
- Create: `apps/desktop/vitest.setup.ts`
- Create: `apps/desktop/tests/hello.test.tsx`
- Modify: `apps/desktop/package.json`
- Modify: `package.json` (root)

- [ ] **Step 1: 创建 vitest 配置文件**

Create `apps/desktop/vitest.config.ts`:

```typescript
// vitest 配置：jsdom 环境 + React 插件 + alias + setupFiles
// vitest config: jsdom environment + React plugin + alias + setupFiles

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    pool: 'threads',
    poolOptions: { threads: { singleThread: true } },
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, '../../packages/shared/src'),
      '@renderer': resolve(__dirname, 'src/renderer/src'),
    },
  },
});
```

- [ ] **Step 2: 创建全局测试 setup 文件**

Create `apps/desktop/vitest.setup.ts`:

```typescript
// 全局测试 setup：jest-dom matchers + window.dataAccess mock
// Global test setup: jest-dom matchers + window.dataAccess mock

import '@testing-library/jest-dom';
import { vi } from 'vitest';

// window.dataAccess 全局 mock 工厂
// window.dataAccess global mock factory
// 覆盖所有 namespace，每个方法用 vi.fn()，返回 undefined 作为默认值
// Covers all namespaces, each method is vi.fn() returning undefined by default

const fn = () => vi.fn();

window.dataAccess = {
  initDatabase: fn(),
  closeDatabase: fn(),
  user: {
    create: fn(),
    get: fn(),
    update: fn(),
    getFirst: fn(),
  },
  account: {
    create: fn(),
    get: fn(),
    list: fn(),
    update: fn(),
    updateBalance: fn(),
    investableBalance: fn(),
    netWorth: fn(),
    hasTransactions: fn(),
    softDelete: fn(),
  },
  category: {
    create: fn(),
    get: fn(),
    list: fn(),
    seed: fn(),
  },
  tx: {
    get: fn(),
    getById: fn(),
    listByUser: fn(),
    create: fn(),
    edit: fn(),
    delete: fn(),
  },
  recurring: {
    create: fn(),
    listActive: fn(),
    update: fn(),
    process: fn(),
  },
  scenario: {
    create: fn(),
    get: fn(),
    list: fn(),
    update: fn(),
  },
  snapshot: {
    list: fn(),
    getByMonth: fn(),
    generateMonthly: fn(),
  },
  fireCalc: {
    runProjection: fn(),
  },
} as any;
```

- [ ] **Step 3: 修改 desktop package.json 添加脚本和依赖**

Modify `apps/desktop/package.json` — 在 `scripts` 中添加 `test` 和 `test:watch`，在 `devDependencies` 中添加测试依赖：

```json
{
  "name": "@fire-app/desktop",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./out/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "rebuild": "electron-rebuild -f -w better-sqlite3",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@fire-app/shared": "workspace:*",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.0.0",
    "zustand": "^5.0.0",
    "better-sqlite3": "^11.0.0",
    "uuid": "^10.0.0"
  },
  "devDependencies": {
    "@electron/rebuild": "^3.6.0",
    "@tailwindcss/vite": "^4.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.0.0",
    "@types/better-sqlite3": "^7.6.10",
    "@types/node": "^20.14.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/uuid": "^10.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "electron": "^31.0.0",
    "electron-vite": "^2.0.0",
    "jsdom": "^25.0.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 4: 修改根 package.json 添加脚本**

Modify `package.json` (root) — 在 `scripts` 中添加 `test:desktop` 和 `test:all`：

```json
{
  "name": "fire-app-monorepo",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=20.0.0 <22.0.0",
    "pnpm": ">=9.0.0"
  },
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "dev": "pnpm --filter @fire-app/desktop dev",
    "build": "pnpm --filter @fire-app/desktop build",
    "test:shared": "pnpm --filter @fire-app/shared test",
    "test:desktop": "pnpm --filter @fire-app/desktop test",
    "test:all": "pnpm test:shared && pnpm test:desktop",
    "check-env": "node scripts/check-env.mjs",
    "bootstrap": "node scripts/setup.mjs",
    "preinstall": "node scripts/check-env.mjs --quiet || true",
    "postinstall": "pnpm --filter @fire-app/desktop rebuild"
  },
  "devDependencies": {
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Step 5: 创建冒烟测试文件**

Create `apps/desktop/tests/hello.test.tsx`:

```typescript
// 冒烟测试：验证 vitest + jsdom + @testing-library 配置正确
// Smoke test: verify vitest + jsdom + @testing-library configuration

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

function Hello({ name }: { name: string }) {
  return <div>Hello, {name}!</div>;
}

describe('vitest 配置冒烟测试', () => {
  it('渲染 React 组件并断言文本', () => {
    render(<Hello name="FIRE" />);
    expect(screen.getByText('Hello, FIRE!')).toBeInTheDocument();
  });

  it('jsdom DOM API 可用', () => {
    const div = document.createElement('div');
    div.textContent = 'test';
    expect(div.textContent).toBe('test');
  });

  it('window.dataAccess mock 已注入', () => {
    expect(window.dataAccess).toBeDefined();
    expect(window.dataAccess.tx.listByUser).toBeDefined();
    expect(typeof window.dataAccess.tx.listByUser).toBe('function');
  });
});
```

- [ ] **Step 6: 安装依赖**

Run:
```bash
cd "/workspace/FIRE APP" && pnpm install
```
Expected: 安装成功，无错误。

- [ ] **Step 7: 运行冒烟测试验证配置**

Run:
```bash
cd "/workspace/FIRE APP" && pnpm --filter @fire-app/desktop test
```
Expected: 3 个测试全部 PASS。

- [ ] **Step 8: 提交**

```bash
cd "/workspace/FIRE APP" && git add apps/desktop/vitest.config.ts apps/desktop/vitest.setup.ts apps/desktop/tests/hello.test.tsx apps/desktop/package.json package.json pnpm-lock.yaml && git commit -m "$(cat <<'EOF'
chore: add renderer test infrastructure with vitest + jsdom + testing-library

Set up vitest config with jsdom environment, @shared/@renderer aliases,
and global window.dataAccess mock. Add @testing-library/react, user-event,
and jest-dom devDependencies.
EOF
)"
```

---

## Task 2: transaction-constants.ts (纯函数 + 测试)

**Files:**
- Create: `apps/desktop/src/renderer/src/components/transactions/transaction-constants.ts`
- Test: `apps/desktop/tests/transaction-constants.test.ts`

- [ ] **Step 1: 编写失败测试**

Create `apps/desktop/tests/transaction-constants.test.ts`:

```typescript
// transaction-constants 纯函数测试 / transaction-constants pure function tests

import { describe, it, expect } from 'vitest';
import type { Transaction } from '@shared/types/index.js';
import {
  TRANSACTION_TYPE_CONFIG,
  TRANSACTION_TYPE_OPTIONS,
  formatAmount,
  formatDate,
  computeOverview,
  filterTransactions,
  sortTransactions,
  hasActiveFilters,
  type TransactionFilters,
} from '@renderer/components/transactions/transaction-constants.js';

// 构造基础交易 mock / Build base transaction mock
function makeTx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'tx-1',
    user_id: 'user-1',
    account_id: 'acc-1',
    to_account_id: null,
    category_id: null,
    recurring_id: null,
    transaction_type: 'expense',
    amount: 10000,
    transaction_date: new Date('2026-07-15').getTime(),
    description: null,
    sync_version: 0,
    updated_at: 0,
    deleted_flag: 0,
    ...overrides,
  };
}

const EMPTY_FILTERS: TransactionFilters = {
  type: '',
  account_id: '',
  category_id: '',
  dateFrom: '',
  dateTo: '',
};

describe('TRANSACTION_TYPE_CONFIG', () => {
  it('包含 4 种类型', () => {
    expect(Object.keys(TRANSACTION_TYPE_CONFIG)).toHaveLength(4);
    expect(TRANSACTION_TYPE_CONFIG.income).toBeDefined();
    expect(TRANSACTION_TYPE_CONFIG.expense).toBeDefined();
    expect(TRANSACTION_TYPE_CONFIG.transfer).toBeDefined();
    expect(TRANSACTION_TYPE_CONFIG.initial_balance).toBeDefined();
  });

  it('每种类型有 label/dotClass/tagClass/sign', () => {
    for (const key of Object.keys(TRANSACTION_TYPE_CONFIG) as (keyof typeof TRANSACTION_TYPE_CONFIG)[]) {
      const config = TRANSACTION_TYPE_CONFIG[key];
      expect(config.label).toBeTruthy();
      expect(config.dotClass).toBeTruthy();
      expect(config.tagClass).toBeTruthy();
      expect(config.sign).toBeTruthy();
    }
  });
});

describe('TRANSACTION_TYPE_OPTIONS', () => {
  it('长度 = 4', () => {
    expect(TRANSACTION_TYPE_OPTIONS).toHaveLength(4);
  });

  it('每个选项有 label 和 value', () => {
    for (const opt of TRANSACTION_TYPE_OPTIONS) {
      expect(opt.label).toBeTruthy();
      expect(opt.value).toBeTruthy();
    }
  });
});

describe('formatAmount', () => {
  it('0 分 → 包含 0.00', () => {
    expect(formatAmount(0)).toContain('0.00');
  });

  it('正数 10000 分 → 包含 100.00', () => {
    expect(formatAmount(10000)).toContain('100.00');
  });

  it('负数 -5000 分 → 包含 50.00 和负号', () => {
    const result = formatAmount(-5000);
    expect(result).toContain('50.00');
    expect(result).toContain('-');
  });
});

describe('formatDate', () => {
  it('时间戳 → YYYY-MM-DD', () => {
    const ms = new Date('2026-07-15T08:30:00').getTime();
    expect(formatDate(ms)).toBe('2026-07-15');
  });

  it('一位数月日补零', () => {
    const ms = new Date('2026-01-05T12:00:00').getTime();
    expect(formatDate(ms)).toBe('2026-01-05');
  });
});

describe('computeOverview', () => {
  it('空数组 → 全部 0', () => {
    const overview = computeOverview([]);
    expect(overview.income).toBe(0);
    expect(overview.expense).toBe(0);
    expect(overview.transfer).toBe(0);
    expect(overview.balance).toBe(0);
  });

  it('纯 income', () => {
    const txs = [makeTx({ transaction_type: 'income', amount: 10000 })];
    const overview = computeOverview(txs);
    expect(overview.income).toBe(10000);
    expect(overview.expense).toBe(0);
    expect(overview.balance).toBe(10000);
  });

  it('纯 expense', () => {
    const txs = [makeTx({ transaction_type: 'expense', amount: 5000 })];
    const overview = computeOverview(txs);
    expect(overview.income).toBe(0);
    expect(overview.expense).toBe(5000);
    expect(overview.balance).toBe(-5000);
  });

  it('initial_balance 计入 income', () => {
    const txs = [makeTx({ transaction_type: 'initial_balance', amount: 20000 })];
    const overview = computeOverview(txs);
    expect(overview.income).toBe(20000);
    expect(overview.balance).toBe(20000);
  });

  it('transfer 不计入 balance', () => {
    const txs = [
      makeTx({ id: 'tx-1', transaction_type: 'income', amount: 10000 }),
      makeTx({ id: 'tx-2', transaction_type: 'transfer', amount: 5000 }),
    ];
    const overview = computeOverview(txs);
    expect(overview.income).toBe(10000);
    expect(overview.expense).toBe(0);
    expect(overview.transfer).toBe(5000);
    expect(overview.balance).toBe(10000);
  });

  it('混合：income + expense + transfer', () => {
    const txs = [
      makeTx({ id: 'tx-1', transaction_type: 'income', amount: 10000 }),
      makeTx({ id: 'tx-2', transaction_type: 'expense', amount: 3000 }),
      makeTx({ id: 'tx-3', transaction_type: 'transfer', amount: 2000 }),
      makeTx({ id: 'tx-4', transaction_type: 'initial_balance', amount: 5000 }),
    ];
    const overview = computeOverview(txs);
    expect(overview.income).toBe(15000);
    expect(overview.expense).toBe(3000);
    expect(overview.transfer).toBe(2000);
    expect(overview.balance).toBe(12000);
  });
});

describe('filterTransactions', () => {
  const txs: Transaction[] = [
    makeTx({ id: 'tx-1', transaction_type: 'income', account_id: 'acc-1', to_account_id: null, category_id: 'cat-1', transaction_date: new Date('2026-07-10').getTime() }),
    makeTx({ id: 'tx-2', transaction_type: 'expense', account_id: 'acc-2', to_account_id: null, category_id: 'cat-2', transaction_date: new Date('2026-07-15').getTime() }),
    makeTx({ id: 'tx-3', transaction_type: 'transfer', account_id: 'acc-1', to_account_id: 'acc-2', category_id: null, transaction_date: new Date('2026-07-16').getTime() }),
    makeTx({ id: 'tx-4', transaction_type: 'expense', account_id: 'acc-3', to_account_id: null, category_id: 'cat-1', transaction_date: new Date('2026-07-17').getTime() }),
  ];

  it('空筛选 → 返回全部', () => {
    expect(filterTransactions(txs, EMPTY_FILTERS)).toHaveLength(4);
  });

  it('type 筛选', () => {
    const result = filterTransactions(txs, { ...EMPTY_FILTERS, type: 'expense' });
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.id)).toEqual(['tx-2', 'tx-4']);
  });

  it('account 筛选含 transfer 双向匹配', () => {
    // acc-1 是 tx-1 的 account_id，也是 tx-3 的 account_id（source）
    const result = filterTransactions(txs, { ...EMPTY_FILTERS, account_id: 'acc-1' });
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.id)).toEqual(['tx-1', 'tx-3']);
  });

  it('account 筛选匹配 to_account_id（transfer 目标）', () => {
    // acc-2 是 tx-2 的 account_id，也是 tx-3 的 to_account_id（target）
    const result = filterTransactions(txs, { ...EMPTY_FILTERS, account_id: 'acc-2' });
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.id)).toEqual(['tx-2', 'tx-3']);
  });

  it('category 筛选', () => {
    const result = filterTransactions(txs, { ...EMPTY_FILTERS, category_id: 'cat-1' });
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.id)).toEqual(['tx-1', 'tx-4']);
  });

  it('dateFrom 筛选', () => {
    const result = filterTransactions(txs, { ...EMPTY_FILTERS, dateFrom: '2026-07-16' });
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.id)).toEqual(['tx-3', 'tx-4']);
  });

  it('dateTo 筛选含当天', () => {
    // dateTo=2026-07-16 应包含 7/10, 7/15, 7/16，不含 7/17
    const result = filterTransactions(txs, { ...EMPTY_FILTERS, dateTo: '2026-07-16' });
    expect(result).toHaveLength(3);
    expect(result.map((t) => t.id)).toEqual(['tx-1', 'tx-2', 'tx-3']);
  });

  it('组合筛选：type + account', () => {
    const result = filterTransactions(txs, { ...EMPTY_FILTERS, type: 'transfer', account_id: 'acc-1' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('tx-3');
  });

  it('无匹配', () => {
    const result = filterTransactions(txs, { ...EMPTY_FILTERS, account_id: 'acc-999' });
    expect(result).toHaveLength(0);
  });
});

describe('sortTransactions', () => {
  const txs: Transaction[] = [
    makeTx({ id: 'tx-a', amount: 3000, transaction_date: new Date('2026-07-10').getTime() }),
    makeTx({ id: 'tx-b', amount: 10000, transaction_date: new Date('2026-07-15').getTime() }),
    makeTx({ id: 'tx-c', amount: 5000, transaction_date: new Date('2026-07-20').getTime() }),
  ];

  it('date-desc（默认）：日期降序', () => {
    const result = sortTransactions(txs, 'date-desc');
    expect(result.map((t) => t.id)).toEqual(['tx-c', 'tx-b', 'tx-a']);
  });

  it('date-asc：日期升序', () => {
    const result = sortTransactions(txs, 'date-asc');
    expect(result.map((t) => t.id)).toEqual(['tx-a', 'tx-b', 'tx-c']);
  });

  it('amount-desc：金额降序', () => {
    const result = sortTransactions(txs, 'amount-desc');
    expect(result.map((t) => t.id)).toEqual(['tx-b', 'tx-c', 'tx-a']);
  });

  it('amount-asc：金额升序', () => {
    const result = sortTransactions(txs, 'amount-asc');
    expect(result.map((t) => t.id)).toEqual(['tx-a', 'tx-c', 'tx-b']);
  });

  it('不修改原数组', () => {
    const original = [...txs];
    sortTransactions(txs, 'amount-asc');
    expect(txs.map((t) => t.id)).toEqual(original.map((t) => t.id));
  });
});

describe('hasActiveFilters', () => {
  it('全空 → false', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
  });

  it('有 type → true', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, type: 'expense' })).toBe(true);
  });

  it('有 account_id → true', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, account_id: 'acc-1' })).toBe(true);
  });

  it('有 dateFrom → true', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, dateFrom: '2026-07-01' })).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run:
```bash
cd "/workspace/FIRE APP" && pnpm --filter @fire-app/desktop test -- tests/transaction-constants.test.ts
```
Expected: FAIL — 模块不存在，`Cannot find module '@renderer/components/transactions/transaction-constants.js'`。

- [ ] **Step 3: 编写实现**

Create `apps/desktop/src/renderer/src/components/transactions/transaction-constants.ts`:

```typescript
// 交易相关常量与纯函数 / Transaction constants and pure functions
// 包含类型配置、格式化、筛选、排序、概览计算 — 全部无副作用，易于单元测试
// Includes type config, formatting, filtering, sorting, overview computation — all pure, easily testable

import type { Transaction, TransactionType } from '@shared/types/index.js';
import { centsToYuan } from '@shared/utils/money.js';

/** 交易类型配置：标签、色点类名、标签类名、金额符号 */
// Transaction type config: label, dot class, tag class, amount sign
export const TRANSACTION_TYPE_CONFIG: Record<TransactionType, {
  label: string;
  dotClass: string;
  tagClass: string;
  sign: string;
}> = {
  income: { label: '收入', dotClass: 'bg-green-500', tagClass: 'bg-green-100 text-green-700', sign: '+' },
  expense: { label: '支出', dotClass: 'bg-red-500', tagClass: 'bg-red-100 text-red-700', sign: '-' },
  transfer: { label: '转账', dotClass: 'bg-blue-500', tagClass: 'bg-blue-100 text-blue-700', sign: '⟷' },
  initial_balance: { label: '初始余额', dotClass: 'bg-purple-500', tagClass: 'bg-purple-100 text-purple-700', sign: '+' },
};

/** 交易类型选项（供 Select 组件使用） */
// Transaction type options (for Select component)
export const TRANSACTION_TYPE_OPTIONS: { label: string; value: TransactionType }[] = [
  { label: '收入', value: 'income' },
  { label: '支出', value: 'expense' },
  { label: '转账', value: 'transfer' },
  { label: '初始余额', value: 'initial_balance' },
];

/** 筛选状态：全部 string，空 = '' 表示不筛选 */
// Filter state: all strings, empty = '' means no filter
export interface TransactionFilters {
  type: string;
  account_id: string;
  category_id: string;
  dateFrom: string;
  dateTo: string;
}

/** 概览聚合结果 */
// Overview aggregation result
export interface TransactionOverview {
  income: number;    // 含 initial_balance / includes initial_balance
  expense: number;
  transfer: number;  // 不计入 balance / not counted in balance
  balance: number;   // income - expense
}

/** 分转元并格式化为人民币货币字符串 */
// Convert cents to yuan and format as CNY currency string
export function formatAmount(cents: number): string {
  const yuan = centsToYuan(cents);
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
  }).format(yuan);
}

/** 时间戳 → YYYY-MM-DD 字符串 */
// Timestamp → YYYY-MM-DD string
export function formatDate(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 从交易数组前端计算概览（无 IPC 往返） */
// Compute overview from transactions array in-memory (no IPC roundtrip)
export function computeOverview(txs: Transaction[]): TransactionOverview {
  const result: TransactionOverview = { income: 0, expense: 0, transfer: 0, balance: 0 };
  for (const tx of txs) {
    if (tx.transaction_type === 'income' || tx.transaction_type === 'initial_balance') {
      result.income += tx.amount;
    } else if (tx.transaction_type === 'expense') {
      result.expense += tx.amount;
    } else if (tx.transaction_type === 'transfer') {
      result.transfer += tx.amount;
    }
  }
  result.balance = result.income - result.expense;
  return result;
}

/** 前端内存筛选 */
// In-memory filtering
export function filterTransactions(txs: Transaction[], filters: TransactionFilters): Transaction[] {
  return txs.filter((tx) => {
    if (filters.type && tx.transaction_type !== filters.type) return false;
    // 账户筛选：双向匹配（account_id 或 to_account_id）
    // Account filter: bidirectional match (account_id or to_account_id)
    if (filters.account_id && tx.account_id !== filters.account_id && tx.to_account_id !== filters.account_id) return false;
    if (filters.category_id && tx.category_id !== filters.category_id) return false;
    if (filters.dateFrom && tx.transaction_date < new Date(filters.dateFrom).getTime()) return false;
    // dateTo 含当天：截止到次日 0 点
    // dateTo inclusive: up to next day 00:00
    if (filters.dateTo && tx.transaction_date >= new Date(filters.dateTo).getTime() + 86400000) return false;
    return true;
  });
}

/** 排序：date-desc(默认), date-asc, amount-desc, amount-asc */
// Sort: date-desc (default), date-asc, amount-desc, amount-asc
export function sortTransactions(txs: Transaction[], sortBy: string): Transaction[] {
  const copy = [...txs];
  switch (sortBy) {
    case 'date-asc':
      return copy.sort((a, b) => a.transaction_date - b.transaction_date);
    case 'amount-desc':
      return copy.sort((a, b) => b.amount - a.amount);
    case 'amount-asc':
      return copy.sort((a, b) => a.amount - b.amount);
    default:
      return copy.sort((a, b) => b.transaction_date - a.transaction_date);
  }
}

/** 判断是否有激活的筛选条件 */
// Check if any filter is active
export function hasActiveFilters(filters: TransactionFilters): boolean {
  return Boolean(filters.type || filters.account_id || filters.category_id || filters.dateFrom || filters.dateTo);
}
```

- [ ] **Step 4: 运行测试验证通过**

Run:
```bash
cd "/workspace/FIRE APP" && pnpm --filter @fire-app/desktop test -- tests/transaction-constants.test.ts
```
Expected: 全部 PASS（28 个测试用例）。

- [ ] **Step 5: 提交**

```bash
cd "/workspace/FIRE APP" && git add apps/desktop/src/renderer/src/components/transactions/transaction-constants.ts apps/desktop/tests/transaction-constants.test.ts && git commit -m "$(cat <<'EOF'
feat(transactions): add transaction-constants with pure functions for formatting, filtering, sorting, and overview computation
EOF
)"
```

---

## Task 3: category-store.ts + 测试

**Files:**
- Create: `apps/desktop/src/renderer/src/stores/category-store.ts`
- Modify: `apps/desktop/src/renderer/src/stores/index.ts`
- Test: `apps/desktop/tests/category-store.test.ts`

- [ ] **Step 1: 编写失败测试**

Create `apps/desktop/tests/category-store.test.ts`:

```typescript
// category-store 测试 / category-store tests
// 验证自动 seed 兜底逻辑和并发安全

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Category } from '@shared/types/index.js';

// mock dataAccess 模块（路径相对于测试文件）
// mock dataAccess module (path relative to test file)
vi.mock('../src/renderer/src/data/data-access.js', () => ({
  dataAccess: {
    getCategories: vi.fn(),
    seedCategories: vi.fn(),
  },
}));

import { dataAccess } from '../src/renderer/src/data/data-access.js';
import { useCategoryStore } from '../src/renderer/src/stores/category-store.js';

// 构造基础分类 mock / Build base category mock
function makeCat(overrides: Partial<Category>): Category {
  return {
    id: 'cat-1',
    user_id: 'user-1',
    parent_id: null,
    name: '餐饮',
    type: 'expense',
    icon: null,
    color: null,
    linked_fire_concept: null,
    display_order: 0,
    is_system: 1,
    sync_version: 0,
    updated_at: 0,
    deleted_flag: 0,
    ...overrides,
  };
}

const cat1 = makeCat({ id: 'cat-1', name: '餐饮' });
const cat2 = makeCat({ id: 'cat-2', name: '交通' });

describe('useCategoryStore', () => {
  beforeEach(() => {
    // 重置 store 状态 / Reset store state
    useCategoryStore.setState({ categories: [], loading: false, error: null });
    vi.clearAllMocks();
  });

  it('非空 categories 不触发 seed', async () => {
    vi.mocked(dataAccess.getCategories).mockResolvedValue([cat1]);
    vi.mocked(dataAccess.seedCategories).mockResolvedValue(undefined);

    await useCategoryStore.getState().fetchCategories('user-1');

    expect(dataAccess.getCategories).toHaveBeenCalledTimes(1);
    expect(dataAccess.seedCategories).not.toHaveBeenCalled();
    expect(useCategoryStore.getState().categories).toEqual([cat1]);
    expect(useCategoryStore.getState().loading).toBe(false);
  });

  it('空 categories 触发 seed 后重新 fetch', async () => {
    vi.mocked(dataAccess.getCategories)
      .mockResolvedValueOnce([])           // 第一次返回空
      .mockResolvedValueOnce([cat1, cat2]); // seed 后重新 fetch 返回 2 条
    vi.mocked(dataAccess.seedCategories).mockResolvedValue(undefined);

    await useCategoryStore.getState().fetchCategories('user-1');

    expect(dataAccess.getCategories).toHaveBeenCalledTimes(2);
    expect(dataAccess.seedCategories).toHaveBeenCalledTimes(1);
    expect(dataAccess.seedCategories).toHaveBeenCalledWith('user-1');
    expect(useCategoryStore.getState().categories).toHaveLength(2);
    expect(useCategoryStore.getState().loading).toBe(false);
  });

  it('并发安全：同时两次 fetchCategories，seed 只调用 1 次', async () => {
    vi.mocked(dataAccess.getCategories)
      .mockResolvedValueOnce([])                // call 1 初始
      .mockResolvedValueOnce([])                // call 2 初始
      .mockResolvedValueOnce([cat1, cat2])      // call 1 re-fetch
      .mockResolvedValueOnce([cat1, cat2]);     // call 2 re-fetch
    vi.mocked(dataAccess.seedCategories).mockResolvedValue(undefined);

    const p1 = useCategoryStore.getState().fetchCategories('user-1');
    const p2 = useCategoryStore.getState().fetchCategories('user-1');
    await Promise.all([p1, p2]);

    expect(dataAccess.seedCategories).toHaveBeenCalledTimes(1);
    expect(useCategoryStore.getState().categories).toHaveLength(2);
  });

  it('seed 失败时 error 被设置', async () => {
    vi.mocked(dataAccess.getCategories).mockResolvedValueOnce([]);
    vi.mocked(dataAccess.seedCategories).mockRejectedValue(new Error('seed failed'));

    await useCategoryStore.getState().fetchCategories('user-1');

    expect(useCategoryStore.getState().error).toBe('seed failed');
    expect(useCategoryStore.getState().loading).toBe(false);
  });

  it('clear 重置状态', async () => {
    vi.mocked(dataAccess.getCategories).mockResolvedValue([cat1]);
    await useCategoryStore.getState().fetchCategories('user-1');
    expect(useCategoryStore.getState().categories).toHaveLength(1);

    useCategoryStore.getState().clear();
    expect(useCategoryStore.getState().categories).toEqual([]);
    expect(useCategoryStore.getState().error).toBeNull();
    expect(useCategoryStore.getState().loading).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run:
```bash
cd "/workspace/FIRE APP" && pnpm --filter @fire-app/desktop test -- tests/category-store.test.ts
```
Expected: FAIL — `Cannot find module '../src/renderer/src/stores/category-store.js'`。

- [ ] **Step 3: 编写 category-store 实现**

Create `apps/desktop/src/renderer/src/stores/category-store.ts`:

```typescript
// 分类状态管理 / Category state management
// 带 自动 seed 兜底：首次 fetch 为空时自动 seed 后重新 fetch
// With auto-seed fallback: auto-seed on first empty fetch then re-fetch

import { create } from 'zustand';
import type { Category } from '@shared/types/index.js';
import { dataAccess } from '../data/data-access.js';

interface CategoryStore {
  categories: Category[];
  loading: boolean;
  error: string | null;
  fetchCategories: (userId: string) => Promise<void>;
  clear: () => void;
}

// 模块级 Promise 缓存：防止并发 fetch 时重复 seed
// Module-level Promise cache: prevent duplicate seed on concurrent fetch
let seedInProgress: Promise<void> | null = null;

export const useCategoryStore = create<CategoryStore>((set) => ({
  categories: [],
  loading: false,
  error: null,

  fetchCategories: async (userId) => {
    set({ loading: true, error: null });
    try {
      const list = await dataAccess.getCategories(userId);
      if (list.length === 0) {
        // 首次为空 → 自动 seed
        // First fetch empty → auto-seed
        if (!seedInProgress) {
          seedInProgress = dataAccess.seedCategories(userId)
            .finally(() => { seedInProgress = null; });
        }
        await seedInProgress;
        // seed 完成后重新 fetch
        // Re-fetch after seed completes
        const reList = await dataAccess.getCategories(userId);
        set({ categories: reList, loading: false });
        return;
      }
      set({ categories: list, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  clear: () => set({ categories: [], error: null, loading: false }),
}));
```

- [ ] **Step 4: 修改 stores/index.ts 追加导出**

Modify `apps/desktop/src/renderer/src/stores/index.ts` — 在末尾追加一行：

```typescript
// Store 统一导出 / Store barrel export

export { useAppStore } from './app-store.js';
export { useAccountStore } from './account-store.js';
export { useTransactionStore } from './transaction-store.js';
export { useSnapshotStore } from './snapshot-store.js';
export { useScenarioStore } from './scenario-store.js';
export { useToastStore } from './toast-store.js';
export { useCategoryStore } from './category-store.js';
```

- [ ] **Step 5: 运行测试验证通过**

Run:
```bash
cd "/workspace/FIRE APP" && pnpm --filter @fire-app/desktop test -- tests/category-store.test.ts
```
Expected: 全部 PASS（5 个测试用例）。

- [ ] **Step 6: 提交**

```bash
cd "/workspace/FIRE APP" && git add apps/desktop/src/renderer/src/stores/category-store.ts apps/desktop/src/renderer/src/stores/index.ts apps/desktop/tests/category-store.test.ts && git commit -m "$(cat <<'EOF'
feat(stores): add useCategoryStore with auto-seed fallback and concurrent-safe seed caching
EOF
)"
```

---

## Task 4: TransactionOverviewCards.tsx + 测试

**Files:**
- Create: `apps/desktop/src/renderer/src/components/transactions/TransactionOverviewCards.tsx`
- Test: `apps/desktop/tests/TransactionOverviewCards.test.tsx`

**Card 组件 API 确认**（已读取 `components/base/Card.tsx`）：
```tsx
interface CardProps {
  title?: string;
  extra?: ReactNode;
  children: ReactNode;
  padding?: boolean;  // 默认 true → 包裹 p-6
}
// 无 className prop
```

- [ ] **Step 1: 编写失败测试**

Create `apps/desktop/tests/TransactionOverviewCards.test.tsx`:

```typescript
// TransactionOverviewCards 组件测试 / TransactionOverviewCards component tests

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Transaction } from '@shared/types/index.js';
import { TransactionOverviewCards } from '@renderer/components/transactions/TransactionOverviewCards.js';

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

describe('TransactionOverviewCards', () => {
  it('渲染 3 张卡，显示正确的金额', () => {
    const txs = [
      makeTx({ id: 'tx-1', transaction_type: 'income', amount: 10000 }),
      makeTx({ id: 'tx-2', transaction_type: 'expense', amount: 3000 }),
    ];
    render(<TransactionOverviewCards transactions={txs} />);

    // 3 张卡：收入、支出、结余
    expect(screen.getByText('收入')).toBeInTheDocument();
    expect(screen.getByText('支出')).toBeInTheDocument();
    expect(screen.getByText('结余')).toBeInTheDocument();

    // 收入 10000 分 = 100.00 元
    expect(screen.getByText('收入').closest('.bg-white')!).toHaveTextContent('100.00');
    // 支出 3000 分 = 30.00 元
    expect(screen.getByText('支出').closest('.bg-white')!).toHaveTextContent('30.00');
    // 结余 = 100 - 30 = 70.00 元
    expect(screen.getByText('结余').closest('.bg-white')!).toHaveTextContent('70.00');
  });

  it('transactions 为空数组时正常渲染（显示 ¥0.00）', () => {
    render(<TransactionOverviewCards transactions={[]} />);

    expect(screen.getByText('收入')).toBeInTheDocument();
    expect(screen.getByText('支出')).toBeInTheDocument();
    expect(screen.getByText('结余')).toBeInTheDocument();

    // 全部显示 0.00
    expect(screen.getByText('收入').closest('.bg-white')!).toHaveTextContent('0.00');
    expect(screen.getByText('支出').closest('.bg-white')!).toHaveTextContent('0.00');
    expect(screen.getByText('结余').closest('.bg-white')!).toHaveTextContent('0.00');
  });

  it('负数结余显示红色（text-red-600 class）', () => {
    const txs = [
      makeTx({ id: 'tx-1', transaction_type: 'income', amount: 5000 }),
      makeTx({ id: 'tx-2', transaction_type: 'expense', amount: 10000 }),
    ];
    const { container } = render(<TransactionOverviewCards transactions={txs} />);

    // 结余 = 50 - 100 = -50 元 → 负数 → 应有 text-red-600 class
    const balanceLabel = screen.getByText('结余');
    const balanceCard = balanceLabel.closest('.bg-white')!;
    const balanceValue = balanceCard.querySelector('.text-xl')!;
    expect(balanceValue.className).toContain('text-red-600');
  });

  it('正数结余不显示红色', () => {
    const txs = [
      makeTx({ id: 'tx-1', transaction_type: 'income', amount: 10000 }),
    ];
    render(<TransactionOverviewCards transactions={txs} />);

    const balanceLabel = screen.getByText('结余');
    const balanceCard = balanceLabel.closest('.bg-white')!;
    const balanceValue = balanceCard.querySelector('.text-xl')!;
    expect(balanceValue.className).not.toContain('text-red-600');
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run:
```bash
cd "/workspace/FIRE APP" && pnpm --filter @fire-app/desktop test -- tests/TransactionOverviewCards.test.tsx
```
Expected: FAIL — `Cannot find module '@renderer/components/transactions/TransactionOverviewCards.js'`。

- [ ] **Step 3: 编写实现**

Create `apps/desktop/src/renderer/src/components/transactions/TransactionOverviewCards.tsx`:

```tsx
// 交易概览卡片 / Transaction overview cards
// 展示 3 张卡：收入（含 initial_balance）/ 支出 / 结余
// Display 3 cards: income (incl. initial_balance) / expense / balance

import type { Transaction } from '@shared/types/index.js';
import { Card } from '../base/Card.js';
import { computeOverview, formatAmount } from './transaction-constants.js';

interface TransactionOverviewCardsProps {
  transactions: Transaction[];
}

export function TransactionOverviewCards({ transactions }: TransactionOverviewCardsProps) {
  const overview = computeOverview(transactions);

  return (
    <div className="grid grid-cols-3 gap-4">
      {/* 收入卡 / Income card */}
      <Card>
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
          <span className="text-sm text-gray-500">收入</span>
        </div>
        <div className="text-xl font-semibold text-gray-900">{formatAmount(overview.income)}</div>
      </Card>

      {/* 支出卡 / Expense card */}
      <Card>
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
          <span className="text-sm text-gray-500">支出</span>
        </div>
        <div className="text-xl font-semibold text-gray-900">{formatAmount(overview.expense)}</div>
      </Card>

      {/* 结余卡 / Balance card */}
      <Card>
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-sm text-gray-500">结余</span>
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
cd "/workspace/FIRE APP" && pnpm --filter @fire-app/desktop test -- tests/TransactionOverviewCards.test.tsx
```
Expected: 全部 PASS（4 个测试用例）。

- [ ] **Step 5: 提交**

```bash
cd "/workspace/FIRE APP" && git add apps/desktop/src/renderer/src/components/transactions/TransactionOverviewCards.tsx apps/desktop/tests/TransactionOverviewCards.test.tsx && git commit -m "$(cat <<'EOF'
feat(transactions): add TransactionOverviewCards with income/expense/balance cards
EOF
)"
```

---

## Task 5: TransactionFilters.tsx + 测试

**Files:**
- Create: `apps/desktop/src/renderer/src/components/transactions/TransactionFilters.tsx`
- Test: `apps/desktop/tests/TransactionFilters.test.tsx`

- [ ] **Step 1: 编写失败测试**

Create `apps/desktop/tests/TransactionFilters.test.tsx`:

```typescript
// TransactionFilters 组件测试 / TransactionFilters component tests

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Account, Category } from '@shared/types/index.js';
import { TransactionFilters } from '@renderer/components/transactions/TransactionFilters.js';
import type { TransactionFilters as Filters } from '@renderer/components/transactions/transaction-constants.js';

const accounts: Account[] = [
  { id: 'acc-1', user_id: 'user-1', name: '招行活期', asset_class: 'liquid', account_type: 'checking', current_balance: 100000, note: null, sync_version: 0, updated_at: 0, deleted_flag: 0 },
  { id: 'acc-2', user_id: 'user-1', name: '支付宝', asset_class: 'liquid', account_type: 'checking', current_balance: 50000, note: null, sync_version: 0, updated_at: 0, deleted_flag: 0 },
];

const categories: Category[] = [
  { id: 'cat-1', user_id: 'user-1', parent_id: null, name: '餐饮', type: 'expense', icon: null, color: null, linked_fire_concept: null, display_order: 0, is_system: 1, sync_version: 0, updated_at: 0, deleted_flag: 0 },
  { id: 'cat-2', user_id: 'user-1', parent_id: null, name: '工资', type: 'income', icon: null, color: null, linked_fire_concept: null, display_order: 1, is_system: 1, sync_version: 0, updated_at: 0, deleted_flag: 0 },
];

const EMPTY_FILTERS: Filters = { type: '', account_id: '', category_id: '', dateFrom: '', dateTo: '' };

describe('TransactionFilters', () => {
  it('渲染 5 个筛选项（3 个 Select + 2 个日期 Input）', () => {
    render(
      <TransactionFilters
        filters={EMPTY_FILTERS}
        accounts={accounts}
        categories={categories}
        onFiltersChange={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    // 3 个 select
    const selects = screen.getAllByRole('combobox');
    expect(selects).toHaveLength(3);

    // 2 个 date input
    const dateInputs = document.querySelectorAll('input[type="date"]');
    expect(dateInputs).toHaveLength(2);

    // 全部类型 / 全部账户 / 全部分类
    expect(screen.getByText('全部类型')).toBeInTheDocument();
    expect(screen.getByText('全部账户')).toBeInTheDocument();
    expect(screen.getByText('全部分类')).toBeInTheDocument();
  });

  it('改变 type Select 触发 onFiltersChange', async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    render(
      <TransactionFilters
        filters={EMPTY_FILTERS}
        accounts={accounts}
        categories={categories}
        onFiltersChange={onFiltersChange}
        onReset={vi.fn()}
      />,
    );

    const selects = screen.getAllByRole('combobox');
    // 第一个 select 是 type
    await user.selectOptions(selects[0], 'expense');

    expect(onFiltersChange).toHaveBeenCalledWith({ ...EMPTY_FILTERS, type: 'expense' });
  });

  it('改变 account Select 触发 onFiltersChange', async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    render(
      <TransactionFilters
        filters={EMPTY_FILTERS}
        accounts={accounts}
        categories={categories}
        onFiltersChange={onFiltersChange}
        onReset={vi.fn()}
      />,
    );

    const selects = screen.getAllByRole('combobox');
    // 第二个 select 是 account
    await user.selectOptions(selects[1], 'acc-1');

    expect(onFiltersChange).toHaveBeenCalledWith({ ...EMPTY_FILTERS, account_id: 'acc-1' });
  });

  it('点击重置按钮触发 onReset', async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    render(
      <TransactionFilters
        filters={EMPTY_FILTERS}
        accounts={accounts}
        categories={categories}
        onFiltersChange={vi.fn()}
        onReset={onReset}
      />,
    );

    const resetButton = screen.getByText('重置');
    await user.click(resetButton);

    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('accounts 正确映射为选项', () => {
    render(
      <TransactionFilters
        filters={EMPTY_FILTERS}
        accounts={accounts}
        categories={categories}
        onFiltersChange={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    expect(screen.getByText('招行活期')).toBeInTheDocument();
    expect(screen.getByText('支付宝')).toBeInTheDocument();
  });

  it('categories 正确映射为选项', () => {
    render(
      <TransactionFilters
        filters={EMPTY_FILTERS}
        accounts={accounts}
        categories={categories}
        onFiltersChange={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    expect(screen.getByText('餐饮')).toBeInTheDocument();
    expect(screen.getByText('工资')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run:
```bash
cd "/workspace/FIRE APP" && pnpm --filter @fire-app/desktop test -- tests/TransactionFilters.test.tsx
```
Expected: FAIL — `Cannot find module '@renderer/components/transactions/TransactionFilters.js'`。

- [ ] **Step 3: 编写实现**

Create `apps/desktop/src/renderer/src/components/transactions/TransactionFilters.tsx`:

```tsx
// 交易筛选组件 / Transaction filter component
// 受控组件：5 个筛选项（类型/账户/分类/开始日期/结束日期）+ 重置按钮
// Controlled component: 5 filters (type/account/category/dateFrom/dateTo) + reset button

import type { Account, Category } from '@shared/types/index.js';
import type { TransactionFilters as Filters } from './transaction-constants.js';
import { Select } from '../base/Select.js';
import { Input } from '../base/Input.js';
import { Button } from '../base/Button.js';
import { TRANSACTION_TYPE_OPTIONS } from './transaction-constants.js';

interface TransactionFiltersProps {
  filters: Filters;
  accounts: Account[];
  categories: Category[];
  onFiltersChange: (f: Filters) => void;
  onReset: () => void;
}

// 类型选项：全部类型 + 4 种交易类型
// Type options: all types + 4 transaction types
const TYPE_OPTIONS = [{ label: '全部类型', value: '' }, ...TRANSACTION_TYPE_OPTIONS];

export function TransactionFilters({ filters, accounts, categories, onFiltersChange, onReset }: TransactionFiltersProps) {
  const accountOptions = [
    { label: '全部账户', value: '' },
    ...accounts.map((a) => ({ label: a.name, value: a.id })),
  ];
  const categoryOptions = [
    { label: '全部分类', value: '' },
    ...categories.map((c) => ({ label: c.name, value: c.id })),
  ];

  const update = (patch: Partial<Filters>) => onFiltersChange({ ...filters, ...patch });

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="grid grid-cols-5 gap-3">
        <Select options={TYPE_OPTIONS} value={filters.type} onChange={(v) => update({ type: v })} />
        <Select options={accountOptions} value={filters.account_id} onChange={(v) => update({ account_id: v })} />
        <Select options={categoryOptions} value={filters.category_id} onChange={(v) => update({ category_id: v })} />
        <Input type="date" value={filters.dateFrom} onChange={(v) => update({ dateFrom: v })} />
        <Input type="date" value={filters.dateTo} onChange={(v) => update({ dateTo: v })} />
      </div>
      <div className="mt-3 flex justify-end">
        <Button variant="secondary" size="sm" onClick={onReset}>重置</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 运行测试验证通过**

Run:
```bash
cd "/workspace/FIRE APP" && pnpm --filter @fire-app/desktop test -- tests/TransactionFilters.test.tsx
```
Expected: 全部 PASS（6 个测试用例）。

- [ ] **Step 5: 提交**

```bash
cd "/workspace/FIRE APP" && git add apps/desktop/src/renderer/src/components/transactions/TransactionFilters.tsx apps/desktop/tests/TransactionFilters.test.tsx && git commit -m "$(cat <<'EOF'
feat(transactions): add TransactionFilters controlled component with type/account/category/date filters
EOF
)"
```

---

## Task 6: TransactionListTable.tsx + 测试

**Files:**
- Create: `apps/desktop/src/renderer/src/components/transactions/TransactionListTable.tsx`
- Test: `apps/desktop/tests/TransactionListTable.test.tsx`

- [ ] **Step 1: 编写失败测试**

Create `apps/desktop/tests/TransactionListTable.test.tsx`:

```typescript
// TransactionListTable 组件测试 / TransactionListTable component tests

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Transaction, Account, Category } from '@shared/types/index.js';
import { TransactionListTable } from '@renderer/components/transactions/TransactionListTable.js';

function makeTx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'tx-1',
    user_id: 'user-1',
    account_id: 'acc-1',
    to_account_id: null,
    category_id: null,
    recurring_id: null,
    transaction_type: 'expense',
    amount: 10000,
    transaction_date: new Date('2026-07-15').getTime(),
    description: '午餐',
    sync_version: 0,
    updated_at: 0,
    deleted_flag: 0,
    ...overrides,
  };
}

const accounts: Account[] = [
  { id: 'acc-1', user_id: 'user-1', name: '招行活期', asset_class: 'liquid', account_type: 'checking', current_balance: 100000, note: null, sync_version: 0, updated_at: 0, deleted_flag: 0 },
  { id: 'acc-2', user_id: 'user-1', name: '支付宝', asset_class: 'liquid', account_type: 'checking', current_balance: 50000, note: null, sync_version: 0, updated_at: 0, deleted_flag: 0 },
];

const categories: Category[] = [
  { id: 'cat-1', user_id: 'user-1', parent_id: null, name: '餐饮', type: 'expense', icon: null, color: null, linked_fire_concept: null, display_order: 0, is_system: 1, sync_version: 0, updated_at: 0, deleted_flag: 0 },
];

describe('TransactionListTable', () => {
  it('渲染交易行（类型标签、日期、金额）', () => {
    const txs = [makeTx({ id: 'tx-1', transaction_type: 'expense', amount: 5000, description: '午餐' })];
    render(
      <TransactionListTable
        transactions={txs}
        loading={false}
        accounts={accounts}
        categories={categories}
        hasActiveFilters={false}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText('支出')).toBeInTheDocument();
    expect(screen.getByText('2026-07-15')).toBeInTheDocument();
    expect(screen.getByText('午餐')).toBeInTheDocument();
    // 金额 5000 分 = 50.00 元，支出带负号
    expect(screen.getByText(/50\.00/)).toBeInTheDocument();
  });

  it('transfer 显示 source → target', () => {
    const txs = [makeTx({
      id: 'tx-1',
      transaction_type: 'transfer',
      account_id: 'acc-1',
      to_account_id: 'acc-2',
      amount: 20000,
      description: null,
    })];
    render(
      <TransactionListTable
        transactions={txs}
        loading={false}
        accounts={accounts}
        categories={categories}
        hasActiveFilters={false}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText('招行活期 → 支付宝')).toBeInTheDocument();
  });

  it('排序 Select 切换触发重排', async () => {
    const user = userEvent.setup();
    const txs = [
      makeTx({ id: 'tx-a', amount: 3000, transaction_date: new Date('2026-07-10').getTime() }),
      makeTx({ id: 'tx-b', amount: 10000, transaction_date: new Date('2026-07-15').getTime() }),
    ];
    render(
      <TransactionListTable
        transactions={txs}
        loading={false}
        accounts={accounts}
        categories={categories}
        hasActiveFilters={false}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    // 默认 date-desc：tx-b (Jul 15) 在前
    const sortSelect = screen.getByDisplayValue('日期降序');
    await user.selectOptions(sortSelect, 'amount-asc');

    // amount-asc：tx-a (3000) 在前
    // 验证第一行的日期是 07-10
    const rows = screen.getAllByRole('row');
    // rows[0] 是表头，rows[1] 是第一条数据
    expect(rows[1]).toHaveTextContent('2026-07-10');
  });

  it('空状态：无筛选时显示"暂无交易记录"', () => {
    render(
      <TransactionListTable
        transactions={[]}
        loading={false}
        accounts={accounts}
        categories={categories}
        hasActiveFilters={false}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText('暂无交易记录')).toBeInTheDocument();
  });

  it('空状态：有筛选时显示"无匹配交易"', () => {
    render(
      <TransactionListTable
        transactions={[]}
        loading={false}
        accounts={accounts}
        categories={categories}
        hasActiveFilters={true}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText('无匹配交易')).toBeInTheDocument();
  });

  it('编辑/删除按钮回调', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const txs = [makeTx({ id: 'tx-1' })];
    render(
      <TransactionListTable
        transactions={txs}
        loading={false}
        accounts={accounts}
        categories={categories}
        hasActiveFilters={false}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    );

    await user.click(screen.getByText('编辑'));
    expect(onEdit).toHaveBeenCalledWith(txs[0]);

    await user.click(screen.getByText('删除'));
    expect(onDelete).toHaveBeenCalledWith(txs[0]);
  });

  it('有分类时显示分类名称', () => {
    const txs = [makeTx({ id: 'tx-1', category_id: 'cat-1' })];
    render(
      <TransactionListTable
        transactions={txs}
        loading={false}
        accounts={accounts}
        categories={categories}
        hasActiveFilters={false}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText('餐饮')).toBeInTheDocument();
  });

  it('无分类时显示 —', () => {
    const txs = [makeTx({ id: 'tx-1', category_id: null, transaction_type: 'transfer' })];
    render(
      <TransactionListTable
        transactions={txs}
        loading={false}
        accounts={accounts}
        categories={categories}
        hasActiveFilters={false}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    // transfer 没有 category_id → 显示 —
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run:
```bash
cd "/workspace/FIRE APP" && pnpm --filter @fire-app/desktop test -- tests/TransactionListTable.test.tsx
```
Expected: FAIL — `Cannot find module '@renderer/components/transactions/TransactionListTable.js'`。

- [ ] **Step 3: 编写实现**

Create `apps/desktop/src/renderer/src/components/transactions/TransactionListTable.tsx`:

```tsx
// 交易列表表格 / Transaction list table
// 展示交易列表，支持排序（内嵌 Select）与行内编辑/删除操作
// Display transaction list, support sorting (inline Select) and row edit/delete actions

import { useMemo, useState } from 'react';
import type { Transaction, Account, Category } from '@shared/types/index.js';
import { Table, type TableColumn } from '../base/Table.js';
import { Button } from '../base/Button.js';
import { Select } from '../base/Select.js';
import { EmptyState } from '../auxiliary/EmptyState.js';
import {
  TRANSACTION_TYPE_CONFIG,
  formatAmount,
  formatDate,
  sortTransactions,
} from './transaction-constants.js';

interface TransactionListTableProps {
  transactions: Transaction[];   // 已筛选未排序
  loading: boolean;
  accounts: Account[];
  categories: Category[];
  hasActiveFilters: boolean;     // 用于判断空状态文案
  onEdit: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
}

// 排序选项 / Sort options
const SORT_OPTIONS = [
  { label: '日期降序', value: 'date-desc' },
  { label: '日期升序', value: 'date-asc' },
  { label: '金额降序', value: 'amount-desc' },
  { label: '金额升序', value: 'amount-asc' },
];

// 辅助函数：查找账户名 / Helper: find account name
function getAccountName(accounts: Account[], id: string | null): string {
  if (!id) return '—';
  return accounts.find((a) => a.id === id)?.name ?? '—';
}

// 辅助函数：查找分类名 / Helper: find category name
function getCategoryName(categories: Category[], id: string | null): string {
  if (!id) return '—';
  return categories.find((c) => c.id === id)?.name ?? '—';
}

export function TransactionListTable({
  transactions, loading, accounts, categories, hasActiveFilters, onEdit, onDelete,
}: TransactionListTableProps) {
  const [sortBy, setSortBy] = useState('date-desc');

  const sortedTxs = useMemo(() => sortTransactions(transactions, sortBy), [transactions, sortBy]);

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
    // 分类 / Category
    {
      key: 'category',
      title: '分类',
      render: (r) => (
        <span className="text-gray-600">
          {r.category_id ? getCategoryName(categories, r.category_id) : '—'}
        </span>
      ),
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
    // 操作：编辑/删除 / Actions: edit/delete
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
      {/* 排序 Select：仅有数据且非 loading 时显示 */}
      {/* Sort Select: only show when has data and not loading */}
      {sortedTxs.length > 0 && !loading && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">排序：</span>
          <div className="w-40">
            <Select options={SORT_OPTIONS} value={sortBy} onChange={setSortBy} />
          </div>
        </div>
      )}

      {/* 表格 / 空状态 / Table / Empty state */}
      {loading ? (
        <Table columns={columns} data={[]} loading={true} />
      ) : sortedTxs.length === 0 ? (
        <EmptyState
          title={hasActiveFilters ? '无匹配交易' : '暂无交易记录'}
          description={hasActiveFilters ? '试试调整筛选条件' : '点击右上角「新增交易」开始记录'}
        />
      ) : (
        <Table columns={columns} data={sortedTxs} />
      )}
    </div>
  );
}
```

- [ ] **Step 4: 运行测试验证通过**

Run:
```bash
cd "/workspace/FIRE APP" && pnpm --filter @fire-app/desktop test -- tests/TransactionListTable.test.tsx
```
Expected: 全部 PASS（8 个测试用例）。

- [ ] **Step 5: 提交**

```bash
cd "/workspace/FIRE APP" && git add apps/desktop/src/renderer/src/components/transactions/TransactionListTable.tsx apps/desktop/tests/TransactionListTable.test.tsx && git commit -m "$(cat <<'EOF'
feat(transactions): add TransactionListTable with inline sort, transfer display, and empty states
EOF
)"
```

---

## Task 7: TransactionFormModal.tsx + 测试

**Files:**
- Create: `apps/desktop/src/renderer/src/components/transactions/TransactionFormModal.tsx`
- Test: `apps/desktop/tests/TransactionFormModal.test.tsx`

- [ ] **Step 1: 编写失败测试**

Create `apps/desktop/tests/TransactionFormModal.test.tsx`:

```typescript
// TransactionFormModal 组件测试 / TransactionFormModal component tests

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Transaction, Account, Category } from '@shared/types/index.js';
import { TransactionFormModal } from '@renderer/components/transactions/TransactionFormModal.js';

function makeTx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'tx-1',
    user_id: 'user-1',
    account_id: 'acc-1',
    to_account_id: null,
    category_id: 'cat-1',
    recurring_id: null,
    transaction_type: 'expense',
    amount: 5000,
    transaction_date: new Date('2026-07-15').getTime(),
    description: '午餐',
    sync_version: 0,
    updated_at: 0,
    deleted_flag: 0,
    ...overrides,
  };
}

const accounts: Account[] = [
  { id: 'acc-1', user_id: 'user-1', name: '招行活期', asset_class: 'liquid', account_type: 'checking', current_balance: 100000, note: null, sync_version: 0, updated_at: 0, deleted_flag: 0 },
  { id: 'acc-2', user_id: 'user-1', name: '支付宝', asset_class: 'liquid', account_type: 'checking', current_balance: 50000, note: null, sync_version: 0, updated_at: 0, deleted_flag: 0 },
];

const categories: Category[] = [
  { id: 'cat-1', user_id: 'user-1', parent_id: null, name: '餐饮', type: 'expense', icon: null, color: null, linked_fire_concept: null, display_order: 0, is_system: 1, sync_version: 0, updated_at: 0, deleted_flag: 0 },
  { id: 'cat-2', user_id: 'user-1', parent_id: null, name: '工资', type: 'income', icon: null, color: null, linked_fire_concept: null, display_order: 1, is_system: 1, sync_version: 0, updated_at: 0, deleted_flag: 0 },
];

describe('TransactionFormModal', () => {
  it('create 模式渲染空表单（type 默认 expense）', () => {
    render(
      <TransactionFormModal
        open={true}
        mode="create"
        userId="user-1"
        accounts={accounts}
        categories={categories}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('新增交易')).toBeInTheDocument();
    // type 默认 expense → 显示 "支出"
    expect(screen.getByDisplayValue('支出')).toBeInTheDocument();
    // 账户未选 → 显示 placeholder
    expect(screen.getByDisplayValue('请选择账户')).toBeInTheDocument();
  });

  it('edit 模式预填字段', async () => {
    const tx = makeTx({ id: 'tx-1', transaction_type: 'expense', account_id: 'acc-1', amount: 5000, description: '午餐' });
    render(
      <TransactionFormModal
        open={true}
        mode="edit"
        transaction={tx}
        userId="user-1"
        accounts={accounts}
        categories={categories}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('编辑交易')).toBeInTheDocument();
    // 等待 useEffect 预填
    await waitFor(() => {
      expect(screen.getByDisplayValue('招行活期')).toBeInTheDocument();
    });
    // 金额 5000 分 = 50.00 元
    expect(screen.getByDisplayValue('50')).toBeInTheDocument();
    // 描述
    expect(screen.getByDisplayValue('午餐')).toBeInTheDocument();
  });

  it('切换 type 到 transfer 时显示 to_account_id', async () => {
    const user = userEvent.setup();
    render(
      <TransactionFormModal
        open={true}
        mode="create"
        userId="user-1"
        accounts={accounts}
        categories={categories}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    // 初始没有目标账户选择
    expect(screen.queryByText('目标账户')).not.toBeInTheDocument();

    // 切换到 transfer
    const typeSelect = screen.getByDisplayValue('支出');
    await user.selectOptions(typeSelect, 'transfer');

    // 显示目标账户 Select
    expect(screen.getByText('目标账户')).toBeInTheDocument();
  });

  it('切换 type 从 transfer 到 expense 时隐藏 to_account_id', async () => {
    const user = userEvent.setup();
    render(
      <TransactionFormModal
        open={true}
        mode="create"
        userId="user-1"
        accounts={accounts}
        categories={categories}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    // 先切换到 transfer
    const typeSelect = screen.getByDisplayValue('支出');
    await user.selectOptions(typeSelect, 'transfer');
    expect(screen.getByText('目标账户')).toBeInTheDocument();

    // 再切换回 expense
    await user.selectOptions(typeSelect, 'expense');
    expect(screen.queryByText('目标账户')).not.toBeInTheDocument();
  });

  it('校验：amount 为空时显示错误', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <TransactionFormModal
        open={true}
        mode="create"
        userId="user-1"
        accounts={accounts}
        categories={categories}
        onSubmit={onSubmit}
        onClose={vi.fn()}
      />,
    );

    // 选择账户但不填金额
    const selects = screen.getAllByRole('combobox');
    // selects[0] = type, selects[1] = account
    await user.selectOptions(selects[1], 'acc-1');

    // 填日期
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    await user.type(dateInput, '2026-07-15');

    // 提交
    await user.click(screen.getByText('确定'));

    expect(screen.getByText('请输入有效金额')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('校验：transfer 时 to_account_id = account_id 显示错误', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <TransactionFormModal
        open={true}
        mode="create"
        userId="user-1"
        accounts={accounts}
        categories={categories}
        onSubmit={onSubmit}
        onClose={vi.fn()}
      />,
    );

    // 切换到 transfer
    const typeSelect = screen.getByDisplayValue('支出');
    await user.selectOptions(typeSelect, 'transfer');

    // 选择源账户和目标账户为同一个
    const selects = screen.getAllByRole('combobox');
    // selects[0] = type, selects[1] = account, selects[2] = to_account
    await user.selectOptions(selects[1], 'acc-1');
    await user.selectOptions(selects[2], 'acc-1');

    // 填金额
    const amountInput = document.querySelector('input[type="number"]') as HTMLInputElement;
    await user.type(amountInput, '100');

    // 填日期
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    await user.type(dateInput, '2026-07-15');

    // 提交
    await user.click(screen.getByText('确定'));

    expect(screen.getByText('目标账户不能与源账户相同')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('提交：create 构造正确 input', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <TransactionFormModal
        open={true}
        mode="create"
        userId="user-1"
        accounts={accounts}
        categories={categories}
        onSubmit={onSubmit}
        onClose={vi.fn()}
      />,
    );

    // type 默认 expense
    // 选择账户
    const selects = screen.getAllByRole('combobox');
    await user.selectOptions(selects[1], 'acc-1');

    // 选择分类
    await user.selectOptions(selects[2], 'cat-1');

    // 填金额 100 元 = 10000 分
    const amountInput = document.querySelector('input[type="number"]') as HTMLInputElement;
    await user.type(amountInput, '100');

    // 填日期
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    await user.type(dateInput, '2026-07-15');

    // 填描述
    const textInput = document.querySelector('input[type="text"]') as HTMLInputElement;
    await user.type(textInput, '测试');

    // 提交
    await user.click(screen.getByText('确定'));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const input = onSubmit.mock.calls[0][0];
    expect(input).toEqual(
      expect.objectContaining({
        user_id: 'user-1',
        account_id: 'acc-1',
        to_account_id: null,
        category_id: 'cat-1',
        transaction_type: 'expense',
        amount: 10000,
        description: '测试',
      }),
    );
    // transaction_date 应为 2026-07-15 的时间戳
    expect(input.transaction_date).toBe(new Date('2026-07-15').getTime());
  });

  it('提交：edit 构造正确 input（不含 user_id，非 transfer 时 to_account_id=null）', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const tx = makeTx({
      id: 'tx-1',
      transaction_type: 'expense',
      account_id: 'acc-1',
      to_account_id: null,
      category_id: 'cat-1',
      amount: 5000,
      description: '午餐',
    });
    render(
      <TransactionFormModal
        open={true}
        mode="edit"
        transaction={tx}
        userId="user-1"
        accounts={accounts}
        categories={categories}
        onSubmit={onSubmit}
        onClose={vi.fn()}
      />,
    );

    // 等待预填
    await waitFor(() => {
      expect(screen.getByDisplayValue('招行活期')).toBeInTheDocument();
    });

    // 提交
    await user.click(screen.getByText('确定'));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const input = onSubmit.mock.calls[0][0];
    expect(input).toEqual(
      expect.objectContaining({
        account_id: 'acc-1',
        to_account_id: null,
        category_id: 'cat-1',
        transaction_type: 'expense',
        amount: 5000,
        description: '午餐',
      }),
    );
    // edit 模式不含 user_id
    expect(input).not.toHaveProperty('user_id');
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run:
```bash
cd "/workspace/FIRE APP" && pnpm --filter @fire-app/desktop test -- tests/TransactionFormModal.test.tsx
```
Expected: FAIL — `Cannot find module '@renderer/components/transactions/TransactionFormModal.js'`。

- [ ] **Step 3: 编写实现**

Create `apps/desktop/src/renderer/src/components/transactions/TransactionFormModal.tsx`:

```tsx
// 交易新增/编辑表单弹窗 / Transaction create/edit form modal
// mode='create' 空表单；mode='edit' 预填充
// transfer 时显示 to_account_id 并校验 ≠ account_id；非 transfer 时 to_account_id 强制 null

import { useEffect, useState } from 'react';
import type { Transaction, TransactionType, Account, Category } from '@shared/types/index.js';
import type { CreateTransactionInput, EditTransactionInput } from '@shared/services/transaction-service.js';
import { yuanToCents, centsToYuan } from '@shared/utils/money.js';
import { Modal } from '../base/Modal.js';
import { Input } from '../base/Input.js';
import { Select } from '../base/Select.js';
import { Button } from '../base/Button.js';
import { TRANSACTION_TYPE_OPTIONS, formatDate } from './transaction-constants.js';

interface TransactionFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  transaction?: Transaction;
  userId?: string;
  accounts: Account[];
  categories: Category[];
  loading?: boolean;
  onSubmit: (input: CreateTransactionInput | EditTransactionInput) => void;
  onClose: () => void;
}

interface FormErrors {
  accountId?: string;
  toAccountId?: string;
  amount?: string;
  transactionDate?: string;
}

export function TransactionFormModal({
  open, mode, transaction, userId, accounts, categories, loading, onSubmit, onClose,
}: TransactionFormModalProps) {
  const [transactionType, setTransactionType] = useState<TransactionType>('expense');
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [transactionDate, setTransactionDate] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  // 打开时根据 mode 初始化表单值
  // Initialize form values on open based on mode
  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && transaction) {
      setTransactionType(transaction.transaction_type);
      setAccountId(transaction.account_id);
      setToAccountId(transaction.to_account_id ?? '');
      setCategoryId(transaction.category_id ?? '');
      setAmount(centsToYuan(transaction.amount).toString());
      setTransactionDate(formatDate(transaction.transaction_date));
      setDescription(transaction.description ?? '');
    } else {
      setTransactionType('expense');
      setAccountId('');
      setToAccountId('');
      setCategoryId('');
      setAmount('');
      setTransactionDate('');
      setDescription('');
    }
    setErrors({});
  }, [open, mode, transaction]);

  const isTransfer = transactionType === 'transfer';

  // 账户选项 / Account options
  const accountOptions = accounts.map((a) => ({ label: a.name, value: a.id }));
  // 分类选项：包含"不选分类" / Category options: includes "no category"
  const categoryOptions = [
    { label: '不选分类', value: '' },
    ...categories.map((c) => ({ label: c.name, value: c.id })),
  ];

  const handleSubmit = () => {
    const errs: FormErrors = {};
    if (!accountId) errs.accountId = '请选择账户';
    if (!amount || Number(amount) <= 0) errs.amount = '请输入有效金额';
    if (isTransfer) {
      if (!toAccountId) errs.toAccountId = '请选择目标账户';
      if (toAccountId && toAccountId === accountId) errs.toAccountId = '目标账户不能与源账户相同';
    }
    if (!transactionDate) errs.transactionDate = '请选择日期';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    // 非 transfer 时 to_account_id 强制 null
    // Force to_account_id to null for non-transfer
    const resolvedToAccountId = isTransfer ? toAccountId : null;
    const resolvedCategoryId = categoryId || null;
    const resolvedAmount = yuanToCents(Number(amount));
    const resolvedDate = new Date(transactionDate).getTime();
    const resolvedDescription = description.trim() || null;

    if (mode === 'create') {
      const input: CreateTransactionInput = {
        user_id: userId ?? '',
        account_id: accountId,
        to_account_id: resolvedToAccountId,
        category_id: resolvedCategoryId,
        transaction_type: transactionType,
        amount: resolvedAmount,
        transaction_date: resolvedDate,
        description: resolvedDescription,
      };
      onSubmit(input);
    } else {
      const input: EditTransactionInput = {
        account_id: accountId,
        to_account_id: resolvedToAccountId,
        category_id: resolvedCategoryId,
        transaction_type: transactionType,
        amount: resolvedAmount,
        transaction_date: resolvedDate,
        description: resolvedDescription,
      };
      onSubmit(input);
    }
  };

  return (
    <Modal
      open={open}
      title={mode === 'create' ? '新增交易' : '编辑交易'}
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
        {/* 交易类型 / Transaction type */}
        <Select
          label="交易类型"
          options={TRANSACTION_TYPE_OPTIONS}
          value={transactionType}
          required
          onChange={(v) => setTransactionType(v as TransactionType)}
        />

        {/* 账户 / Account */}
        <Select
          label="账户"
          options={accountOptions}
          value={accountId}
          required
          error={errors.accountId}
          placeholder="请选择账户"
          onChange={setAccountId}
        />

        {/* 目标账户：仅 transfer 时显示 / Target account: only show for transfer */}
        {isTransfer && (
          <Select
            label="目标账户"
            options={accountOptions}
            value={toAccountId}
            required
            error={errors.toAccountId}
            placeholder="请选择目标账户"
            onChange={setToAccountId}
          />
        )}

        {/* 分类（可选） / Category (optional) */}
        <Select
          label="分类"
          options={categoryOptions}
          value={categoryId}
          onChange={setCategoryId}
        />

        {/* 金额 / Amount */}
        <Input
          label="金额"
          type="number"
          value={amount}
          required
          prefix="¥"
          error={errors.amount}
          placeholder="请输入金额"
          onChange={setAmount}
        />

        {/* 日期 / Date */}
        <Input
          label="日期"
          type="date"
          value={transactionDate}
          required
          error={errors.transactionDate}
          onChange={setTransactionDate}
        />

        {/* 描述（可选） / Description (optional) */}
        <Input
          label="描述"
          type="text"
          value={description}
          placeholder="可选，交易备注"
          onChange={setDescription}
        />
      </div>
    </Modal>
  );
}
```

- [ ] **Step 4: 运行测试验证通过**

Run:
```bash
cd "/workspace/FIRE APP" && pnpm --filter @fire-app/desktop test -- tests/TransactionFormModal.test.tsx
```
Expected: 全部 PASS（8 个测试用例）。

- [ ] **Step 5: 提交**

```bash
cd "/workspace/FIRE APP" && git add apps/desktop/src/renderer/src/components/transactions/TransactionFormModal.tsx apps/desktop/tests/TransactionFormModal.test.tsx && git commit -m "$(cat <<'EOF'
feat(transactions): add TransactionFormModal with transfer linkage, validation, and create/edit modes
EOF
)"
```

---

## Task 8: TransactionsPage.tsx + 测试

**Files:**
- Modify: `apps/desktop/src/renderer/src/pages/TransactionsPage.tsx`（替换占位页）
- Test: `apps/desktop/tests/TransactionsPage.test.tsx`

- [ ] **Step 1: 编写失败测试**

Create `apps/desktop/tests/TransactionsPage.test.tsx`:

```typescript
// TransactionsPage 页面集成测试 / TransactionsPage integration tests

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Transaction, Account, Category } from '@shared/types/index.js';

// mock dataAccess 模块（路径相对于测试文件）
// mock dataAccess module (path relative to test file)
vi.mock('../src/renderer/src/data/data-access.js', () => ({
  dataAccess: {
    getTransactionsByUser: vi.fn(),
    createTransaction: vi.fn(),
    editTransaction: vi.fn(),
    deleteTransaction: vi.fn(),
    getAccounts: vi.fn(),
    getCategories: vi.fn(),
    seedCategories: vi.fn(),
  },
}));

import { dataAccess } from '../src/renderer/src/data/data-access.js';
import { useTransactionStore } from '../src/renderer/src/stores/transaction-store.js';
import { useAccountStore } from '../src/renderer/src/stores/account-store.js';
import { useCategoryStore } from '../src/renderer/src/stores/category-store.js';
import { useAppStore } from '../src/renderer/src/stores/app-store.js';
import { useToastStore } from '../src/renderer/src/stores/toast-store.js';
import { TransactionsPage } from '../src/renderer/src/pages/TransactionsPage.js';

// Mock 数据 / Mock data
function makeTx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'tx-1',
    user_id: 'user-1',
    account_id: 'acc-1',
    to_account_id: null,
    category_id: 'cat-1',
    recurring_id: null,
    transaction_type: 'expense',
    amount: 5000,
    transaction_date: new Date('2026-07-15').getTime(),
    description: '午餐',
    sync_version: 0,
    updated_at: 0,
    deleted_flag: 0,
    ...overrides,
  };
}

const mockAccounts: Account[] = [
  { id: 'acc-1', user_id: 'user-1', name: '招行活期', asset_class: 'liquid', account_type: 'checking', current_balance: 100000, note: null, sync_version: 0, updated_at: 0, deleted_flag: 0 },
];

const mockCategories: Category[] = [
  { id: 'cat-1', user_id: 'user-1', parent_id: null, name: '餐饮', type: 'expense', icon: null, color: null, linked_fire_concept: null, display_order: 0, is_system: 1, sync_version: 0, updated_at: 0, deleted_flag: 0 },
];

const mockTxs: Transaction[] = [
  makeTx({ id: 'tx-1', transaction_type: 'income', amount: 10000, description: '工资', category_id: 'cat-1' }),
  makeTx({ id: 'tx-2', transaction_type: 'expense', amount: 5000, description: '午餐', category_id: 'cat-1' }),
];

describe('TransactionsPage', () => {
  beforeEach(() => {
    // 重置所有 store 状态 / Reset all store states
    useTransactionStore.setState({ transactions: [], loading: false, error: null });
    useAccountStore.setState({ accounts: [], loading: false, error: null });
    useCategoryStore.setState({ categories: [], loading: false, error: null });
    useToastStore.setState({ toasts: [] });
    useAppStore.setState({
      currentUser: { id: 'user-1', display_name: 'Test User' } as any,
      initialized: true,
      loading: false,
      error: null,
    });
    vi.clearAllMocks();
  });

  it('mount 时触发 3 个 fetch（transactions, accounts, categories）', async () => {
    vi.mocked(dataAccess.getTransactionsByUser).mockResolvedValue([]);
    vi.mocked(dataAccess.getAccounts).mockResolvedValue([]);
    vi.mocked(dataAccess.getCategories).mockResolvedValue([]);

    render(<TransactionsPage />);

    await waitFor(() => {
      expect(dataAccess.getTransactionsByUser).toHaveBeenCalledWith('user-1');
      expect(dataAccess.getAccounts).toHaveBeenCalledWith('user-1');
      expect(dataAccess.getCategories).toHaveBeenCalledWith('user-1');
    });
  });

  it('筛选变化时概览卡和列表联动更新', async () => {
    vi.mocked(dataAccess.getTransactionsByUser).mockResolvedValue(mockTxs);
    vi.mocked(dataAccess.getAccounts).mockResolvedValue(mockAccounts);
    vi.mocked(dataAccess.getCategories).mockResolvedValue(mockCategories);

    render(<TransactionsPage />);

    // 等待数据加载
    await waitFor(() => {
      expect(screen.getByText('工资')).toBeInTheDocument();
    });

    // 初始：2 条交易，概览显示收入 100.00 + 支出 50.00
    expect(screen.getByText('收入').closest('.bg-white')!).toHaveTextContent('100.00');
    expect(screen.getByText('支出').closest('.bg-white')!).toHaveTextContent('50.00');

    // 筛选 type=expense
    const user = userEvent.setup();
    const selects = screen.getAllByRole('combobox');
    // 第一个 select 是筛选的类型
    await user.selectOptions(selects[0], 'expense');

    // 只剩 1 条 expense，收入应为 0
    await waitFor(() => {
      expect(screen.getByText('收入').closest('.bg-white')!).toHaveTextContent('0.00');
      expect(screen.getByText('支出').closest('.bg-white')!).toHaveTextContent('50.00');
    });
    // 工资（income）不应再显示
    expect(screen.queryByText('工资')).not.toBeInTheDocument();
  });

  it('新增交易流程（点击新增 → 弹窗 → 提交 → createTransaction 调用）', async () => {
    vi.mocked(dataAccess.getTransactionsByUser).mockResolvedValue([]);
    vi.mocked(dataAccess.getAccounts).mockResolvedValue(mockAccounts);
    vi.mocked(dataAccess.getCategories).mockResolvedValue(mockCategories);
    vi.mocked(dataAccess.createTransaction).mockResolvedValue({} as any);

    const user = userEvent.setup();
    render(<TransactionsPage />);

    // 等待账户加载
    await waitFor(() => {
      expect(screen.getByText('暂无交易记录')).toBeInTheDocument();
    });

    // 点击新增
    await user.click(screen.getByText('+ 新增交易'));

    // 弹窗打开
    expect(screen.getByText('新增交易')).toBeInTheDocument();

    // 选择账户
    const modalSelects = screen.getAllByRole('combobox');
    // modalSelects[0] = type, modalSelects[1] = account
    await user.selectOptions(modalSelects[1], 'acc-1');

    // 填金额
    const amountInput = document.querySelector('input[type="number"]') as HTMLInputElement;
    await user.type(amountInput, '100');

    // 填日期
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    await user.type(dateInput, '2026-07-15');

    // 提交
    await user.click(screen.getByText('确定'));

    await waitFor(() => {
      expect(dataAccess.createTransaction).toHaveBeenCalledTimes(1);
    });
    const input = vi.mocked(dataAccess.createTransaction).mock.calls[0][0];
    expect(input).toEqual(
      expect.objectContaining({
        user_id: 'user-1',
        account_id: 'acc-1',
        transaction_type: 'expense',
        amount: 10000,
      }),
    );
  });

  it('编辑交易流程', async () => {
    vi.mocked(dataAccess.getTransactionsByUser).mockResolvedValue(mockTxs);
    vi.mocked(dataAccess.getAccounts).mockResolvedValue(mockAccounts);
    vi.mocked(dataAccess.getCategories).mockResolvedValue(mockCategories);
    vi.mocked(dataAccess.editTransaction).mockResolvedValue({} as any);

    const user = userEvent.setup();
    render(<TransactionsPage />);

    // 等待数据加载
    await waitFor(() => {
      expect(screen.getByText('午餐')).toBeInTheDocument();
    });

    // 点击第一行的编辑按钮
    const editButtons = screen.getAllByText('编辑');
    await user.click(editButtons[0]);

    // 弹窗打开
    expect(screen.getByText('编辑交易')).toBeInTheDocument();

    // 等待预填
    await waitFor(() => {
      expect(screen.getByDisplayValue('招行活期')).toBeInTheDocument();
    });

    // 提交
    await user.click(screen.getByText('确定'));

    await waitFor(() => {
      expect(dataAccess.editTransaction).toHaveBeenCalledTimes(1);
    });
    // edit 不含 user_id
    const input = vi.mocked(dataAccess.editTransaction).mock.calls[0][1];
    expect(input).not.toHaveProperty('user_id');
  });

  it('删除交易流程（点击删除 → 确认 → deleteTransaction 调用）', async () => {
    vi.mocked(dataAccess.getTransactionsByUser).mockResolvedValue(mockTxs);
    vi.mocked(dataAccess.getAccounts).mockResolvedValue(mockAccounts);
    vi.mocked(dataAccess.getCategories).mockResolvedValue(mockCategories);
    vi.mocked(dataAccess.deleteTransaction).mockResolvedValue({} as any);

    const user = userEvent.setup();
    render(<TransactionsPage />);

    // 等待数据加载
    await waitFor(() => {
      expect(screen.getByText('午餐')).toBeInTheDocument();
    });

    // 点击第一行的删除按钮
    const deleteButtons = screen.getAllByText('删除');
    await user.click(deleteButtons[0]);

    // 确认对话框出现
    expect(screen.getByText('删除交易')).toBeInTheDocument();

    // 点击确认
    await user.click(screen.getByText('确认'));

    await waitFor(() => {
      expect(dataAccess.deleteTransaction).toHaveBeenCalledTimes(1);
    });
    // 第一个参数是交易 id
    const txId = vi.mocked(dataAccess.deleteTransaction).mock.calls[0][0];
    expect(mockTxs.map((t) => t.id)).toContain(txId);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run:
```bash
cd "/workspace/FIRE APP" && pnpm --filter @fire-app/desktop test -- tests/TransactionsPage.test.tsx
```
Expected: FAIL — 当前 TransactionsPage 是占位页，没有 "+ 新增交易" 按钮等元素。

- [ ] **Step 3: 编写实现（替换占位页）**

Replace `apps/desktop/src/renderer/src/pages/TransactionsPage.tsx` with:

```tsx
// 交易记录页 / Transactions page
// 组合概览卡片、筛选、列表表格、表单弹窗、删除确认，完成交易 CRUD
// 复刻 AccountsPage 模式：store 错误处理 + useEffect 加载 + getState().error 判定成功

import { useEffect, useMemo, useState } from 'react';
import type { Transaction } from '@shared/types/index.js';
import type { CreateTransactionInput, EditTransactionInput } from '@shared/services/transaction-service.js';
import { useTransactionStore } from '../stores/transaction-store.js';
import { useAccountStore } from '../stores/account-store.js';
import { useCategoryStore } from '../stores/category-store.js';
import { useAppStore } from '../stores/app-store.js';
import { useToastStore } from '../stores/toast-store.js';
import { PageHeader } from '../components/layout/PageHeader.js';
import { Button } from '../components/base/Button.js';
import { ConfirmDialog } from '../components/base/ConfirmDialog.js';
import { TransactionOverviewCards } from '../components/transactions/TransactionOverviewCards.js';
import { TransactionFilters } from '../components/transactions/TransactionFilters.js';
import { TransactionListTable } from '../components/transactions/TransactionListTable.js';
import { TransactionFormModal } from '../components/transactions/TransactionFormModal.js';
import {
  type TransactionFilters as Filters,
  filterTransactions, computeOverview, hasActiveFilters,
} from '../components/transactions/transaction-constants.js';

// 空筛选状态 / Empty filter state
const EMPTY_FILTERS: Filters = { type: '', account_id: '', category_id: '', dateFrom: '', dateTo: '' };

export function TransactionsPage() {
  const { transactions, loading, error, fetchTransactions, createTransaction, editTransaction, deleteTransaction } = useTransactionStore();
  const { accounts, fetchAccounts } = useAccountStore();
  const { categories, fetchCategories } = useCategoryStore();
  const { currentUser } = useAppStore();
  const { showSuccess, showError } = useToastStore();

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);

  // 派生：筛选后的交易 + 是否有激活筛选
  // Derived: filtered transactions + whether filters are active
  const filtered = useMemo(() => filterTransactions(transactions, filters), [transactions, filters]);
  const activeFilters = hasActiveFilters(filters);

  // 初始加载交易、账户、分类
  // Initial load: transactions, accounts, categories
  useEffect(() => {
    if (currentUser) {
      fetchTransactions(currentUser.id);
      fetchAccounts(currentUser.id);
      fetchCategories(currentUser.id);
    }
  }, [currentUser, fetchTransactions, fetchAccounts, fetchCategories]);

  // 监听 store error，自动弹出错误 Toast
  // Monitor store error, auto show error toast
  useEffect(() => {
    if (error) showError(error);
  }, [error, showError]);

  const openCreateModal = () => {
    setModalMode('create');
    setEditingTransaction(null);
    setModalOpen(true);
  };

  const openEditModal = (tx: Transaction) => {
    setModalMode('edit');
    setEditingTransaction(tx);
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const openConfirm = (tx: Transaction) => {
    setDeleteTarget(tx);
    setConfirmOpen(true);
  };

  const closeConfirm = () => {
    setConfirmOpen(false);
    setDeleteTarget(null);
  };

  const handleResetFilters = () => setFilters(EMPTY_FILTERS);

  // 表单提交：create 调 createTransaction，edit 调 editTransaction
  // store 方法内部捕获错误并写入 state.error（不抛出），故用 getState().error 判定成功/失败
  const handleSubmit = async (input: CreateTransactionInput | EditTransactionInput) => {
    if (!currentUser) return;
    if (modalMode === 'create') {
      await createTransaction(input as CreateTransactionInput, currentUser.id);
    } else if (editingTransaction) {
      await editTransaction(editingTransaction.id, input as EditTransactionInput, currentUser.id);
    }
    if (!useTransactionStore.getState().error) {
      setModalOpen(false);
      showSuccess(modalMode === 'create' ? '交易创建成功' : '交易更新成功');
    }
  };

  const handleDelete = async () => {
    if (!currentUser || !deleteTarget) return;
    setConfirmOpen(false);
    await deleteTransaction(deleteTarget.id, currentUser.id);
    if (!useTransactionStore.getState().error) {
      showSuccess('交易已删除');
    }
    setDeleteTarget(null);
  };

  return (
    <div>
      <PageHeader
        title="交易记录"
        extra={<Button variant="primary" size="md" onClick={openCreateModal}>+ 新增交易</Button>}
      />
      <div className="p-8 space-y-6">
        {/* 概览卡：filtered.length === 0 时隐藏 */}
        {/* Overview cards: hidden when filtered.length === 0 */}
        {filtered.length > 0 && (
          <TransactionOverviewCards transactions={filtered} />
        )}

        {/* 筛选 / Filters */}
        <TransactionFilters
          filters={filters}
          accounts={accounts}
          categories={categories}
          onFiltersChange={setFilters}
          onReset={handleResetFilters}
        />

        {/* 列表表格 / List table */}
        <TransactionListTable
          transactions={filtered}
          loading={loading}
          accounts={accounts}
          categories={categories}
          hasActiveFilters={activeFilters}
          onEdit={openEditModal}
          onDelete={openConfirm}
        />
      </div>

      {/* 表单弹窗 / Form modal */}
      <TransactionFormModal
        open={modalOpen}
        mode={modalMode}
        transaction={editingTransaction ?? undefined}
        userId={currentUser?.id}
        accounts={accounts}
        categories={categories}
        loading={loading}
        onSubmit={handleSubmit}
        onClose={closeModal}
      />

      {/* 删除确认 / Delete confirm */}
      <ConfirmDialog
        open={confirmOpen}
        title="删除交易"
        message="确定删除此交易记录吗？此操作不可撤销。"
        variant="danger"
        confirmText="确认"
        cancelText="取消"
        onConfirm={handleDelete}
        onCancel={closeConfirm}
      />
    </div>
  );
}
```

- [ ] **Step 4: 运行测试验证通过**

Run:
```bash
cd "/workspace/FIRE APP" && pnpm --filter @fire-app/desktop test -- tests/TransactionsPage.test.tsx
```
Expected: 全部 PASS（5 个测试用例）。

- [ ] **Step 5: 运行全部测试确保无回归**

Run:
```bash
cd "/workspace/FIRE APP" && pnpm --filter @fire-app/desktop test
```
Expected: 全部 PASS（hello + transaction-constants + category-store + TransactionOverviewCards + TransactionFilters + TransactionListTable + TransactionFormModal + TransactionsPage）。

- [ ] **Step 6: 提交**

```bash
cd "/workspace/FIRE APP" && git add apps/desktop/src/renderer/src/pages/TransactionsPage.tsx apps/desktop/tests/TransactionsPage.test.tsx && git commit -m "$(cat <<'EOF'
feat(transactions): implement TransactionsPage with full CRUD, filtering, overview, and category auto-seed

Replace placeholder page with complete transaction management: PageHeader +
overview cards (conditional) + filters + list table + form modal + delete confirm.
Wires useTransactionStore, useAccountStore, useCategoryStore, useAppStore, useToastStore.
EOF
)"
```

---

## Self-Review Checklist

### Spec 覆盖检查

| Spec 要求 | 对应 Task |
|-----------|-----------|
| 完整 CRUD（create/edit/delete） | Task 7 (Form) + Task 8 (Page handlers) |
| 多维度筛选（type/account/category/date） | Task 2 (filterTransactions) + Task 5 (TransactionFilters) |
| 汇总概览（收入/支出/结余） | Task 2 (computeOverview) + Task 4 (TransactionOverviewCards) |
| Category 自动 seed 兜底 | Task 3 (category-store) |
| Transfer 联动（to_account_id 必填，非 transfer 强制 null） | Task 7 (TransactionFormModal) |
| 筛选逻辑（Transfer 双向匹配，dateTo 含当天） | Task 2 (filterTransactions) |
| 完整 renderer 测试基础设施 | Task 1 (vitest + jsdom + testing-library) |
| 排序（date-desc/asc, amount-desc/asc） | Task 2 (sortTransactions) + Task 6 (TransactionListTable) |
| 空状态区分（有/无筛选） | Task 6 (TransactionListTable) |
| 概览卡条件渲染（filtered.length===0 隐藏） | Task 8 (TransactionsPage) |

### 占位符扫描

✅ 无 TBD / TODO / "implement later"
✅ 每步都有完整代码
✅ 每个测试用例都有完整代码
✅ 无 "Similar to Task N" 引用

### 类型一致性检查

| 名称 | 定义 Task | 使用 Task | 一致 |
|------|----------|----------|------|
| `TransactionFilters` | Task 2 | Task 5, 8 | ✅ |
| `TransactionOverview` | Task 2 | Task 4 | ✅ |
| `TRANSACTION_TYPE_CONFIG` | Task 2 | Task 6 | ✅ |
| `TRANSACTION_TYPE_OPTIONS` | Task 2 | Task 5, 7 | ✅ |
| `formatAmount` | Task 2 | Task 4, 6 | ✅ |
| `formatDate` | Task 2 | Task 6, 7 | ✅ |
| `computeOverview` | Task 2 | Task 4, 8 | ✅ |
| `filterTransactions` | Task 2 | Task 8 | ✅ |
| `sortTransactions` | Task 2 | Task 6 | ✅ |
| `hasActiveFilters` | Task 2 | Task 8 | ✅ |
| `useCategoryStore.fetchCategories` | Task 3 | Task 8 | ✅ |
| `TransactionListTableProps.hasActiveFilters` | Task 6 | Task 8 | ✅ |
| `TransactionFormModalProps.onSubmit` | Task 7 | Task 8 | ✅ |

### Mock 路径验证

| 测试文件 | vi.mock 路径 | 解析目标 | 正确 |
|---------|-------------|---------|------|
| `tests/category-store.test.ts` | `../src/renderer/src/data/data-access.js` | `src/renderer/src/data/data-access.ts` | ✅ |
| `tests/TransactionsPage.test.tsx` | `../src/renderer/src/data/data-access.js` | `src/renderer/src/data/data-access.ts` | ✅ |

### 提交历史

| Task | Commit Type | 描述 |
|------|------------|------|
| 1 | chore | renderer test infrastructure |
| 2 | feat | transaction-constants pure functions |
| 3 | feat | useCategoryStore with auto-seed |
| 4 | feat | TransactionOverviewCards |
| 5 | feat | TransactionFilters |
| 6 | feat | TransactionListTable |
| 7 | feat | TransactionFormModal |
| 8 | feat | TransactionsPage full CRUD |
