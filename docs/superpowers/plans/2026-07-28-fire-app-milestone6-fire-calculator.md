# M6 FIRE 计算器实施计划 / M6 FIRE Calculator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将占位的 FireCalculatorPage 升级为完整 FIRE 计算器：多场景管理 + 参数表单（debounce 自动保存）+ 实时投影重算 + 4 结果卡 + 环形进度仪表盘 + 面积图投影 + 首次进入介绍页。

**Architecture:** 复刻 M4/M5 模式 — 容器组件 + 纯展示子组件 + 纯函数模块 + Zustand store。数据层（model/service/IPC/handlers/preload）已就位，M6 只动 UI 层。表单字段修改触发 debounce 500ms 持久化 + 立即 runProjection 乐观重算。

**Tech Stack:** React 19、Zustand 5、Recharts 2.x（AreaChart/RadialBarChart）、Tailwind CSS 4、vitest 2、@testing-library/react 16

**Spec:** `docs/superpowers/specs/2026-07-28-fire-app-milestone6-fire-calculator-design.md`

**关键约定：**
- 金额：DB 存分（整数），UI 展示元。`centsToYuan`/`yuanToCents`（来自 `@shared/utils/money.js`）
- 利率：DB 存基点（350=3.5%），UI 展示百分比。`basisPointsToPercent`/`percentToBasisPoints`（本计划新建）
- `runProjection` 返回的 `fire_number`/`adjusted_fire_number`/`retirement_portfolio`/`monthly_projection.balance` 均为**分**
- `progress` 是 0-100 的数字（已含小数）

**测试命令：**
- 单测：`cd /workspace && pnpm --filter @fire-app/desktop test`
- tsc：`cd /workspace && pnpm --filter @fire-app/desktop exec tsc --noEmit`
- 构建：`cd /workspace && pnpm --filter @fire-app/desktop build`

**E2E 说明：** spec §8.4 的 Playwright E2E 在当前 CI（无法运行 Electron）下降级为 Task 9 的集成测试覆盖，不单独建 Task。

---

### Task 1: 扩展 scenario-store.ts + 测试

**Files:**
- Modify: `apps/desktop/src/renderer/src/stores/scenario-store.ts`
- Test: `apps/desktop/tests/scenario-store.test.ts` (Create)

- [ ] **Step 1: Write the failing test**

Create `apps/desktop/tests/scenario-store.test.ts`:

```typescript
// 场景 store 测试 / Scenario store tests

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useScenarioStore } from '@renderer/stores/scenario-store.js';
import type { FireScenario } from '@shared/types/index.js';
import type { ProjectionResult } from '@shared/services/fire-calc.js';

function makeScenario(overrides: Partial<FireScenario>): FireScenario {
  return {
    id: 'scn-1',
    user_id: 'user-1',
    name: '标准计划',
    description: null,
    current_age: 30,
    retirement_age: 55,
    current_portfolio_value: 10000000,
    auto_sync_assets: 0,
    monthly_savings: 100000,
    annual_expenses: 6000000,
    expected_return_rate: 700,
    inflation_rate: 300,
    withdrawal_rate: 400,
    retirement_years: 30,
    post_retirement_monthly_income: 0,
    is_china_market: 1,
    is_active: 1,
    sync_version: 0,
    updated_at: 0,
    deleted_flag: 0,
    ...overrides,
  };
}

function makeProjection(): ProjectionResult {
  return {
    fire_number: 1500000000,
    adjusted_fire_number: 1500000000,
    retirement_portfolio: 2000000000,
    progress: 66.7,
    monthly_projection: [],
  };
}

describe('scenario-store', () => {
  beforeEach(() => {
    useScenarioStore.getState().clear();
    vi.clearAllMocks();
    // 重置 mock 返回值
    (window.dataAccess.scenario.list as any).mockResolvedValue([]);
    (window.dataAccess.scenario.create as any).mockResolvedValue(undefined);
    (window.dataAccess.scenario.update as any).mockResolvedValue(undefined);
    (window.dataAccess.fireCalc.runProjection as any).mockResolvedValue(makeProjection());
  });

  it('初始状态：currentScenarioId=null, projectionResult=null, projectionLoading=false', () => {
    const state = useScenarioStore.getState();
    expect(state.currentScenarioId).toBeNull();
    expect(state.projectionResult).toBeNull();
    expect(state.projectionLoading).toBe(false);
  });

  it('fetchScenarios 加载后选中第一个并触发 runProjection', async () => {
    const scenarios = [makeScenario({ id: 'scn-1' }), makeScenario({ id: 'scn-2' })];
    (window.dataAccess.scenario.list as any).mockResolvedValue(scenarios);

    await useScenarioStore.getState().fetchScenarios('user-1');

    const state = useScenarioStore.getState();
    expect(state.scenarios).toHaveLength(2);
    expect(state.currentScenarioId).toBe('scn-1');
    expect(state.projectionLoading).toBe(false);
    expect(state.projectionResult).not.toBeNull();
    expect(window.dataAccess.fireCalc.runProjection).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'scn-1' })
    );
  });

  it('fetchScenarios 空列表不触发 runProjection', async () => {
    (window.dataAccess.scenario.list as any).mockResolvedValue([]);

    await useScenarioStore.getState().fetchScenarios('user-1');

    const state = useScenarioStore.getState();
    expect(state.scenarios).toEqual([]);
    expect(state.currentScenarioId).toBeNull();
    expect(window.dataAccess.fireCalc.runProjection).not.toHaveBeenCalled();
  });

  it('selectScenario 切换并触发 runProjection', async () => {
    const scenarios = [makeScenario({ id: 'scn-1' }), makeScenario({ id: 'scn-2' })];
    (window.dataAccess.scenario.list as any).mockResolvedValue(scenarios);
    await useScenarioStore.getState().fetchScenarios('user-1');
    vi.clearAllMocks();

    useScenarioStore.getState().selectScenario('scn-2');

    const state = useScenarioStore.getState();
    expect(state.currentScenarioId).toBe('scn-2');
    expect(window.dataAccess.fireCalc.runProjection).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'scn-2' })
    );
  });

  it('createScenario 后选中新场景并触发 runProjection', async () => {
    (window.dataAccess.scenario.list as any)
      .mockResolvedValueOnce([]) // fetchScenarios
      .mockResolvedValueOnce([makeScenario({ id: 'scn-new', name: '新场景' })]); // createScenario 后刷新

    await useScenarioStore.getState().fetchScenarios('user-1');
    vi.clearAllMocks();

    await useScenarioStore.getState().createScenario({
      user_id: 'user-1',
      name: '新场景',
      current_age: 30,
      retirement_age: 55,
      annual_expenses: 6000000,
      expected_return_rate: 700,
      withdrawal_rate: 400,
    }, 'user-1');

    const state = useScenarioStore.getState();
    expect(state.currentScenarioId).toBe('scn-new');
    expect(window.dataAccess.fireCalc.runProjection).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'scn-new' })
    );
  });

  it('updateScenario 乐观更新本地 scenarios', async () => {
    const scenarios = [makeScenario({ id: 'scn-1', current_age: 30 })];
    (window.dataAccess.scenario.list as any).mockResolvedValue(scenarios);
    await useScenarioStore.getState().fetchScenarios('user-1');
    vi.clearAllMocks();

    await useScenarioStore.getState().updateScenario('scn-1', { current_age: 35 }, 'user-1');

    const state = useScenarioStore.getState();
    // 乐观更新立即反映
    expect(state.scenarios[0].current_age).toBe(35);
  });

  it('runProjection 设置 projectionLoading 并存储结果', async () => {
    const scenario = makeScenario({ id: 'scn-1' });
    (window.dataAccess.fireCalc.runProjection as any).mockResolvedValue(makeProjection());

    const promise = useScenarioStore.getState().runProjection(scenario);
    expect(useScenarioStore.getState().projectionLoading).toBe(true);

    await promise;

    const state = useScenarioStore.getState();
    expect(state.projectionLoading).toBe(false);
    expect(state.projectionResult).not.toBeNull();
    expect(state.projectionResult!.fire_number).toBe(1500000000);
  });

  it('runProjection 失败设置 error', async () => {
    const scenario = makeScenario({ id: 'scn-1' });
    (window.dataAccess.fireCalc.runProjection as any).mockRejectedValue(new Error('IPC 失败'));

    await useScenarioStore.getState().runProjection(scenario);

    const state = useScenarioStore.getState();
    expect(state.projectionLoading).toBe(false);
    expect(state.error).toBe('IPC 失败');
  });

  it('clear 重置所有状态', async () => {
    const scenarios = [makeScenario({ id: 'scn-1' })];
    (window.dataAccess.scenario.list as any).mockResolvedValue(scenarios);
    await useScenarioStore.getState().fetchScenarios('user-1');

    useScenarioStore.getState().clear();

    const state = useScenarioStore.getState();
    expect(state.scenarios).toEqual([]);
    expect(state.currentScenarioId).toBeNull();
    expect(state.projectionResult).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /workspace && pnpm --filter @fire-app/desktop test tests/scenario-store.test.ts`
Expected: FAIL — `currentScenarioId` 不存在 / store 接口未扩展

