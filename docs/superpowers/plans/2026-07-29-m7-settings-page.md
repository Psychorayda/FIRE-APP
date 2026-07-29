# M7 设置页 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现设置页：用户偏好编辑（6 字段）+ 内置分类展示与重置，补齐最后一个核心页面。

**Architecture:** 单页 + 上下两区，复刻 M4/M5/M6 容器模式。数据层新增 `resetSystemCategories` service（事务：软删除系统分类 + 重新 seed），通过 IPC 暴露到渲染进程。SettingsPage 受控表单 + 分类列表，保存同步全局 currentUser。

**Tech Stack:** React 19、Zustand 5、better-sqlite3、electron IPC、vitest、@testing-library/react

---

## File Structure

**Create:**
- `packages/shared/src/services/category-service.ts` — resetSystemCategories 服务函数
- `packages/shared/tests/services/category-service.test.ts` — 服务测试
- `apps/desktop/src/renderer/src/pages/SettingsPage.tsx` — 设置页组件
- `apps/desktop/tests/settings-components.test.tsx` — 组件 + 集成测试

**Modify:**
- `apps/desktop/src/main/ipc/category-handlers.ts` — 注册 `db:category:resetSystem`
- `apps/desktop/src/preload/index.ts` — category.resetSystem
- `apps/desktop/src/renderer/src/data/data-access-port.ts` — resetSystemCategories 接口
- `apps/desktop/src/renderer/src/data/ipc-data-access.ts` — resetSystemCategories 实现
- `apps/desktop/vitest.setup.ts` — window.dataAccess mock 增加 resetSystem
- `apps/desktop/src/renderer/src/router/index.tsx` — /settings 路由
- `apps/desktop/src/renderer/src/components/layout/Sidebar.tsx` — 导航项

---

### Task 1: resetSystemCategories 服务 + 测试（TDD）

**Files:**
- Create: `packages/shared/src/services/category-service.ts`
- Test: `packages/shared/tests/services/category-service.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/shared/tests/services/category-service.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, closeDatabase } from '../../src/db/connection.js';
import { initSchema } from '../../src/db/schema.js';
import { createUser } from '../../src/models/user.js';
import { seedCategories, getCategories, createCategory } from '../../src/models/category.js';
import { resetSystemCategories } from '../../src/services/category-service.js';
import type { Database as DatabaseType } from 'better-sqlite3';

describe('category service', () => {
  let db: DatabaseType;
  let userId: string;

  beforeEach(() => {
    db = createDatabase(':memory:');
    initSchema(db);
    userId = 'test-user-id';
    createUser(db, { id: userId, display_name: '测试' });
  });

  afterEach(() => { closeDatabase(db); });

  it('resetSystemCategories: 软删除旧系统分类并重新 seed 18 个', () => {
    seedCategories(db, userId);
    // 重命名一个系统分类，模拟用户修改
    const cats = getCategories(db, userId);
    expect(cats.length).toBe(18);

    resetSystemCategories(db, userId);

    const after = getCategories(db, userId);
    expect(after.length).toBe(18);
    // 重新 seed 的应为 is_system=1 且 deleted_flag=0
    expect(after.every((c) => c.is_system === 1 && c.deleted_flag === 0)).toBe(true);
    // 11 支出 + 7 收入
    const expenses = after.filter((c) => c.type === 'expense');
    const incomes = after.filter((c) => c.type === 'income');
    expect(expenses.length).toBe(11);
    expect(incomes.length).toBe(7);
  });

  it('resetSystemCategories: 保留自定义分类', () => {
    seedCategories(db, userId);
    createCategory(db, {
      user_id: userId,
      name: '我的自定义分类',
      type: 'expense',
    });
    expect(getCategories(db, userId).length).toBe(19); // 18 系统 + 1 自定义

    resetSystemCategories(db, userId);

    const after = getCategories(db, userId);
    expect(after.length).toBe(19); // 18 新系统 + 1 保留的自定义
    const custom = after.find((c) => c.name === '我的自定义分类');
    expect(custom).toBeDefined();
    expect(custom!.is_system).toBe(0);
  });

  it('resetSystemCategories: 旧系统分类被软删除', () => {
    seedCategories(db, userId);
    const before = getCategories(db, userId);

    resetSystemCategories(db, userId);

    // 旧系统分类的 deleted_flag 应为 1（查全部含已删除）
    const allRows = db.prepare(
      'SELECT * FROM categories WHERE user_id = ? AND is_system = 1 ORDER BY updated_at DESC'
    ).all(userId) as { deleted_flag: number }[];
    const deletedOld = allRows.filter((r) => r.deleted_flag === 1);
    // 旧的 18 个被软删除
    expect(deletedOld.length).toBe(18);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /workspace/packages/shared && npx vitest run tests/services/category-service.test.ts`
