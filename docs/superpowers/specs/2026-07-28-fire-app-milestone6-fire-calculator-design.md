# M6 FIRE 计算器设计 / M6 FIRE Calculator Design

> 版本: 1.0  日期: 2026-07-28  状态: 待审核
> 前置文档: UI/UX 设计文档 §3.4、前端架构设计文档、用户数据模型设计文档

---

## 1. 概述与目标

### 1.1 目标

将占位的 `FireCalculatorPage` 升级为完整的 FIRE 退休规划计算器，实现：
- 多场景管理（侧边栏列表 + 新建/选中）
- 参数表单（14 个字段，分组展示，debounce 500ms 自动保存）
- 投影计算（实时重算，复用已有的 `runProjection` 计算引擎）
- 结果展示（4 个结果卡片 + 环形进度仪表盘 + 面积图投影）
- 首次进入介绍页（无场景时显示）

### 1.2 前置条件（已就位）

| 层 | 文件 | 状态 |
|----|------|------|
| Model | `packages/shared/src/models/scenario.ts` | ✅ createScenario/getScenario/getScenarios/updateScenario |
| Service | `packages/shared/src/services/fire-calc.ts` | ✅ calculateFireNumber/calculateAdjustedFireNumber/calculateAccumulation/calculateProgress/runProjection |
| IPC handlers | `apps/desktop/src/main/ipc/scenario-handlers.ts` | ✅ db:scenario:create/get/list/update |
| IPC handlers | `apps/desktop/src/main/ipc/fire-calc-handlers.ts` | ✅ db:fireCalc:runProjection |
| Preload | `apps/desktop/src/preload/index.ts` | ✅ scenario.create/get/list/update, fireCalc.runProjection |
| DataAccess | `apps/desktop/src/renderer/src/data/ipc-data-access.ts` | ✅ createScenario/getScenario/getScenarios/updateScenario/runProjection |
| Store | `apps/desktop/src/renderer/src/stores/scenario-store.ts` | ⚠️ 需扩展（新增 currentScenarioId/projectionResult/runProjection） |
| 测试 mock | `apps/desktop/vitest.setup.ts` | ✅ scenario.create/get/list/update, fireCalc.runProjection 均已 mock |

### 1.3 不修改文件

- 数据层（model/service/IPC/handlers/preload）— 已全部就位
- 路由配置（`/fire` 路由已存在，指向 FireCalculatorPage）
- M4/M5 代码（除非验证发现回归 bug）

---

## 2. 架构与组件

### 2.1 整体架构

复刻 M4/M5 模式：容器组件 + 纯展示子组件 + 纯函数模块 + Zustand store。M6 工作集中在 UI 层。

### 2.2 数据流

```
FireCalculatorPage (容器)
  │
  ├─ useEffect → scenarioStore.fetchScenarios(userId)
  │
  ├─ 无场景 → FireIntro 介绍页 → 点击创建 → createScenario → 自动选中 → runProjection
  │
  ├─ 有场景 → 选中场景（默认第一个）
  │     ↓
  ├─ ScenarioForm (受控表单)
  │     ├─ 字段修改 → 校验通过
  │     │     ├─ scenarioStore.updateScenario(id, updates, userId)  [debounce 500ms 持久化]
  │     │     └─ scenarioStore.runProjection(updatedScenario)        [立即重算，乐观更新]
  │     │           → dataAccess.runProjection(scenario) → IPC → 主进程 runProjection(db, scenario)
  │     │           → ProjectionResult (fire_number/adjusted_fire_number/progress/monthly_projection/retirement_portfolio)
  │     └─ auto_sync_assets=1 → dataAccess.getInvestableBalance(userId) → 只读显示
  │
  └─ projectionResult → ResultCards / ProgressGauge / ProjectionChart
```

### 2.3 布局

三区域布局（对齐 UI/UX 设计文档 §3.4.1）：