- [ ] **Step 3: Write minimal implementation**

Replace `apps/desktop/src/renderer/src/stores/scenario-store.ts` with:

```typescript
// FIRE 场景状态管理 / FIRE scenario state management
// 含选中场景、投影结果、debounce 自动保存

import { create } from 'zustand';
import type { FireScenario } from '@shared/types/index.js';
import type { CreateScenarioInput } from '@shared/models/scenario.js';
import type { ProjectionResult } from '@shared/services/fire-calc.js';
import { dataAccess } from '../data/data-access.js';

interface ScenarioStore {
  scenarios: FireScenario[];
  loading: boolean;
  error: string | null;
  currentScenarioId: string | null;
  projectionResult: ProjectionResult | null;
  projectionLoading: boolean;

  fetchScenarios: (userId: string) => Promise<void>;
  createScenario: (input: CreateScenarioInput, userId: string) => Promise<void>;
  updateScenario: (id: string, updates: Partial<FireScenario>, userId: string) => Promise<void>;
  selectScenario: (id: string) => void;
  runProjection: (scenario: FireScenario) => Promise<void>;
  clear: () => void;
}

// debounce timer（模块级单例）
// debounce timer (module-level singleton)
let updateTimer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 500;

export const useScenarioStore = create<ScenarioStore>((set, get) => ({
  scenarios: [],
  loading: false,
  error: null,
  currentScenarioId: null,
  projectionResult: null,
  projectionLoading: false,

  fetchScenarios: async (userId) => {
    set({ loading: true, error: null });
    try {
      const scenarios = await dataAccess.getScenarios(userId);
      const firstId = scenarios.length > 0 ? scenarios[0].id : null;
      set({ scenarios, loading: false, currentScenarioId: firstId });
      if (firstId) {
        await get().runProjection(scenarios[0]);
      }
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  createScenario: async (input, userId) => {
    set({ loading: true, error: null });
    try {
      await dataAccess.createScenario(input);
      const scenarios = await dataAccess.getScenarios(userId);
      // 新场景按 updated_at DESC 排在第一个
      // New scenario is first (ORDER BY updated_at DESC)
      const newScenario = scenarios[0];
      set({ scenarios, loading: false, currentScenarioId: newScenario.id });
      await get().runProjection(newScenario);
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  updateScenario: async (id, updates, userId) => {
    // 乐观更新本地（立即反映 UI）
    // Optimistic local update (immediate UI reflect)
    set((state) => ({
      scenarios: state.scenarios.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      ),
    }));

    // debounce 持久化
    // debounced persistence
    if (updateTimer) clearTimeout(updateTimer);
    updateTimer = setTimeout(async () => {
      try {
        await dataAccess.updateScenario(id, updates);
        const scenarios = await dataAccess.getScenarios(userId);
        set({ scenarios });
      } catch (err) {
        set({ error: (err as Error).message });
      }
    }, DEBOUNCE_MS);
  },

  selectScenario: (id) => {
    set({ currentScenarioId: id });
    const scenario = get().scenarios.find((s) => s.id === id);
    if (scenario) {
      void get().runProjection(scenario);
    }
  },

  runProjection: async (scenario) => {
    set({ projectionLoading: true });
    try {
      const result = await dataAccess.runProjection(scenario);
      set({ projectionResult: result, projectionLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, projectionLoading: false });
    }
  },

  clear: () => {
    if (updateTimer) {
      clearTimeout(updateTimer);
      updateTimer = null;
    }
    set({
      scenarios: [],
      error: null,
      loading: false,
      currentScenarioId: null,
      projectionResult: null,
      projectionLoading: false,
    });
  },
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /workspace && pnpm --filter @fire-app/desktop test tests/scenario-store.test.ts`
Expected: PASS — 8 个测试全通过

- [ ] **Step 5: Run tsc**

Run: `cd /workspace && pnpm --filter @fire-app/desktop exec tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
cd /workspace && git add apps/desktop/src/renderer/src/stores/scenario-store.ts apps/desktop/tests/scenario-store.test.ts && git commit -m "feat(fire-calc): extend scenario-store with projection and debounce"
```

---

### Task 2: 创建 fire-calc-constants.ts + 测试（TDD）

**Files:**
- Create: `apps/desktop/src/renderer/src/components/fire-calculator/fire-calc-constants.ts`
- Test: `apps/desktop/tests/fire-calc-constants.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/desktop/tests/fire-calc-constants.test.ts`:

```typescript
// FIRE 计算器纯函数测试 / FIRE calculator pure function tests

import { describe, it, expect } from 'vitest';
import type { User, FireScenario } from '@shared/types/index.js';
import type { MonthlyProjectionPoint } from '@shared/services/fire-calc.js';
import {
  createDefaultScenarioInput,
  validateScenarioField,
  basisPointsToPercent,
  percentToBasisPoints,
  formatFireAmount,
  formatProgress,
  formatProjectionForChart,
  FORM_FIELD_GROUPS,
  CHINA_WITHDRAWAL_RATE_HINT,
} from '@renderer/components/fire-calculator/fire-calc-constants.js';

function makeUser(overrides: Partial<User>): User {
  return {
    id: 'user-1',
    display_name: 'test',
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

describe('basisPointsToPercent', () => {
  it('350 基点 → 3.5%', () => {
    expect(basisPointsToPercent(350)).toBe(3.5);
  });
  it('400 基点 → 4%', () => {
    expect(basisPointsToPercent(400)).toBe(4);
  });
  it('0 基点 → 0%', () => {
    expect(basisPointsToPercent(0)).toBe(0);
  });
});

describe('percentToBasisPoints', () => {
  it('3.5% → 350 基点', () => {
    expect(percentToBasisPoints(3.5)).toBe(350);
  });
  it('4% → 400 基点', () => {
    expect(percentToBasisPoints(4)).toBe(400);
  });
  it('往返转换一致', () => {
    expect(percentToBasisPoints(basisPointsToPercent(550))).toBe(550);
  });
});

describe('formatFireAmount', () => {
  it('分转元并格式化为人民币', () => {
    expect(formatFireAmount(171428600)).toBe('¥1,714,286.00');
  });
  it('0 分', () => {
    expect(formatFireAmount(0)).toBe('¥0.00');
  });
});

describe('formatProgress', () => {
  it('66.7 → 66.7%', () => {
    expect(formatProgress(66.7)).toBe('66.7%');
  });
  it('0 → 0%', () => {
    expect(formatProgress(0)).toBe('0%');
  });
  it('100 → 100%', () => {
    expect(formatProgress(100)).toBe('100%');
  });
});

describe('createDefaultScenarioInput', () => {
  it('从 User 表读取默认利率偏好', () => {
    const user = makeUser({
      default_expected_return: 700,
      default_inflation_rate: 300,
      default_withdrawal_rate: 350,
    });
    const input = createDefaultScenarioInput(user, '我的计划');
    expect(input.name).toBe('我的计划');
    expect(input.expected_return_rate).toBe(700);
    expect(input.inflation_rate).toBe(300);
    expect(input.withdrawal_rate).toBe(350);
  });

  it('默认值：年龄30、退休55、年限30', () => {
    const input = createDefaultScenarioInput(makeUser({}), 'x');
    expect(input.current_age).toBe(30);
    expect(input.retirement_age).toBe(55);
    expect(input.retirement_years).toBe(30);
  });

  it('默认开启自动同步', () => {
    const input = createDefaultScenarioInput(makeUser({}), 'x');
    expect(input.auto_sync_assets).toBe(1);
  });

  it('年度支出默认 6 万元/年（转分）', () => {
    const input = createDefaultScenarioInput(makeUser({}), 'x');
    expect(input.annual_expenses).toBe(6000000);
  });

  it('继承用户的 is_china_market', () => {
    const input = createDefaultScenarioInput(makeUser({ is_china_market: 0 }), 'x');
    expect(input.is_china_market).toBe(0);
  });
});

describe('validateScenarioField', () => {
  it('current_age=30 通过', () => {
    expect(validateScenarioField('current_age', 30)).toBe('');
  });
  it('current_age=17 失败', () => {
    expect(validateScenarioField('current_age', 17)).toBe('当前年龄需在 18-80 之间');
  });
  it('current_age=81 失败', () => {
    expect(validateScenarioField('current_age', 81)).toBe('当前年龄需在 18-80 之间');
  });
  it('retirement_age=55 且 current_age=30 通过（需带上下文）', () => {
    // retirement_age 校验需 current_age 上下文，用第二参数
    expect(validateScenarioField('retirement_age', 55, { current_age: 30 })).toBe('');
  });
  it('retirement_age=30 且 current_age=30 失败', () => {
    expect(validateScenarioField('retirement_age', 30, { current_age: 30 })).toBe('退休年龄需大于当前年龄且不超过 80');
  });
  it('annual_expenses=0 失败', () => {
    expect(validateScenarioField('annual_expenses', 0)).toBe('年度支出需大于 0');
  });
  it('expected_return_rate=100 通过（1%）', () => {
    expect(validateScenarioField('expected_return_rate', 100)).toBe('');
  });
  it('expected_return_rate=1500 通过（15%）', () => {
    expect(validateScenarioField('expected_return_rate', 1500)).toBe('');
  });
  it('expected_return_rate=99 失败', () => {
    expect(validateScenarioField('expected_return_rate', 99)).toBe('预期回报率需在 1%-15% 之间');
  });
  it('inflation_rate=0 通过', () => {
    expect(validateScenarioField('inflation_rate', 0)).toBe('');
  });
  it('inflation_rate=1001 失败', () => {
    expect(validateScenarioField('inflation_rate', 1001)).toBe('通胀率需在 0%-10% 之间');
  });
  it('withdrawal_rate=200 通过（2%）', () => {
    expect(validateScenarioField('withdrawal_rate', 200)).toBe('');
  });
  it('withdrawal_rate=600 通过（6%）', () => {
    expect(validateScenarioField('withdrawal_rate', 600)).toBe('');
  });
  it('withdrawal_rate=601 失败', () => {
    expect(validateScenarioField('withdrawal_rate', 601)).toBe('提现率需在 2%-6% 之间');
  });
  it('retirement_years=10 通过', () => {
    expect(validateScenarioField('retirement_years', 10)).toBe('');
  });
  it('retirement_years=51 失败', () => {
    expect(validateScenarioField('retirement_years', 51)).toBe('退休后年限需在 10-50 之间');
  });
  it('monthly_savings=-1 失败', () => {
    expect(validateScenarioField('monthly_savings', -1)).toBe('每月储蓄不能为负');
  });
  it('未知字段返回空字符串', () => {
    expect(validateScenarioField('sync_version', 0)).toBe('');
  });
});

describe('FORM_FIELD_GROUPS', () => {
  it('包含 2 个分组', () => {
    expect(FORM_FIELD_GROUPS).toHaveLength(2);
  });
  it('第一组标题为基本参数', () => {
    expect(FORM_FIELD_GROUPS[0].title).toBe('基本参数');
  });
  it('第二组标题为投资参数', () => {
    expect(FORM_FIELD_GROUPS[1].title).toBe('投资参数');
  });
  it('包含 current_age 字段', () => {
    const allFields = FORM_FIELD_GROUPS.flatMap((g) => g.fields.map((f) => f.key));
    expect(allFields).toContain('current_age');
  });
});

describe('CHINA_WITHDRAWAL_RATE_HINT', () => {
  it('包含 3.0%-3.5%', () => {
    expect(CHINA_WITHDRAWAL_RATE_HINT).toContain('3.0%-3.5%');
  });
});

describe('formatProjectionForChart', () => {
  it('空数组返回空', () => {
    expect(formatProjectionForChart([], 1500000000)).toEqual([]);
  });

  it('转换分→元、注入 fireNumber、保留 phase', () => {
    const projection: MonthlyProjectionPoint[] = [
      {
        month: 1, age: 30.0833, balance: 10100000, contribution: 100000,
        growth: 100000, cumulative_contribution: 100000, cumulative_growth: 100000,
        phase: 'accumulation',
      },
      {
        month: 301, age: 55.0833, balance: 1990000000, contribution: 0,
        growth: 5000000, cumulative_contribution: 30000000, cumulative_growth: 1960000000,
        phase: 'retirement',
      },
    ];
    const result = formatProjectionForChart(projection, 1500000000);
    expect(result).toHaveLength(2);
    expect(result[0].age).toBe(30.08);
    expect(result[0].balance).toBe(101000); // 10100000 分 → 101000 元
    expect(result[0].phase).toBe('accumulation');
    expect(result[0].fireNumber).toBe(15000000); // 1500000000 分 → 15000000 元
    expect(result[1].phase).toBe('retirement');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /workspace && pnpm --filter @fire-app/desktop test tests/fire-calc-constants.test.ts`
