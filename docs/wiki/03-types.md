# 03-types.md — 类型定义

> **最后更新**: 2026-07-30
> **对应代码**: `packages/shared/src/types/`（核心实体）+ `packages/shared/src/services/`（M8）+ `packages/shared/src/models/`（M9）
> **导航**: [← 返回主页](CODE_WIKI.md) | [上一节](02-database.md) | [下一节](04-models.md)

---

## 1. 概述

源码：[index.ts](file:///workspace/packages/shared/src/types/index.ts)

`types/index.ts` 是一个**纯类型导出文件**——仅含 `export type` 与 `export interface` 声明，无任何运行时代码（无函数、无常量、无副作用）。编译后输出的 `.js` 文件为空（仅有 sourcemap 引用），因此在运行时此模块**不增加 bundle 体积**。

### 1.1 模块职责

- 定义 5 个枚举别名（string literal union），与数据库 CHECK 约束一一对应
- 定义 7 个实体接口，与 7 张数据库表一一对应
- 为 models / services / tests 层提供统一的类型契约

### 1.2 命名约定

- **接口名**：PascalCase（如 `User`、`RecurringTransaction`、`FireScenario`）
- **字段名**：snake_case，**与数据库列名完全一致**（如 `user_id`、`sync_version`、`deleted_flag`），无需任何转换即可直接将数据库行赋值给接口变量
- **类型别名**：PascalCase（如 `AssetClass`、`Frequency`）

### 1.3 文件结构

源码 141 行，分两个区块（[index.ts:3-17](file:///workspace/packages/shared/src/types/index.ts#L3-L17) 为枚举区块，[index.ts:19-141](file:///workspace/packages/shared/src/types/index.ts#L19-L141) 为接口区块）。所有类型均用 `export` 导出，供外部模块按名引用。

---

## 2. 5 个枚举别名

5 个 `type` 别名均为 string literal union，与 schema 的 CHECK 约束一一对应。它们在编译后被完全擦除（无运行时对象），仅由 TypeScript 编译器在类型检查阶段使用。

### 2.1 `AssetClass`

源码：[index.ts:5](file:///workspace/packages/shared/src/types/index.ts#L5)

```typescript
export type AssetClass = 'liquid' | 'invested' | 'use_asset' | 'liability';
```

- **值列表**：4 个
  - `liquid` — 流动资产（活期、现金等）
  - `invested` — 投资资产（基金、股票、退休账户等）
  - `use_asset` — 使用资产（自住房产、车辆等）
  - `liability` — 负债（信用卡、贷款、房贷等，余额为负数）
- **对应 CHECK 约束**：`accounts.asset_class IN ('liquid', 'invested', 'use_asset', 'liability')`（[schema.ts:35](file:///workspace/packages/shared/src/db/schema.ts#L35)）
- **使用场景**：`accounts.asset_class` 字段；驱动 `getInvestableBalance`（liquid + invested）与净资产快照的 4 类分组聚合（详见 [05-services.md](05-services.md) 的快照服务小节）

### 2.2 `AccountType`

源码：[index.ts:7-11](file:///workspace/packages/shared/src/types/index.ts#L7-L11)

```typescript
export type AccountType =
  | 'checking' | 'savings' | 'cash'
  | 'investment' | 'retirement' | 'fund'
  | 'real_estate' | 'vehicle'
  | 'credit_card' | 'loan' | 'mortgage';
```

- **值列表**：11 个
  - 银行类：`checking`（活期）、`savings`（储蓄）、`cash`（现金）
  - 投资类：`investment`（投资账户）、`retirement`（退休账户）、`fund`（基金）
  - 实物类：`real_estate`（房产）、`vehicle`（车辆）
  - 负债类：`credit_card`（信用卡）、`loan`（贷款）、`mortgage`（房贷）
- **对应 CHECK 约束**：`accounts.account_type IN ('checking','savings','cash','investment','retirement','fund','real_estate','vehicle','credit_card','loan','mortgage')`（[schema.ts:37-42](file:///workspace/packages/shared/src/db/schema.ts#L37-L42)）
- **使用场景**：`accounts.account_type` 字段
- **已知问题**：设计文档 `2026-07-12-fire-app-user-data-model-design.md` 第 925 行（决策记录 #17）写"10 种完整枚举"，正确值为 **11 种**。Wiki 以代码为权威，描述为 11（详见 [08-design-index.md](08-design-index.md) 的已知问题清单）

### 2.3 `TransactionType`

源码：[index.ts:13](file:///workspace/packages/shared/src/types/index.ts#L13)

```typescript
export type TransactionType = 'income' | 'expense' | 'transfer' | 'initial_balance';
```

- **值列表**：4 个
  - `income` — 收入
  - `expense` — 支出
  - `transfer` — 转账
  - `initial_balance` — 初始余额（仅用于建账时设置账户起始余额）
- **对应 CHECK 约束**：
  - `transactions.transaction_type IN ('income','expense','transfer','initial_balance')`（[schema.ts:75](file:///workspace/packages/shared/src/db/schema.ts#L75)）— 4 值
  - `recurring_transactions.transaction_type IN ('income','expense','transfer')`（[schema.ts:97](file:///workspace/packages/shared/src/db/schema.ts#L97)）— 3 值，**不包含** `initial_balance`
- **使用场景**：
  - `transactions.transaction_type` 字段（4 值全部可用）
  - `recurring_transactions.transaction_type` 字段（仅前 3 值，初始余额不应作为经常性模板）
- **余额影响规则**（见 [05-services.md](05-services.md) 的 `balanceDelta` 函数）：`income` / `initial_balance` 增加余额，`expense` / `transfer` 减少余额（transfer 时贷方账户由 `to_account_id` 单独处理增加）

### 2.4 `CategoryType`

源码：[index.ts:15](file:///workspace/packages/shared/src/types/index.ts#L15)

```typescript
export type CategoryType = 'income' | 'expense';
```

- **值列表**：2 个
  - `income` — 收入分类
  - `expense` — 支出分类
- **对应 CHECK 约束**：`categories.type IN ('income', 'expense')`（[schema.ts:59](file:///workspace/packages/shared/src/db/schema.ts#L59)）
- **使用场景**：`categories.type` 字段；`getCategories(db, userId, type?)` 函数支持按此类型过滤分类列表（详见 [04-models.md](04-models.md) 的 category 小节）

### 2.5 `Frequency`

源码：[index.ts:17](file:///workspace/packages/shared/src/types/index.ts#L17)

```typescript
export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
```

- **值列表**：4 个
  - `daily` — 每日
  - `weekly` — 每周
  - `monthly` — 每月
  - `yearly` — 每年
- **对应 CHECK 约束**：`recurring_transactions.frequency IN ('daily','weekly','monthly','yearly')`（[schema.ts:99](file:///workspace/packages/shared/src/db/schema.ts#L99)）
- **使用场景**：`recurring_transactions.frequency` 字段；与 `interval` 字段配合表达"每 N 个单位"模式（如 `frequency='monthly'` + `interval=3` 表示每季度）。`advanceDueDate` 函数按此频率推算下一个到期日（详见 [05-services.md](05-services.md) 的 recurring-service 小节）

---

## 3. 7 个实体接口

7 个 `interface` 与 7 张数据库表一一对应。字段表中的"可空"列：`否` 表示 TypeScript 类型非空，`是` 表示类型为 `T | null`；"表列类型"列引用 schema 中的 SQLite 类型（详见 [02-database.md](02-database.md) 第 3 节）。

### 3.1 `User`

源码：[index.ts:21-34](file:///workspace/packages/shared/src/types/index.ts#L21-L34)

对应表：`users`（12 字段，见 [02-database.md 3.1](02-database.md#31-users)）

| 字段名 | TypeScript 类型 | 可空 | 表列类型 | 说明 |
|--------|-----------------|------|----------|------|
| id | string | 否 | TEXT PRIMARY KEY | UUID v4 |
| display_name | string | 否 | TEXT NOT NULL | 用户显示名 |
| base_currency | string | 否 | TEXT NOT NULL DEFAULT 'CNY' | 基础货币（ISO 4217） |
| is_china_market | number | 否 | INTEGER NOT NULL DEFAULT 1 | 是否中国市场（1=是，0=否） |
| default_withdrawal_rate | number | 否 | INTEGER NOT NULL DEFAULT 350 | 默认提款率（基点，350 = 3.5%） |
| default_expected_return | number | 否 | INTEGER NOT NULL DEFAULT 700 | 默认预期收益率（基点，700 = 7%） |
| default_inflation_rate | number | 否 | INTEGER NOT NULL DEFAULT 300 | 默认通胀率（基点，300 = 3%） |
| encryption_key_hash | string \| null | 是 | TEXT | 加密密钥哈希（同步加密用，尚未实现） |
| last_sync_at | number \| null | 是 | INTEGER | 最后同步时间戳（Unix 毫秒） |
| sync_version | number | 否 | INTEGER NOT NULL DEFAULT 0 | 同步版本号，每次本地修改 +1 |
| updated_at | number | 否 | INTEGER NOT NULL | 最后修改时间戳（Unix 毫秒） |
| deleted_flag | number | 否 | INTEGER NOT NULL DEFAULT 0 | 软删除标志（0=活跃，1=已删除） |

**字段数**：12

### 3.2 `Account`

源码：[index.ts:36-49](file:///workspace/packages/shared/src/types/index.ts#L36-L49)

对应表：`accounts`（12 字段，见 [02-database.md 3.2](02-database.md#32-accounts)）

| 字段名 | TypeScript 类型 | 可空 | 表列类型 | 说明 |
|--------|-----------------|------|----------|------|
| id | string | 否 | TEXT PRIMARY KEY | UUID v4 |
| user_id | string | 否 | TEXT NOT NULL | 所属用户 ID |
| name | string | 否 | TEXT NOT NULL | 账户名 |
| asset_class | AssetClass | 否 | TEXT NOT NULL | 资产分类（4 值枚举） |
| account_type | AccountType | 否 | TEXT NOT NULL | 账户类型（11 值枚举） |
| current_balance | number | 否 | INTEGER NOT NULL DEFAULT 0 | 当前余额（分；负债为负数） |
| last_updated | number | 否 | INTEGER NOT NULL | 余额最后更新时间戳 |
| display_order | number | 否 | INTEGER NOT NULL DEFAULT 0 | 显示顺序 |
| note | string \| null | 是 | TEXT | 备注 |
| sync_version | number | 否 | INTEGER NOT NULL DEFAULT 0 | 同步版本号 |
| updated_at | number | 否 | INTEGER NOT NULL | 最后修改时间戳 |
| deleted_flag | number | 否 | INTEGER NOT NULL DEFAULT 0 | 软删除标志 |

**字段数**：12

### 3.3 `Transaction`

源码：[index.ts:51-65](file:///workspace/packages/shared/src/types/index.ts#L51-L65)

对应表：`transactions`（13 字段，见 [02-database.md 3.5](02-database.md#35-transactions)）

| 字段名 | TypeScript 类型 | 可空 | 表列类型 | 说明 |
|--------|-----------------|------|----------|------|
| id | string | 否 | TEXT PRIMARY KEY | UUID v4 |
| user_id | string | 否 | TEXT NOT NULL | 所属用户 ID |
| account_id | string | 否 | TEXT NOT NULL | 借方账户 ID |
| to_account_id | string \| null | 是 | TEXT | 贷方账户 ID（仅转账） |
| category_id | string \| null | 是 | TEXT | 分类 ID |
| recurring_id | string \| null | 是 | TEXT | 来源模板 ID（前向引用） |
| transaction_type | TransactionType | 否 | TEXT NOT NULL | 交易类型（4 值枚举） |
| amount | number | 否 | INTEGER NOT NULL | 金额（分，必须 > 0） |
| transaction_date | number | 否 | INTEGER NOT NULL | 交易日期（Unix 毫秒） |
| description | string \| null | 是 | TEXT | 描述 |
| sync_version | number | 否 | INTEGER NOT NULL DEFAULT 0 | 同步版本号 |
| updated_at | number | 否 | INTEGER NOT NULL | 最后修改时间戳 |
| deleted_flag | number | 否 | INTEGER NOT NULL DEFAULT 0 | 软删除标志 |

**字段数**：13

### 3.4 `Category`

源码：[index.ts:67-81](file:///workspace/packages/shared/src/types/index.ts#L67-L81)

对应表：`categories`（13 字段，见 [02-database.md 3.3](02-database.md#33-categories)）

| 字段名 | TypeScript 类型 | 可空 | 表列类型 | 说明 |
|--------|-----------------|------|----------|------|
| id | string | 否 | TEXT PRIMARY KEY | UUID v4 |
| user_id | string | 否 | TEXT NOT NULL | 所属用户 ID |
| parent_id | string \| null | 是 | TEXT | 父分类 ID（自引用，支持两级树） |
| name | string | 否 | TEXT NOT NULL | 分类名 |
| type | CategoryType | 否 | TEXT NOT NULL | 分类类型（2 值枚举） |
| icon | string \| null | 是 | TEXT | 图标标识 |
| color | string \| null | 是 | TEXT | 颜色值 |
| linked_fire_concept | string \| null | 是 | TEXT | 关联的 FIRE 知识库概念标识 |
| display_order | number | 否 | INTEGER NOT NULL DEFAULT 0 | 显示顺序 |
| is_system | number | 否 | INTEGER NOT NULL DEFAULT 0 | 是否系统内置（1=是，用户不可删） |
| sync_version | number | 否 | INTEGER NOT NULL DEFAULT 0 | 同步版本号 |
| updated_at | number | 否 | INTEGER NOT NULL | 最后修改时间戳 |
| deleted_flag | number | 否 | INTEGER NOT NULL DEFAULT 0 | 软删除标志 |

**字段数**：13

### 3.5 `RecurringTransaction`

源码：[index.ts:83-103](file:///workspace/packages/shared/src/types/index.ts#L83-L103)

对应表：`recurring_transactions`（19 字段，见 [02-database.md 3.4](02-database.md#34-recurring_transactions)）

| 字段名 | TypeScript 类型 | 可空 | 表列类型 | 说明 |
|--------|-----------------|------|----------|------|
| id | string | 否 | TEXT PRIMARY KEY | UUID v4 |
| user_id | string | 否 | TEXT NOT NULL | 所属用户 ID |
| account_id | string | 否 | TEXT NOT NULL | 借方账户 ID |
| to_account_id | string \| null | 是 | TEXT | 贷方账户 ID（仅转账模板） |
| category_id | string \| null | 是 | TEXT | 分类 ID |
| transaction_type | TransactionType | 否 | TEXT NOT NULL | 交易类型（3 值枚举，无 initial_balance） |
| amount | number | 否 | INTEGER NOT NULL | 金额（分，必须 > 0） |
| frequency | Frequency | 否 | TEXT NOT NULL | 频率（4 值枚举） |
| interval | number | 否 | INTEGER NOT NULL DEFAULT 1 | 间隔（配合 frequency 表示"每 N 个单位"） |
| start_date | number | 否 | INTEGER NOT NULL | 起始日期（Unix 毫秒） |
| end_date | number \| null | 是 | INTEGER | 结束日期（NULL 表示无限期） |
| next_due_date | number | 否 | INTEGER NOT NULL | 下次到期日（CHECK: >= start_date） |
| last_generated_date | number \| null | 是 | INTEGER | 上次生成交易日期 |
| description | string \| null | 是 | TEXT | 描述 |
| is_active | number | 否 | INTEGER NOT NULL DEFAULT 1 | 是否活跃（1=活跃，0=已停用） |
| auto_create | number | 否 | INTEGER NOT NULL DEFAULT 1 | 是否自动创建交易（1=是） |
| sync_version | number | 否 | INTEGER NOT NULL DEFAULT 0 | 同步版本号 |
| updated_at | number | 否 | INTEGER NOT NULL | 最后修改时间戳 |
| deleted_flag | number | 否 | INTEGER NOT NULL DEFAULT 0 | 软删除标志 |

**字段数**：19

> 注：实施计划中早期版本曾写"17 字段"，实际源码（[index.ts:83-103](file:///workspace/packages/shared/src/types/index.ts#L83-L103)）为 **19 字段**，本 Wiki 以代码为权威描述为 19。

### 3.6 `NetWorthSnapshot`

源码：[index.ts:105-118](file:///workspace/packages/shared/src/types/index.ts#L105-L118)

对应表：`net_worth_snapshots`（12 字段，见 [02-database.md 3.6](02-database.md#36-net_worth_snapshots)）

| 字段名 | TypeScript 类型 | 可空 | 表列类型 | 说明 |
|--------|-----------------|------|----------|------|
| id | string | 否 | TEXT PRIMARY KEY | UUID v4 |
| user_id | string | 否 | TEXT NOT NULL | 所属用户 ID |
| snapshot_date | number | 否 | INTEGER NOT NULL | 快照日期（Unix 毫秒） |
| snapshot_year_month | string | 否 | TEXT NOT NULL | 快照年月（"YYYY-MM" 格式） |
| total_liquid | number | 否 | INTEGER NOT NULL | 流动资产合计（分） |
| total_invested | number | 否 | INTEGER NOT NULL | 投资资产合计（分） |
| total_use_asset | number | 否 | INTEGER NOT NULL | 使用资产合计（分） |
| total_liability | number | 否 | INTEGER NOT NULL | 负债合计（分，负数） |
| net_worth | number | 否 | INTEGER NOT NULL | 净资产（4 类之和，分） |
| sync_version | number | 否 | INTEGER NOT NULL DEFAULT 0 | 同步版本号 |
| updated_at | number | 否 | INTEGER NOT NULL | 最后修改时间戳 |
| deleted_flag | number | 否 | INTEGER NOT NULL DEFAULT 0 | 软删除标志 |

**字段数**：12

**表级约束**：`UNIQUE(user_id, snapshot_year_month)`（[schema.ts:127](file:///workspace/packages/shared/src/db/schema.ts#L127)）保证每月每用户仅一条快照，是 `generateMonthlySnapshot` 幂等性的数据库层保障。

### 3.7 `FireScenario`

源码：[index.ts:120-141](file:///workspace/packages/shared/src/types/index.ts#L120-L141)

对应表：`fire_scenarios`（20 字段，见 [02-database.md 3.7](02-database.md#37-fire_scenarios)）

| 字段名 | TypeScript 类型 | 可空 | 表列类型 | 说明 |
|--------|-----------------|------|----------|------|
| id | string | 否 | TEXT PRIMARY KEY | UUID v4 |
| user_id | string | 否 | TEXT NOT NULL | 所属用户 ID |
| name | string | 否 | TEXT NOT NULL | 场景名 |
| description | string \| null | 是 | TEXT | 场景描述 |
| current_age | number | 否 | INTEGER NOT NULL | 当前年龄 |
| retirement_age | number | 否 | INTEGER NOT NULL | 退休年龄（CHECK: > current_age） |
| current_portfolio_value | number | 否 | INTEGER NOT NULL DEFAULT 0 | 当前投资组合价值（分） |
| auto_sync_assets | number | 否 | INTEGER NOT NULL DEFAULT 1 | 是否自动同步资产（1=从 accounts 表读取） |
| monthly_savings | number | 否 | INTEGER NOT NULL DEFAULT 0 | 月储蓄（分） |
| annual_expenses | number | 否 | INTEGER NOT NULL | 年支出（分） |
| expected_return_rate | number | 否 | INTEGER NOT NULL | 预期收益率（基点） |
| inflation_rate | number | 否 | INTEGER NOT NULL DEFAULT 300 | 通胀率（基点，300 = 3%） |
| withdrawal_rate | number | 否 | INTEGER NOT NULL | 提款率（基点，CHECK: BETWEEN 200 AND 600） |
| retirement_years | number | 否 | INTEGER NOT NULL DEFAULT 30 | 退休后年数 |
| post_retirement_monthly_income | number | 否 | INTEGER NOT NULL DEFAULT 0 | 退休后月其他收入（分，如社保养老金） |
| is_china_market | number | 否 | INTEGER NOT NULL DEFAULT 1 | 是否中国市场 |
| is_active | number | 否 | INTEGER NOT NULL DEFAULT 1 | 是否活跃场景 |
| sync_version | number | 否 | INTEGER NOT NULL DEFAULT 0 | 同步版本号 |
| updated_at | number | 否 | INTEGER NOT NULL | 最后修改时间戳 |
| deleted_flag | number | 否 | INTEGER NOT NULL DEFAULT 0 | 软删除标志 |

**字段数**：20

**FIRE 投影结果不持久化**：本接口仅含场景**输入参数**，投影计算结果（`fire_number`、`adjusted_fire_number`、`monthly_projection` 等）由 `runProjection` 每次实时计算返回，不存入数据库（详见 [05-services.md](05-services.md) 的 fire-calc 小节）。

---

## 4. 接口与数据库行的映射约定

7 个接口的字段与数据库表列保持**一一对应**，无需任何字段名转换或类型转换即可将 `db.prepare(sql).get()` 返回的行直接赋值给接口变量（better-sqlite3 默认返回 `unknown`，但实际形状与接口完全一致，models 层用 `as InterfaceName` 断言）。

### 4.1 命名一致性

接口字段名与表列名**完全一致**，统一使用 snake_case：

| 接口字段 | 表列 | 一致性 |
|----------|------|--------|
| `user_id` | `user_id` | ✓ |
| `transaction_type` | `transaction_type` | ✓ |
| `sync_version` | `sync_version` | ✓ |
| `deleted_flag` | `deleted_flag` | ✓ |

这是有意的设计选择：避免在 models 层引入 camelCase ↔ snake_case 转换层，减少代码冗余与潜在 bug。

### 4.2 类型映射规则

| SQLite 列类型 | TypeScript 类型 | 示例字段 |
|---------------|-----------------|----------|
| `TEXT` (NOT NULL) | `string` | `display_name`、`name`、`base_currency` |
| `TEXT` (可空) | `string \| null` | `note`、`description`、`encryption_key_hash` |
| `INTEGER` (NOT NULL) | `number` | `current_balance`、`amount`、`sync_version` |
| `INTEGER` (可空) | `number \| null` | `last_sync_at`、`end_date`、`last_generated_date` |
| `TEXT` + CHECK 枚举 (NOT NULL) | 枚举别名（`AssetClass` / `AccountType` / `TransactionType` / `CategoryType` / `Frequency`） | `asset_class`、`account_type`、`frequency` |
| `TEXT` + CHECK 枚举 (可空) | （本项目无此组合） | — |

### 4.3 0/1 标志位约定（重要）

所有"是否"类标志位字段在 TypeScript 中类型为 **`number`（不是 `boolean`）**，取值 `0` 或 `1`：

| 字段 | 类型 | 取值 | 说明 |
|------|------|------|------|
| `is_china_market` | `number` | 0 / 1 | 是否中国市场 |
| `is_system` | `number` | 0 / 1 | 是否系统内置分类 |
| `is_active` | `number` | 0 / 1 | 模板/场景是否活跃 |
| `auto_create` | `number` | 0 / 1 | 是否自动创建交易 |
| `auto_sync_assets` | `number` | 0 / 1 | 是否自动同步资产 |
| `deleted_flag` | `number` | 0 / 1 | 软删除标志 |

**设计动机**：SQLite 无原生 boolean 类型，用 INTEGER 0/1 表达更直观且与同步协议（JSON 序列化）兼容。代码中使用 `=== 1` / `=== 0` 比较，**不**使用 truthy/falsy 隐式转换（避免 `0` 被误判为 falsy）。

### 4.4 时间戳约定

所有时间戳字段类型为 `number`，存储 **Unix 毫秒**（非秒），统一使用 UTC 时区：

| 字段 | 含义 | 时区 |
|------|------|------|
| `updated_at` | 记录最后修改时间 | UTC 毫秒 |
| `last_sync_at` | 最后同步时间 | UTC 毫秒 |
| `last_updated` | 账户余额最后更新时间 | UTC 毫秒 |
| `transaction_date` | 交易日期 | UTC 毫秒 |
| `start_date` / `end_date` / `next_due_date` / `last_generated_date` | 经常性模板日期 | UTC 毫秒 |
| `snapshot_date` | 快照日期 | UTC 毫秒 |

时间戳生成统一通过 `utils/time.ts` 的 `nowMs()`（即 `Date.now()`），年月提取通过 `toYearMonth()`（使用 `getUTCFullYear` / `getUTCMonth`），确保跨时区一致（详见 [06-utils.md](06-utils.md) 的 time 小节）。

### 4.5 同步元数据三件套

所有 7 个接口均含以下 3 个字段，构成记录级 LWW（Last-Write-Wins）同步协议的基础：

| 字段 | 类型 | 用途 |
|------|------|------|
| `sync_version` | `number` | 同步版本号，每次本地修改 +1 |
| `updated_at` | `number` | 最后修改时间戳，LWW 冲突比较依据 |
| `deleted_flag` | `number` | 软删除标志，同步传播删除操作 |

冲突解决规则：`shouldRemoteWin(local, remote)` 返回 `remote.updated_at >= local.updated_at`（详见 [06-utils.md](06-utils.md) 的 sync 小节）。

---

## 5. M8 导出/导入/清空类型

M8 里程碑引入了数据导出（JSON / CSV）、导入（JSON LWW 合并 / CSV 模板解析）与一键清空交易的能力。配套的类型**定义在 services 与 import-templates 目录**，而非 `types/index.ts`，因为它们是服务层 DTO（数据传输对象）而非数据库实体。本节汇总这 8 个类型。

### 5.1 `ExportTableName`

源码：[export-service.ts](file:///workspace/packages/shared/src/services/export-service.ts)

```typescript
export const EXPORT_TABLE_NAMES = [
  'users', 'accounts', 'categories', 'transactions',
  'recurring_transactions', 'net_worth_snapshots', 'fire_scenarios',
] as const;

export type ExportTableName = (typeof EXPORT_TABLE_NAMES)[number];
```

- **值列表**：7 个，与第 3 节的 7 张实体表一一对应
- **构造方式**：由 `EXPORT_TABLE_NAMES` 常量数组通过 `as const` + 索引访问类型推导而来，避免字面量重复书写
- **使用场景**：`buildCsvExport(db, tableName, userId)` 的 `tableName` 形参类型；`importJsonWithLww` 内部 `processOrder: ExportTableName[]` 的元素类型
- **运行时与编译期双重存在**：与第 2 节的 5 个枚举别名（纯编译期）不同，本类型伴随一个运行时常量 `EXPORT_TABLE_NAMES`，导入服务在 `validateEnvelope` 中复用该常量做"数据表数量与键名严格匹配"校验

### 5.2 `ExportEnvelope`

源码：[export-service.ts](file:///workspace/packages/shared/src/services/export-service.ts)

```typescript
export interface ExportEnvelope {
  header: {
    format: 'fire-app-export';
    version: '1.0';
    exported_at: number;
    app_version: string;
    table_count: number;
    record_count: number;
    crypto: null;
  };
  data: {
    users: User[]; accounts: Account[]; categories: Category[];
    transactions: Transaction[]; recurring_transactions: RecurringTransaction[];
    net_worth_snapshots: NetWorthSnapshot[]; fire_scenarios: FireScenario[];
  };
}
```

JSON 导出文件的顶层信封结构，由 `buildExportEnvelope(db, userId, appVersion)` 构造、`serializeExportEnvelope` 序列化为 `JSON.stringify(envelope, null, 2)`（2 空格缩进）。

- **`header` 子结构（内联类型，未单独导出为 `ExportHeader`）**：
  | 字段 | 类型 | 说明 |
  |------|------|------|
  | `format` | `'fire-app-export'`（字面量） | 文件格式标识，导入时严格相等校验 |
  | `version` | `'1.0'`（字面量） | 导出格式版本，导入时仅接受 `1.0` |
  | `exported_at` | `number` | 导出时间戳（UTC 毫秒，由 `Date.now()` 生成） |
  | `app_version` | `string` | 导出时的 App 版本号（由调用方传入） |
  | `table_count` | `number` | 数据表数量，固定为 `EXPORT_TABLE_NAMES.length`（7） |
  | `record_count` | `number` | 全表记录总数（7 个数组 `length` 之和） |
  | `crypto` | `null` | 加密信息占位，当前恒为 `null`（加密功能未实现，导入时若非 `null` 报"加密文件暂不支持导入"） |
- **`data` 子结构**：7 个数组字段，键名与 `EXPORT_TABLE_NAMES` 严格一致，元素类型为第 3 节对应的实体接口
- **安全注意**：`buildExportEnvelope` 在查询 `users` 时使用显式列名并把 `encryption_key_hash` 替换为 `NULL`，避免将密码哈希写入导出文件（防离线爆破），详见 [05-services.md](05-services.md) 的 export-service 小节

> 注：源码中 `header` 与 `data` 均为内联对象字面量类型，未单独导出 `ExportHeader` 别名。如需在别处引用 header 形状，使用 `ExportEnvelope['header']`。

### 5.3 `ParsedCsvTransaction`

源码：[types.ts](file:///workspace/packages/shared/src/import-templates/types.ts)

CSV 导入流水线中"单条已解析交易"的中间表示，由模板的 `parseHook` 或通用解析器产出，随后经去重、分类推断、占位符解析等阶段逐步填充字段，最终由 `importCsvTransactions` 转写为 `transactions` 表行。

```typescript
export type ParsedTransactionType = 'income' | 'expense' | 'transfer';

export interface ParsedCsvTransaction {
  tempId: string;
  transactionDate: number;
  amount: number; // 分：正收入/负支出/0 转账
  transactionType: ParsedTransactionType;
  description: string;
  counterparty?: string;
  productDescription?: string;
  mappedCategoryId?: string;
  inferredCategoryId?: string;
  finalCategoryId: string;
  dedupHash: string;
  isDuplicate: boolean;
  sourceLine: number;
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `tempId` | `string` | 是 | 解析阶段生成的临时 ID（仅用于前端列表 key） |
| `transactionDate` | `number` | 是 | 交易日期（UTC 毫秒） |
| `amount` | `number` | 是 | 金额（分），符号约定：正=收入、负=支出、0=转账；入库时取 `Math.abs()` |
| `transactionType` | `ParsedTransactionType` | 是 | 交易类型（3 值，**无** `initial_balance`） |
| `description` | `string` | 是 | 描述，映射到 `transactions.description` |
| `counterparty` | `string` | 否 | 交易对手方（来自 CSV 列） |
| `productDescription` | `string` | 否 | 商品描述（用于关键词分类推断） |
| `mappedCategoryId` | `string` | 否 | 模板 `categoryMapping` 给出的占位符（如 `__CAT_FOOD__`） |
| `inferredCategoryId` | `string` | 否 | 关键词规则推断出的占位符 |
| `finalCategoryId` | `string` | 是 | 经占位符解析后填入的真实分类 UUID；空串表示未匹配到分类 |
| `dedupHash` | `string` | 是 | 去重哈希（含 `transactionDate` / `amount` / `transactionType` / `description`） |
| `isDuplicate` | `boolean` | 是 | 是否与库内已有交易重复（由 `markDuplicateTransactions` 填充） |
| `sourceLine` | `number` | 是 | 源 CSV 行号（用于错误定位） |

- **`ParsedTransactionType`**：独立导出的 3 值字面量联合（`'income' | 'expense' | 'transfer'`），与第 2.3 节 `TransactionType` 的前 3 值一致但**不含** `initial_balance`
- **生命周期**：解析 → `markDuplicateTransactions` 设 `isDuplicate` → `resolveCategoryForTransactions` 设 `finalCategoryId` → `importCsvTransactions` 落库（重复项跳过）

### 5.4 `CsvImportTemplate`

源码：[types.ts](file:///workspace/packages/shared/src/import-templates/types.ts)

CSV 导入模板的静态配置结构，描述某类银行账单（如招行、支付宝）的文件特征与列映射规则。

```typescript
export interface ColumnMapping {
  date: { columnName?: string; columnIndex?: number; format: 'yyyy-mm-dd' | 'yyyy/mm/dd' | 'dd-mm-yyyy' | 'timestamp' };
  amount: { columnName?: string; columnIndex?: number };
  description: { columnName?: string; columnIndex?: number };
  counterparty?: { columnName?: string; columnIndex?: number };
  productDescription?: { columnName?: string; columnIndex?: number };
  category?: { columnName?: string; columnIndex?: number };
}

export interface CsvImportTemplate {
  id: string;
  displayName: string;
  description: string;
  fileSignatures: string[];
  encoding: 'utf-8' | 'gbk';
  headerLineCount: number;
  columnMapping: ColumnMapping;
  categoryMapping: Record<string, string>;
  amountConvention: 'positive_is_income' | 'positive_is_expense' | 'signed';
  parseHook?: (rawRows: string[][]) => ParsedCsvTransaction[];
}
```

`CsvImportTemplate` 字段说明：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `string` | 模板唯一标识 |
| `displayName` | `string` | UI 显示名 |
| `description` | `string` | 模板描述 |
| `fileSignatures` | `string[]` | 文件特征签名（用于自动匹配模板，如文件名/首行内容匹配） |
| `encoding` | `'utf-8' \| 'gbk'` | 文件编码 |
| `headerLineCount` | `number` | 表头行数（解析时跳过前 N 行） |
| `columnMapping` | `ColumnMapping` | 列映射（按列名或列索引定位字段） |
| `categoryMapping` | `Record<string, string>` | 分类映射：CSV 原始值 → 占位符（如 `"餐饮" → "__CAT_FOOD__"`） |
| `amountConvention` | `'positive_is_income' \| 'positive_is_expense' \| 'signed'` | 金额符号约定 |
| `parseHook` | `(rawRows: string[][]) => ParsedCsvTransaction[]`（可选） | 自定义解析钩子，覆盖默认解析逻辑 |

`ColumnMapping` 字段说明：`date` / `amount` / `description` 为必填（其中 `date.format` 必填，支持 4 种日期格式），`counterparty` / `productDescription` / `category` 为可选；每个字段可用 `columnName`（列名）或 `columnIndex`（列索引）二选一定位。

### 5.5 `ImportResult`

源码：[import-service.ts](file:///workspace/packages/shared/src/services/import-service.ts)

```typescript
export interface ImportResult {
  success: boolean;
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
}
```

JSON 导入（`importJsonWithLww`）与 CSV 导入（`importCsvTransactions`）共用的统一结果类型。

| 字段 | 类型 | 说明 |
|------|------|------|
| `success` | `boolean` | 整体是否成功（任何阶段抛错或校验失败置 `false`） |
| `inserted` | `number` | 新增记录数（LWW：本地不存在该 `id`） |
| `updated` | `number` | 更新记录数（LWW：`remote.updated_at > local.updated_at`） |
| `skipped` | `number` | 跳过记录数（LWW：远端不比本地新；CSV：`isDuplicate` 为真） |
| `errors` | `string[]` | 错误信息列表（校验失败时含多条；异常时含 1 条异常 message） |

- **失败语义**：失败时 `inserted` / `updated` / `skipped` 全部归零（在 try/catch 的 catch 分支显式重置），`errors` 含失败原因
- **事务边界**：JSON 导入与 CSV 导入均包裹在 `db.transaction(() => { ... })()` 中，整体原子提交；任一记录异常则全部回滚

### 5.6 `CsvImportParams`

源码：[import-service.ts](file:///workspace/packages/shared/src/services/import-service.ts)

```typescript
export interface CsvImportParams {
  templateId: string;
  filePath: string;
  accountId: string;
  userId: string;
  transactions: ParsedCsvTransaction[];
}
```

`importCsvTransactions(db, params)` 的入参契约。

| 字段 | 类型 | 说明 |
|------|------|------|
| `templateId` | `string` | 使用的模板 ID |
| `filePath` | `string` | CSV 文件路径 |
| `accountId` | `string` | 目标账户 ID（所有交易挂账到此账户） |
| `userId` | `string` | 用户 ID |
| `transactions` | `ParsedCsvTransaction[]` | 已解析、去重、分类解析完成的交易列表 |

> 注：`importCsvTransactions` 实际仅使用 `userId` / `accountId` / `transactions` 三字段；`templateId` 与 `filePath` 保留用于日志与未来扩展。

### 5.7 `ClearResult`

源码：[clear-service.ts](file:///workspace/packages/shared/src/services/clear-service.ts)

```typescript
export interface ClearResult {
  success: boolean;
  clearedTransactionCount: number;
  clearedRecurringCount: number;
  resetAccountCount: number;
  error?: string;
}
```

`clearAllTransactions(db, userId)` 的返回类型，描述"一键清空交易数据"操作的影响范围。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `success` | `boolean` | 是 | 是否成功 |
| `clearedTransactionCount` | `number` | 是 | 软删除的交易记录数（操作前 `deleted_flag = 0` 的交易条数） |
| `clearedRecurringCount` | `number` | 是 | 软删除的经常性模板数 |
| `resetAccountCount` | `number` | 是 | 余额被置零的账户数 |
| `error` | `string` | 否 | 失败时的异常 message（成功时缺省） |

- **操作语义**：软删除（`deleted_flag = 1`）交易与经常性模板，并将所有账户 `current_balance` 置零；不删除账户、分类、快照、场景
- **事务边界**：整个操作包裹在单个事务中，原子提交

---

## 6. M9 分页查询/经常性更新类型

M9 里程碑引入了交易分页查询（替代旧的全量拉取）、月度收支聚合与经常性模板的部分更新能力。配套类型定义在 `models/` 目录，是查询函数的入参/出参契约。

### 6.1 `TransactionPageParams`

源码：[transaction-queries.ts](file:///workspace/packages/shared/src/models/transaction-queries.ts)

```typescript
export interface TransactionPageParams {
  dateFrom?: number;
  dateTo?: number;
  type?: 'income' | 'expense' | 'transfer' | 'initial_balance';
  accountId?: string;
  limit: number;
  offset: number;
}
```

`getTransactionsPage(db, userId, params)` 的筛选 + 分页入参。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `dateFrom` | `number` | 否 | 起始日期（UTC 毫秒，闭区间，`transaction_date >= ?`） |
| `dateTo` | `number` | 否 | 截止日期（UTC 毫秒，闭区间，`transaction_date <= ?`） |
| `type` | `'income' \| 'expense' \| 'transfer' \| 'initial_balance'` | 否 | 交易类型过滤（与第 2.3 节 `TransactionType` 同 4 值） |
| `accountId` | `string` | 否 | 账户 ID 过滤（`account_id = ?`） |
| `limit` | `number` | 是 | 每页条数（SQL `LIMIT`） |
| `offset` | `number` | 是 | 偏移量（SQL `OFFSET`） |

- **筛选下推**：所有可选筛选条件均下推到 SQL `WHERE` 子句，避免在 JS 层过滤全量数据
- **排序规则**：固定 `ORDER BY transaction_date DESC, updated_at DESC`（不在参数中暴露）
- **软删除过滤**：`deleted_flag = 0` 恒定附加，不可配置

### 6.2 `TransactionPage`

源码：[transaction-queries.ts](file:///workspace/packages/shared/src/models/transaction-queries.ts)

```typescript
export interface TransactionPage {
  items: Transaction[];
  total: number;
}
```

`getTransactionsPage` 的返回结构。

| 字段 | 类型 | 说明 |
|------|------|------|
| `items` | `Transaction[]` | 当前页交易记录（按 `transaction_date DESC, updated_at DESC` 排序） |
| `total` | `number` | 满足筛选条件的总记录数（独立 `COUNT(*)` 查询，非 `items.length`） |

- **设计动机**：`total` 用于前端分页器渲染总页数；与 `items` 分两次 SQL 查询（一次 `COUNT`，一次 `SELECT * ... LIMIT/OFFSET`）

### 6.3 `MonthlyOverview`

源码：[transaction-queries.ts](file:///workspace/packages/shared/src/models/transaction-queries.ts)

```typescript
export interface MonthlyOverview {
  income: number;
  expense: number;
  transfer: number;
}
```

`getMonthlyOverview(db, userId, yearMonth)` 的返回结构，按交易类型分组的月度金额合计。

| 字段 | 类型 | 说明 |
|------|------|------|
| `income` | `number` | 当月收入合计（分，`SUM(CASE WHEN transaction_type='income' THEN amount ELSE 0 END)`） |
| `expense` | `number` | 当月支出合计（分） |
| `transfer` | `number` | 当月转账合计（分） |

- **聚合下推**：使用 SQL `SUM(CASE WHEN ...)` 与 `strftime('%Y-%m', transaction_date / 1000, 'unixepoch')` 在数据库层完成聚合，避免拉全量到 JS 层
- **空结果处理**：当月无交易时返回 `{ income: 0, expense: 0, transfer: 0 }`（通过 `COALESCE(..., 0)` 与 `??` 兜底）
- **不包含** `initial_balance` 类型（仅 income / expense / transfer 三类参与聚合）

### 6.4 `RecurringUpdateFields`

源码：[recurring.ts](file:///workspace/packages/shared/src/models/recurring.ts)

```typescript
export type RecurringUpdateFields = Partial<Pick<RecurringTransaction, 'next_due_date' | 'last_generated_date' | 'is_active'>>;
```

`updateRecurring(db, id, updates)` 的可更新字段契约。

- **类型构造**：`Partial<Pick<RecurringTransaction, 'next_due_date' | 'last_generated_date' | 'is_active'>>`
  - `Pick<RecurringTransaction, ...>` 从第 3.5 节 `RecurringTransaction` 接口中精确摘取 3 个字段
  - `Partial<...>` 将这 3 个字段全部变为可选
- **可更新字段**（3 个，全部可选）：
  | 字段 | 原类型（Pick 前） | 说明 |
  |------|-------------------|------|
  | `next_due_date` | `number` | 下次到期日（生成交易后顺延） |
  | `last_generated_date` | `number \| null` | 上次生成交易日期 |
  | `is_active` | `number` | 是否活跃（0/1，停用模板） |
- **设计动机**：限制可更新字段为最小必要集，防止调用方误改 `amount` / `frequency` / `account_id` 等需重建模板的字段；`sync_version` 与 `updated_at` 由 `updateRecurring` 内部自动维护（`sync_version + 1`、`updated_at = nowMs()`）
- **运行时行为**：`updateRecurring` 用 `{ ...current, ...updates }` 合并后，UPDATE 语句**固定写入全部 3 个字段**（含未被更新的字段，沿用原值），而非动态拼接 SET 子句