```
+-----------------------------------------------------------------------+
|  FIRE 计算器                                                           |
+-----------------------------------------------------------------------+
|                  |                                                    |
|  场景列表        |  ScenarioForm (参数表单，基本参数 + 投资参数两组)    |
|  (侧边栏 240px)  |                                                    |
|  [+ 新建场景]    |                                                    |
|  > 标准计划 ●   |                                                    |
|    保守计划      |                                                    |
|                  |                                                    |
+------------------+----------------------------------------------------+
|                                                                       |
|  ResultCards (4 列：FIRE Number / 调整后 / 进度 / 退休资产)            |
|                                                                       |
|  +-------------------+  +-------------------+                         |
|  | ProgressGauge     |  | ProjectionChart   |                         |
|  | (环形进度)        |  | (面积图投影)      |                         |
|  +-------------------+  +-------------------+                         |
+-----------------------------------------------------------------------+
```

---

## 3. 文件结构

### 3.1 新建文件（9 个）

| 文件 | 职责 |
|------|------|
| `apps/desktop/src/renderer/src/components/fire-calculator/fire-calc-constants.ts` | 纯函数：默认值生成、字段校验、基点/百分比转换、金额格式化、投影数据格式化 |
| `apps/desktop/src/renderer/src/components/fire-calculator/ScenarioSidebar.tsx` | 场景列表 + 新建按钮 |
| `apps/desktop/src/renderer/src/components/fire-calculator/ScenarioForm.tsx` | 参数表单（基本参数 + 投资参数两组） |
| `apps/desktop/src/renderer/src/components/fire-calculator/ResultCards.tsx` | 4 个结果卡片 |
| `apps/desktop/src/renderer/src/components/fire-calculator/ProgressGauge.tsx` | 环形进度仪表盘 |
| `apps/desktop/src/renderer/src/components/fire-calculator/ProjectionChart.tsx` | 面积图投影 |
| `apps/desktop/src/renderer/src/components/fire-calculator/FireIntro.tsx` | 介绍页（首次进入无场景时显示） |
| `apps/desktop/tests/fire-calc-constants.test.ts` | 纯函数测试 |
| `apps/desktop/tests/fire-calc-components.test.tsx` | 组件 + 集成测试 |

### 3.2 修改文件（2 个）

| 文件 | 修改 |
|------|------|
| `apps/desktop/src/renderer/src/stores/scenario-store.ts` | 扩展 currentScenarioId/projectionResult/projectionLoading/selectScenario/runProjection，updateScenario 加 debounce |
| `apps/desktop/src/renderer/src/pages/FireCalculatorPage.tsx` | 占位页 → 容器组件 |

---

## 4. 纯函数模块 fire-calc-constants.ts

### 4.1 导出内容

```typescript
import type { User, FireScenario } from '@shared/types/index.js';
import type { CreateScenarioInput } from '@shared/models/scenario.js';
import type { MonthlyProjectionPoint } from '@shared/services/fire-calc.js';

// 默认场景参数生成（从 User 表读取默认偏好）
export function createDefaultScenarioInput(user: User, name: string): CreateScenarioInput;

// 字段校验（返回错误信息，空字符串表示通过）
export function validateScenarioField(field: keyof FireScenario, value: unknown): string;

// 百分比 ↔ 基点转换（UI 显示百分比，DB 存储基点）
export function basisPointsToPercent(bp: number): number;   // 350 → 3.5
export function percentToBasisPoints(percent: number): number; // 3.5 → 350

// 金额格式化（分 → 元 → 货币字符串）
export function formatFireAmount(cents: number): string;     // ¥1,714,286.00
export function formatProgress(percent: number): string;     // 67.4%

// 投影数据格式化（MonthlyProjectionPoint[] → Recharts AreaChart 格式）
export interface ProjectionChartPoint {
  age: number;          // 年龄（X 轴）
  balance: number;      // 余额（Y 值，元）
  phase: 'accumulation' | 'retirement';
  fireNumber: number;   // FIRE Number 参考线（常量，每点相同）
}
export function formatProjectionForChart(
  projection: MonthlyProjectionPoint[],
  fireNumber: number
): ProjectionChartPoint[];

// 中国市场提现率建议
export const CHINA_WITHDRAWAL_RATE_HINT = '中国市场建议提现率 3.0%-3.5%';

// 表单分组配置（用于 ScenarioForm 渲染）
export const FORM_FIELD_GROUPS: ReadonlyArray<{
  title: string;
  fields: ReadonlyArray<{
    key: keyof FireScenario;
    label: string;
    type: 'number' | 'amount' | 'percent' | 'toggle';
    required?: boolean;
    min?: number;
    max?: number;
    step?: number;
    hint?: string;
  }>;
}>;
```