Expected: FAIL — 模块不存在

- [ ] **Step 3: Write minimal implementation**

Create `apps/desktop/src/renderer/src/components/fire-calculator/fire-calc-constants.ts`:

```typescript
// FIRE 计算器纯函数与类型 / FIRE calculator pure functions and types
// 默认值生成、字段校验、基点/百分比转换、金额格式化、投影数据格式化
// 全部无副作用，易于单元测试

import type { User, FireScenario } from '@shared/types/index.js';
import type { CreateScenarioInput } from '@shared/models/scenario.js';
import type { MonthlyProjectionPoint } from '@shared/services/fire-calc.js';
import { centsToYuan } from '@shared/utils/money.js';

// ============= 单位转换 =============

/** 基点 → 百分比（350 → 3.5） */
// basis points → percent (350 → 3.5)
export function basisPointsToPercent(bp: number): number {
  return bp / 100;
}

/** 百分比 → 基点（3.5 → 350） */
// percent → basis points (3.5 → 350)
export function percentToBasisPoints(percent: number): number {
  return Math.round(percent * 100);
}

// ============= 格式化 =============

/** 分 → 元 → 人民币货币字符串 */
// cents → yuan → CNY currency string
export function formatFireAmount(cents: number): string {
  const yuan = centsToYuan(cents);
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
  }).format(yuan);
}

/** 进度格式化（66.7 → '66.7%'） */
// progress format (66.7 → '66.7%')
export function formatProgress(percent: number): string {
  return `${percent}%`;
}

// ============= 默认值生成 =============

/** 从 User 表默认偏好生成场景输入 */
// Generate scenario input from User table defaults
export function createDefaultScenarioInput(user: User, name: string): CreateScenarioInput {
  return {
    user_id: user.id,
    name,
    description: null,
    current_age: 30,
    retirement_age: 55,
    current_portfolio_value: 0,
    auto_sync_assets: 1,
    monthly_savings: 0,
    annual_expenses: 60000 * 100, // 6 万元/年，转分 / 60k yuan/year → cents
    expected_return_rate: user.default_expected_return,
    inflation_rate: user.default_inflation_rate,
    withdrawal_rate: user.default_withdrawal_rate,
    retirement_years: 30,
    post_retirement_monthly_income: 0,
    is_china_market: user.is_china_market,
  };
}

// ============= 校验 =============

/**
 * 字段校验：返回错误信息，空字符串表示通过
 * retirement_age 校验需 current_age 上下文，通过 context 参数传入
 *
 * Field validation: returns error message, empty string means pass.
 * retirement_age validation needs current_age context via context param.
 */
export function validateScenarioField(
  field: keyof FireScenario,
  value: unknown,
  context?: Partial<Pick<FireScenario, 'current_age'>>
): string {
  const n = typeof value === 'number' ? value : Number(value);
  switch (field) {
    case 'current_age':
      if (!Number.isInteger(n) || n < 18 || n > 80) return '当前年龄需在 18-80 之间';
      return '';
    case 'retirement_age': {
      const currentAge = context?.current_age ?? 0;
      if (!Number.isInteger(n) || n <= currentAge || n > 80) return '退休年龄需大于当前年龄且不超过 80';
      return '';
    }
    case 'annual_expenses':
      if (!(n > 0)) return '年度支出需大于 0';
      return '';
    case 'expected_return_rate':
      if (n < 100 || n > 1500) return '预期回报率需在 1%-15% 之间';
      return '';
    case 'inflation_rate':
      if (n < 0 || n > 1000) return '通胀率需在 0%-10% 之间';
      return '';
    case 'withdrawal_rate':
      if (n < 200 || n > 600) return '提现率需在 2%-6% 之间';
      return '';
    case 'retirement_years':
      if (!Number.isInteger(n) || n < 10 || n > 50) return '退休后年限需在 10-50 之间';
      return '';
    case 'monthly_savings':
      if (n < 0) return '每月储蓄不能为负';
      return '';
    case 'post_retirement_monthly_income':
      if (n < 0) return '退休后月收入不能为负';
      return '';
    default:
      return '';
  }
}

// ============= 投影数据格式化 =============

/** 投影图表数据点（Recharts AreaChart 格式） */
// Projection chart data point (Recharts AreaChart format)
export interface ProjectionChartPoint {
  age: number;          // 年龄（保留 2 位小数）
  balance: number;      // 余额（元）
  phase: 'accumulation' | 'retirement';
  fireNumber: number;   // FIRE Number 参考线（元，每点相同）
}

/** MonthlyProjectionPoint[] → ProjectionChartPoint[]（分→元，注入 fireNumber） */
// Convert projection points to chart format (cents→yuan, inject fireNumber)
export function formatProjectionForChart(
  projection: MonthlyProjectionPoint[],
  fireNumber: number
): ProjectionChartPoint[] {
  const fireNumberYuan = centsToYuan(fireNumber);
  return projection.map((p) => ({
    age: Math.round(p.age * 100) / 100,
    balance: centsToYuan(p.balance),
    phase: p.phase,
    fireNumber: fireNumberYuan,
  }));
}

// ============= 常量 =============

/** 中国市场提现率建议 */
// China market withdrawal rate hint
export const CHINA_WITHDRAWAL_RATE_HINT = '中国市场建议提现率 3.0%-3.5%';

/** 表单字段分组配置 */
// Form field group config
export type FormFieldType = 'number' | 'amount' | 'percent' | 'toggle';

export interface FormFieldConfig {
  key: keyof FireScenario;
  label: string;
  type: FormFieldType;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
}

export interface FormFieldGroup {
  title: string;
  fields: ReadonlyArray<FormFieldConfig>;
}

export const FORM_FIELD_GROUPS: ReadonlyArray<FormFieldGroup> = [
  {
    title: '基本参数',
    fields: [
      { key: 'name', label: '场景名称', type: 'number', required: true },
      { key: 'current_age', label: '当前年龄', type: 'number', required: true, min: 18, max: 80 },
      { key: 'retirement_age', label: '退休年龄', type: 'number', required: true, min: 18, max: 80 },
      { key: 'retirement_years', label: '退休后年限', type: 'number', required: true, min: 10, max: 50 },
      { key: 'annual_expenses', label: '年度支出', type: 'amount', required: true },
      { key: 'post_retirement_monthly_income', label: '退休后月收入', type: 'amount' },
    ],
  },
  {
    title: '投资参数',
    fields: [
      { key: 'auto_sync_assets', label: '自动同步资产', type: 'toggle' },
      { key: 'current_portfolio_value', label: '当前组合值', type: 'amount' },
      { key: 'monthly_savings', label: '每月储蓄', type: 'amount' },
      { key: 'expected_return_rate', label: '预期回报率', type: 'percent', required: true, min: 1, max: 15, step: 0.1 },
      { key: 'inflation_rate', label: '通胀率', type: 'percent', required: true, min: 0, max: 10, step: 0.1 },
      { key: 'withdrawal_rate', label: '提现率', type: 'percent', required: true, min: 2, max: 6, step: 0.1 },
    ],
  },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /workspace && pnpm --filter @fire-app/desktop test tests/fire-calc-constants.test.ts`
