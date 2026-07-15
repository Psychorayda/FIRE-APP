# 07-tests.md — 测试套件

> **最后更新**: 2026-07-15
> **对应代码**: `fire-app/tests/`
> **导航**: [← 返回主页](CODE_WIKI.md) | [上一节](06-utils.md) | [下一节](08-design-index.md)

---

## 1. 测试框架与配置

FIRE APP 的测试套件基于 **vitest 2.0**，覆盖数据层、模型层、服务层、工具层的单元测试以及一条端到端集成测试，共 **13 个测试文件**（12 单元 + 1 集成）。

### 1.1 配置文件

源码：[vitest.config.ts](file:///workspace/FIRE%20APP/fire-app/vitest.config.ts)

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
  },
});
```

### 1.2 关键配置说明

| 配置项 | 值 | 作用 |
|--------|-----|------|
| `globals` | `true` | `describe` / `it` / `expect` / `beforeEach` / `afterEach` 全局可用，无需在每个文件 import（实际测试文件仍显式 import 以兼容 IDE） |
| `environment` | `'node'` | Node.js 环境（better-sqlite3 是原生模块，需 Node 运行时） |
| `include` | `['tests/**/*.test.ts']` | 仅匹配 `tests/` 目录下所有 `.test.ts` 文件 |
| `pool` | `'threads'` | 使用线程池执行测试 |
| `poolOptions.threads.singleThread` | `true` | **单线程执行**，避免 better-sqlite3 同步 API 在多线程下的并发问题（详见第 4 节） |

### 1.3 运行命令

| 命令 | 用途 |
|------|------|
| `npm test` | 单次运行全部测试 |
| `npm run test:watch` | 监视模式，文件变更时自动重跑 |

---

## 2. 测试目录结构

```
fire-app/tests/
├── db/                  # 数据库层测试（2 个文件）
│   ├── connection.test.ts
│   └── schema.test.ts
├── models/              # 模型层测试（3 个文件）
│   ├── account.test.ts
│   ├── category.test.ts
│   └── user.test.ts
├── services/            # 服务层测试（4 个文件）
│   ├── fire-calc.test.ts
│   ├── recurring-service.test.ts
│   ├── snapshot-service.test.ts
│   └── transaction-service.test.ts
├── utils/               # 工具层测试（3 个文件）
│   ├── money.test.ts
│   ├── sync.test.ts
│   └── time.test.ts
└── integration/         # 集成测试（1 个文件）
    └── workflow.test.ts