### 4.2 默认值生成逻辑

`createDefaultScenarioInput(user, name)` 从 User 表读取默认偏好值：

```typescript
{
  user_id: user.id,
  name,
  description: null,
  current_age: 30,                    // 默认值，用户可修改
  retirement_age: 55,                 // 默认值
  current_portfolio_value: 0,
  auto_sync_assets: 1,                // 默认开启自动同步
  monthly_savings: 0,
  annual_expenses: 60000 * 100,       // 6 万元/年，转分
  expected_return_rate: user.default_expected_return,   // 从 User 表读取
  inflation_rate: user.default_inflation_rate,          // 从 User 表读取
  withdrawal_rate: user.default_withdrawal_rate,        // 从 User 表读取
  retirement_years: 30,
  post_retirement_monthly_income: 0,
  is_china_market: user.is_china_market,
}
```

### 4.3 校验规则

对齐 UI/UX 设计文档 §3.4.3：

| 字段 | 校验 | 错误信息 |
|------|------|---------|
| `current_age` | 18-80 整数 | "当前年龄需在 18-80 之间" |
| `retirement_age` | > current_age，≤ 80 | "退休年龄需大于当前年龄且不超过 80" |
| `annual_expenses` | > 0 | "年度支出需大于 0" |
| `expected_return_rate` | 100-1500 基点（1%-15%） | "预期回报率需在 1%-15% 之间" |
| `inflation_rate` | 0-1000 基点（0%-10%） | "通胀率需在 0%-10% 之间" |
| `withdrawal_rate` | 200-600 基点（2%-6%） | "提现率需在 2%-6% 之间" |
| `retirement_years` | 10-50 整数 | "退休后年限需在 10-50 之间" |
| `monthly_savings` | ≥ 0 | "每月储蓄不能为负" |
| `post_retirement_monthly_income` | ≥ 0 | "退休后月收入不能为负" |
| `name` | 1-50 字符 | "场景名称需在 1-50 字符之间" |

### 4.4 单位约定

| 字段类别 | DB 存储 | UI 显示 | 转换 |
|---------|---------|---------|------|
| 利率（expected_return_rate/inflation_rate/withdrawal_rate） | 基点整数（350 = 3.5%） | 百分比（3.5%） | `basisPointsToPercent` / `percentToBasisPoints` |
| 金额（current_portfolio_value/monthly_savings/annual_expenses/post_retirement_monthly_income） | 分（整数） | 元（货币字符串） | `centsToYuan` + `formatFireAmount` |
| 年龄/年限 | 整数 | 整数 | 无转换 |

---

## 5. Store 扩展 scenario-store.ts

### 5.1 扩展接口

```typescript
interface ScenarioStore {
  // 已有
  scenarios: FireScenario[];
  loading: boolean;
  error: string | null;
  fetchScenarios: (userId: string) => Promise<void>;
  createScenario: (input: CreateScenarioInput, userId: string) => Promise<void>;
  updateScenario: (id: string, updates: Partial<FireScenario>, userId: string) => Promise<void>;
  clear: () => void;

  // 新增
  currentScenarioId: string | null;
  projectionResult: ProjectionResult | null;
  projectionLoading: boolean;
  selectScenario: (id: string) => void;
  runProjection: (scenario: FireScenario) => Promise<void>;
}
```