Expected: FAIL — "Failed to resolve import ... category-service.js"

- [ ] **Step 3: Write minimal implementation**

Create `packages/shared/src/services/category-service.ts`:

```typescript
// 分类服务 / Category service
// 跨表组合操作（系统分类重置等）

import type { Database as DatabaseType } from 'better-sqlite3';
import { seedCategories } from '../models/category.js';
import { nowMs } from '../utils/time.js';

/**
 * 重置系统分类：事务内软删除现有系统分类 + 重新 seed 18 个内置分类
 * 自定义分类（is_system=0）保留不动
 *
 * Reset system categories: soft-delete existing system categories + re-seed 18 defaults.
 * Custom categories (is_system=0) are preserved.
 */
export function resetSystemCategories(db: DatabaseType, userId: string): void {
  db.transaction(() => {
    db.prepare(
      'UPDATE categories SET deleted_flag = 1, updated_at = ? WHERE user_id = ? AND is_system = 1'
    ).run(nowMs(), userId);
    seedCategories(db, userId);
  })();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /workspace/packages/shared && npx vitest run tests/services/category-service.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
cd /workspace && git add packages/shared/src/services/category-service.ts packages/shared/tests/services/category-service.test.ts
git commit -m "feat: add resetSystemCategories service (soft-delete + reseed)"
```

---

### Task 2: IPC + preload + dataAccess + dataAccessPort 扩展

**Files:**
- Modify: `apps/desktop/src/main/ipc/category-handlers.ts`
- Modify: `apps/desktop/src/preload/index.ts`
- Modify: `apps/desktop/src/renderer/src/data/data-access-port.ts`
- Modify: `apps/desktop/src/renderer/src/data/ipc-data-access.ts`

- [ ] **Step 1: Add IPC handler**

Edit `apps/desktop/src/main/ipc/category-handlers.ts` — add import and handler:

```typescript
import { registerHandler } from './register-handlers.js';
import { createCategory, getCategory, getCategories, seedCategories } from '@shared/models/category.js';
import { resetSystemCategories } from '@shared/services/category-service.js';
import type { Database as DatabaseType } from 'better-sqlite3';
import type { CreateCategoryInput } from '@shared/models/category.js';
import type { CategoryType } from '@shared/types/index.js';

export function registerCategoryHandlers(db: DatabaseType): void {
  registerHandler('db:category:create', (_db, input: CreateCategoryInput) => createCategory(_db, input), db);
  registerHandler('db:category:get', (_db, id: string) => getCategory(_db, id), db);
  registerHandler('db:category:list', (_db, userId: string, type?: CategoryType) => getCategories(_db, userId, type), db);
  registerHandler('db:category:seed', (_db, userId: string) => { seedCategories(_db, userId); }, db);
  registerHandler('db:category:resetSystem', (_db, userId: string) => { resetSystemCategories(_db, userId); }, db);
}
```

- [ ] **Step 2: Add preload bridge**

Edit `apps/desktop/src/preload/index.ts` — add `resetSystem` to the category namespace (after the `seed` line at line 38):

```typescript
  // 分类 / Category
  category: {
    create: (input: unknown) => ipcRenderer.invoke('db:category:create', input),
    get: (id: string) => ipcRenderer.invoke('db:category:get', id),
    list: (userId: string, type?: string) => ipcRenderer.invoke('db:category:list', userId, type),
    seed: (userId: string) => ipcRenderer.invoke('db:category:seed', userId),
    resetSystem: (userId: string) => ipcRenderer.invoke('db:category:resetSystem', userId),
  },
```

- [ ] **Step 3: Add DataAccessPort interface method**

Edit `apps/desktop/src/renderer/src/data/data-access-port.ts` — add to Category section (after `seedCategories` at line 51):

```typescript
  // ===== Category =====
  createCategory(input: CreateCategoryInput): Promise<Category>;
  getCategory(id: string): Promise<Category | null>;
  getCategories(userId: string, type?: CategoryType): Promise<Category[]>;
  seedCategories(userId: string): Promise<void>;
  resetSystemCategories(userId: string): Promise<void>;
```