Expected: PASS — 全部测试通过

- [ ] **Step 5: Run tsc**

Run: `cd /workspace && pnpm --filter @fire-app/desktop exec tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
cd /workspace && git add apps/desktop/src/renderer/src/components/fire-calculator/fire-calc-constants.ts apps/desktop/tests/fire-calc-constants.test.ts && git commit -m "feat(fire-calc): add pure functions module with tests"
```

---

### Task 3: 创建 FireIntro.tsx + 测试

**Files:**
- Create: `apps/desktop/src/renderer/src/components/fire-calculator/FireIntro.tsx`
- Test: `apps/desktop/tests/fire-calc-components.test.tsx` (Create, 逐步累积)

- [ ] **Step 1: Write the failing test**

Create `apps/desktop/tests/fire-calc-components.test.tsx`:

```typescript
// Mock recharts（jsdom 下 SVG 渲染有问题）
// Mock recharts (SVG rendering issues under jsdom)
import { vi } from 'vitest';
vi.mock('recharts', () => ({
  AreaChart: ({ children }: { children: React.ReactNode }) => <div data-testid="area-chart">{children}</div>,
  Area: () => <div data-testid="area" />,
  XAxis: () => <div data-testid="xaxis" />,
  YAxis: () => <div data-testid="yaxis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  ReferenceLine: () => <div data-testid="reference-line" />,
  RadialBarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="radial-bar-chart">{children}</div>,
  RadialBar: () => <div data-testid="radial-bar" />,
  PolarAngleAxis: () => <div data-testid="polar-angle-axis" />,
}));

// FIRE 计算器组件测试 / FIRE calculator component tests

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { FireIntro } from '@renderer/components/fire-calculator/FireIntro.js';

describe('FireIntro', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('渲染标题和说明', () => {
    render(<FireIntro onCreate={vi.fn()} />);
    expect(screen.getByText('开始你的 FIRE 之旅')).toBeInTheDocument();
    expect(screen.getByText(/FIRE Number/)).toBeInTheDocument();
  });

  it('点击按钮触发 onCreate', () => {
    const onCreate = vi.fn();
    render(<FireIntro onCreate={onCreate} />);
    fireEvent.click(screen.getByText('创建第一个场景'));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /workspace && pnpm --filter @fire-app/desktop test tests/fire-calc-components.test.tsx`
Expected: FAIL — `FireIntro` 模块不存在

- [ ] **Step 3: Write minimal implementation**

Create `apps/desktop/src/renderer/src/components/fire-calculator/FireIntro.tsx`:

```typescript
// FIRE 计算器介绍页 / FIRE calculator intro page
// 首次进入无场景时显示，说明 FIRE 概念
// Shown when no scenarios exist, explains FIRE concepts

interface FireIntroProps {
  onCreate: () => void;
}

export function FireIntro({ onCreate }: FireIntroProps) {
  return (
    <div className="max-w-2xl mx-auto py-16 px-4 text-center">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">开始你的 FIRE 之旅</h1>
      <div className="space-y-4 text-left text-gray-600">
        <p>
          <strong className="text-gray-900">FIRE Number</strong> — 退休所需资产目标，计算公式为年度支出 ÷ 提现率。例如年度支出 6 万元、提现率 4%，则 FIRE Number 为 150 万元。
        </p>
        <p>
          <strong className="text-gray-900">4% 规则</strong> — 经典的退休提现率，源于 Trinity 研究。中国市场因波动较大，建议提现率 3.0%-3.5%。
        </p>
        <p>
          <strong className="text-gray-900">积累与提取</strong> — 投影分为两阶段：退休前持续储蓄投资（积累期），退休后按提现率支取（提取期）。面积图将可视化整条路径。
        </p>
      </div>
      <button
        onClick={onCreate}
        className="mt-8 bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600"
      >
        创建第一个场景
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /workspace && pnpm --filter @fire-app/desktop test tests/fire-calc-components.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /workspace && git add apps/desktop/src/renderer/src/components/fire-calculator/FireIntro.tsx apps/desktop/tests/fire-calc-components.test.tsx && git commit -m "feat(fire-calc): add FireIntro component"
```

---

### Task 4: 创建 ScenarioSidebar.tsx + 测试

**Files:**
- Create: `apps/desktop/src/renderer/src/components/fire-calculator/ScenarioSidebar.tsx`
- Modify: `apps/desktop/tests/fire-calc-components.test.tsx` (追加测试)

- [ ] **Step 1: Write the failing test**

Append to `apps/desktop/tests/fire-calc-components.test.tsx` (在文件末尾追加，保留已有的 `import` 和 `FireIntro` describe 块):

```typescript
import { ScenarioSidebar } from '@renderer/components/fire-calculator/ScenarioSidebar.js';
import type { FireScenario } from '@shared/types/index.js';

function makeScenario(overrides: Partial<FireScenario>): FireScenario {
  return {
    id: 'scn-1', user_id: 'user-1', name: '标准计划', description: null,
    current_age: 30, retirement_age: 55, current_portfolio_value: 0,
    auto_sync_assets: 0, monthly_savings: 0, annual_expenses: 6000000,
    expected_return_rate: 700, inflation_rate: 300, withdrawal_rate: 400,
    retirement_years: 30, post_retirement_monthly_income: 0,
    is_china_market: 1, is_active: 1, sync_version: 0, updated_at: 0, deleted_flag: 0,
    ...overrides,
  };
}

describe('ScenarioSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('渲染场景列表', () => {
    const scenarios = [makeScenario({ id: 's1', name: '标准' }), makeScenario({ id: 's2', name: '保守' })];
    render(<ScenarioSidebar scenarios={scenarios} currentId="s1" onSelect={vi.fn()} onCreate={vi.fn()} />);
    expect(screen.getByText('标准')).toBeInTheDocument();
    expect(screen.getByText('保守')).toBeInTheDocument();
  });

  it('选中项有高亮 class', () => {
    const scenarios = [makeScenario({ id: 's1', name: '标准' }), makeScenario({ id: 's2', name: '保守' })];
    render(<ScenarioSidebar scenarios={scenarios} currentId="s2" onSelect={vi.fn()} onCreate={vi.fn()} />);
    const item = screen.getByText('保守').closest('button');
    expect(item!.className).toContain('bg-blue-50');
  });

  it('点击场景项触发 onSelect', () => {
    const onSelect = vi.fn();
    const scenarios = [makeScenario({ id: 's1', name: '标准' })];
    render(<ScenarioSidebar scenarios={scenarios} currentId="s1" onSelect={onSelect} onCreate={vi.fn()} />);
    fireEvent.click(screen.getByText('标准'));
    expect(onSelect).toHaveBeenCalledWith('s1');
  });

  it('点击新建按钮触发 onCreate', () => {
    const onCreate = vi.fn();
    render(<ScenarioSidebar scenarios={[]} currentId="" onSelect={vi.fn()} onCreate={onCreate} />);
    fireEvent.click(screen.getByText('+ 新建场景'));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /workspace && pnpm --filter @fire-app/desktop test tests/fire-calc-components.test.tsx`
Expected: FAIL — `ScenarioSidebar` 模块不存在

- [ ] **Step 3: Write minimal implementation**

Create `apps/desktop/src/renderer/src/components/fire-calculator/ScenarioSidebar.tsx`:

```typescript
// 场景列表侧边栏 / Scenario list sidebar
// 展示场景列表 + 新建按钮，纯展示组件
// Displays scenario list + create button, pure presentational

import type { FireScenario } from '@shared/types/index.js';

interface ScenarioSidebarProps {
  scenarios: FireScenario[];
  currentId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
}

export function ScenarioSidebar({ scenarios, currentId, onSelect, onCreate }: ScenarioSidebarProps) {
  return (
    <div className="w-60 border-r border-gray-200 bg-gray-50 flex flex-col">
      <div className="p-4">
        <button
          onClick={onCreate}
          className="w-full bg-blue-500 text-white px-3 py-2 rounded text-sm hover:bg-blue-600"
        >
          + 新建场景
        </button>
      </div>
      <div className="flex-1 overflow-auto px-2 pb-4 space-y-1">
        {scenarios.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={`w-full text-left px-3 py-2 rounded text-sm border-l-2 ${
              s.id === currentId
                ? 'bg-blue-50 border-blue-500 text-gray-900'
                : 'border-transparent text-gray-600 hover:bg-gray-100'
            }`}
          >
            <div className="font-medium truncate">{s.name}</div>
            {s.description && (
              <div className="text-xs text-gray-400 truncate mt-0.5">{s.description}</div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /workspace && pnpm --filter @fire-app/desktop test tests/fire-calc-components.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /workspace && git add apps/desktop/src/renderer/src/components/fire-calculator/ScenarioSidebar.tsx apps/desktop/tests/fire-calc-components.test.tsx && git commit -m "feat(fire-calc): add ScenarioSidebar component"
```

---

### Task 5: 创建 ScenarioForm.tsx + 测试

**Files:**
- Create: `apps/desktop/src/renderer/src/components/fire-calculator/ScenarioForm.tsx`
- Modify: `apps/desktop/tests/fire-calc-components.test.tsx` (追加测试)

- [ ] **Step 1: Write the failing test**

Append to `apps/desktop/tests/fire-calc-components.test.tsx`:

```typescript
import { ScenarioForm } from '@renderer/components/fire-calculator/ScenarioForm.js';

describe('ScenarioForm', () => {
  const baseScenario = makeScenario({
    id: 's1', name: '标准', current_age: 30, retirement_age: 55,
    annual_expenses: 6000000, expected_return_rate: 700, inflation_rate: 300,
    withdrawal_rate: 400, retirement_years: 30, auto_sync_assets: 0,
    current_portfolio_value: 10000000, monthly_savings: 100000,
    post_retirement_monthly_income: 0, is_china_market: 1,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('渲染两个分组标题', () => {
    render(<ScenarioForm scenario={baseScenario} onFieldChange={vi.fn()} investableBalance={null} />);
    expect(screen.getByText('基本参数')).toBeInTheDocument();
    expect(screen.getByText('投资参数')).toBeInTheDocument();
  });

  it('百分比字段显示为百分比（7.0 而非 700）', () => {
    render(<ScenarioForm scenario={baseScenario} onFieldChange={vi.fn()} investableBalance={null} />);
    // 预期回报率 700 基点 = 7.0%
    const input = screen.getByLabelText('预期回报率') as HTMLInputElement;
    expect(input.value).toBe('7');
  });

  it('金额字段显示为元（100000 而非 10000000）', () => {
    render(<ScenarioForm scenario={baseScenario} onFieldChange={vi.fn()} investableBalance={null} />);
    const input = screen.getByLabelText('当前组合值') as HTMLInputElement;
    expect(input.value).toBe('100000');
  });

  it('auto_sync 开启时当前组合值只读并显示 investableBalance', () => {
    const syncScenario = { ...baseScenario, auto_sync_assets: 1 };
    render(<ScenarioForm scenario={syncScenario} onFieldChange={vi.fn()} investableBalance={5000000} />);
    const input = screen.getByLabelText('当前组合值') as HTMLInputElement;
    expect(input.disabled).toBe(true);
    expect(input.value).toBe('50000'); // 5000000 分 → 50000 元
  });

  it('is_china_market=1 时显示提现率提示', () => {
    render(<ScenarioForm scenario={baseScenario} onFieldChange={vi.fn()} investableBalance={null} />);
    expect(screen.getByText(/中国市场建议提现率/)).toBeInTheDocument();
  });

  it('is_china_market=0 时不显示提现率提示', () => {
    const overseasScenario = { ...baseScenario, is_china_market: 0 };
    render(<ScenarioForm scenario={overseasScenario} onFieldChange={vi.fn()} investableBalance={null} />);
    expect(screen.queryByText(/中国市场建议提现率/)).not.toBeInTheDocument();
  });

  it('修改百分比字段触发 onFieldChange（转基点）', () => {
    const onFieldChange = vi.fn();
    render(<ScenarioForm scenario={baseScenario} onFieldChange={onFieldChange} investableBalance={null} />);
    const input = screen.getByLabelText('预期回报率') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '8' } });
    expect(onFieldChange).toHaveBeenCalledWith('expected_return_rate', 800);
  });

  it('修改金额字段触发 onFieldChange（转分）', () => {
    const onFieldChange = vi.fn();
    render(<ScenarioForm scenario={baseScenario} onFieldChange={onFieldChange} investableBalance={null} />);
    const input = screen.getByLabelText('每月储蓄') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2000' } });
    expect(onFieldChange).toHaveBeenCalledWith('monthly_savings', 200000);
  });

  it('切换 auto_sync 开关触发 onFieldChange', () => {
    const onFieldChange = vi.fn();
    render(<ScenarioForm scenario={baseScenario} onFieldChange={onFieldChange} investableBalance={null} />);
    const toggle = screen.getByLabelText('自动同步资产') as HTMLInputElement;
    fireEvent.click(toggle);
    expect(onFieldChange).toHaveBeenCalledWith('auto_sync_assets', 1);
  });

  it('非法年龄显示校验错误', () => {
    const invalidScenario = { ...baseScenario, current_age: 15 };
    render(<ScenarioForm scenario={invalidScenario} onFieldChange={vi.fn()} investableBalance={null} />);
    expect(screen.getByText('当前年龄需在 18-80 之间')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /workspace && pnpm --filter @fire-app/desktop test tests/fire-calc-components.test.tsx`
Expected: FAIL — `ScenarioForm` 模块不存在

- [ ] **Step 3: Write minimal implementation**

Create `apps/desktop/src/renderer/src/components/fire-calculator/ScenarioForm.tsx`:

```typescript
// 场景参数表单 / Scenario parameter form
// 分两组渲染（基本参数/投资参数），受控组件
// 校验失败时不触发 onFieldChange
// auto_sync 时 current_portfolio_value 只读

import { useState } from 'react';
import type { FireScenario } from '@shared/types/index.js';
import { centsToYuan, yuanToCents } from '@shared/utils/money.js';
import {
  FORM_FIELD_GROUPS,
  basisPointsToPercent,
  percentToBasisPoints,
  validateScenarioField,
  CHINA_WITHDRAWAL_RATE_HINT,
} from './fire-calc-constants.js';

interface ScenarioFormProps {
  scenario: FireScenario;
  onFieldChange: (field: keyof FireScenario, value: number) => void;
  investableBalance: number | null; // auto_sync 时传入，null 表示未开启
}

export function ScenarioForm({ scenario, onFieldChange, investableBalance }: ScenarioFormProps) {
  // 本地草稿：用户输入未提交时的中间值
  // Local draft: intermediate values before commit
  const [draft, setDraft] = useState<Partial<Record<keyof FireScenario, string>>>({});

  function getDisplayValue(field: typeof FORM_FIELD_GROUPS[number]['fields'][number]): string {
    const draftVal = draft[field.key];
    if (draftVal !== undefined) return draftVal;
    const raw = scenario[field.key] as number;
    if (field.type === 'percent') return String(basisPointsToPercent(raw));
    if (field.type === 'amount') return String(centsToYuan(raw));
    if (field.type === 'toggle') return String(raw);
    return String(raw);
  }

  function handleChange(field: typeof FORM_FIELD_GROUPS[number]['fields'][number], inputVal: string) {
    setDraft((d) => ({ ...d, [field.key]: inputVal }));

    let storedValue: number;
    if (field.type === 'percent') {
      storedValue = percentToBasisPoints(Number(inputVal));
    } else if (field.type === 'amount') {
      storedValue = yuanToCents(Number(inputVal));
    } else if (field.type === 'toggle') {
      // toggle 由专用 handler 处理，此处不触发
      return;
    } else {
      storedValue = Number(inputVal);
    }

    const err = validateScenarioField(field.key, storedValue, { current_age: scenario.current_age });
    if (err) return; // 校验失败不回调
    onFieldChange(field.key, storedValue);
  }

  function handleToggle(field: typeof FORM_FIELD_GROUPS[number]['fields'][number]) {
    const current = scenario[field.key] as number;
    const next = current === 1 ? 0 : 1;
    onFieldChange(field.key, next);
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="space-y-6">
        {FORM_FIELD_GROUPS.map((group) => (
          <div key={group.title}>
            <h3 className="text-base font-semibold text-gray-900 mb-3">{group.title}</h3>
            <div className="grid grid-cols-2 gap-4">
              {group.fields.map((field) => {
                const isAutoSyncedAmount =
                  field.key === 'current_portfolio_value' && scenario.auto_sync_assets === 1;
                const displayVal = isAutoSyncedAmount
                  ? String(centsToYuan(investableBalance ?? 0))
                  : getDisplayValue(field);
                const err = validateScenarioField(field.key, (() => {
                  const raw = scenario[field.key] as number;
                  if (field.type === 'percent') return raw;
                  return raw;
                })(), { current_age: scenario.current_age });

                if (field.type === 'toggle') {
                  const checked = (scenario[field.key] as number) === 1;
                  return (
                    <div key={field.key} className="flex flex-col">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {field.label}
                      </label>
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggle(field)}
                          className="form-checkbox h-4 w-4 text-blue-600"
                        />
                        <span className="text-sm text-gray-600">{checked ? '已开启' : '已关闭'}</span>
                      </label>
                    </div>
                  );
                }

                return (
                  <div key={field.key} className="flex flex-col">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step={field.step ?? 1}
                        min={field.min}
                        max={field.max}
                        value={displayVal}
                        disabled={isAutoSyncedAmount}
                        onChange={(e) => handleChange(field, e.target.value)}
                        aria-label={field.label}
                        className={`w-full h-10 rounded-md border bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed ${
                          err ? 'border-red-300' : 'border-gray-300'
                        } ${field.type === 'amount' ? 'pr-8' : ''} ${field.type === 'percent' ? 'pr-8' : ''}`}
                      />
                      {field.type === 'amount' && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">元</span>
                      )}
                      {field.type === 'percent' && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                      )}
                    </div>
                    {err && <p className="mt-1 text-xs text-red-500">{err}</p>}
                    {field.key === 'withdrawal_rate' && scenario.is_china_market === 1 && (
                      <p className="mt-1 text-xs text-gray-400">{CHINA_WITHDRAWAL_RATE_HINT}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /workspace && pnpm --filter @fire-app/desktop test tests/fire-calc-components.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /workspace && git add apps/desktop/src/renderer/src/components/fire-calculator/ScenarioForm.tsx apps/desktop/tests/fire-calc-components.test.tsx && git commit -m "feat(fire-calc): add ScenarioForm with validation and unit conversion"
```