### 5.2 debounce 实现

`updateScenario` 内部加 debounce 500ms：

```typescript
// 模块级 timer ref（store 单例，模块级即可）
let updateTimer: ReturnType<typeof setTimeout> | null = null;

updateScenario: async (id, updates, userId) => {
  // 乐观更新本地 scenarios（立即反映 UI）
  set(state => ({
    scenarios: state.scenarios.map(s =>
      s.id === id ? { ...s, ...updates } : s
    )
  }));

  // debounce 持久化
  if (updateTimer) clearTimeout(updateTimer);
  updateTimer = setTimeout(async () => {
    try {
      await dataAccess.updateScenario(id, updates);
      const scenarios = await dataAccess.getScenarios(userId);
      set({ scenarios });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  }, 500);
}
```

### 5.3 runProjection

```typescript
runProjection: async (scenario) => {
  set({ projectionLoading: true });
  try {
    const result = await dataAccess.runProjection(scenario);
    set({ projectionResult: result, projectionLoading: false });
  } catch (err) {
    set({ error: (err as Error).message, projectionLoading: false });
  }
}
```

### 5.4 selectScenario

切换场景后自动触发 runProjection：

```typescript
selectScenario: (id) => {
  set({ currentScenarioId: id });
  const scenario = get().scenarios.find(s => s.id === id);
  if (scenario) get().runProjection(scenario);
}
```

### 5.5 createScenario

成功后自动选中新场景并触发 runProjection：

```typescript
createScenario: async (input, userId) => {
  set({ loading: true, error: null });
  try {
    await dataAccess.createScenario(input);
    const scenarios = await dataAccess.getScenarios(userId);
    // 新场景是 getScenarios 返回的第一个（按 updated_at DESC）
    const newScenario = scenarios[0];
    set({ scenarios, loading: false, currentScenarioId: newScenario.id });
    get().runProjection(newScenario);
  } catch (err) {
    set({ error: (err as Error).message, loading: false });
  }
}
```

### 5.6 fetchScenarios

加载完成后自动选中第一个并触发 runProjection：

```typescript
fetchScenarios: async (userId) => {
  set({ loading: true, error: null });
  try {
    const scenarios = await dataAccess.getScenarios(userId);
    const firstId = scenarios.length > 0 ? scenarios[0].id : null;
    set({ scenarios, loading: false, currentScenarioId: firstId });
    if (firstId) {
      const scenario = scenarios[0];
      get().runProjection(scenario);
    }
  } catch (err) {
    set({ error: (err as Error).message, loading: false });
  }
}
```

---

## 6. 组件设计

### 6.1 FireCalculatorPage（容器）

**职责**：协调数据流，组合子组件，管理选中场景状态。