- [ ] **Step 4: Add IpcDataAccess implementation**

Edit `apps/desktop/src/renderer/src/data/ipc-data-access.ts` — add after `seedCategories` (line 48):

```typescript
  // ===== Category =====
  createCategory(input: CreateCategoryInput) { return window.dataAccess.category.create(input); }
  getCategory(id: string) { return window.dataAccess.category.get(id); }
  getCategories(userId: string, type?: CategoryType) { return window.dataAccess.category.list(userId, type); }
  seedCategories(userId: string) { return window.dataAccess.category.seed(userId); }
  resetSystemCategories(userId: string) { return window.dataAccess.category.resetSystem(userId); }
```

- [ ] **Step 5: Add resetSystem to vitest.setup.ts mock**

Edit `apps/desktop/vitest.setup.ts` — add `resetSystem: fn(),` to the category namespace (after line 48 `seed: fn(),`):

```typescript
  category: {
    create: fn(),
    get: fn(),
    list: fn(),
    seed: fn(),
    resetSystem: fn(),
  },
```

- [ ] **Step 6: Verify tsc passes**

Run: `cd /workspace/apps/desktop && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
cd /workspace && git add apps/desktop/src/main/ipc/category-handlers.ts apps/desktop/src/preload/index.ts apps/desktop/src/renderer/src/data/data-access-port.ts apps/desktop/src/renderer/src/data/ipc-data-access.ts apps/desktop/vitest.setup.ts
git commit -m "feat: wire resetSystemCategories through IPC + preload + dataAccess"
```

---

### Task 3: SettingsPage 组件

**Files:**
- Create: `apps/desktop/src/renderer/src/pages/SettingsPage.tsx`

- [ ] **Step 1: Create SettingsPage component**

Create `apps/desktop/src/renderer/src/pages/SettingsPage.tsx`:

```typescript
// 设置页 / Settings page
// 用户偏好编辑 + 内置分类展示与重置

import { useState, useEffect } from 'react';
import { Button } from '../components/base/Button.js';
import { Input } from '../components/base/Input.js';
import { dataAccess } from '../data/data-access.js';
import { useAppStore } from '../stores/app-store.js';
import { useToastStore } from '../stores/toast-store.js';
import type { User } from '@shared/types/index.js';
import type { Category } from '@shared/types/index.js';

interface PreferenceForm {
  display_name: string;
  base_currency: string;
  is_china_market: number;
  default_withdrawal_rate: number;
  default_expected_return: number;
  default_inflation_rate: number;
}

function userToForm(user: User): PreferenceForm {
  return {
    display_name: user.display_name,
    base_currency: user.base_currency,
    is_china_market: user.is_china_market,
    default_withdrawal_rate: user.default_withdrawal_rate,
    default_expected_return: user.default_expected_return,
    default_inflation_rate: user.default_inflation_rate,
  };
}

// 基点 ↔ 百分比转换（复用 M6 逻辑）
// basis points ↔ percent conversion (reuse M6 logic)
const bpToPercent = (bp: number) => bp / 100;
const percentToBp = (p: number) => Math.round(p * 100);

export function SettingsPage() {
  const currentUser = useAppStore((s) => s.currentUser);
  const setCurrentUser = useAppStore((s) => s.setCurrentUser);
  const showSuccess = useToastStore((s) => s.showSuccess);
  const showError = useToastStore((s) => s.showError);

  const [formData, setFormData] = useState<PreferenceForm | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof PreferenceForm, string>>>({});
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  // 加载用户偏好到表单
  // Load user preferences into form
  useEffect(() => {
    if (currentUser) {
      setFormData(userToForm(currentUser));
    }
  }, [currentUser]);

  // 加载系统分类
  // Load system categories
  useEffect(() => {
    if (!currentUser) return;
    void loadCategories();
  }, [currentUser]);

  const loadCategories = async () => {
    if (!currentUser) return;
    setLoadingCats(true);
    try {
      const all = await dataAccess.getCategories(currentUser.id);
      setCategories(all.filter((c) => c.is_system === 1 && c.deleted_flag === 0));
    } catch (err) {
      showError(`加载分类失败：${(err as Error).message}`);
    } finally {
      setLoadingCats(false);
    }
  };

  if (!formData || !currentUser) {
    return <div className="p-6 text-gray-500">加载中...</div>;
  }

  const updateField = <K extends keyof PreferenceForm>(field: K, value: PreferenceForm[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleMarketChange = (isChina: number) => {
    // 中国 350 / 全球 400，用户可手动覆盖
    // China 350 / Global 400, user can override
    const defaultWithdrawal = isChina ? 350 : 400;
    setFormData((prev) => ({
      ...prev,
      is_china_market: isChina,
      base_currency: isChina ? 'CNY' : 'USD',
      default_withdrawal_rate: prev.default_withdrawal_rate,
    }));
    // 仅在等于另一个市场默认值时才联动（避免覆盖用户手动设置）
    // Only auto-adjust if equal to the other market's default (avoid overriding user edits)
    const otherDefault = isChina ? 400 : 350;
    if (formData.default_withdrawal_rate === otherDefault) {
      setFormData((prev) => ({ ...prev, default_withdrawal_rate: defaultWithdrawal }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof PreferenceForm, string>> = {};
    const name = formData.display_name.trim();
    if (!name) {
      newErrors.display_name = '请输入显示名称';
    } else if (name.length > 30) {
      newErrors.display_name = '显示名称不能超过 30 字符';
    }
    if (formData.default_withdrawal_rate < 200 || formData.default_withdrawal_rate > 600) {
      newErrors.default_withdrawal_rate = '提现率范围为 200-600 基点';
    }
    if (formData.default_expected_return < 0 || formData.default_expected_return > 2000) {
      newErrors.default_expected_return = '预期回报范围为 0-2000 基点';
    }
    if (formData.default_inflation_rate < 0 || formData.default_inflation_rate > 1000) {
      newErrors.default_inflation_rate = '通胀率范围为 0-1000 基点';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate() || !currentUser) return;
    setSaving(true);
    try {
      const updated = await dataAccess.updateUser(currentUser.id, {
        display_name: formData.display_name.trim(),
        is_china_market: formData.is_china_market,
        base_currency: formData.base_currency,
        default_withdrawal_rate: formData.default_withdrawal_rate,
        default_expected_return: formData.default_expected_return,
        default_inflation_rate: formData.default_inflation_rate,
      });
      setCurrentUser(updated);
      showSuccess('偏好设置已保存');
    } catch (err) {
      showError(`保存失败：${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setFormData(userToForm(currentUser));
    setErrors({});
  };

  const handleResetCategories = async () => {
    if (!currentUser) return;
    setResetting(true);
    try {
      await dataAccess.resetSystemCategories(currentUser.id);
      await loadCategories();
      showSuccess('内置分类已重置');
    } catch (err) {
      showError(`重置失败：${(err as Error).message}`);
    } finally {
      setResetting(false);
      setConfirmingReset(false);
    }
  };

  const expenseCats = categories.filter((c) => c.type === 'expense');
  const incomeCats = categories.filter((c) => c.type === 'income');

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      {/* 用户偏好区 / Preferences section */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">用户偏好</h2>
        <div className="space-y-4 bg-white rounded-md border border-gray-200 p-6">
          <Input
            type="text"
            label="显示名称"
            value={formData.display_name}
            error={errors.display_name}
            placeholder="例如：张三"
            onChange={(v) => updateField('display_name', v)}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">基础货币</label>
            <input
              type="text"
              value={formData.base_currency}
              disabled
              className="w-full h-10 rounded-md border border-gray-300 bg-gray-50 px-3 text-sm text-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">投资市场</label>
            <div className="space-y-2">
              <label className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer ${
                formData.is_china_market === 1 ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
              }`}>
                <input
                  type="radio"
                  name="market"
                  checked={formData.is_china_market === 1}
                  onChange={() => handleMarketChange(1)}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-900">中国市场 (CNY)</span>
              </label>
              <label className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer ${
                formData.is_china_market === 0 ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
              }`}>
                <input
                  type="radio"
                  name="market"
                  checked={formData.is_china_market === 0}
                  onChange={() => handleMarketChange(0)}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-900">全球市场 (USD)</span>
              </label>
            </div>
          </div>

          <Input
            type="number"
            label="默认提现率"
            value={bpToPercent(formData.default_withdrawal_rate)}
            error={errors.default_withdrawal_rate}
            suffix="%"
            onChange={(v) => updateField('default_withdrawal_rate', percentToBp(Number(v)))}
          />
          <Input
            type="number"
            label="默认预期回报率"
            value={bpToPercent(formData.default_expected_return)}
            error={errors.default_expected_return}
            suffix="%"
            onChange={(v) => updateField('default_expected_return', percentToBp(Number(v)))}
          />
          <Input
            type="number"
            label="默认通胀率"
            value={bpToPercent(formData.default_inflation_rate)}
            error={errors.default_inflation_rate}
            suffix="%"
            onChange={(v) => updateField('default_inflation_rate', percentToBp(Number(v)))}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="md" onClick={handleReset} disabled={saving}>重置</Button>
            <Button variant="primary" size="md" onClick={handleSave} loading={saving}>保存</Button>
          </div>
        </div>
      </section>

      {/* 内置分类区 / System categories section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">内置分类</h2>
          <Button
            variant="danger"
            size="sm"
            onClick={() => setConfirmingReset(true)}
            disabled={resetting}
          >
            重置为默认
          </Button>
        </div>

        {loadingCats ? (
          <p className="text-sm text-gray-500">加载中...</p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-md border border-gray-200 p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">支出分类 ({expenseCats.length})</h3>
              <ul className="space-y-1">
                {expenseCats.map((c) => (
                  <li key={c.id} className="text-sm text-gray-900">{c.name}</li>
                ))}
              </ul>
            </div>
            <div className="bg-white rounded-md border border-gray-200 p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">收入分类 ({incomeCats.length})</h3>
              <ul className="space-y-1">
                {incomeCats.map((c) => (
                  <li key={c.id} className="text-sm text-gray-900">{c.name}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>

      {/* 重置确认对话框 / Reset confirmation dialog */}
      {confirmingReset && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-gray-900 mb-2">确认重置内置分类</h3>
            <p className="text-sm text-gray-600 mb-4">
              将软删除现有内置分类并重新生成 18 个默认分类。你的自定义分类不受影响。
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="md" onClick={() => setConfirmingReset(false)} disabled={resetting}>
                取消
              </Button>
              <Button variant="danger" size="md" onClick={handleResetCategories} loading={resetting}>
                确认重置
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify tsc passes**

Run: `cd /workspace/apps/desktop && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
cd /workspace && git add apps/desktop/src/renderer/src/pages/SettingsPage.tsx
git commit -m "feat: add SettingsPage component (preferences + categories)"
```

---

### Task 4: 路由 + 侧边栏导航

**Files:**
- Modify: `apps/desktop/src/renderer/src/router/index.tsx`
- Modify: `apps/desktop/src/renderer/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add route**

Edit `apps/desktop/src/renderer/src/router/index.tsx` — add import and route. Replace the existing imports block and routes:

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
import { SettingsPage } from '../pages/SettingsPage.js';

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
          { path: '/settings', element: <SettingsPage /> },
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

- [ ] **Step 2: Add sidebar nav item**

Edit `apps/desktop/src/renderer/src/components/layout/Sidebar.tsx` — add a settings item to `NAV_ITEMS` (after the FIRE 计算器 item, before the closing `];`):

```typescript
  {
    label: '设置',
    path: '/settings',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];