```

**目录与源码镜像**：`tests/` 子目录与 `src/` 子目录一一对应（`db/` / `models/` / `services/` / `utils/`），`integration/` 是额外的端到端测试目录。

---

## 3. 代码-测试映射表

下表统计自 2026-07-15 实际扫描的 13 个测试文件。每个测试文件均包含 1 个 `describe` 块（描述被测模块），`it` 数量为该文件内独立测试用例数。

| 源文件 | 测试文件 | describe 数 | it 数 | 覆盖范围 |
|--------|----------|------------|-------|----------|
| `src/db/connection.ts` | `tests/db/connection.test.ts` | 1 | 4 | 连接创建、WAL 模式回退、SQL 执行、关闭 |
| `src/db/schema.ts` | `tests/db/schema.test.ts` | 1 | 9 | 7 张表创建、TABLE_NAMES 常量、字段完整性、4 个索引、UNIQUE 约束 |
| `src/models/account.ts` | `tests/models/account.test.ts` | 1 | 12 | CRUD、活期/投资/负债账户、余额查询、软删除、hasTransactions |
| `src/models/category.ts` | `tests/models/category.test.ts` | 1 | 10 | CRUD、子分类、seedCategories（18 个）、5 个 linked_fire_concept |
| `src/models/user.ts` | `tests/models/user.test.ts` | 1 | 6 | CRUD、中国市场默认值、非中国市场提款率 400、sync_version 递增 |
| `src/services/fire-calc.ts` | `tests/services/fire-calc.test.ts` | 1 | 13 | FIRE 数公式、调整后 FIRE 数、积累公式、进度计算、runProjection 三场景、scenario CRUD |
| `src/services/recurring-service.ts` | `tests/services/recurring-service.test.ts` | 1 | 6 | 到期生成、补生成多月遗漏、未到期跳过、end_date 停用、暂停模板、转账模板 |
| `src/services/snapshot-service.ts` | `tests/services/snapshot-service.test.ts` | 1 | 5 | 首次生成、同月幂等返回 null、无账户净资产 0、降序查询、year_month 格式 |
| `src/services/transaction-service.ts` | `tests/services/transaction-service.test.ts` | 1 | 10 | 4 种交易类型余额联动、转账规则校验、editTransaction、deleteTransaction 回滚 |
| `src/utils/money.ts` | `tests/utils/money.test.ts` | 1 | 7 | 元转分、四舍五入浮点陷阱、分转元、基点转小数 |
| `src/utils/sync.ts` | `tests/utils/sync.test.ts` | 1 | 5 | createSyncMeta、bumpSyncVersion、LWW 三种冲突场景（远程新/本地新/时间相同） |
| `src/utils/time.ts` | `tests/utils/time.test.ts` | 1 | 7 | nowMs、toYearMonth、addMonths（含跨年）、monthsBetween（含跨年） |
| —（端到端） | `tests/integration/workflow.test.ts` | 1 | 3 | 建账→记账→快照→FIRE 计算、经常性交易补生成、多月快照降序 |

**汇总**：13 个测试文件，共 13 个 `describe` 块，97 个 `it` 测试用例。

**未覆盖源文件的说明**：
- `src/models/transaction.ts`、`src/models/recurring.ts`、`src/models/scenario.ts`、`src/models/snapshot.ts` 无独立测试文件，其逻辑通过对应的 service 测试间接覆盖（如 `transaction-service.test.ts` 测试交易创建/编辑/删除，间接验证 `transaction.ts` 的查询函数）。
- `src/types/index.ts` 为纯类型文件，无运行时代码，不需测试。

---

## 4. 测试约定

### 4.1 内存数据库

所有涉及数据库的测试均使用 `createDatabase(':memory:')` 创建内存数据库，无文件 I/O，测试速度快且互不干扰。

```typescript
beforeEach(() => {
  db = createDatabase(':memory:');
  initSchema(db);
});
```

内存库的特性：
- 不支持 WAL 模式，但 `createDatabase` 内部静默忽略（不抛错），见 [connection.test.ts:28-31](file:///workspace/FIRE%20APP/fire-app/tests/db/connection.test.ts#L28-L31)
- 每个测试用例独立创建新实例，无状态泄漏

### 4.2 beforeEach / afterEach 模式

**beforeEach**（建库 + 建表 + 建用户 + 可选 seed 分类）：

```typescript
beforeEach(() => {
  db = createDatabase(':memory:');
  initSchema(db);
  createUser(db, { id: userId, display_name: '测试' });
  // 集成测试额外调用 seedCategories(db, userId);
});
```

- `db/` 测试只做建库 + 建表（无用户）
- `models/` 测试建库 + 建表 + 建用户（部分需 seedCategories）
- `services/` 测试建库 + 建表 + 建用户 + 建账户 + 建分类（按需）
- `integration/` 测试建库 + 建表 + 建用户 + seedCategories

**afterEach**（关闭连接）：

```typescript
afterEach(() => {
  closeDatabase(db);
});
```

工具层测试（`utils/money.test.ts`、`utils/sync.test.ts`、`utils/time.test.ts`）不涉及数据库，故无 `beforeEach` / `afterEach`。

### 4.3 单线程执行的原因

`vitest.config.ts` 设置 `poolOptions.threads.singleThread: true`，原因：

- **better-sqlite3 是同步 API**：所有数据库操作在调用线程上同步执行，多线程并发访问同一连接会导致段错误
- **测试隔离性**：单线程确保每个测试文件串行执行，避免内存数据库实例之间的资源竞争
- **代价**：测试总耗时为各文件耗时之和（无法并行加速），但本项目测试规模小（97 个用例），单线程总耗时仍在秒级

### 4.4 断言风格

测试统一使用 vitest 的 `expect` BDD 风格断言：

| 断言模式 | 示例 | 用途 |
|----------|------|------|
| 值相等 | `expect(x).toBe(y)` | 基本类型严格相等 |
| 定义检查 | `expect(x).toBeDefined()` | 非undefined |
| 长度检查 | `expect(arr).toHaveLength(n)` | 数组长度 |
| 包含检查 | `expect(arr).toContain(v)` | 数组/字符串包含 |
| 抛错检查 | `expect(() => fn()).toThrow(/正则/)` | 验证错误抛出与消息 |
| 近似比较 | `expect(x).toBeCloseTo(y, precision)` | 浮点数比较 |
| 范围比较 | `expect(x).toBeGreaterThan(y)` | 数值范围 |
| 正则匹配 | `expect(s).toMatch(/^\d{4}-\d{2}$/)` | 字符串格式 |

### 4.5 集成测试

[workflow.test.ts](file:///workspace/FIRE%20APP/fire-app/tests/integration/workflow.test.ts) 是唯一的端到端集成测试，跨 db / models / services / utils 全栈验证完整用户流程（详见第 5 节）。

---

## 5. 关键测试用例示例

### 5.1 集成测试用例

源码：[workflow.test.ts](file:///workspace/FIRE%20APP/fire-app/tests/integration/workflow.test.ts)

集成测试包含 3 个端到端用例，覆盖 FIRE APP 的核心业务链路：

#### 用例 1：完整工作流（[workflow.test.ts:29-108](file:///workspace/FIRE%20APP/fire-app/tests/integration/workflow.test.ts#L29-L108)）

**标题**：`完整工作流: 建账 → 记账 → 快照 → FIRE计算`

**验证流程**：

1. **建账**：创建 3 个账户（活期 500000 分 / 基金 200000 分 / 信用卡 -100000 分）
2. **验证初始余额**：含负债账户的负数余额
3. **记账**：记录收入（工资薪金 1500000 分）+ 支出（食品 300000 分）+ 转账定投（500000 分）
4. **验证余额联动**：活期 = 500000 + 1500000 - 300000 - 500000 = 1200000；基金 = 200000 + 500000 = 700000
5. **验证净资产**：1200000 + 700000 + 0 - 100000 = 1800000
6. **验证可投资余额**：1200000（活期 liquid）+ 700000（基金 invested）= 1900000
7. **生成月度快照**：验证 4 类资产合计与 net_worth（1800000）
8. **创建 FIRE 场景**：30 岁 → 50 岁退休，月储蓄 500000 分，年支出 6000000 分，提款率 350 基点
9. **运行投影**：验证 fire_number = 171428571（= 6000000 × 10000 / 350 向下取整）、adjusted_fire_number < fire_number、月度投影 600 个点（240 积累 + 360 退休）

#### 用例 2：经常性交易工作流（[workflow.test.ts:110-137](file:///workspace/FIRE%20APP/fire-app/tests/integration/workflow.test.ts#L110-L137)）

**标题**：`经常性交易工作流: 创建模板 → 补生成 → 余额更新`

**验证流程**：
1. 创建活期账户（初始 1000000 分）+ 基金账户
2. 插入月度工资模板（next_due_date 设为 3 个月前）
3. 调用 `processRecurringTransactions` 补生成逾期交易（≥3 笔）
4. 验证余额 = 1000000 + 1000000 × 生成笔数

#### 用例 3：快照历史工作流（[workflow.test.ts:139-160](file:///workspace/FIRE%20APP/fire-app/tests/integration/workflow.test.ts#L139-L160)）

**标题**：`快照历史工作流: 多月快照按日期降序`

**验证流程**：
1. 创建活期账户
2. 手动插入 3 个月的历史快照（2026-01 / 2026-02 / 2026-03）
3. 调用 `generateMonthlySnapshot` 生成本月快照
4. 验证 `getSnapshots` 返回 4 条记录，且按 `snapshot_date` 降序排列

### 5.2 单元测试关键覆盖点

| 测试文件 | 关键覆盖点 | 源码位置 |
|----------|-----------|----------|
| [connection.test.ts](file:///workspace/FIRE%20APP/fire-app/tests/db/connection.test.ts) | 内存库创建、WAL 回退、closeDatabase | [connection.ts](file:///workspace/FIRE%20APP/fire-app/src/db/connection.ts) |
| [schema.test.ts](file:///workspace/FIRE%20APP/fire-app/tests/db/schema.test.ts) | 7 表 + 4 索引 + UNIQUE 约束 | [schema.ts](file:///workspace/FIRE%20APP/fire-app/src/db/schema.ts) |
| [account.test.ts](file:///workspace/FIRE%20APP/fire-app/tests/models/account.test.ts) | softDeleteAccount 抛错（有关联交易）、getInvestableBalance 只汇总 liquid+invested | [account.ts:103-119](file:///workspace/FIRE%20APP/fire-app/src/models/account.ts#L103-L119) |
| [category.test.ts](file:///workspace/FIRE%20APP/fire-app/tests/models/category.test.ts) | seedCategories 生成 18 个（11 支出 + 7 收入）、5 个 linked_fire_concept | [category.ts:93-118](file:///workspace/FIRE%20APP/fire-app/src/models/category.ts#L93-L118) |
| [user.test.ts](file:///workspace/FIRE%20APP/fire-app/tests/models/user.test.ts) | 中国市场默认 350 基点、非中国市场 400 基点 | [user.ts:28](file:///workspace/FIRE%20APP/fire-app/src/models/user.ts#L28) |
| [fire-calc.test.ts](file:///workspace/FIRE%20APP/fire-app/tests/services/fire-calc.test.ts) | 4% 规则（25 倍）、3.5% 规则（~28.57 倍）、auto_sync_assets 两条路径 | [fire-calc.ts:18](file:///workspace/FIRE%20APP/fire-app/src/services/fire-calc.ts#L18) |
| [recurring-service.test.ts](file:///workspace/FIRE%20APP/fire-app/tests/services/recurring-service.test.ts) | while 循环补单、end_date 停用、暂停模板跳过 | [recurring-service.ts:17](file:///workspace/FIRE%20APP/fire-app/src/services/recurring-service.ts#L17) |
| [snapshot-service.test.ts](file:///workspace/FIRE%20APP/fire-app/tests/services/snapshot-service.test.ts) | 同月幂等返回 null、net_worth = 4 类之和 | [snapshot-service.ts:21](file:///workspace/FIRE%20APP/fire-app/src/services/snapshot-service.ts#L21) |
| [transaction-service.test.ts](file:///workspace/FIRE%20APP/fire-app/tests/services/transaction-service.test.ts) | 转账双账户联动、转账规则校验（无 to_account_id / 转给自己）、edit 反向+正向调整 | [transaction-service.ts:43](file:///workspace/FIRE%20APP/fire-app/src/services/transaction-service.ts#L43) |
| [money.test.ts](file:///workspace/FIRE%20APP/fire-app/tests/utils/money.test.ts) | 1.005 元 → 101 分（两阶段取整规避 IEEE 754 误差） | [money.ts](file:///workspace/FIRE%20APP/fire-app/src/utils/money.ts) |
| [sync.test.ts](file:///workspace/FIRE%20APP/fire-app/tests/utils/sync.test.ts) | LWW 时间相同 → 远程胜（避免同步死锁） | [sync.ts](file:///workspace/FIRE%20APP/fire-app/src/utils/sync.ts) |
| [time.test.ts](file:///workspace/FIRE%20APP/fire-app/tests/utils/time.test.ts) | addMonths 跨年、monthsBetween 跨年 | [time.ts](file:///workspace/FIRE%20APP/fire-app/src/utils/time.ts) |
