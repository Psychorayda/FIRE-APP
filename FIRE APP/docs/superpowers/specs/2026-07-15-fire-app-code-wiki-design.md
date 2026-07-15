# FIRE APP — Code Wiki 设计文档

> **版本**: 1.0
> **日期**: 2026-07-15
> **状态**: 待 spec review
> **范围**: 为 FIRE APP 仓库生成结构化、完整的 Code Wiki 文档
> **输出位置**: `/workspace/FIRE APP/docs/wiki/`

---

## 1. 设计目标

### 1.1 问题陈述

FIRE APP 仓库目前有完整的代码实现（数据层 7 张表 + 4 个服务引擎 + 3 个工具模块 + 13 个测试文件，其中 12 单元 + 1 集成）和 9 份设计/规划文档（6 spec + 3 plan），但缺少**面向代码本身**的统一文档：

- 设计文档聚焦"应该怎么设计"，不描述"代码实际是什么样"
- 新人（或几个月后的自己）想要快速定位"某个函数在哪、为什么这样写、被谁调用、有哪些测试覆盖"时没有入口
- 跨文档的术语、约定（金额=分、利率=基点、LWW 同步）没有集中说明

### 1.2 目标

构建一份**代码结构镜像**的 Wiki，作为代码的索引与导航层，具备：

1. **代码完整性**：覆盖 `fire-app/src/` 下所有 `.ts` 文件
2. **可导航性**：从主页 2 次点击内到达任意源文件描述
3. **可跳转性**：源码引用全部使用 `file:///` 可点击链接
4. **设计文档衔接**：通过专门的索引文件导航到 9 份设计/规划文档
5. **跨切关注点集中**：金额/基点/同步/软删除等约定在主页速查

### 1.3 非目标

Wiki **不**承担以下职责：

- 设计文档的完整复述（只导航）
- 前端代码描述（尚未实现，由设计文档索引导航）
- 部署/运维/用户使用手册
- 知识库 `fire-knowledge-schema.yaml` 的内容详述
- 第三方库（better-sqlite3、uuid、vitest）的 API 文档

---

## 2. 设计决策摘要

| 维度 | 决策 | 备选 |
|------|------|------|
| 覆盖范围 | 全栈视图（代码 + 设计 + 规划） | 仅代码层 / 代码 + 设计导航 |
| 详略程度 | 详细型（职责 + 函数签名 + 调用关系 + 设计动机 + 表/文档关联） | 概览型 / 参考手册型 |
| 目标读者 | 混合（未来的自己 + 新贡献者） | 仅自己 / 仅新人 |
| 文件结构 | 主页 + 模块子文件（代码结构镜像） | 业务主题驱动 / 双轴混合 |
| 语言 | 中文为主（标识符/SQL/类型名保留英文） | 英文为主 / 中英双语 |
| 存放位置 | `docs/wiki/` | `docs/superpowers/wiki/` / 仓库根 |
| 可选增强 | Mermaid 图 + 代码-测试映射表 + Schema 详解 + 源码链接（全选） | 部分选择 |

---

## 3. 总体架构

### 3.1 文件清单

Wiki 输出到 `/workspace/FIRE APP/docs/wiki/`，共 9 个文件：

| 文件 | 角色 | 预估篇幅 |
|------|------|----------|
| `CODE_WIKI.md` | 主页：项目总览 + 4 层架构图 + Wiki 索引 + 全局约定速查 + 端到端工作流 Mermaid | ~250 行 |
| `01-overview.md` | 项目目标、技术栈、4 层架构详解、与知识库 v5.0 的对齐关系 | ~200 行 |
| `02-database.md` | `connection.ts` + `schema.ts`；7 张表 DDL 逐表详解 + ER 图 Mermaid | ~450 行 |
| `03-types.md` | `types/index.ts`：5 个枚举别名 + 7 个实体接口字段表 | ~250 行 |
| `04-models.md` | 7 个 model 文件（user/account/category/transaction/recurring/scenario/snapshot） | ~400 行 |
| `05-services.md` | 4 个 service 文件（fire-calc/transaction-service/recurring-service/snapshot-service） | ~500 行 |
| `06-utils.md` | `money.ts` / `sync.ts` / `time.ts`；约定与陷阱 | ~200 行 |
| `07-tests.md` | 13 个测试文件（12 单元 + 1 集成）+ 代码-测试映射表 | ~250 行 |
| `08-design-index.md` | 6 spec + 3 plan 的导航与摘要 | ~300 行 |