```

- [ ] **Step 3: Verify tsc + build**

Run: `cd /workspace/apps/desktop && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
cd /workspace && git add apps/desktop/src/renderer/src/router/index.tsx apps/desktop/src/renderer/src/components/layout/Sidebar.tsx
git commit -m "feat: add /settings route and sidebar nav item"
```

---

### Task 5: SettingsPage 组件 + 集成测试（TDD）

**Files:**
- Create: `apps/desktop/tests/settings-components.test.tsx`

- [ ] **Step 1: Write the test file**

Create `apps/desktop/tests/settings-components.test.tsx`:

```typescript
// SettingsPage 组件 + 集成测试 / SettingsPage component + integration tests

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { User, Category } from '@shared/types/index.js';
import { SettingsPage } from '../src/renderer/src/pages/SettingsPage.js';
import { useAppStore } from '../src/renderer/src/stores/app-store.js';
import { useToastStore } from '../src/renderer/src/stores/toast-store.js';

// 测试数据工厂 / Test data factories
function makeUser(overrides: Partial<User>): User {
  return {
    id: 'user-1',
    display_name: '张三',
    base_currency: 'CNY',
    is_china_market: 1,
    default_withdrawal_rate: 350,
    default_expected_return: 700,
    default_inflation_rate: 300,
    encryption_key_hash: null,
    last_sync_at: null,
    sync_version: 0,
    updated_at: 0,
    deleted_flag: 0,
    ...overrides,
  };
}

