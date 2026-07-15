# 04-models.md — 数据模型层

> **最后更新**: 2026-07-15
> **对应代码**: `fire-app/src/models/`
> **导航**: [← 返回主页](CODE_WIKI.md) | [上一节](03-types.md) | [下一节](05-services.md)

---

## 1. 模块概述

models 层是**数据访问层（DAL）**，每个文件对应一张数据库表，提供 CRUD 操作与简单查询。本层不含跨表事务（事务边界在 services 层协调）。

**共同约定**：
- 所有写操作（创建/更新/软删除）递增 `sync_version` 并刷新 `updated_at`，便于 LWW 同步
- 例外：`updateAccountBalance`（账户余额变动）仅更新 `current_balance` 与 `last_updated`，**不**递增 `sync_version`（余额由交易驱动，不视作用户编辑）
- 读操作默认过滤 `deleted_flag = 0`（软删除）；`transaction.ts` 的 `getTransactionById` 是例外，含已删除记录（供历史回溯使用）
- 新记录初始 `sync_version = 0`、`deleted_flag = 0`

**统一依赖**：
| 依赖 | 来源 | 用途 |
|------|------|------|
| `DatabaseType` | better-sqlite3 | 数据库连接类型 |
| `v4 as uuidv4` | uuid | 生成记录 ID（UUID v4） |
| `nowMs` | utils/time.ts | 获取当前 Unix 毫秒时间戳 |
| 实体接口 | types/index.ts | `User` / `Account` / `Category` / `Transaction` / `RecurringTransaction` / `FireScenario` / `NetWorthSnapshot` |

**文件清单**（按本节顺序）：

| # | 文件 | 函数数 | 主要职责 |
|---|------|--------|----------|
| 1 | user.ts | 3 | 用户档案 CRUD + 默认偏好管理 |
| 2 | account.ts | 8 | 账户 CRUD + 余额查询 + 软删除 |
| 3 | category.ts | 4 | 分类 CRUD + 种子分类初始化 |
| 4 | transaction.ts | 2 | 交易查询（仅读操作） |
| 5 | recurring.ts | 3 | 经常性交易模板 CRUD |
| 6 | scenario.ts | 4 | FIRE 场景 CRUD |
| 7 | snapshot.ts | 3 | 净资产快照查询与插入 |

---

## 2. user.ts