**总预估**：~2800 行，分布在 9 个文件中。

### 3.2 主页 CODE_WIKI.md 结构

1. 项目一句话定位
2. 快速导航（按"我想了解 X"组织的链接表）
3. 全局约定速查表（金额=分、利率=基点、软删除、LWW、UUID 主键、UTC 时间戳）
4. 4 层架构 Mermaid `flowchart` 图
5. 端到端工作流 Mermaid `sequenceDiagram`（建账→记账→快照→FIRE 投影）
6. 文档约定（如何更新 Wiki、源码链接格式、贡献指南）

### 3.3 命名约定

- Wiki 文件名：`CODE_WIKI.md`（主页，全大写下划线）+ `NN-slug.md`（子文件，数字前缀保证排序）
- 子文件编号 `01-08` 反映从基础设施（database）到外延（design-index）的阅读顺序
- 编号留空隙便于未来插入（如 `02-database.md` 与 `03-types.md` 之间可插入 `02.5-xxx.md`）

---

## 4. 各文件内容设计

### 4.1 `01-overview.md` — 项目概览

**章节**：
1. 项目定位（FIRE 计算应用，本地优先 + 加密同步）
2. 技术栈（TypeScript 5.5 / better-sqlite3 11 / uuid 10 / vitest 2 / ESM 模块）
3. 4 层架构详解（用户层 / 财务追踪层 / 快照层 / FIRE 投影层）
4. 与知识库 `fire-knowledge-schema.yaml` v5.0 的对齐关系（账户分类、FIRE 概念映射）
5. 仓库目录结构图（含 `fire-app/src/`、`tests/`、`docs/superpowers/`）
6. Mermaid `flowchart` 展示模块依赖关系

### 4.2 `02-database.md` — 数据库层