---

### Task 6: 创建 ResultCards.tsx + 测试

**Files:**
- Create: `apps/desktop/src/renderer/src/components/fire-calculator/ResultCards.tsx`
- Modify: `apps/desktop/tests/fire-calc-components.test.tsx` (追加测试)

- [ ] **Step 1: Write the failing test**

Append to `apps/desktop/tests/fire-calc-components.test.tsx`:

```typescript
import { ResultCards } from '@renderer/components/fire-calculator/ResultCards.js';
import type { ProjectionResult } from '@shared/services/fire-calc.js';

function makeProjection(overrides: Partial<ProjectionResult>): ProjectionResult {
  return {
    fire_number: 1500000000,
    adjusted_fire_number: 1500000000,
    retirement_portfolio: 2000000000,
    progress: 66.7,
    monthly_projection: [],
    ...overrides,
  };
}

describe('ResultCards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loading 时显示加载中', () => {
    render(<ResultCards result={null} loading={true} />);
    // 4 张卡都显示加载中（getAllByText）
    expect(screen.getAllByText('加载中...')).toHaveLength(4);
  });

  it('result 为 null 时显示暂无数据', () => {
    render(<ResultCards result={null} loading={false} />);
    expect(screen.getAllByText('暂无数据')).toHaveLength(4);
  });

  it('渲染 4 个卡片标签', () => {
    render(<ResultCards result={makeProjection({})} loading={false} />);
    expect(screen.getByText('FIRE Number')).toBeInTheDocument();
    expect(screen.getByText('调整后 FIRE Number')).toBeInTheDocument();
    expect(screen.getByText('当前进度')).toBeInTheDocument();
    expect(screen.getByText('退休时资产')).toBeInTheDocument();
  });

  it('金额和进度格式化正确（分→元）', () => {
    render(<ResultCards result={makeProjection({ fire_number: 1500000000, progress: 66.7 })} loading={false} />);
    // 1500000000 分 = 15000000 元 = ¥15,000,000.00
    expect(screen.getByText('¥15,000,000.00')).toBeInTheDocument();
    expect(screen.getByText('66.7%')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /workspace && pnpm --filter @fire-app/desktop test tests/fire-calc-components.test.tsx`
Expected: FAIL — `ResultCards` 模块不存在

- [ ] **Step 3: Write minimal implementation**

Create `apps/desktop/src/renderer/src/components/fire-calculator/ResultCards.tsx`:

```typescript
// 投影结果卡片 / Projection result cards
// 4 张卡：FIRE Number / 调整后 / 当前进度 / 退休时资产
// 4 cards: FIRE Number / adjusted / progress / retirement portfolio

import type { ProjectionResult } from '@shared/services/fire-calc.js';
import { formatFireAmount, formatProgress } from './fire-calc-constants.js';
import { Card } from '../base/Card.js';

interface ResultCardsProps {
  result: ProjectionResult | null;
  loading: boolean;
}

interface CardConfig {
  label: string;
  value: string;
  dotClass: string;
}

function buildCards(result: ProjectionResult | null, loading: boolean): CardConfig[] {
  if (loading) {
    return [
      { label: 'FIRE Number', value: '加载中...', dotClass: 'bg-blue-500' },
      { label: '调整后 FIRE Number', value: '加载中...', dotClass: 'bg-indigo-500' },
      { label: '当前进度', value: '加载中...', dotClass: 'bg-green-500' },
      { label: '退休时资产', value: '加载中...', dotClass: 'bg-purple-500' },
    ];
  }
  if (!result) {
    return [
      { label: 'FIRE Number', value: '暂无数据', dotClass: 'bg-blue-500' },
      { label: '调整后 FIRE Number', value: '暂无数据', dotClass: 'bg-indigo-500' },
      { label: '当前进度', value: '暂无数据', dotClass: 'bg-green-500' },
      { label: '退休时资产', value: '暂无数据', dotClass: 'bg-purple-500' },
    ];
  }
  return [
    { label: 'FIRE Number', value: formatFireAmount(result.fire_number), dotClass: 'bg-blue-500' },
    { label: '调整后 FIRE Number', value: formatFireAmount(result.adjusted_fire_number), dotClass: 'bg-indigo-500' },
    { label: '当前进度', value: formatProgress(result.progress), dotClass: 'bg-green-500' },
    { label: '退休时资产', value: formatFireAmount(result.retirement_portfolio), dotClass: 'bg-purple-500' },
  ];
}

export function ResultCards({ result, loading }: ResultCardsProps) {
  const cards = buildCards(result, loading);
  return (
    <div className="grid grid-cols-4 gap-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <div className="flex items-center gap-2 mb-2">
            <span className={`inline-block w-2 h-2 rounded-full ${c.dotClass}`} />
            <span className="text-sm text-gray-500">{c.label}</span>
          </div>
          <div className="text-lg font-semibold text-gray-900">{c.value}</div>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /workspace && pnpm --filter @fire-app/desktop test tests/fire-calc-components.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /workspace && git add apps/desktop/src/renderer/src/components/fire-calculator/ResultCards.tsx apps/desktop/tests/fire-calc-components.test.tsx && git commit -m "feat(fire-calc): add ResultCards component"
```

---

### Task 7: 创建 ProgressGauge.tsx + 测试

**Files:**
- Create: `apps/desktop/src/renderer/src/components/fire-calculator/ProgressGauge.tsx`
- Modify: `apps/desktop/tests/fire-calc-components.test.tsx` (追加测试)

- [ ] **Step 1: Write the failing test**

Append to `apps/desktop/tests/fire-calc-components.test.tsx`:

```typescript
import { ProgressGauge } from '@renderer/components/fire-calculator/ProgressGauge.js';

describe('ProgressGauge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('渲染环形图和百分比', () => {
    render(<ProgressGauge progress={66.7} fireNumber={1500000000} currentValue={1000000000} />);
    expect(screen.getByTestId('radial-bar-chart')).toBeInTheDocument();
    expect(screen.getByText('66.7%')).toBeInTheDocument();
  });

  it('底部标注显示当前值 → FIRE Number', () => {
    render(<ProgressGauge progress={66.7} fireNumber={1500000000} currentValue={1000000000} />);
    // 1000000000 分 = 10000000 元 = ¥10,000,000.00
    // 1500000000 分 = 15000000 元 = ¥15,000,000.00
    expect(screen.getByText('¥10,000,000.00 → ¥15,000,000.00')).toBeInTheDocument();
  });

  it('progress=0 显示 0%', () => {
    render(<ProgressGauge progress={0} fireNumber={1500000000} currentValue={0} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /workspace && pnpm --filter @fire-app/desktop test tests/fire-calc-components.test.tsx`
Expected: FAIL — `ProgressGauge` 模块不存在

- [ ] **Step 3: Write minimal implementation**

Create `apps/desktop/src/renderer/src/components/fire-calculator/ProgressGauge.tsx`:

```typescript
// 环形进度仪表盘 / Radial progress gauge
// Recharts RadialBarChart，中心显示百分比，底部标注当前值→FIRE Number
// Recharts RadialBarChart, center shows percent, bottom shows current→FIRE Number

import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import { Card } from '../base/Card.js';
import { formatFireAmount, formatProgress } from './fire-calc-constants.js';

interface ProgressGaugeProps {
  progress: number;       // 0-100
  fireNumber: number;     // 分
  currentValue: number;   // 分
}

export function ProgressGauge({ progress, fireNumber, currentValue }: ProgressGaugeProps) {
  const data = [{ name: 'progress', value: progress, fill: '#3b82f6' }];
  const clamped = Math.min(100, Math.max(0, progress));

  return (
    <Card title="进度">
      <div className="relative h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            innerRadius="70%"
            outerRadius="100%"
            data={data}
            startAngle={90}
            endAngle={-270}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar background dataKey="value" cornerRadius={10} />
          </RadialBarChart>
        </ResponsiveContainer>
        {/* 中心百分比 */}
        {/* Center percent */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-semibold text-gray-900">{formatProgress(clamped)}</span>
        </div>
      </div>
      <div className="mt-2 text-center text-xs text-gray-500">
        {formatFireAmount(currentValue)} → {formatFireAmount(fireNumber)}
      </div>
    </Card>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /workspace && pnpm --filter @fire-app/desktop test tests/fire-calc-components.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /workspace && git add apps/desktop/src/renderer/src/components/fire-calculator/ProgressGauge.tsx apps/desktop/tests/fire-calc-components.test.tsx && git commit -m "feat(fire-calc): add ProgressGauge component"
```

---

### Task 8: 创建 ProjectionChart.tsx + 测试

**Files:**
- Create: `apps/desktop/src/renderer/src/components/fire-calculator/ProjectionChart.tsx`
- Modify: `apps/desktop/tests/fire-calc-components.test.tsx` (追加测试)

- [ ] **Step 1: Write the failing test**

Append to `apps/desktop/tests/fire-calc-components.test.tsx`:

```typescript
import { ProjectionChart } from '@renderer/components/fire-calculator/ProjectionChart.js';
import type { MonthlyProjectionPoint } from '@shared/services/fire-calc.js';

function makeProjectionPoints(): MonthlyProjectionPoint[] {
  return [
    {
      month: 1, age: 30.08, balance: 10100000, contribution: 100000,
      growth: 100000, cumulative_contribution: 100000, cumulative_growth: 100000,
      phase: 'accumulation',
    },
    {
      month: 2, age: 30.17, balance: 10300000, contribution: 100000,
      growth: 101000, cumulative_contribution: 200000, cumulative_growth: 201000,
      phase: 'accumulation',
    },
    {
      month: 301, age: 55.08, balance: 1990000000, contribution: 0,
      growth: 5000000, cumulative_contribution: 30000000, cumulative_growth: 1960000000,
      phase: 'retirement',
    },
  ];
}

describe('ProjectionChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loading 时显示加载中', () => {
    render(<ProjectionChart data={[]} fireNumber={1500000000} loading={true} />);
    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  it('空数据显示空状态', () => {
    render(<ProjectionChart data={[]} fireNumber={1500000000} loading={false} />);
    expect(screen.getByText('暂无投影数据')).toBeInTheDocument();
  });

  it('有数据时渲染面积图', () => {
    render(<ProjectionChart data={makeProjectionPoints()} fireNumber={1500000000} loading={false} />);
    expect(screen.getByTestId('area-chart')).toBeInTheDocument();
    expect(screen.getByTestId('reference-line')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /workspace && pnpm --filter @fire-app/desktop test tests/fire-calc-components.test.tsx`
Expected: FAIL — `ProjectionChart` 模块不存在

- [ ] **Step 3: Write minimal implementation**

Create `apps/desktop/src/renderer/src/components/fire-calculator/ProjectionChart.tsx`:

```typescript
// 投影面积图 / Projection area chart
// Recharts AreaChart，展示余额随年龄变化，含 FIRE Number 参考线
// Recharts AreaChart, balance over age, with FIRE Number reference line

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { MonthlyProjectionPoint } from '@shared/services/fire-calc.js';
import { Card } from '../base/Card.js';
import { EmptyState } from '../auxiliary/EmptyState.js';
import { formatProjectionForChart, formatFireAmount } from './fire-calc-constants.js';

interface ProjectionChartProps {
  data: MonthlyProjectionPoint[];
  fireNumber: number; // 分
  loading: boolean;
}

export function ProjectionChart({ data, fireNumber, loading }: ProjectionChartProps) {
  const chartData = formatProjectionForChart(data, fireNumber);
  const fireNumberYuan = fireNumber / 100;

  return (
    <Card title="投影">
      {loading ? (
        <div className="py-12 text-center text-gray-400">加载中...</div>
      ) : chartData.length === 0 ? (
        <EmptyState title="暂无投影数据" />
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
              <defs>
                <linearGradient id="colorAccumulation" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="colorRetirement" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <XAxis dataKey="age" tick={{ fontSize: 12 }} stroke="#9ca3af" />
              <YAxis hide />
              <Tooltip
                formatter={(value: number) => [formatFireAmount(value * 100), '余额']}
                labelFormatter={(label) => `年龄: ${label}`}
              />
              <ReferenceLine y={fireNumberYuan} stroke="#EF4444" strokeDasharray="5 5" />
              <Area
                type="monotone"
                dataKey="balance"
                stroke="#10B981"
                strokeWidth={2}
                fill="url(#colorAccumulation)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /workspace && pnpm --filter @fire-app/desktop test tests/fire-calc-components.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /workspace && git add apps/desktop/src/renderer/src/components/fire-calculator/ProjectionChart.tsx apps/desktop/tests/fire-calc-components.test.tsx && git commit -m "feat(fire-calc): add ProjectionChart component"
```

---

### Task 9: 重写 FireCalculatorPage 容器 + 集成测试

**Files:**
- Modify: `apps/desktop/src/renderer/src/pages/FireCalculatorPage.tsx`
- Modify: `apps/desktop/tests/fire-calc-components.test.tsx` (追加集成测试)

- [ ] **Step 1: Write the failing test**

Append to `apps/desktop/tests/fire-calc-components.test.tsx`:

```typescript
import { FireCalculatorPage } from '@renderer/pages/FireCalculatorPage.js';
import { useAppStore } from '@renderer/stores/app-store.js';
import { useScenarioStore } from '@renderer/stores/scenario-store.js';

describe('FireCalculatorPage 集成', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 重置 stores
    useAppStore.getState().clearError();
    useScenarioStore.getState().clear();
    // 默认 mock
    (window.dataAccess.scenario.list as any).mockResolvedValue([]);
    (window.dataAccess.scenario.create as any).mockResolvedValue(undefined);
    (window.dataAccess.scenario.update as any).mockResolvedValue(undefined);
    (window.dataAccess.fireCalc.runProjection as any).mockResolvedValue(makeProjection({}));
    (window.dataAccess.account.investableBalance as any).mockResolvedValue(0);
  });

  it('无场景时显示介绍页', async () => {
    (window.dataAccess.scenario.list as any).mockResolvedValue([]);
    useAppStore.setState({ currentUser: makeUser({}) as any });

    render(<FireCalculatorPage />);

    expect(await screen.findByText('开始你的 FIRE 之旅')).toBeInTheDocument();
  });

  it('有场景时显示表单和结果', async () => {
    const scenarios = [makeScenario({ id: 's1', name: '标准' })];
    (window.dataAccess.scenario.list as any).mockResolvedValue(scenarios);
    useAppStore.setState({ currentUser: makeUser({}) as any });

    render(<FireCalculatorPage />);

    expect(await screen.findByText('标准')).toBeInTheDocument();
    expect(screen.getByText('基本参数')).toBeInTheDocument();
    expect(screen.getByText('FIRE Number')).toBeInTheDocument();
  });

  it('点击介绍页按钮创建场景', async () => {
    (window.dataAccess.scenario.list as any)
      .mockResolvedValueOnce([]) // 初始 fetch
      .mockResolvedValueOnce([makeScenario({ id: 's-new', name: '我的 FIRE 计划' })]); // 创建后
    useAppStore.setState({ currentUser: makeUser({}) as any });

    render(<FireCalculatorPage />);

    const btn = await screen.findByText('创建第一个场景');
    fireEvent.click(btn);

    expect(await screen.findByText('我的 FIRE 计划')).toBeInTheDocument();
    expect(window.dataAccess.scenario.create).toHaveBeenCalledTimes(1);
  });

  it('切换场景触发 runProjection', async () => {
    const scenarios = [makeScenario({ id: 's1', name: 'A' }), makeScenario({ id: 's2', name: 'B' })];
    (window.dataAccess.scenario.list as any).mockResolvedValue(scenarios);
    useAppStore.setState({ currentUser: makeUser({}) as any });

    render(<FireCalculatorPage />);
    await screen.findByText('A');
    vi.clearAllMocks();

    fireEvent.click(screen.getByText('B'));
    expect(window.dataAccess.fireCalc.runProjection).toHaveBeenCalledWith(
      expect.objectContaining({ id: 's2' })
    );
  });

  it('加载失败显示错误提示', async () => {
    (window.dataAccess.scenario.list as any).mockRejectedValue(new Error('加载失败'));
    useAppStore.setState({ currentUser: makeUser({}) as any });

    render(<FireCalculatorPage />);

    expect(await screen.findByText('数据加载失败，请重试')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /workspace && pnpm --filter @fire-app/desktop test tests/fire-calc-components.test.tsx`