```typescript
export function FireCalculatorPage() {
  const currentUser = useAppStore(s => s.currentUser);
  const {
    scenarios, currentScenarioId, projectionResult, loading, error,
    fetchScenarios, createScenario, updateScenario, selectScenario, runProjection,
  } = useScenarioStore();
  const [investableBalance, setInvestableBalance] = useState<number | null>(null);

  useEffect(() => {
    if (currentUser) fetchScenarios(currentUser.id);
  }, [currentUser]);

  // auto_sync 时获取 investableBalance
  const currentScenario = scenarios.find(s => s.id === currentScenarioId);
  useEffect(() => {
    if (currentUser && currentScenario?.auto_sync_assets === 1) {
      dataAccess.getInvestableBalance(currentUser.id)
        .then(setInvestableBalance)
        .catch(() => setInvestableBalance(null));
    }
  }, [currentUser, currentScenario?.auto_sync_assets]);

  if (loading) return <div className="p-8">加载中...</div>;
  if (error) return <div className="p-8 text-red-600">数据加载失败，请重试</div>;

  // 无场景 → 介绍页
  if (scenarios.length === 0) {
    return (
      <FireIntro
        onCreate={() => createScenario(
          createDefaultScenarioInput(currentUser!, '我的 FIRE 计划'),
          currentUser!.id
        )}
      />
    );
  }

  return (
    <div className="flex h-full">
      <ScenarioSidebar
        scenarios={scenarios}
        currentId={currentScenario!.id}
        onSelect={selectScenario}
        onCreate={() => createScenario(
          createDefaultScenarioInput(currentUser!, '新场景'),
          currentUser!.id
        )}
      />
      <div className="flex-1 flex flex-col overflow-auto">
        <div className="p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">FIRE 计算器</h1>

          <ScenarioForm
            scenario={currentScenario!}
            onFieldChange={(field, value) => {
              const updated = { ...currentScenario!, [field]: value };
              updateScenario(currentScenario!.id, { [field]: value }, currentUser!.id);
              runProjection(updated);
            }}
            investableBalance={investableBalance}
          />

          <div className="mt-6">
            <ResultCards result={projectionResult} loading={useScenarioStore(s => s.projectionLoading)} />
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4">
            <ProgressGauge
              progress={projectionResult?.progress ?? 0}
              fireNumber={projectionResult?.adjusted_fire_number ?? 0}
              currentValue={currentScenario?.auto_sync_assets === 1
                ? (investableBalance ?? 0)
                : currentScenario?.current_portfolio_value ?? 0}
            />
            <ProjectionChart
              data={projectionResult?.monthly_projection ?? []}
              fireNumber={projectionResult?.fire_number ?? 0}
              loading={useScenarioStore(s => s.projectionLoading)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 6.2 ScenarioSidebar

**职责**：场景列表 + 新建按钮，纯展示。

```typescript
interface ScenarioSidebarProps {
  scenarios: FireScenario[];
  currentId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
}
```

- 固定宽度 240px，纵向列表
- 顶部"+ 新建场景"按钮（`bg-blue-500 text-white`）
- 每项显示场景名称 + 描述（截断 1 行）
- 选中项高亮（`bg-blue-50 border-l-2 border-blue-500`）
- 空状态不在此组件处理（由容器决定显示 FireIntro）

### 6.3 ScenarioForm

**职责**：参数表单，分两组（基本参数/投资参数），受控组件。

```typescript
interface ScenarioFormProps {
  scenario: FireScenario;
  onFieldChange: (field: keyof FireScenario, value: number) => void;
  investableBalance: number | null;  // auto_sync 时传入，null 表示未开启
}
```

- 字段分组渲染（FORM_FIELD_GROUPS 配置驱动）
- 百分比字段：UI 显示百分比（`basisPointsToPercent`），onChange 时转基点（`percentToBasisPoints`）回调
- 金额字段：UI 显示元（`centsToYuan`），onChange 时转分回调
- `auto_sync_assets=1` 时 current_portfolio_value 只读，显示 `investableBalance`（formatFireAmount）
- `is_china_market=1` 时提现率下方显示 `CHINA_WITHDRAWAL_RATE_HINT`
- 校验错误在字段下方红色提示（`text-red-500 text-xs`）
- 校验失败时不触发 onFieldChange

### 6.4 ResultCards

**职责**：4 个结果卡片，纯展示。

```typescript
interface ResultCardsProps {
  result: ProjectionResult | null;
  loading: boolean;
}
```

- 4 列网格：FIRE Number / 调整后 FIRE Number / 当前进度 / 退休时资产总值
- loading 时每个卡片显示"加载中..."
- result 为 null 时显示"暂无数据"
- 金额用 `formatFireAmount`，进度用 `formatProgress`

### 6.5 ProgressGauge

**职责**：环形进度仪表盘。

```typescript
interface ProgressGaugeProps {
  progress: number;       // 0-100
  fireNumber: number;     // 调整后 FIRE Number，分
  currentValue: number;   // 当前组合值，分
}
```

- Recharts RadialBarChart 实现环形
- 中心显示百分比（`formatProgress`）
- 底部标注 `¥{formatFireAmount(currentValue)} → ¥{formatFireAmount(fireNumber)}`
- progress=0 时显示空环

### 6.6 ProjectionChart

**职责**：面积图投影。

```typescript
interface ProjectionChartProps {
  data: MonthlyProjectionPoint[];
  fireNumber: number;     // 分
  loading: boolean;
}
```

- Recharts AreaChart
- 用 `formatProjectionForChart` 转换数据（分 → 元，month → age）
- X 轴：年龄
- Y 轴：余额（元）
- 积累阶段绿色面积（`fill="#10B981"`）+ 提现阶段蓝色面积（`fill="#3B82F6"`）
- FIRE Number 参考线（`<ReferenceLine y={fireNumber 元} stroke="#EF4444" strokeDasharray="5 5" />`）
- 空数据显示"暂无投影数据"
- loading 显示"加载中..."

### 6.7 FireIntro

**职责**：介绍页，首次进入无场景时显示。

```typescript
interface FireIntroProps {
  onCreate: () => void;
}
```

- 居中布局，`max-w-2xl mx-auto py-16`
- 标题"开始你的 FIRE 之旅"
- 说明 FIRE 计算器概念（3 段）：
  1. FIRE Number — 退休所需资产目标（年度支出 ÷ 提现率）
  2. 4% 规则 — 经典退休提现率，中国市场建议 3.0%-3.5%
  3. 积累与提取 — 两阶段投影，可视化退休路径
- "创建第一个场景"按钮（`bg-blue-500 text-white px-6 py-2 rounded`）

---

## 7. 错误处理

| 场景 | 处理 |
|------|------|
| 场景列表加载失败 | 页面顶部红色 error banner（复用 M5 模式） |
| 投影计算失败 | projectionResult 保持上一个值，error banner 提示"投影计算失败" |
| 表单校验失败 | 字段下方红色提示，不触发 updateScenario/runProjection |
| auto_sync 获取 investableBalance 失败 | 表单字段显示"获取失败"，不阻塞其他字段编辑 |
| createScenario 失败 | error banner 提示，停留在 FireIntro 页 |

---

## 8. 测试策略

### 8.1 纯函数测试（fire-calc-constants.test.ts）

- `createDefaultScenarioInput`：正确从 User 读取默认值，金额转分
- `validateScenarioField`：每个字段的边界值（合法/非法/边界）
- `basisPointsToPercent` / `percentToBasisPoints`：转换正确性
- `formatFireAmount` / `formatProgress`：格式化输出
- `formatProjectionForChart`：数据转换正确性（分→元、month→age、phase 保留、fireNumber 注入）

### 8.2 组件测试（fire-calc-components.test.tsx）

- mock recharts（LineChart/AreaChart/RadialBarChart/ReferenceLine 等）
- **ScenarioSidebar**：列表渲染、选中高亮、新建按钮点击、点击切换
- **ScenarioForm**：字段渲染、百分比/金额转换、auto_sync 只读、中国市场提示、校验错误
- **ResultCards**：空数据/loading/有数据
- **ProgressGauge**：进度显示、金额标注
- **ProjectionChart**：空数据/loading/有数据、面积图渲染
- **FireIntro**：文案渲染、按钮点击

### 8.3 集成测试

FireCalculatorPage 完整流程：
- 无场景 → 显示 FireIntro → 点击创建 → 加载完成 → 显示场景 + 表单 + 结果
- 切换场景 → 表单更新 → 投影重算
- 表单字段修改 → 触发 updateScenario + runProjection → 结果更新
- 加载失败 → error banner

### 8.4 E2E 测试（Playwright）

验证完整端到端流程：
- 场景创建 → 参数编辑 → 投影重算 → 结果验证
- 切换场景 → 表单更新 → 结果更新
- 校验失败 → 阻止保存 → 修正后恢复保存

> 注：Electron 应用的 Playwright E2E 测试需 `_electron.application` 启动主进程，配置较重。若 CI 环境无法运行 Electron，则降级为在 renderer 层用 Playwright + jsdom 模拟，或延后至可运行 Electron 的环境补充。

### 8.5 mock 策略

- 复用 `vitest.setup.ts` 的 `window.dataAccess` mock（scenario.create/get/list/update, fireCalc.runProjection 已配置）
- 测试中用 `mockResolvedValue` / `mockRejectedValue` 控制返回值
- Recharts 组件 mock 为简单 div（data-testid）

---

## 9. 验收标准

| 编号 | 检查点 | 验证方式 |
|------|--------|---------|
| FC-1 | 占位页已替换为完整计算器 | GUI |
| FC-2 | 首次进入显示介绍页 | GUI |
| FC-3 | 创建场景后显示参数表单 + 投影结果 | GUI |
| FC-4 | 场景列表切换正常 | GUI |
| FC-5 | 参数表单 14 字段编辑正常 | GUI |
| FC-6 | 自动保存（debounce 500ms）生效 | GUI |
| FC-7 | 投影实时重算 | GUI |
| FC-8 | 4 个结果卡片显示正确 | GUI |
| FC-9 | 环形进度仪表盘显示正确 | GUI |
| FC-10 | 面积图投影显示正确 | GUI |
| FC-11 | auto_sync 开关切换正常 | GUI |
| FC-12 | 中国市场提现率提示显示 | GUI |
| FC-13 | 表单校验错误提示 | GUI |
| FC-14 | M4/M5 回归无 bug | GUI |
| FC-15 | 单元测试全通过 | CLI |
| FC-16 | tsc 零错误 | CLI |
| FC-17 | 构建成功 | CLI |
| FC-18 | CI 构建成功 | CI |

---

## 10. 实施顺序建议

1. **Task 1**: 扩展 scenario-store.ts（currentScenarioId/projectionResult/selectScenario/runProjection + debounce）
2. **Task 2**: 创建 fire-calc-constants.ts + 测试（TDD）
3. **Task 3**: 创建 FireIntro.tsx + 测试
4. **Task 4**: 创建 ScenarioSidebar.tsx + 测试
5. **Task 5**: 创建 ScenarioForm.tsx + 测试
6. **Task 6**: 创建 ResultCards.tsx + 测试
7. **Task 7**: 创建 ProgressGauge.tsx + 测试
8. **Task 8**: 创建 ProjectionChart.tsx + 测试
9. **Task 9**: 重写 FireCalculatorPage 容器 + 集成测试
10. **Task 10**: 全量测试 + tsc + 构建验证
11. **Task 11**: 推送 + CI 验证
12. **Task 12**: 手动 GUI 验证（FC-1 ~ FC-14）

---

## 附录：实现差异备注（2026-07-29 更新）

> 以下为实现阶段相对本设计文档的变更记录，正文保持不动以保留设计历史。

| 设计文档描述 | 实际实现 | 变更原因 |
|-------------|---------|---------|
| ScenarioForm 使用 `onFieldChange` 逐字段回调 | 改为 `onSave(updates)` 批量保存 | 用户反馈：debounce 自动保存无视觉反馈，改为浏览/编辑双模式 + 手动保存按钮 |
| `updateScenario` 内部 debounce 500ms 自动保存 | 移除 debounce，直接持久化 | 配合手动保存模式，保存时立即持久化 |
| `current_portfolio_value` 等字段直接编辑 | 浏览模式只读展示，编辑模式表单输入 | 浏览/编辑双模式设计 |
| 新增 `name` 字段校验（1-50 字符）和 `text` 类型字段 | — | 支持场景名称在表单中编辑 |
