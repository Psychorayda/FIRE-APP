# 03-types.md — 类型定义

> **最后更新**: 2026-07-15
> **对应代码**: `fire-app/src/types/`
> **导航**: [← 返回主页](CODE_WIKI.md) | [上一节](02-database.md) | [下一节](04-models.md)

---

## 1. 概述

源码：[index.ts](file:///workspace/FIRE%20APP/fire-app/src/types/index.ts)

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

源码 141 行，分两个区块（[index.ts:3-17](file:///workspace/FIRE%20APP/fire-app/src/types/index.ts#L3-L17) 为枚举区块，[index.ts:19-141](file:///workspace/FIRE%20APP/fire-app/src/types/index.ts#L19-L141) 为接口区块）。所有类型均用 `export` 导出，供外部模块按名引用。

---

## 2. 5 个枚举别名

5 个 `type` 别名均为 string literal union，与 schema 的 CHECK 约束一一对应。它们在编译后被完全擦除（无运行时对象），仅由 TypeScript 编译器在类型检查阶段使用。

### 2.1 `AssetClass`

源码：[index.ts:5](file:///workspace/FIRE%20APP/fire-app/src/types/index.ts#L5)

```typescript
export type AssetClass = 'liquid' | 'invested' | 'use_asset' | 'liability';
```

- **值列表**：4 个
  - `liquid` — 流动资产（活期、现金等）
  - `invested` — 投资资产（基金、股票、退休账户等）
  - `use_asset` — 使用资产（自住房产、车辆等）
  - `liability` — 负债（信用卡、贷款、房贷等，余额为负数）
- **对应 CHECK 约束**：`accounts.asset_class IN ('liquid', 'invested', 'use_asset', 'liability')`（[schema.ts:35](file:///workspace/FIRE%20APP/fire-app/src/db/schema.ts#L35)）
- **使用场景**：`accounts.asset_class` 字段；驱动 `getInvestableBalance`（liquid + invested）与净资产快照的 4 类分组聚合（详见 [05-services.md](05-services.md) 的快照服务小节）

### 2.2 `AccountType`

源码：[index.ts:7-11](file:///workspace/FIRE%20APP/fire-app/src/types/index.ts#L7-L11)

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
- **对应 CHECK 约束**：`accounts.account_type IN ('checking','savings','cash','investment','retirement','fund','real_estate','vehicle','credit_card','loan','mortgage')`（[schema.ts:37-42](file:///workspace/FIRE%20APP/fire-app/src/db/schema.ts#L37-L42)）
- **使用场景**：`accounts.account_type` 字段
- **已知问题**：设计文档 `2026-07-12-fire-app-user-data-model-design.md` 第 925 行（决策记录 #17）写"10 种完整枚举"，正确值为 **11 种**。Wiki 以代码为权威，描述为 11（详见 [08-design-index.md](08-design-index.md) 的已知问题清单）

### 2.3 `TransactionType`

源码：[index.ts:13](file:///workspace/FIRE%20APP/fire-app/src/types/index.ts#L13)

```typescript
export type TransactionType = 'income' | 'expense' | 'transfer' | 'initial_balance';
```

- **值列表**：4 个
  - `income` — 收入
  - `expense` — 支出
  - `transfer` — 转账
  - `initial_balance` — 初始余额（仅用于建账时设置账户起始余额）
- **对应 CHECK 约束**：
  - `transactions.transaction_type IN ('income','expense','transfer','initial_balance')`（[schema.ts:75](file:///workspace/FIRE%20APP/fire-app/src/db/schema.ts#L75)）— 4 值
  - `recurring_transactions.transaction_type IN ('income','expense','transfer')`（[schema.ts:97](file:///workspace/FIRE%20APP/fire-app/src/db/schema.ts#L97)）— 3 值，**不包含** `initial_balance`
- **使用场景**：
  - `transactions.transaction_type` 字段（4 值全部可用）
  - `recurring_transactions.transaction_type` 字段（仅前 3 值，初始余额不应作为经常性模板）
- **余额影响规则**（见 [05-services.md](05-services.md) 的 `balanceDelta` 函数）：`income` / `initial_balance` 增加余额，`expense` / `transfer` 减少余额（transfer 时贷方账户由 `to_account_id` 单独处理增加）

### 2.4 `CategoryType`

源码：[index.ts:15](file:///workspace/FIRE%20APP/fire-app/src/types/index.ts#L15)

```typescript
export type CategoryType = 'income' | 'expense';
```

- **值列表**：2 个
  - `income` — 收入分类
  - `expense` — 支出分类
- **对应 CHECK 约束**：`categories.type IN ('income', 'expense')`（[schema.ts:59](file:///workspace/FIRE%20APP/fire-app/src/db/schema.ts#L59)）
- **使用场景**：`categories.type` 字段；`getCategories(db, userId, type?)` 函数支持按此类型过滤分类列表（详见 [04-models.md](04-models.md) 的 category 小节）

### 2.5 `Frequency`

源码：[index.ts:17](file:///workspace/FIRE%20APP/fire-app/src/types/index.ts#L17)

```typescript
export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
```

- **值列表**：4 个
  - `daily` — 每日
  - `weekly` — 每周
  - `monthly` — 每月
  - `yearly` — 每年
- **对应 CHECK 约束**：`recurring_transactions.frequency IN ('daily','weekly','monthly','yearly')`（[schema.ts:99](file:///workspace/FIRE%20APP/fire-app/src/db/schema.ts#L99)）
- **使用场景**：`recurring_transactions.frequency` 字段；与 `interval` 字段配合表达"每 N 个单位"模式（如 `frequency='monthly'` + `interval=3` 表示每季度）。`advanceDueDate` 函数按此频率推算下一个到期日（详见 [05-services.md](05-services.md) 的 recurring-service 小节）

---

## 3. 7 个实体接口

7 个 `interface` 与 7 张数据库表一一对应。字段表中的"可空"列：`否` 表示 TypeScript 类型非空，`是` 表示类型为 `T | null`；"表列类型"列引用 schema 中的 SQLite 类型（详见 [02-database.md](02-database.md) 第 3 节）。

### 3.1 `User`

源码：[index.ts:21-34](file:///workspace/FIRE%20APP/fire-app/src/types/index.ts#L21-L34)

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

源码：[index.ts:36-49](file:///workspace/FIRE%20APP/fire-app/src/types/index.ts#L36-L49)

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

源码：[index.ts:51-65](file:///workspace/FIRE%20APP/fire-app/src/types/index.ts#L51-L65)

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

源码：[index.ts:67-81](file:///workspace/FIRE%20APP/fire-app/src/types/index.ts#L67-L81)

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

源码：[index.ts:83-103](file:///workspace/FIRE%20APP/fire-app/src/types/index.ts#L83-L103)

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

> 注：实施计划中早期版本曾写"17 字段"，实际源码（[index.ts:83-103](file:///workspace/FIRE%20APP/fire-app/src/types/index.ts#L83-L103)）为 **19 字段**，本 Wiki 以代码为权威描述为 19。

### 3.6 `NetWorthSnapshot`

源码：[index.ts:105-118](file:///workspace/FIRE%20APP/fire-app/src/types/index.ts#L105-L118)

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

**表级约束**：`UNIQUE(user_id, snapshot_year_month)`（[schema.ts:127](file:///workspace/FIRE%20APP/fire-app/src/db/schema.ts#L127)）保证每月每用户仅一条快照，是 `generateMonthlySnapshot` 幂等性的数据库层保障。

### 3.7 `FireScenario`

源码：[index.ts:120-141](file:///workspace/FIRE%20APP/fire-app/src/types/index.ts#L120-L141)

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