Expected: FAIL — `FireCalculatorPage` 仍是占位页

- [ ] **Step 3: Write minimal implementation**

Replace `apps/desktop/src/renderer/src/pages/FireCalculatorPage.tsx`:

```typescript
// FIRE 计算器页 / FIRE calculator page
// 多场景管理 + 参数表单（debounce 自动保存）+ 实时投影 + 结果展示
// Multi-scenario + form (debounce auto-save) + realtime projection + results

import { useEffect, useState } from 'react';
import { useAppStore } from '../stores/app-store.js';
import { useScenarioStore } from '../stores/scenario-store.js';
import { dataAccess } from '../data/data-access.js';
import { createDefaultScenarioInput } from '../components/fire-calculator/fire-calc-constants.js';
import { FireIntro } from '../components/fire-calculator/FireIntro.js';
import { ScenarioSidebar } from '../components/fire-calculator/ScenarioSidebar.js';
import { ScenarioForm } from '../components/fire-calculator/ScenarioForm.js';
import { ResultCards } from '../components/fire-calculator/ResultCards.js';
import { ProgressGauge } from '../components/fire-calculator/ProgressGauge.js';
import { ProjectionChart } from '../components/fire-calculator/ProjectionChart.js';

export function FireCalculatorPage() {
  const currentUser = useAppStore((s) => s.currentUser);
  const {
    scenarios,
    currentScenarioId,
    projectionResult,
    projectionLoading,
    loading,
    error,
    fetchScenarios,
    createScenario,
    updateScenario,
    selectScenario,
    runProjection,
  } = useScenarioStore();
  const [investableBalance, setInvestableBalance] = useState<number | null>(null);

  useEffect(() => {
    if (currentUser) {
      void fetchScenarios(currentUser.id);
    }
  }, [currentUser, fetchScenarios]);

  const currentScenario = scenarios.find((s) => s.id === currentScenarioId);

  // auto_sync 时获取 investableBalance
  // Fetch investableBalance when auto_sync is on
  useEffect(() => {
    if (currentUser && currentScenario?.auto_sync_assets === 1) {
      dataAccess
        .getInvestableBalance(currentUser.id)
        .then((v) => setInvestableBalance(v))
        .catch(() => setInvestableBalance(null));
    } else {
      setInvestableBalance(null);
    }
  }, [currentUser, currentScenario?.auto_sync_assets, currentScenario?.id]);

  if (loading && scenarios.length === 0) {
    return <div className="p-8">加载中...</div>;
  }

  if (error && scenarios.length === 0) {
    return <div className="p-8 text-red-600">数据加载失败，请重试</div>;
  }

  // 无场景 → 介绍页
  // No scenarios → intro
  if (scenarios.length === 0) {
    return (
      <FireIntro
        onCreate={() =>
          createScenario(
            createDefaultScenarioInput(currentUser!, '我的 FIRE 计划'),
            currentUser!.id
          )
        }
      />
    );
  }

  return (
    <div className="flex h-full">
      <ScenarioSidebar
        scenarios={scenarios}
        currentId={currentScenario!.id}
        onSelect={selectScenario}
        onCreate={() =>
          createScenario(
            createDefaultScenarioInput(currentUser!, '新场景'),
            currentUser!.id
          )
        }
      />
      <div className="flex-1 flex flex-col overflow-auto">
        <div className="p-8 space-y-6">
          <h1 className="text-2xl font-bold text-gray-900">FIRE 计算器</h1>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
              {error}
            </div>
          )}

          <ScenarioForm
            scenario={currentScenario!}
            onFieldChange={(field, value) => {
              const updated = { ...currentScenario!, [field]: value };
              updateScenario(currentScenario!.id, { [field]: value }, currentUser!.id);
              void runProjection(updated);
            }}
            investableBalance={investableBalance}
          />

          <ResultCards result={projectionResult} loading={projectionLoading} />

          <div className="grid grid-cols-2 gap-4">
            <ProgressGauge
              progress={projectionResult?.progress ?? 0}
              fireNumber={projectionResult?.adjusted_fire_number ?? 0}
              currentValue={
                currentScenario?.auto_sync_assets === 1
                  ? investableBalance ?? 0
                  : currentScenario?.current_portfolio_value ?? 0
              }
            />
            <ProjectionChart
              data={projectionResult?.monthly_projection ?? []}
              fireNumber={projectionResult?.fire_number ?? 0}
              loading={projectionLoading}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /workspace && pnpm --filter @fire-app/desktop test tests/fire-calc-components.test.tsx`
Expected: PASS — 全部组件 + 集成测试通过

- [ ] **Step 5: Commit**

```bash
cd /workspace && git add apps/desktop/src/renderer/src/pages/FireCalculatorPage.tsx apps/desktop/tests/fire-calc-components.test.tsx && git commit -m "feat(fire-calc): rewrite FireCalculatorPage as container with integration tests"
```

---

### Task 10: 全量测试 + tsc + 构建验证

**Files:** 无（验证 Task）

- [ ] **Step 1: Run full test suite**

Run: `cd /workspace && pnpm --filter @fire-app/desktop test`
Expected: ALL PASS — 包含 scenario-store、fire-calc-constants、fire-calc-components 以及 M4/M5 原有测试

- [ ] **Step 2: Run tsc**

Run: `cd /workspace && pnpm --filter @fire-app/desktop exec tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Run build**

Run: `cd /workspace && pnpm --filter @fire-app/desktop build`
Expected: build success（electron-vite build 完成，无错误）

- [ ] **Step 4: 如有失败，修复**

若测试/tsc/构建失败，修复后重新验证。常见问题：
- recharts mock 缺失组件：在 `tests/fire-calc-components.test.tsx` 顶部的 `vi.mock('recharts')` 中补充缺失组件
- 类型错误：检查 `fire-calc-constants.ts` 的导出类型与组件 import 是否一致
- 单位错误：确认金额（分）和利率（基点）转换正确

- [ ] **Step 5: 无需 commit（本 Task 纯验证，若有修复则提交）**

若有修复：
```bash
cd /workspace && git add -A && git commit -m "fix(fire-calc): address test/type/build issues"
```

---

### Task 11: 推送 + CI 验证

**Files:** 无

- [ ] **Step 1: Push to remote**

Run: `cd /workspace && git push origin main`
Expected: push 成功

- [ ] **Step 2: 等待 CI 触发**

确认 GitHub Actions 触发，监控 CI run 状态。

- [ ] **Step 3: 验证 CI 成功**

Run: `cd /workspace && gh run list --limit 3`
Expected: 最新 run 状态为 success

- [ ] **Step 4: 下载 artifact（可选，用于 Task 12 手动验证）**

Run: `cd /workspace && gh run download <run-id> -n fire-app-windows`
Expected: artifact 下载成功

- [ ] **Step 5: 无需 commit**

---

### Task 12: 手动 GUI 验证

**Files:** 无（手动验证 Task）

- [ ] **Step 1: 运行 exe**

解压 artifact，运行 `fire-app.exe`，完成 onboarding（如未初始化）。

- [ ] **Step 2: 逐项验证 FC-1 ~ FC-14**

| 编号 | 检查点 | 验证方式 |
|------|--------|---------|
| FC-1 | 占位页已替换为完整计算器 | 切到"FIRE 计算器"页，确认不再是"即将在里程碑 6 实现" |
| FC-2 | 首次进入显示介绍页 | 无场景时显示"开始你的 FIRE 之旅" |
| FC-3 | 创建场景后显示参数表单 + 投影结果 | 点击"创建第一个场景"，确认显示表单 + 4 卡 + 仪表盘 + 面积图 |
| FC-4 | 场景列表切换正常 | 新建第二个场景，点击切换，确认表单/结果更新 |
| FC-5 | 参数表单字段编辑正常 | 修改年龄/支出/回报率等字段，确认值更新 |
| FC-6 | 自动保存生效 | 修改字段后刷新页面，确认值已持久化 |
| FC-7 | 投影实时重算 | 修改字段后确认 4 卡 + 仪表盘 + 面积图立即更新 |
| FC-8 | 4 个结果卡片显示正确 | FIRE Number / 调整后 / 进度 / 退休资产 均显示金额或百分比 |
| FC-9 | 环形进度仪表盘显示正确 | 环形 + 中心百分比 + 底部"当前→FIRE Number"标注 |
| FC-10 | 面积图投影显示正确 | 面积图 + FIRE Number 红色虚线参考线 |
| FC-11 | auto_sync 开关切换正常 | 开启时当前组合值只读并显示 investableBalance |
| FC-12 | 中国市场提现率提示显示 | 提现率字段下方显示"中国市场建议提现率 3.0%-3.5%" |
| FC-13 | 表单校验错误提示 | 输入非法值（如年龄 15），确认红色错误提示 |
| FC-14 | M4/M5 回归无 bug | 切到仪表盘/交易/净资产趋势页，确认正常 |

- [ ] **Step 3: 记录验证结果**

向主代理报告 FC-1 ~ FC-14 的验证结果（通过/失败）。

- [ ] **Step 4: 如有 bug，修复并重新验证**

若有 bug，回到对应 Task 修复，重新执行 Task 10-12。