源码：[user.ts](file:///workspace/FIRE%20APP/fire-app/src/models/user.ts)

**职责**：用户档案 CRUD 与默认偏好管理（中国市场假设影响默认提款率）

**依赖**：`DatabaseType`、`uuidv4`、`nowMs`、`User` 接口

### 2.1 输入接口

#### `CreateUserInput`

| 字段 | 类型 | 可选 | 默认值 | 说明 |
|------|------|------|--------|------|
| id | string | ✓ | uuidv4() | 用户 ID（可外部指定） |
| display_name | string | 否 | — | 显示名 |
| base_currency | string | ✓ | 'CNY' | 基础货币 |
| is_china_market | number | ✓ | 1 | 是否中国市场（影响提款率默认值） |
| default_withdrawal_rate | number | ✓ | 350（中国）/ 400（非中国） | 默认提款率（基点） |
| default_expected_return | number | ✓ | 700 | 默认预期收益率（基点，即 7%） |
| default_inflation_rate | number | ✓ | 300 | 默认通胀率（基点，即 3%） |

#### `UpdateUserInput`

所有字段均可选，额外含 `encryption_key_hash` 与 `last_sync_at`（同步状态字段，用户编辑时不直接修改）：

| 字段 | 类型 | 说明 |
|------|------|------|
| display_name | string? | 显示名 |
| base_currency | string? | 基础货币 |
| is_china_market | number? | 是否中国市场 |
| default_withdrawal_rate | number? | 默认提款率（基点） |
| default_expected_return | number? | 默认预期收益率（基点） |
| default_inflation_rate | number? | 默认通胀率（基点） |
| encryption_key_hash | string \| null | 加密密钥哈希（同步层使用） |
| last_sync_at | number \| null | 上次同步时间戳 |

### 2.2 函数清单

| 函数名 | 签名 | 用途 | 读/写 | 递增 sync_version | 抛错条件 |
|--------|------|------|-------|------------------|----------|
| createUser | (db, input) => User | 创建用户 | 写 | 否（初始 0） | — |
| getUser | (db, id) => User \| null | 查询用户（过滤软删除） | 读 | — | — |
| updateUser | (db, id, input) => User | 更新用户档案与偏好 | 写 | 是 | `User not found: ${id}` |

### 2.3 关键函数详解

#### `createUser`（[user.ts:28-58](file:///workspace/FIRE%20APP/fire-app/src/models/user.ts#L28-L58)）

**默认值逻辑**：`is_china_market` 决定 `default_withdrawal_rate` 默认值——中国市场（=1）用 350 基点（3.5%，符合中国社保养老金预期），非中国市场用 400 基点（4%，经典 4% 规则）。

**关联表**：`users`（无外键）

**SQL**：使用命名参数（`@id`、`@display_name`…）的 INSERT 语句，传入完整 `User` 对象。

#### `updateUser`（[user.ts:67-96](file:///workspace/FIRE%20APP/fire-app/src/models/user.ts#L67-L96)）

**业务规则**：
1. 先调用 `getUser` 查询当前记录，不存在则抛 `User not found: ${id}`
2. 用 spread 合并：`{ ...current, ...input, sync_version: current.sync_version + 1, updated_at: nowMs() }`
3. 全字段 UPDATE（非部分字段）——传入字段为 `undefined` 时 spread 不覆盖，原值保留

**关联表**：`users`

---

## 3. account.ts

源码：[account.ts](file:///workspace/FIRE%20APP/fire-app/src/models/account.ts)

**职责**：账户 CRUD + 余额查询（可投资余额 / 净资产）+ 软删除（含关联交易保护）

**依赖**：`DatabaseType`、`uuidv4`、`nowMs`、`Account` / `AssetClass` / `AccountType` 接口

### 3.1 输入接口

#### `CreateAccountInput`

| 字段 | 类型 | 可选 | 默认值 | 说明 |
|------|------|------|--------|------|
| user_id | string | 否 | — | 所属用户 ID |
| name | string | 否 | — | 账户名称 |
| asset_class | AssetClass | 否 | — | 资产分类（liquid / invested / use_asset / liability） |
| account_type | AccountType | 否 | — | 账户类型（11 种，如 checking / investment / loan） |
| initial_balance | number | ✓ | 0 | 初始余额（分；负债账户为负数） |
| display_order | number | ✓ | 0 | 显示排序 |
| note | string \| null | ✓ | null | 备注 |

### 3.2 函数清单

| 函数名 | 签名 | 用途 | 读/写 | 递增 sync_version | 抛错条件 |
|--------|------|------|-------|------------------|----------|
| createAccount | (db, input) => Account | 创建账户 | 写 | 否（初始 0） | — |
| getAccount | (db, id) => Account \| null | 查询账户（过滤软删除） | 读 | — | — |
| getAccounts | (db, userId) => Account[] | 列出用户所有账户（按 display_order, name 排序） | 读 | — | — |
| updateAccountBalance | (db, id, newBalance) => void | 更新账户余额 | 写 | **否** | — |
| getInvestableBalance | (db, userId) => number | 计算可投资余额（liquid + invested） | 读 | — | — |
| getNetWorth | (db, userId) => number | 计算净资产（所有账户，负债为负数） | 读 | — | — |
| hasTransactions | (db, accountId) => boolean | 检查账户是否有关联交易 | 读 | — | — |
| softDeleteAccount | (db, id) => void | 软删除账户 | 写 | 是 | 有关联交易 / `Account not found: ${id}` |

### 3.3 关键函数详解

#### `softDeleteAccount`（[account.ts:103-119](file:///workspace/FIRE%20APP/fire-app/src/models/account.ts#L103-L119)）

**业务规则（关联交易保护）**：
1. 先调用 `hasTransactions(db, id)` 检查关联交易——查询 `transactions` 表中 `account_id = ? OR to_account_id = ?` 且未软删除的记录
2. 若有关联交易，抛错：`该账户下有关联交易，无法删除。请先处理关联交易。`
3. 否则调用 `getAccount` 查询当前记录，不存在则抛 `Account not found: ${id}`
4. 执行软删除：`UPDATE accounts SET deleted_flag = 1, sync_version = current.sync_version + 1, updated_at = nowMs() WHERE id = ?`

**设计动机**：保护数据完整性——若直接软删除账户，历史交易会变成"悬空引用"，破坏报表聚合。

**关联表**：`accounts`（写）、`transactions`（读，关联检查）

#### `getInvestableBalance`（[account.ts:68-75](file:///workspace/FIRE%20APP/fire-app/src/models/account.ts#L68-L75)）

**SQL**：`SELECT COALESCE(SUM(current_balance), 0) FROM accounts WHERE user_id = ? AND asset_class IN ('liquid', 'invested') AND deleted_flag = 0`

**说明**：`COALESCE` 处理无账户时的空集（返回 0 而非 null）。仅 `liquid` 与 `invested` 两类计入可投资余额；`use_asset`（如自住房产）与 `liability` 排除。

**用途**：FIRE 投影（`fire-calc.ts` 的 `runProjection`）读取此值作为投资组合起点。

#### `getNetWorth`（[account.ts:80-87](file:///workspace/FIRE%20APP/fire-app/src/models/account.ts#L80-L87)）

**SQL**：`SELECT COALESCE(SUM(current_balance), 0) FROM accounts WHERE user_id = ? AND deleted_flag = 0`

**说明**：含全部 4 类资产；负债账户余额为负数（如信用卡 -5000 元），SUM 自然扣减。`getNetWorth` 与 `getInvestableBalance` 的差值即"非投资性资产 - 负债"。

#### `updateAccountBalance`（[account.ts:59-63](file:///workspace/FIRE%20APP/fire-app/src/models/account.ts#L59-L63)）

**特殊处理**：仅更新 `current_balance` 与 `last_updated`，**不**递增 `sync_version`。原因：余额由交易（`transaction-service.ts`）驱动，不视作用户编辑；`sync_version` 用于 LWW 同步时识别用户主动修改的字段。

**调用方**：`services/transaction-service.ts` 在事务内调用此函数联动余额。

#### `hasTransactions`（[account.ts:92-98](file:///workspace/FIRE%20APP/fire-app/src/models/account.ts#L92-L98)）

**SQL**：`SELECT COUNT(*) FROM transactions WHERE (account_id = ? OR to_account_id = ?) AND deleted_flag = 0`

**说明**：同时检查 `account_id`（借方）与 `to_account_id`（转账贷方），覆盖账户在交易中的两种角色。

---

## 4. category.ts

源码：[category.ts](file:///workspace/FIRE%20APP/fire-app/src/models/category.ts)

**职责**：分类 CRUD + 种子分类初始化（18 个内置分类）

**依赖**：`DatabaseType`、`uuidv4`、`nowMs`、`Category` / `CategoryType` 接口

### 4.1 输入接口

#### `CreateCategoryInput`

| 字段 | 类型 | 可选 | 默认值 | 说明 |
|------|------|------|--------|------|
| user_id | string | 否 | — | 所属用户 ID |
| parent_id | string \| null | ✓ | null | 父分类 ID（支持两级分类树） |
| name | string | 否 | — | 分类名称 |
| type | CategoryType | 否 | — | 分类类型（income / expense） |
| icon | string \| null | ✓ | null | 图标标识 |
| color | string \| null | ✓ | null | 颜色 |
| linked_fire_concept | string \| null | ✓ | null | 关联的 FIRE 知识库概念 |
| display_order | number | ✓ | 0 | 显示排序 |

### 4.2 函数清单

| 函数名 | 签名 | 用途 | 读/写 | 递增 sync_version | 抛错条件 |
|--------|------|------|-------|------------------|----------|
| createCategory | (db, input) => Category | 创建分类（用户自建，is_system=0） | 写 | 否（初始 0） | — |
| getCategory | (db, id) => Category \| null | 查询分类（过滤软删除） | 读 | — | — |
| getCategories | (db, userId, type?) => Category[] | 列出用户分类（可按 type 过滤） | 读 | — | — |
| seedCategories | (db, userId) => void | 初始化 18 个种子分类（is_system=1） | 写 | 否（初始 0） | — |

### 4.3 关键函数详解

#### `seedCategories`（[category.ts:93-119](file:///workspace/FIRE%20APP/fire-app/src/models/category.ts#L93-L119)）

**用途**：为新用户插入 18 个内置分类（11 支出 + 7 收入），所有种子分类 `is_system = 1`（用户不可删除）。

**18 个种子分类**（来自 [category.ts:18-39](file:///workspace/FIRE%20APP/fire-app/src/models/category.ts#L18-L39) 的 `SEED_CATEGORIES` 数组）：

**支出分类（11 个）**：

| # | 名称 | linked_fire_concept |
|---|------|---------------------|
| 1 | 住房 | — |
| 2 | 食品 | — |
| 3 | 交通 | — |
| 4 | 保险 | `insurance_planning` |
| 5 | 医疗 | `china_medical_insurance` |
| 6 | 娱乐 | — |
| 7 | 购物 | — |
| 8 | 个人护理 | — |
| 9 | 教育 | — |
| 10 | 债务还款 | `debt_management` |
| 11 | 其他支出 | — |

**收入分类（7 个）**：

| # | 名称 | linked_fire_concept |
|---|------|---------------------|
| 1 | 工资薪金 | — |
| 2 | 自由职业 | — |
| 3 | 投资收益 | — |
| 4 | 租金收入 | `retirement_income_diversification` |
| 5 | 退税 | — |
| 6 | 社保养老金 | `china_pension_system` |
| 7 | 其他收入 | — |

**5 个有 `linked_fire_concept` 的分类**（与知识库 v5.0 概念对齐）：

| 分类 | 类型 | linked_fire_concept | 知识库概念 |
|------|------|---------------------|-----------|
| 保险 | expense | insurance_planning | 保险规划 |
| 医疗 | expense | china_medical_insurance | 中国医保体系 |
| 债务还款 | expense | debt_management | 债务管理 |
| 租金收入 | income | retirement_income_diversification | 退休收入多元化 |
| 社保养老金 | income | china_pension_system | 中国养老金体系 |

**实现细节**：
- 预编译 INSERT 语句，循环插入 18 条
- 每条用 `uuidv4()` 生成新 ID
- `display_order` 用数组索引（0-17），保证默认排序与种子定义一致
- 所有种子分类 `parent_id = null`（顶层分类）、`is_system = 1`

> ⚠️ **数量校正**：设计文档 `2026-07-15-fire-app-missing-design-documents-plan.md` 第 155 行误写"17 个内置分类"，实际代码为 **18 个**（11 支出 + 7 收入）。详见 [08-design-index.md](08-design-index.md) 已知问题清单。

#### `getCategories`（[category.ts:78-91](file:///workspace/FIRE%20APP/fire-app/src/models/category.ts#L78-L91)）

**行为**：可选 `type` 参数——传入时按 type 过滤（仅 income 或仅 expense），不传则返回全部。结果按 `display_order, name` 排序。

**关联表**：`categories`（self-reference via `parent_id`，本函数不递归展开子分类）

---

## 5. transaction.ts

源码：[transaction.ts](file:///workspace/FIRE%20APP/fire-app/src/models/transaction.ts)

**职责**：交易查询（**仅读操作**）

**依赖**：`DatabaseType`、`Transaction` 接口

> **特别说明**：本文件**不含**创建/编辑/删除函数。交易的写操作涉及账户余额联动，需要事务边界保证原子性，因此放在 [services/transaction-service.ts](file:///workspace/FIRE%20APP/fire-app/src/services/transaction-service.ts) 的 `createTransaction` / `editTransaction` / `deleteTransaction` 中实现。

### 5.1 函数清单

| 函数名 | 签名 | 用途 | 读/写 | 递增 sync_version | 抛错条件 |
|--------|------|------|-------|------------------|----------|
| getTransaction | (db, id) => Transaction \| null | 查询交易（**过滤**软删除） | 读 | — | — |
| getTransactionById | (db, id) => Transaction \| null | 查询交易（**不过滤**软删除，含已删除） | 读 | — | — |

### 5.2 关键函数详解

#### `getTransaction`（[transaction.ts:4-7](file:///workspace/FIRE%20APP/fire-app/src/models/transaction.ts#L4-L7)）

**SQL**：`SELECT * FROM transactions WHERE id = ? AND deleted_flag = 0`

**用途**：常规业务查询（如交易列表、报表），仅返回活跃记录。

#### `getTransactionById`（[transaction.ts:9-12](file:///workspace/FIRE%20APP/fire-app/src/models/transaction.ts#L9-L12)）

**SQL**：`SELECT * FROM transactions WHERE id = ?`

**用途**：历史回溯与同步层使用——即使交易已软删除，仍可查询到完整记录（供 LWW 冲突解决、审计等场景）。

**设计动机**：区分两个查询入口避免业务层误用已删除数据，同时保留同步/审计场景对历史记录的访问能力。

---

## 6. recurring.ts

源码：[recurring.ts](file:///workspace/FIRE%20APP/fire-app/src/models/recurring.ts)

**职责**：经常性交易模板 CRUD（自动生成周期性交易）

**依赖**：`DatabaseType`、`uuidv4`、`nowMs`、`RecurringTransaction` / `TransactionType` / `Frequency` 接口

### 6.1 输入接口

#### `CreateRecurringInput`

| 字段 | 类型 | 可选 | 默认值 | 说明 |
|------|------|------|--------|------|
| user_id | string | 否 | — | 所属用户 ID |
| account_id | string | 否 | — | 借方账户 ID |
| to_account_id | string \| null | ✓ | null | 贷方账户 ID（仅转账模板） |
| category_id | string \| null | ✓ | null | 分类 ID |
| transaction_type | TransactionType | 否 | — | 交易类型（income / expense / transfer） |
| amount | number | 否 | — | 金额（分，必须 > 0） |
| frequency | Frequency | 否 | — | 频率（daily / weekly / monthly / yearly） |
| interval | number | ✓ | 1 | 间隔（配合 frequency，如每 2 个月） |
| start_date | number | 否 | — | 开始日期（毫秒） |
| end_date | number \| null | ✓ | null | 结束日期（null = 无限期） |
| next_due_date | number | 否 | — | 下次到期日（毫秒） |
| description | string \| null | ✓ | null | 描述 |
| is_active | number | ✓ | 1 | 是否激活 |
| auto_create | number | ✓ | 1 | 到期时是否自动创建交易 |

### 6.2 函数清单

| 函数名 | 签名 | 用途 | 读/写 | 递增 sync_version | 抛错条件 |
|--------|------|------|-------|------------------|----------|
| createRecurring | (db, input) => RecurringTransaction | 创建经常性模板 | 写 | 否（初始 0） | — |
| getActiveRecurring | (db, userId) => RecurringTransaction[] | 列出用户所有激活模板 | 读 | — | — |
| updateRecurring | (db, id, updates) => void | 更新模板（部分字段） | 写 | 是 | `Recurring transaction not found: ${id}` |

### 6.3 关键函数详解

#### `updateRecurring`（[recurring.ts:44-48](file:///workspace/FIRE%20APP/fire-app/src/models/recurring.ts#L44-L48)）

**签名**：`(db, id, updates: Partial<RecurringTransaction>) => void`

**业务规则**：
1. 先查询当前记录，不存在则抛 `Recurring transaction not found: ${id}`
2. 用 spread 合并：`{ ...current, ...updates, sync_version: current.sync_version + 1, updated_at: nowMs() }`
3. UPDATE 语句**仅更新 5 个字段**：`next_due_date`、`last_generated_date`、`is_active`、`sync_version`、`updated_at`

**设计动机（关键）**：虽然接受 `Partial<RecurringTransaction>`（任意字段可传入），但 UPDATE 语句**锁定**只能修改这 5 个字段。这是有意为之——service 层（`recurring-service.ts` 的 `processRecurringTransactions`）只用此函数推进到期日和停用模板，**不允许修改 amount / frequency / account_id 等核心字段**。若用户要修改模板内容，应软删除旧模板并创建新模板，避免历史生成交易与当前模板不一致。

**关联表**：`recurring_transactions`

---

## 7. scenario.ts

源码：[scenario.ts](file:///workspace/FIRE%20APP/fire-app/src/models/scenario.ts)

**职责**：FIRE 场景 CRUD（多场景支持保守/标准/激进对比）

**依赖**：`DatabaseType`、`uuidv4`、`nowMs`、`FireScenario` 接口

### 7.1 输入接口

#### `CreateScenarioInput`

| 字段 | 类型 | 可选 | 默认值 | 说明 |
|------|------|------|--------|------|
| user_id | string | 否 | — | 所属用户 ID |
| name | string | 否 | — | 场景名称（如"保守"、"标准"、"激进"） |
| description | string \| null | ✓ | null | 场景描述 |
| current_age | number | 否 | — | 当前年龄 |
| retirement_age | number | 否 | — | 退休年龄（CHECK: > current_age） |
| current_portfolio_value | number | ✓ | 0 | 当前投资组合余额（分） |
| auto_sync_assets | number | ✓ | 1 | 是否自动从 accounts 表同步可投资余额 |
| monthly_savings | number | ✓ | 0 | 月储蓄（分） |
| annual_expenses | number | 否 | — | 年支出（分） |
| expected_return_rate | number | 否 | — | 预期年化收益率（基点） |
| inflation_rate | number | ✓ | 300 | 通胀率（基点） |
| withdrawal_rate | number | 否 | — | 提款率（基点，CHECK: BETWEEN 200 AND 600） |
| retirement_years | number | ✓ | 30 | 退休后年数 |
| post_retirement_monthly_income | number | ✓ | 0 | 退休后月其他收入（分，如社保养老金） |
| is_china_market | number | ✓ | 1 | 是否中国市场 |

### 7.2 函数清单

| 函数名 | 签名 | 用途 | 读/写 | 递增 sync_version | 抛错条件 |
|--------|------|------|-------|------------------|----------|
| createScenario | (db, input) => FireScenario | 创建 FIRE 场景 | 写 | 否（初始 0） | — |
| getScenario | (db, id) => FireScenario \| null | 查询场景（过滤软删除） | 读 | — | — |
| getScenarios | (db, userId) => FireScenario[] | 列出用户所有场景（按 updated_at DESC） | 读 | — | — |
| updateScenario | (db, id, updates) => FireScenario | 更新场景（部分字段） | 写 | 是 | `Scenario not found: ${id}` |

### 7.3 关键函数详解

#### `updateScenario`（[scenario.ts:47-53](file:///workspace/FIRE%20APP/fire-app/src/models/scenario.ts#L47-L53)）

**签名**：`(db, id, updates: Partial<FireScenario>) => FireScenario`

**业务规则**：
1. 先调用 `getScenario` 查询当前记录，不存在则抛 `Scenario not found: ${id}`
2. 用 spread 合并：`{ ...current, ...updates, id: current.id, user_id: current.user_id, sync_version: current.sync_version + 1, updated_at: nowMs() }`
3. **锁定 `id` 与 `user_id` 不可改**（即使 `updates` 中传入也会被 `current.id` / `current.user_id` 覆盖）
4. 全字段 UPDATE（17 个业务字段 + sync_version + updated_at）

**与 `updateRecurring` 的对比**：

| 维度 | updateRecurring | updateScenario |
|------|-----------------|----------------|
| 接受类型 | `Partial<RecurringTransaction>` | `Partial<FireScenario>` |
| UPDATE 范围 | 仅 5 字段（next_due_date / last_generated_date / is_active / sync_version / updated_at） | 全字段（除 id / user_id） |
| 设计意图 | 锁定核心字段，service 仅推进到期日 | 允许用户编辑场景参数 |
| 返回值 | void | FireScenario（更新后对象） |

**关联表**：`fire_scenarios`

---

## 8. snapshot.ts

源码：[snapshot.ts](file:///workspace/FIRE%20APP/fire-app/src/models/snapshot.ts)

**职责**：净资产快照查询与插入（**无 update 函数**）

**依赖**：`DatabaseType`、`NetWorthSnapshot` 接口

> **特别说明**：本文件**不含** update 函数，也**不含**快照生成协调逻辑。快照的"按月幂等检查 + 4 类资产聚合 + 插入"流程在 [services/snapshot-service.ts](file:///workspace/FIRE%20APP/fire-app/src/services/snapshot-service.ts) 的 `generateMonthlySnapshot` 中协调。本文件仅提供基础查询与插入原语。

### 8.1 函数清单

| 函数名 | 签名 | 用途 | 读/写 | 递增 sync_version | 抛错条件 |
|--------|------|------|-------|------------------|----------|
| getSnapshots | (db, userId) => NetWorthSnapshot[] | 列出用户所有快照（按 snapshot_date DESC） | 读 | — | — |
| getSnapshotByMonth | (db, userId, yearMonth) => NetWorthSnapshot \| null | 按年月查询快照（幂等检查用） | 读 | — | — |
| insertSnapshot | (db, snapshot) => void | 插入完整快照对象 | 写 | 否（初始 0，由调用方设置） | UNIQUE 约束冲突 |

### 8.2 关键函数详解

#### `getSnapshots`（[snapshot.ts:4-6](file:///workspace/FIRE%20APP/fire-app/src/models/snapshot.ts#L4-L6)）

**SQL**：`SELECT * FROM net_worth_snapshots WHERE user_id = ? AND deleted_flag = 0 ORDER BY snapshot_date DESC`

**用途**：返回用户历史快照时间序列（最新在前），供前端绘制净资产趋势图。

#### `getSnapshotByMonth`（[snapshot.ts:8-11](file:///workspace/FIRE%20APP/fire-app/src/models/snapshot.ts#L8-L11)）

**SQL**：`SELECT * FROM net_worth_snapshots WHERE user_id = ? AND snapshot_year_month = ? AND deleted_flag = 0`

**用途**：幂等检查——`snapshot-service.ts` 的 `generateMonthlySnapshot` 先调用此函数，若返回非 null 则跳过本月生成（避免重复）。

**参数 `yearMonth`**：格式 "YYYY-MM"（由 `utils/time.ts` 的 `toYearMonth` 生成）。

#### `insertSnapshot`（[snapshot.ts:13-15](file:///workspace/FIRE%20APP/fire-app/src/models/snapshot.ts#L13-L15)）

**签名**：`(db, snapshot: NetWorthSnapshot) => void`

**行为**：直接插入传入的完整 `NetWorthSnapshot` 对象（含 12 个字段）。`sync_version` 与 `updated_at` 由调用方（`snapshot-service.ts`）在构造对象时设置，本函数不修改。

**潜在错误**：若违反 `UNIQUE(user_id, snapshot_year_month)` 约束（同月重复插入），SQLite 抛约束错误。`snapshot-service.ts` 通过 `getSnapshotByMonth` 预检查规避此情况。

**关联表**：`net_worth_snapshots` → `users`（外键 user_id）

---

## 9. 跨模块要点速查

### 9.1 写操作与 sync_version 关系

| 函数 | 递增 sync_version | 原因 |
|------|------------------|------|
| createUser / createAccount / createCategory / createRecurring / createScenario / seedCategories | 否（初始 0） | 新建记录，无前序版本 |
| updateUser / softDeleteAccount / updateRecurring / updateScenario | 是 | 用户主动修改，需同步 |
| updateAccountBalance | **否** | 余额由交易驱动，非用户编辑 |
| insertSnapshot | 否（由调用方设置） | 快照是系统生成，非用户编辑 |

### 9.2 软删除过滤策略

| 函数 | 过滤 deleted_flag | 用途 |
|------|------------------|------|
| 大多数 get 函数（getUser / getAccount / getTransaction 等） | 是（= 0） | 业务查询仅看活跃记录 |
| getTransactionById | **否** | 历史回溯与同步层使用 |
| softDeleteAccount / updateRecurring / updateScenario（内部查询） | **否** | 操作前需查到记录（即使已软删除？实际未软删除才操作，但 SQL 不加过滤） |

### 9.3 与 services 层的分工

| 业务场景 | model 层 | service 层 |
|----------|----------|-----------|
| 交易创建/编辑/删除 | transaction.ts 仅查询 | transaction-service.ts 事务内联动账户余额 |
| 经常性模板推进到期日 | recurring.ts 的 updateRecurring（仅 5 字段） | recurring-service.ts 的 processRecurringTransactions 调度循环 |
| 月度快照生成 | snapshot.ts 的 getSnapshotByMonth + insertSnapshot | snapshot-service.ts 的 generateMonthlySnapshot 协调幂等与聚合 |
| FIRE 投影计算 | （无对应 model） | fire-calc.ts 纯计算（仅读 accounts 表） |