**章节**：
1. **连接管理**（[connection.ts](file:///workspace/FIRE%20APP/fire-app/src/db/connection.ts)）
   - `createDatabase(path)` / `closeDatabase(db)` 签名与参数
   - WAL 模式策略（文件库启用、内存库静默忽略）
   - 外键约束启用（`PRAGMA foreign_keys = ON`）
2. **Schema 初始化**（[schema.ts](file:///workspace/FIRE%20APP/fire-app/src/db/schema.ts)）
   - `TABLE_NAMES` 常量（7 张表名）
   - `initSchema(db)` 执行流程（遍历 DDL 数组）
3. **7 张表逐表详解**（按依赖顺序）
   - users（无外键）
   - accounts → users
   - categories → users + self-reference
   - recurring_transactions → users + accounts + categories
   - transactions → users + accounts + categories + recurring_transactions（前向引用）
   - net_worth_snapshots → users（含 UNIQUE 约束）
   - fire_scenarios → users（含 CHECK 约束：retirement_age > current_age、withdrawal_rate BETWEEN 200 AND 600）

   每张表包含：
   - 用途（1 句话）
   - 字段表（名称 / 类型 / NOT NULL / 默认值 / CHECK / 说明）
   - 外键关系
   - 索引（如有）
   - 设计动机（如金额为何用 INTEGER）

4. **ER 图**（Mermaid `erDiagram`，展示 7 张表的外键关系）
5. **索引清单表**（9 个索引：4 个 transactions + 1 个 accounts + 1 个 categories + 1 个 recurring + 1 个 snapshots + 1 个 fire_scenarios）

### 4.3 `03-types.md` — 类型定义

**章节**：
1. 概述（types/index.ts 的角色：纯类型导出，无运行时代码）
2. **5 个枚举别名**（type alias）
   - `AssetClass`：4 个值
   - `AccountType`：11 个值
   - `TransactionType`：4 个值
   - `CategoryType`：2 个值
   - `Frequency`：4 个值

   每个枚举：值列表 + 与数据库 CHECK 约束的对应 + 使用场景
3. **7 个实体接口**
   - `User` / `Account` / `Transaction` / `Category` / `RecurringTransaction` / `NetWorthSnapshot` / `FireScenario`

   每个接口：字段表（名称 / 类型 / 可空 / 与表列的对应 / 说明）
4. 接口与数据库行的映射约定（snake_case 一致，INTEGER 映射 number）

### 4.4 `04-models.md` — 数据模型层

**覆盖文件**：
- [user.ts](file:///workspace/FIRE%20APP/fire-app/src/models/user.ts)
- [account.ts](file:///workspace/FIRE%20APP/fire-app/src/models/account.ts)
- [category.ts](file:///workspace/FIRE%20APP/fire-app/src/models/category.ts)
- [transaction.ts](file:///workspace/FIRE%20APP/fire-app/src/models/transaction.ts)
- [recurring.ts](file:///workspace/FIRE%20APP/fire-app/src/models/recurring.ts)
- [scenario.ts](file:///workspace/FIRE%20APP/fire-app/src/models/scenario.ts)
- [snapshot.ts](file:///workspace/FIRE%20APP/fire-app/src/models/snapshot.ts)

**每个 model 文件统一格式**：
1. **职责**：一句话说明
2. **依赖**：导入的 db / types / utils
3. **输入接口**（如有 `CreateXxxInput` / `UpdateXxxInput`）：字段表
4. **函数清单表**：

   | 函数名 | 签名 | 用途 | 读/写 | 递增 sync_version | 抛错条件 |
   |-------|------|------|-------|------------------|----------|

5. **关键函数详解**（仅对非平凡函数）：
   - 输入字段说明
   - 业务规则
   - 错误抛出条件
   - 关联的表与索引
   - 可点击源码链接（含行号锚点）

**特别说明**：
- `category.ts` 的 `seedCategories` 函数：18 个种子分类（11 支出 + 7 收入）的来源、5 个有 `linked_fire_concept` 的分类清单
- `account.ts` 的 `softDeleteAccount`：检查关联交易的业务规则
- `transaction.ts`：仅含 2 个查询函数（`getTransaction` / `getTransactionById`），创建/编辑/删除在 `services/transaction-service.ts`
- `recurring.ts` / `scenario.ts` 的 `updateRecurring` / `updateScenario`：用 `Partial<T>` 接受部分字段
- `snapshot.ts`：仅查询和插入，更新由 `services/snapshot-service.ts` 协调

### 4.5 `05-services.md` — 业务服务层

**覆盖文件**：
- [fire-calc.ts](file:///workspace/FIRE%20APP/fire-app/src/services/fire-calc.ts)
- [transaction-service.ts](file:///workspace/FIRE%20APP/fire-app/src/services/transaction-service.ts)
- [recurring-service.ts](file:///workspace/FIRE%20APP/fire-app/src/services/recurring-service.ts)
- [snapshot-service.ts](file:///workspace/FIRE%20APP/fire-app/src/services/snapshot-service.ts)

**4.5.1 fire-calc.ts — FIRE 计算引擎**

章节：
1. 概述：纯计算引擎，无数据库写入，仅读 `accounts` 表（当 `auto_sync_assets=1`）
2. 输出接口：`MonthlyProjectionPoint` / `ProjectionResult` 字段表
3. 5 个核心函数：
   - `calculateFireNumber(annualExpenses, withdrawalRateBp)` — 公式：`annualExpenses × (10000 / withdrawalRateBp)`，对应 4% 规则
   - `calculateAdjustedFireNumber(...)` — 扣减退休后其他收入的推导
   - `calculateAccumulation(pv, pmt, annualReturnBp, months)` — FV 公式
   - `calculateProgress(currentValue, fireNumber)` — 进度百分比
   - `runProjection(db, scenario)` — 主函数
4. **`runProjection` 算法详解**：
   - 第一阶段：积累阶段（积累月数 = (retirement_age - current_age) × 12）
   - 第二阶段：提款阶段（retirement_years × 12），含通胀递增提款
   - Mermaid `flowchart` 展示数据流
5. 数学公式与代码对应表

**4.5.2 transaction-service.ts — 交易服务**

章节：
1. 概述：交易创建/编辑/删除，**强事务保证**交易与账户余额的原子性
2. 输入接口：`CreateTransactionInput` / `EditTransactionInput`
3. 内部函数 `balanceDelta(type, amount)`：4 种交易类型的余额影响表
4. 3 个公开函数：`createTransaction` / `editTransaction` / `deleteTransaction`
5. **事务原子性说明**：
   - Mermaid `sequenceDiagram` 展示"创建交易 → 更新账户余额"的 `db.transaction(() => {...})` 调用
   - 转账交易的双重余额更新逻辑
   - 编辑交易的三步流程（反向旧 → 正向新 → 更新记录）
6. 业务规则：转账必须有 `to_account_id`、不能转账给自己、`amount > 0`

**4.5.3 recurring-service.ts — 经常性交易引擎**

章节：
1. 概述：扫描活跃模板，自动生成到期交易
2. 内部函数 `advanceDueDate(currentDue, frequency, interval)`：4 种频率的计算方式
3. `processRecurringTransactions(db, userId)` 主循环逻辑：
   - while 循环补单（`next_due_date <= currentTime`）
   - `end_date` 终止条件
   - 自动停用（`is_active = 0`）
   - 更新 `last_generated_date` 和 `next_due_date`
4. Mermaid `flowchart` 展示循环逻辑

**4.5.4 snapshot-service.ts — 快照服务**

章节：
1. 概述：按月生成净资产快照，幂等
2. 内部函数 `summarizeByAssetClass`：按 4 类资产分组求和
3. `generateMonthlySnapshot(db, userId)`：
   - 幂等性保证：同月已存在则返回 null（依赖 UNIQUE 约束）
   - net_worth 计算公式：`total_liquid + total_invested + total_use_asset + total_liability`（负债为负数）
4. `getSnapshots(db, userId)`：按时间倒序查询

### 4.6 `06-utils.md` — 工具模块

**覆盖文件**：
- [money.ts](file:///workspace/FIRE%20APP/fire-app/src/utils/money.ts)
- [sync.ts](file:///workspace/FIRE%20APP/fire-app/src/utils/sync.ts)
- [time.ts](file:///workspace/FIRE%20APP/fire-app/src/utils/time.ts)

**4.6.1 money.ts — 金额与利率转换**

- `yuanToCents(yuan)` — 两阶段取整规避 IEEE 754 误差（先到毫再到分）
- `centsToYuan(cents)` — UI 展示用
- `basisPointsToDecimal(bp)` — 100 基点 = 1%，所以 350 → 0.035
- 陷阱说明：浮点误差案例（1.005 × 100 = 100.4999...）

**4.6.2 sync.ts — 同步元数据**

- `SyncMeta` 接口字段表
- `createSyncMeta()` / `bumpSyncVersion(current)` / `shouldRemoteWin(local, remote)`
- LWW 冲突解决策略说明：`remote.updated_at >= local.updated_at` 时远程胜

**4.6.3 time.ts — 时间工具**

- `nowMs()` — Unix 毫秒时间戳
- `toYearMonth(timestampMs)` — "YYYY-MM" 格式（用 UTC）
- `addMonths(timestampMs, months)` — 月份加法，处理月末溢出（1月31日 + 1月 → 2月28/29日）
- `monthsBetween(startMs, endMs)` — 月数差
- UTC vs 本地时间的约定说明

### 4.7 `07-tests.md` — 测试套件

**章节**：
1. 测试框架与配置（vitest 2.0、`vitest.config.ts` 配置：globals、node 环境、单线程）
2. 测试目录结构（按 `db/` / `models/` / `services/` / `utils/` / `integration/` 组织）
3. **代码-测试映射表**：

   | 源文件 | 测试文件 | describe 数 | it 数 | 覆盖范围 |
   |--------|----------|------------|-------|----------|
   | `src/db/connection.ts` | `tests/db/connection.test.ts` | ? | ? | ? |
   | `src/db/schema.ts` | `tests/db/schema.test.ts` | ? | ? | ? |
   | `src/models/account.ts` | `tests/models/account.test.ts` | ? | ? | ? |
   | `src/models/category.ts` | `tests/models/category.test.ts` | ? | ? | ? |
   | `src/models/user.ts` | `tests/models/user.test.ts` | ? | ? | ? |
   | `src/services/fire-calc.ts` | `tests/services/fire-calc.test.ts` | ? | ? | ? |
   | `src/services/recurring-service.ts` | `tests/services/recurring-service.test.ts` | ? | ? | ? |
   | `src/services/snapshot-service.ts` | `tests/services/snapshot-service.test.ts` | ? | ? | ? |
   | `src/services/transaction-service.ts` | `tests/services/transaction-service.test.ts` | ? | ? | ? |
   | `src/utils/money.ts` | `tests/utils/money.test.ts` | ? | ? | ? |
   | `src/utils/sync.ts` | `tests/utils/sync.test.ts` | ? | ? | ? |
   | `src/utils/time.ts` | `tests/utils/time.test.ts` | ? | ? | ? |
   | —（端到端） | `tests/integration/workflow.test.ts` | ? | ? | 建账→记账→快照→FIRE |

   表中 `?` 由实现阶段扫描每个测试文件的 `describe/it` 数填入实际值。

4. 测试约定：
   - 内存数据库（`:memory:`）
   - `beforeEach` 建表 + 建用户 + seed 分类
   - `afterEach` 关闭连接
5. 运行命令：`npm test` / `npm run test:watch`

### 4.8 `08-design-index.md` — 设计文档导航

**章节**：
1. 概述：本文件是设计/规划文档的索引，**Wiki 以代码为权威**，本索引仅作导航
2. **设计文档清单（6 spec）**：

   每份统一格式：
   ```
   ### [文档标题]
   - 路径：specs/YYYY-MM-DD-xxx.md
   - 日期 / 版本 / 状态
   - 范围：1 句话
   - 关键贡献：3-5 个 bullet
   - 与代码的对应关系（哪些代码实现了文档中的什么）
   - 已知问题（如有，引用 review 文档）
   ```

   覆盖：
   - `2026-07-12-fire-app-user-data-model-design.md`（数据模型，~950 行）
   - `2026-07-15-fire-app-frontend-architecture-design.md`（前端架构，1316 行）
   - `2026-07-15-fire-app-ui-ux-design.md`（UI/UX，1511 行）
   - `2026-07-15-fire-app-initialization-design.md`（初始化，1464 行）
   - `2026-07-15-fire-app-missing-design-documents-plan.md`（缺失文档规划，~250 行）
   - `2026-07-15-fire-app-design-documents-review.md`（跨文档审查）

3. **实现计划清单（3 plan）**：

   每份统一格式（简化版）：
   ```
   ### [文档标题]
   - 路径：plans/YYYY-MM-DD-xxx.md
   - 日期 / 状态
   - 范围：1 句话
   - 关键任务：3-5 个 bullet
   ```

   覆盖：
   - `2026-07-13-fire-app-data-model-implementation.md`
   - `2026-07-15-fire-app-desktop-mvp-milestone1.md`
   - `2026-07-15-fire-app-stage1-design-documents.md`

4. **已知问题清单**（来自 review 文档）：
   - 种子分类数量错误：missing-design-documents-plan.md 第 155 行写"17 个"，正确为 18 个
   - AccountType 枚举数量错误：user-data-model-design.md 第 925 行写"10 种"，正确为 11 种
   - 修正指引：以代码 `category.ts` SEED_CATEGORIES 数组 和 `types/index.ts` AccountType 类型为权威

5. **尚未实现的规划**：
   - 前端代码（IPC 通道、React 组件、状态管理）— 在前端架构与 UI/UX spec 中设计，代码未落地
   - 加密同步层 — 在数据模型 spec 中提及，未实现
   - 这些在 02-06 Wiki 文件中**不**描述，仅在此处标注"尚未实现"

---

## 5. 横切决策

### 5.1 源码链接格式（统一）

所有引用源码的位置使用 `file:///` 协议的可点击链接：

```markdown
- 见 [account.ts:103-119](file:///workspace/FIRE%20APP/fire-app/src/models/account.ts#L103-L119)
- 函数定义在 [fire-calc.ts:43](file:///workspace/FIRE%20APP/fire-app/src/services/fire-calc.ts#L43)
```

规则：
- 路径含空格时用 `%20` 编码
- 行号锚点用 `#L起-止` 或 `#L单行` 格式（VSCode/GitHub 兼容）
- 链接文本用 basename，不用反引号（反引号会破坏渲染）
- 函数级引用尽量带行号锚点；文件级引用可不带

### 5.2 Mermaid 图使用规范

按图类型选择合适语法：

| 图类型 | 用途 | 出现位置 |
|--------|------|----------|
| `flowchart` | 4 层架构图、模块依赖、循环逻辑 | 主页、01-overview、05-services |
| `erDiagram` | 7 张表 ER 关系 | 02-database |
| `sequenceDiagram` | 端到端工作流、事务原子性 | 主页、05-services |

规则：
- 所有 Mermaid 代码块标注 `mermaid` 语言
- 关键图同时提供 1-2 句文字描述，Mermaid 仅作增强（防渲染环境缺失）
- Mermaid 节点文本使用中文，标识符用英文

### 5.3 文档与代码不一致的处理策略

**核心原则：以代码为权威**。Wiki 描述代码实际行为。

具体处理：
1. Wiki 描述代码现状（如 `seedCategories` 实际生成 18 条，不写文档中的"17 条"）
2. 设计文档的已知错误集中放在 `08-design-index.md` 的"已知问题"小节，引用 review 文档
3. 不重复设计文档内容：Wiki 只引用并导航到设计文档，不复述其完整内容
4. 未来规划的代码（前端、IPC、加密层）在 `08-design-index.md` 中标注"尚未实现"，不在 02-06 中描述

### 5.4 术语统一表

Wiki 中使用的术语统一为：

| Wiki 术语 | 代码标识符 | 说明 |
|-----------|-----------|------|
| 金额（分） | `current_balance` / `amount` | INTEGER，1 元 = 100 分 |
| 基点 | `withdrawal_rate` / `expected_return_rate` / `inflation_rate` | INTEGER，350 = 3.5% |
| 软删除 | `deleted_flag = 1` | 不物理删除，同步传播 |
| 同步版本 | `sync_version` | 每次本地修改 +1 |
| LWW | `shouldRemoteWin` | Last-Write-Wins，按 `updated_at` 比较 |
| 资产分类 | `AssetClass` | liquid / invested / use_asset / liability |
| 可投资余额 | `getInvestableBalance` | liquid + invested |
| 净资产 | `getNetWorth` / `net_worth` | 所有账户余额之和（负债为负） |
| FIRE 数 | `fire_number` | `annualExpenses × (10000 / withdrawalRateBp)` |
| 调整后 FIRE 数 | `adjusted_fire_number` | 扣减退休后其他收入的现值 |

### 5.5 文件顶部元信息

每个 Wiki 文件顶部统一格式：

```markdown
# [文件标题]

> **最后更新**: 2026-07-15
> **对应代码**: `fire-app/src/xxx/`
> **导航**: [← 返回主页](CODE_WIKI.md) | [上一节](0N-xxx.md) | [下一节](0N+1-xxx.md)
```

---

## 6. 维护与验收

### 6.1 维护策略

**Wiki 与代码同步规则**：
- 修改源码时，更新对应模块文件的相关函数描述
- 新增源文件时，在对应模块文件的"函数清单表"中追加一行
- 新增/修改测试时，更新 `07-tests.md` 的映射表
- 新增 spec/plan 文档时，在 `08-design-index.md` 追加条目
- 主页 `CODE_WIKI.md` 仅在重大架构变化时更新

**版本控制**：
- Wiki 文件随代码一起提交到 git
- 无独立版本号
- 每份文件顶部标注"最后更新: YYYY-MM-DD"

### 6.2 不在 Wiki 范围内

为避免范围蔓延，Wiki 不包含：
1. 设计文档的完整复述（只导航）
2. 前端代码（尚未实现，由 08-design-index 导航到对应 spec）
3. 部署/运维手册
4. 用户使用手册
5. 知识库 `fire-knowledge-schema.yaml` 的内容（仅在 01-overview 提及对齐关系）
6. 第三方库的 API 文档（better-sqlite3、uuid、vitest 用法）

### 6.3 验收标准

Wiki 完成后应满足：

1. **完整性**：仓库 `fire-app/src/` 下所有 `.ts` 文件都被至少一个 Wiki 文件覆盖
   - `src/db/connection.ts`、`src/db/schema.ts` → 02-database
   - `src/types/index.ts` → 03-types
   - `src/models/{user,account,category,transaction,recurring,scenario,snapshot}.ts` → 04-models
   - `src/services/{fire-calc,transaction-service,recurring-service,snapshot-service}.ts` → 05-services
   - `src/utils/{money,sync,time}.ts` → 06-utils
2. **可导航性**：从主页能在 2 次点击内到达任意源文件的描述
3. **可跳转性**：所有源码引用都是可点击的 `file:///` 链接
4. **代码-测试对齐**：每个有对应测试的源文件都在 `07-tests.md` 中有映射行
5. **设计文档完整索引**：`docs/superpowers/specs/` 和 `plans/` 下所有 9 份文档都在 `08-design-index.md` 中有条目
6. **已知错误可见**：review 文档中标记的 2 个错误在 08-design-index 中可见
7. **Mermaid 图可渲染**：所有 Mermaid 代码块语法正确（GitHub/VSCode 原生支持）
8. **术语一致**：全文遵循 5.4 节的术语统一表

### 6.4 风险与缓解

| 风险 | 缓解 |
|------|------|
| 源码行号链接在代码修改后失效 | 行号锚点尽量用函数名锚定；必要时只链接到文件级 |
| 设计文档未来更新导致 08-design-index 过时 | 08 文件顶部加"⚠️ 此文件为快照，最新内容以原 spec 为准"提示 |
| Mermaid 渲染依赖环境 | 关键图同时提供文字描述，Mermaid 仅作增强 |
| Wiki 与代码漂移 | 主页加"贡献指南"小节，提醒修改代码时同步 Wiki |

---

## 7. 实施顺序建议

按依赖关系，建议实施顺序：

1. **02-database.md** — 数据库是基础，先理清 7 张表
2. **03-types.md** — 类型定义直接对应表结构
3. **06-utils.md** — 工具模块独立，最简单
4. **04-models.md** — 依赖 02/03，是 services 的基础
5. **05-services.md** — 依赖 04，是业务核心
6. **07-tests.md** — 扫描所有测试文件填表
7. **08-design-index.md** — 独立工作，扫描 specs/plans 目录
8. **01-overview.md** — 综合前面所有内容
9. **CODE_WIKI.md** — 主页最后写，确保所有链接有效

---

## 8. 决策记录

| # | 决策 | 选择 | 拒绝的备选 | 理由 |
|---|------|------|-----------|------|
| 1 | Wiki 覆盖范围 | 全栈视图（代码 + 设计 + 规划） | 仅代码层 / 代码 + 设计导航 | 用户明确选择全栈视图 |
| 2 | 详略程度 | 详细型 | 概览型 / 参考手册型 | 平衡可读性与信息量 |
| 3 | 目标读者 | 混合 | 仅自己 / 仅新人 | 兼顾回顾与协作 |
| 4 | 文件结构 | 主页 + 模块子文件（代码结构镜像） | 业务主题驱动 / 双轴混合 | 与代码目录一一对应，维护成本最低 |
| 5 | 语言 | 中文为主 | 英文为主 / 中英双语 | 与现有 spec 文档一致 |
| 6 | 存放位置 | `docs/wiki/` | `docs/superpowers/wiki/` / 仓库根 | 独立顶级目录，不干扰 superpowers 流程 |
| 7 | 可选增强 | Mermaid + 测试映射 + Schema 详解 + 源码链接（全选） | 部分选择 | 用户多选全选 |
| 8 | 文档权威性 | 代码为权威 | 设计文档为权威 | Wiki 是 Code Wiki，必须反映代码现状 |
| 9 | 设计文档错误处理 | 集中在 08-design-index 的"已知问题"小节 | 在每处引用时单独标注 | 避免分散，便于维护 |
| 10 | 源码链接路径 | 绝对路径 `file:///workspace/FIRE%20APP/...` | 相对路径 | Trae IDE 中可点击跳转 |