function makeCategory(overrides: Partial<Category>): Category {
  return {
    id: 'cat-1',
    user_id: 'user-1',
    parent_id: null,
    name: '住房',
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

// 18 个系统分类 mock / 18 system categories mock
function makeSystemCategories(): Category[] {
  const expenseNames = ['住房', '食品', '交通', '保险', '医疗', '娱乐', '购物', '个人护理', '教育', '债务还款', '其他支出'];
  const incomeNames = ['工资薪金', '自由职业', '投资收益', '租金收入', '退税', '社保养老金', '其他收入'];
  return [
    ...expenseNames.map((name, i) => makeCategory({ id: `e${i}`, name, type: 'expense', display_order: i })),
    ...incomeNames.map((name, i) => makeCategory({ id: `i${i}`, name, type: 'income', display_order: i })),
  ];
}

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useToastStore.setState({ toasts: [] });
    // 默认 mock
    (window.dataAccess.getCategories as any).mockResolvedValue(makeSystemCategories());
    (window.dataAccess.updateUser as any).mockResolvedValue(undefined);
    (window.dataAccess.category.resetSystem as any).mockResolvedValue(undefined);
  });

  describe('用户偏好区', () => {
    it('加载用户偏好到表单', async () => {
      useAppStore.setState({ currentUser: makeUser({ display_name: '李四' }) });

      render(<SettingsPage />);

      expect(await screen.findByDisplayValue('李四')).toBeInTheDocument();
      expect(screen.getByDisplayValue('CNY')).toBeDisabled();
      // 利率显示百分比（3.5 / 7 / 3）
      expect(screen.getByDisplayValue('3.5')).toBeInTheDocument();
    });

    it('校验失败阻止保存', async () => {
      useAppStore.setState({ currentUser: makeUser({}) });

      render(<SettingsPage />);
      await screen.findByDisplayValue('张三');

      // 清空显示名称
      fireEvent.change(screen.getByDisplayValue('张三'), { target: { value: '' } });
      fireEvent.click(screen.getByText('保存'));

      expect(screen.getByText('请输入显示名称')).toBeInTheDocument();
      expect(window.dataAccess.updateUser).not.toHaveBeenCalled();
    });

    it('保存触发 updateUser + setCurrentUser', async () => {
      useAppStore.setState({ currentUser: makeUser({}) });
      const updatedUser = makeUser({ display_name: '王五', sync_version: 1 });
      (window.dataAccess.updateUser as any).mockResolvedValue(updatedUser);

      render(<SettingsPage />);
      await screen.findByDisplayValue('张三');

      fireEvent.change(screen.getByDisplayValue('张三'), { target: { value: '王五' } });
      fireEvent.click(screen.getByText('保存'));

      await waitFor(() => {
        expect(window.dataAccess.updateUser).toHaveBeenCalledWith('user-1', expect.objectContaining({ display_name: '王五' }));
      });
      // 全局 currentUser 更新
      await waitFor(() => {
        expect(useAppStore.getState().currentUser?.display_name).toBe('王五');
      });
    });

    it('重置按钮恢复表单到上次保存值', async () => {
      useAppStore.setState({ currentUser: makeUser({ display_name: '张三' }) });

      render(<SettingsPage />);
      await screen.findByDisplayValue('张三');

      fireEvent.change(screen.getByDisplayValue('张三'), { target: { value: '改了' } });
      fireEvent.click(screen.getByText('重置'));

      expect(screen.getByDisplayValue('张三')).toBeInTheDocument();
    });

    it('中国市场切换联动提现率（从 400 → 350）', async () => {
      useAppStore.setState({ currentUser: makeUser({ is_china_market: 0, default_withdrawal_rate: 400, base_currency: 'USD' }) });

      render(<SettingsPage />);
      await screen.findByDisplayValue('4');

      // 切到中国市场
      fireEvent.click(screen.getByLabelText('中国市场 (CNY)'));

      // 提现率应联动为 3.5
      expect(screen.getByDisplayValue('3.5')).toBeInTheDocument();
    });
  });

  describe('内置分类区', () => {
    it('渲染 11 支出 + 7 收入分类', async () => {
      useAppStore.setState({ currentUser: makeUser({}) });

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('支出分类 (11)')).toBeInTheDocument();
        expect(screen.getByText('收入分类 (7)')).toBeInTheDocument();
      });
      expect(screen.getByText('住房')).toBeInTheDocument();
      expect(screen.getByText('工资薪金')).toBeInTheDocument();
    });

    it('重置分类弹出确认对话框', async () => {
      useAppStore.setState({ currentUser: makeUser({}) });

      render(<SettingsPage />);
      await screen.findByText('住房');

      fireEvent.click(screen.getByText('重置为默认'));
      expect(screen.getByText('确认重置内置分类')).toBeInTheDocument();
    });

    it('确认重置触发 resetSystemCategories + 重新加载', async () => {
      useAppStore.setState({ currentUser: makeUser({}) });
      (window.dataAccess.category.resetSystem as any).mockResolvedValue(undefined);

      render(<SettingsPage />);
      await screen.findByText('住房');

      fireEvent.click(screen.getByText('重置为默认'));
      fireEvent.click(screen.getByText('确认重置'));

      await waitFor(() => {
        expect(window.dataAccess.category.resetSystem).toHaveBeenCalledWith('user-1');
      });
      // 对话框关闭
      await waitFor(() => {
        expect(screen.queryByText('确认重置内置分类')).not.toBeInTheDocument();
      });
    });

    it('取消重置不触发 resetSystemCategories', async () => {
      useAppStore.setState({ currentUser: makeUser({}) });

      render(<SettingsPage />);
      await screen.findByText('住房');

      fireEvent.click(screen.getByText('重置为默认'));
      fireEvent.click(screen.getByText('取消'));

      expect(window.dataAccess.category.resetSystem).not.toHaveBeenCalled();
      expect(screen.queryByText('确认重置内置分类')).not.toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it passes (or fails with actionable error)**

Run: `cd /workspace/apps/desktop && npx vitest run tests/settings-components.test.tsx`
Expected: PASS (9 tests)

Note: 注意 `window.dataAccess.category.resetSystem` 是全局 mock（在 vitest.setup.ts 中注册），测试中通过 `(window.dataAccess.category.resetSystem as any)` 访问。`updateUser` 和 `getCategories` 是顶层 mock，直接通过 `(window.dataAccess.updateUser as any)` 访问。

- [ ] **Step 3: Run all desktop tests to verify no regressions**

Run: `cd /workspace/apps/desktop && npx vitest run`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
cd /workspace && git add apps/desktop/tests/settings-components.test.tsx
git commit -m "test: add SettingsPage component + integration tests (9 cases)"
```

---

### Task 6: 全量测试 + tsc + 构建验证

- [ ] **Step 1: Run shared tests**

Run: `cd /workspace/packages/shared && npx vitest run`
Expected: All PASS (含新增 category-service 3 tests)

- [ ] **Step 2: Run desktop tests**

Run: `cd /workspace/apps/desktop && npx vitest run`
Expected: All PASS (含新增 settings 9 tests)

- [ ] **Step 3: Run tsc**

Run: `cd /workspace/apps/desktop && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Run build**

Run: `cd /workspace/apps/desktop && npx electron-vite build`
Expected: build success

- [ ] **Step 5: Commit if any fixes needed (otherwise skip)**

---

### Task 7: 推送 + CI 验证

- [ ] **Step 1: Push to origin**

Run: `cd /workspace && git push <remote> main`
Expected: push success

- [ ] **Step 2: Wait for CI and verify**

Run: `sleep 15 && cd /workspace && GH_TOKEN=<token> gh run list --limit 1`
Expected: status `completed`, conclusion `success`

---

## Self-Review Notes

**Spec coverage:** All spec requirements covered:
- §3.1 resetSystemCategories service → Task 1
- §3.2-3.3 IPC + preload + dataAccess wiring → Task 2
- §4.1 preferences form (6 fields, market toggle, validation, save/reset) → Task 3
- §4.2 categories display + reset confirmation → Task 3
- §5 route + sidebar → Task 4
- §6.1 service test → Task 1
- §6.2 component test → Task 5
- §6.3 integration test (save→currentUser, reset→reload) → Task 5

**Placeholder scan:** No TBD/TODO. All code blocks complete.

**Type consistency:** `resetSystemCategories(db, userId)` consistent across service, IPC, port, impl, mock. `category.resetSystem(userId)` consistent across preload and vitest.setup. Field names (`default_withdrawal_rate` etc.) match User type exactly.
