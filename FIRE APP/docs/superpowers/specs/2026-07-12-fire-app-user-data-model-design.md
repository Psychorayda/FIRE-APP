# FIRE 计算APP — 用户数据模型设计文档

> **版本**: 1.0  
> **日期**: 2026-07-12  
> **状态**: 待审核  
> **知识库基础**: `fire-knowledge-schema.yaml` v5.0  
> **范围**: 用户数据模型（7张核心表），不含UI设计、API设计、计算引擎实现

---

## 1. 设计概述

### 1.1 目标

基于 `fire-knowledge-schema.yaml` v5.0 知识库，设计一个个人使用的 FIRE（Financial Independence, Retire Early）计算APP的用户数据模型，支撑以下核心功能：

- 记录个人财务流水（收入、支出、转账）
- 追踪多类账户与资产状态
- 生成净资产趋势快照
- 创建多场景 FIRE 投影（保守/标准/激进等）
- 支持本地优先 + 加密同步的跨设备使用

### 1.2 设计原则

| 原则 | 说明 |
|------|------|
| **领域分层** | 数据模型按职责分为4层：用户层、财务追踪层、快照层、FIRE投影层 |
| **YAGNI** | 只实现当前需要的功能，不过度设计 |
| **数据完整性优先** | 交易与余额通过事务强一致保证，禁止产生孤儿数据 |
| **同步友好** | 所有表统一包含同步元数据字段，支持记录级 LWW 冲突解决 |
| **FIRE知识库对齐** | 账户分类、FIRE场景参数与知识库概念直接对应 |

### 1.3 架构总览

```
┌─────────────────────────────────────────────────────┐
│                   用户层 (users)                      │
│  用户档案 + 同步根 + FIRE默认偏好                      │
├─────────────────────────────────────────────────────┤
│              财务追踪层 (Financial Tracking)           │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ accounts │  │ transactions │  │  categories   │  │
│  └──────────┘  └──────────────┘  └───────────────┘  │
│                   ┌──────────────────────┐           │
│                   │ recurring_transactions│           │
│                   └──────────────────────┘           │
├─────────────────────────────────────────────────────┤
│                快照层 (Snapshot)                       │
│              ┌─────────────────────┐                 │
│              │ net_worth_snapshots  │                 │
│              └─────────────────────┘                 │
├─────────────────────────────────────────────────────┤
│              FIRE投影层 (Projection)                  │
│              ┌─────────────────┐                     │
│              │  fire_scenarios  │                     │
│              └─────────────────┘                     │
│              (结果实时计算，不持久化)                    │
└─────────────────────────────────────────────────────┘
```

### 1.4 表清单

| # | 表名 | 层级 | 记录数预估 | 说明 |
|---|------|------|-----------|------|
| 1 | `users` | 用户层 | 1 | 用户档案、同步根、FIRE默认偏好 |
| 2 | `accounts` | 财务追踪层 | 5-20 | 账户+资产分类+内嵌余额 |
| 3 | `transactions` | 财务追踪层 | 100-10000+ | 单分录交易明细 |
| 4 | `categories` | 财务追踪层 | 15-40 | 两级收支分类 |
| 5 | `recurring_transactions` | 财务追踪层 | 5-20 | 经常性交易模板 |
| 6 | `net_worth_snapshots` | 快照层 | 12-120 | 月度净资产快照（分类明细） |
| 7 | `fire_scenarios` | FIRE投影层 | 1-5 | 多场景FIRE参数（结果实时计算） |

---

## 2. 通用约定

### 2.1 主键

所有表使用 `id` 字段作为主键，类型为 `TEXT`（UUID v4 字符串）。使用 UUID 而非自增整数的原因：

- 支持离线创建记录（本地生成ID，同步时无冲突）
- 多设备同步时无需中央ID分配
- 与同步层天然兼容

### 2.2 同步元数据

所有表（包括 `users`）统一包含以下3个同步字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `updated_at` | INTEGER (Unix timestamp ms) | 最后修改时间，用于 LWW 冲突解决 |
| `sync_version` | INTEGER | 同步版本号，每次本地修改 +1，同步时比较 |
| `deleted_flag` | INTEGER (0/1) | 软删除标志，0=活跃，1=已删除。用于同步层删除传播 |

**同步冲突解决策略**：记录级 LWW（Last-Write-Wins）。同步时按记录比较 `updated_at`，后修改的覆盖先修改的。软删除通过 `deleted_flag` 传播。

### 2.3 金额存储

**所有金额字段以"分"为单位存储为 `INTEGER`**。

- 示例：1234.56 元 → 存储为 `123456`
- UI 层展示时除以 100 转换
- 此约定贯穿所有表的所有金额字段，避免浮点误差

### 2.4 时间存储

所有日期/时间字段以 `INTEGER` 类型存储 Unix 时间戳（毫秒）。

### 2.5 软删除

所有删除操作为软删除（设置 `deleted_flag = 1`）。查询时默认过滤 `deleted_flag = 0`。

---

## 3. 表结构详细设计

### 3.1 users — 用户表

用户档案、同步根、FIRE计算默认偏好。整个数据模型中只有1条记录。

#### 字段定义

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | TEXT | PK | UUID v4 |
| `display_name` | TEXT | NOT NULL | 用户显示名称 |
| `base_currency` | TEXT | NOT NULL DEFAULT 'CNY' | 基准货币代码（ISO 4217），单一货币模式 |
| `is_china_market` | INTEGER | NOT NULL DEFAULT 1 | 是否中国市场。1=中国（默认提现率3.5%），0=全球（默认提现率4%） |
| `default_withdrawal_rate` | INTEGER | NOT NULL DEFAULT 350 | 默认提现率（基点，350=3.5%）。`is_china_market=1` 时默认350，否则400 |
| `default_expected_return` | INTEGER | NOT NULL DEFAULT 700 | 默认预期年回报率（基点，700=7%） |
| `default_inflation_rate` | INTEGER | NOT NULL DEFAULT 300 | 默认通胀率（基点，300=3%） |
| `encryption_key_hash` | TEXT | | 加密密钥哈希（用于验证主密码），同步服务器不存储密钥本身 |
| `last_sync_at` | INTEGER | | 最后成功同步时间戳 |
| `sync_version` | INTEGER | NOT NULL DEFAULT 0 | 用户表的同步版本号 |
| `updated_at` | INTEGER | NOT NULL | 最后修改时间戳 |
| `deleted_flag` | INTEGER | NOT NULL DEFAULT 0 | 软删除标志 |

#### 设计说明

- **基点存储**：`default_withdrawal_rate`、`default_expected_return`、`default_inflation_rate` 以基点（1% = 100基点）存储为整数，避免浮点数，同时保持精度。
- **中国市场标志**：对齐知识库 `china_market_adjustment` 概念。中国市场默认提现率3.5%（非4%），FIRE Number 倍数28-33x（非25x）。
- **FIRE默认偏好**：新建 `fire_scenarios` 记录时，从 `users` 表读取默认值填充，减少用户重复输入。

#### 知识库映射

| 字段 | 知识库概念 |
|------|-----------|
| `is_china_market` | `china_market_adjustment` |
| `default_withdrawal_rate` | `four_percent_rule`（4%法则，中国市场下调至3-3.5%） |
| `default_expected_return` | `investment_return`（实际回报率5-7%） |
| `default_inflation_rate` | `inflation_risk`（通胀侵蚀风险，2-3%） |

---

### 3.2 accounts — 账户表

存储用户的各类金融账户，包含资产分类和内嵌余额。

#### 字段定义

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | TEXT | PK | UUID v4 |
| `user_id` | TEXT | NOT NULL FK→users.id | 所属用户 |
| `name` | TEXT | NOT NULL | 账户名称（如"招商活期"、"沪深300定投"） |
| `asset_class` | TEXT | NOT NULL | 资产大类：`liquid` / `invested` / `use_asset` / `liability` |
| `account_type` | TEXT | NOT NULL | 账户类型枚举（见下表） |
| `current_balance` | INTEGER | NOT NULL DEFAULT 0 | 当前余额（分）。资产为正，负债为负 |
| `last_updated` | INTEGER | NOT NULL | 余额最后更新时间戳 |
| `display_order` | INTEGER | NOT NULL DEFAULT 0 | 排列顺序 |
| `note` | TEXT | | 备注 |
| `sync_version` | INTEGER | NOT NULL DEFAULT 0 | 同步版本号 |
| `updated_at` | INTEGER | NOT NULL | 最后修改时间戳 |
| `deleted_flag` | INTEGER | NOT NULL DEFAULT 0 | 软删除标志 |

#### account_type 枚举值

| asset_class | account_type | 说明 | 余额符号 | FIRE计算 |
|-------------|-------------|------|---------|---------|
| `liquid` | `checking` | 活期存款 | 正 | 计入可投资组合 |
| `liquid` | `savings` | 储蓄存款 | 正 | 计入可投资组合 |
| `liquid` | `cash` | 手头现金 | 正 | 计入可投资组合 |
| `invested` | `investment` | 券商投资账户 | 正 | 计入可投资组合 |
| `invested` | `retirement` | 退休账户（个人养老金等） | 正 | 计入可投资组合 |
| `invested` | `fund` | 基金账户 | 正 | 计入可投资组合 |
| `use_asset` | `real_estate` | 自住房产 | 正 | **不计入**FIRE Number |
| `use_asset` | `vehicle` | 车辆 | 正 | **不计入**FIRE Number |
| `liability` | `credit_card` | 信用卡欠款 | 负 | 计入总负债 |
| `liability` | `loan` | 消费贷/学生贷款 | 负 | 计入总负债 |
| `liability` | `mortgage` | 房贷 | 负 | 计入总负债 |

#### 设计说明

- **余额符号约定**：资产账户余额 ≥ 0，负债账户余额 ≤ 0。净资产 = `SUM(current_balance)`，一条SQL即可计算。
- **内嵌余额**：`current_balance` 随交易写入实时更新（事务强一致），无需从交易明细汇总。
- **FIRE计算关联**：可投资组合 = `SUM(current_balance) WHERE asset_class IN ('liquid', 'invested')`。自住房产（`use_asset`）不计入FIRE Number，对齐知识库 `fire_number` 概念。
- **删除约束**：账户有关联交易时禁止删除（应用层校验）。

#### 知识库映射

| 字段/概念 | 知识库概念 |
|----------|-----------|
| `asset_class = invested` | `fire_number`（可投资资产） |
| `asset_class = use_asset` | 自住房产不计入FIRE Number |
| `account_type = retirement` | `tax_planning`、`roth_conversion_ladder`（退休账户） |
| `account_type = mortgage` | `debt_management`（房贷管理） |

---

### 3.3 transactions — 交易表

单分录交易明细，记录每一笔收入、支出、转账和初始余额。

#### 字段定义

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | TEXT | PK | UUID v4 |
| `user_id` | TEXT | NOT NULL FK→users.id | 所属用户 |
| `account_id` | TEXT | NOT NULL FK→accounts.id | 关联账户（源账户） |
| `to_account_id` | TEXT | FK→accounts.id | 转账目标账户（仅 transaction_type='transfer' 时使用） |
| `category_id` | TEXT | FK→categories.id | 交易分类（transfer 和 initial_balance 类型可为空） |
| `recurring_id` | TEXT | FK→recurring_transactions.id | 来源经常性交易模板（可为空，表示手动录入） |
| `transaction_type` | TEXT | NOT NULL | 交易类型：`income` / `expense` / `transfer` / `initial_balance` |
| `amount` | INTEGER | NOT NULL | 交易金额（分，始终为正数） |
| `transaction_date` | INTEGER | NOT NULL | 交易日期时间戳 |
| `description` | TEXT | | 交易描述/备注 |
| `sync_version` | INTEGER | NOT NULL DEFAULT 0 | 同步版本号 |
| `updated_at` | INTEGER | NOT NULL | 最后修改时间戳 |
| `deleted_flag` | INTEGER | NOT NULL DEFAULT 0 | 软删除标志 |

#### 交易类型语义

| transaction_type | account_id 余额影响 | to_account_id 余额影响 | 说明 |
|-----------------|--------------------|-----------------------|------|
| `income` | +amount | — | 收入，增加账户余额 |
| `expense` | -amount | — | 支出，减少账户余额 |
| `transfer` | -amount | +amount | 转账，源账户减、目标账户加 |
| `initial_balance` | +amount | — | 账户初始余额，创建账户时自动生成 |

#### 设计说明

- **金额始终为正**：`amount` 字段始终存储正数，方向由 `transaction_type` 决定。避免符号歧义。
- **转账单记录**：转账用一条记录表示，同时更新两个账户余额（事务中执行）。不拆分为两条交易。
- **初始余额交易**：创建账户时自动生成一笔 `initial_balance` 类型交易。收支统计时排除此类型。
- **经常性交易关联**：`recurring_id` 记录交易是否由模板自动生成，便于追溯和批量管理。
- **编辑/删除余额回滚**：
  - 编辑交易：事务内先按原交易反向调整余额，再按新交易正向调整余额
  - 删除交易：事务内按原交易反向调整余额
  - 反向调整规则：`income` 反向 = 余额减；`expense` 反向 = 余额加；`transfer` 反向 = 源加目标减

#### 索引建议

| 索引 | 字段 | 用途 |
|------|------|------|
| `idx_tx_user_date` | (user_id, transaction_date DESC) | 按日期查询用户交易 |
| `idx_tx_account` | (account_id, transaction_date DESC) | 查询账户交易历史 |
| `idx_tx_category` | (category_id) | 按分类统计 |
| `idx_tx_recurring` | (recurring_id) | 查询模板生成的交易 |

---

### 3.4 categories — 分类表

两级收支分类体系，内置标准分类 + 用户自定义。

#### 字段定义

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | TEXT | PK | UUID v4 |
| `user_id` | TEXT | NOT NULL FK→users.id | 所属用户 |
| `parent_id` | TEXT | FK→categories.id | 父分类ID（顶级分类为NULL） |
| `name` | TEXT | NOT NULL | 分类名称 |
| `type` | TEXT | NOT NULL | 分类方向：`income` / `expense` |
| `icon` | TEXT | | 图标标识符 |
| `color` | TEXT | | 显示颜色（hex格式） |
| `linked_fire_concept` | TEXT | | 关联的FIRE知识库概念ID（如 `insurance_planning`） |
| `display_order` | INTEGER | NOT NULL DEFAULT 0 | 排列顺序 |
| `is_system` | INTEGER | NOT NULL DEFAULT 0 | 是否系统内置分类（1=内置，不可删除；0=用户自定义） |
| `sync_version` | INTEGER | NOT NULL DEFAULT 0 | 同步版本号 |
| `updated_at` | INTEGER | NOT NULL | 最后修改时间戳 |
| `deleted_flag` | INTEGER | NOT NULL DEFAULT 0 | 软删除标志 |

#### 内置标准分类

首次使用时自动创建以下标准分类：

**支出分类 (type = 'expense')**：

| 分类名称 | linked_fire_concept | 说明 |
|---------|---------------------|------|
| 住房 | — | 房租/房贷/物业/水电燃气 |
| 食品 | — | 日用品/外出就餐 |
| 交通 | — | 油费/公共交通/车辆维护 |
| 保险 | `insurance_planning` | 健康险/车险/寿险/意外险 |
| 医疗 | `china_medical_insurance` | 门诊/药品/牙科 |
| 娱乐 | — | 流媒体/电影/爱好 |
| 购物 | — | 服装/电子产品 |
| 个人护理 | — | 理发/健身房 |
| 教育 | — | 学费/书籍/课程 |
| 债务还款 | `debt_management` | 信用卡还款/贷款还款 |
| 其他支出 | — | 未分类支出 |

**收入分类 (type = 'income')**：

| 分类名称 | linked_fire_concept | 说明 |
|---------|---------------------|------|
| 工资薪金 | — | 税后工资 |
| 自由职业 | — | 兼职/咨询/外包 |
| 投资收益 | — | 股息/利息/资本利得 |
| 租金收入 | `retirement_income_diversification` | 出租房产/房间 |
| 退税 | — | 个税退税 |
| 社保养老金 | `china_pension_system` | 退休后领取的养老金 |
| 其他收入 | — | 未分类收入 |

#### 设计说明

- **两级层级**：通过 `parent_id` 实现父子两级。不支持更多层级（YAGNI）。
- **系统内置分类**：`is_system = 1` 的分类不可删除，但可编辑名称。用户可新增子分类或全新顶级分类。
- **FIRE概念关联**：`linked_fire_concept` 字段将分类与知识库概念ID关联，可用于在APP中展示相关知识提示（如用户记录保险支出时，展示 `insurance_planning` 概念的 key_insight）。
- **删除约束**：分类有关联交易时禁止删除。

---

### 3.5 recurring_transactions — 经常性交易模板表

管理固定周期的重复交易（如月工资、月定投、月房贷等）。

#### 字段定义

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | TEXT | PK | UUID v4 |
| `user_id` | TEXT | NOT NULL FK→users.id | 所属用户 |
| `account_id` | TEXT | NOT NULL FK→accounts.id | 关联账户 |
| `to_account_id` | TEXT | FK→accounts.id | 转账目标账户（仅 transfer 类型） |
| `category_id` | TEXT | FK→categories.id | 交易分类 |
| `transaction_type` | TEXT | NOT NULL | 交易类型：`income` / `expense` / `transfer` |
| `amount` | INTEGER | NOT NULL | 每次交易金额（分，正数） |
| `frequency` | TEXT | NOT NULL | 频率：`daily` / `weekly` / `monthly` / `yearly` |
| `interval` | INTEGER | NOT NULL DEFAULT 1 | 间隔周期数（如 frequency=monthly, interval=2 表示每两月一次） |
| `start_date` | INTEGER | NOT NULL | 起始日期时间戳 |
| `end_date` | INTEGER | | 结束日期时间戳（NULL = 无限循环） |
| `next_due_date` | INTEGER | NOT NULL | 下次应生成交易的日期时间戳 |
| `last_generated_date` | INTEGER | | 最后一次生成交易的日期时间戳 |
| `description` | TEXT | | 交易描述模板 |
| `is_active` | INTEGER | NOT NULL DEFAULT 1 | 是否活跃（0=暂停，1=活跃） |
| `auto_create` | INTEGER | NOT NULL DEFAULT 1 | 是否自动生成交易（1=自动，0=仅提醒） |
| `sync_version` | INTEGER | NOT NULL DEFAULT 0 | 同步版本号 |
| `updated_at` | INTEGER | NOT NULL | 最后修改时间戳 |
| `deleted_flag` | INTEGER | NOT NULL DEFAULT 0 | 软删除标志 |

#### 执行追踪机制

1. APP打开时查询所有 `is_active = 1 AND deleted_flag = 0` 的模板
2. 对每条模板，检查 `next_due_date <= 当前时间`
3. 若满足，生成一笔交易（`recurring_id` 指向本模板），更新账户余额（事务）
4. 推进 `next_due_date`：根据 `frequency` 和 `interval` 计算下一个到期日
5. 更新 `last_generated_date` 为本次生成日期
6. 重复步骤3-5，直到 `next_due_date > 当前时间`（补生成遗漏的交易）
7. 若 `end_date` 不为空且 `next_due_date > end_date`，设置 `is_active = 0`

#### 设计说明

- **补生成机制**：用户多天不开APP后重新打开，自动补生成所有遗漏的交易。
- **间隔周期**：`interval` 字段支持"每N个月"等非标准频率。如 `frequency=monthly, interval=3` 表示每季度一次。
- **暂停 vs 删除**：暂停设置 `is_active = 0`（可恢复），删除设置 `deleted_flag = 1`（同步传播）。
- **自动 vs 提醒**：`auto_create = 1` 自动生成交易；`auto_create = 0` 仅在APP中提醒用户确认。

---

### 3.6 net_worth_snapshots — 净资产快照表

月度净资产快照，按资产大类分类存储，用于趋势可视化。

#### 字段定义

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | TEXT | PK | UUID v4 |
| `user_id` | TEXT | NOT NULL FK→users.id | 所属用户 |
| `snapshot_date` | INTEGER | NOT NULL | 快照日期时间戳（当月用户首次打开APP的日期） |
| `snapshot_year_month` | TEXT | NOT NULL | 快照年月（格式 `"YYYY-MM"`，如 `"2026-07"`），用于唯一约束 |
| `total_liquid` | INTEGER | NOT NULL | 流动资产合计（分） |
| `total_invested` | INTEGER | NOT NULL | 投资资产合计（分） |
| `total_use_asset` | INTEGER | NOT NULL | 使用资产合计（分） |
| `total_liability` | INTEGER | NOT NULL | 总负债合计（分，存储为负数） |
| `net_worth` | INTEGER | NOT NULL | 净资产 = total_liquid + total_invested + total_use_asset + total_liability |
| `sync_version` | INTEGER | NOT NULL DEFAULT 0 | 同步版本号 |
| `updated_at` | INTEGER | NOT NULL | 最后修改时间戳 |
| `deleted_flag` | INTEGER | NOT NULL DEFAULT 0 | 软删除标志 |

#### 唯一约束

`UNIQUE(user_id, snapshot_year_month)` — 每用户每月只生成一条快照。

> **实现方式**：`snapshot_year_month` 为应用层计算的派生字段（格式 `"YYYY-MM"`，如 `"2026-07"`），从 `snapshot_date` 提取年月后与 `user_id` 一起写入。插入前应用层检查当月是否已有快照，避免重复生成。

#### 快照生成机制

1. APP打开时检查当月是否已有快照（`snapshot_date` 在当月范围内）
2. 若无，从 `accounts` 表按 `asset_class` 分组汇总：
   - `total_liquid` = `SUM(current_balance) WHERE asset_class = 'liquid'`
   - `total_invested` = `SUM(current_balance) WHERE asset_class = 'invested'`
   - `total_use_asset` = `SUM(current_balance) WHERE asset_class = 'use_asset'`
   - `total_liability` = `SUM(current_balance) WHERE asset_class = 'liability'`
   - `net_worth` = 上述四项之和
3. 插入新的快照记录

#### 设计说明

- **打开时生成**：本地APP无法可靠运行后台定时任务，因此采用"打开时检查"策略。
- **快照日期不精确到月末**：快照日期为用户首次打开APP的日期，而非严格的月末。但对个人用户的趋势分析足够。
- **分类明细**：存储4类资产合计，可展示"流动资产占比变化"、"负债率下降趋势"等。
- **不可编辑**：快照一旦生成不可修改（历史记录）。如需更正，删除后重新生成。

---

### 3.7 fire_scenarios — FIRE场景表

多场景FIRE投影参数，投影结果实时计算不持久化。

#### 字段定义

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | TEXT | PK | UUID v4 |
| `user_id` | TEXT | NOT NULL FK→users.id | 所属用户 |
| `name` | TEXT | NOT NULL | 场景名称（如"标准计划"、"保守计划"、"激进计划"） |
| `description` | TEXT | | 场景描述 |
| `current_age` | INTEGER | NOT NULL | 当前年龄 |
| `retirement_age` | INTEGER | NOT NULL | 计划退休年龄 |
| `current_portfolio_value` | INTEGER | NOT NULL DEFAULT 0 | 当前投资组合总值（分）。auto_sync_assets=1时从accounts实时汇总 |
| `auto_sync_assets` | INTEGER | NOT NULL DEFAULT 1 | 是否自动从accounts表同步当前资产。1=自动汇总(invested+liquid)，0=手动输入 |
| `monthly_savings` | INTEGER | NOT NULL DEFAULT 0 | 每月储蓄/定投金额（分） |
| `annual_expenses` | INTEGER | NOT NULL | 退休后年度支出（分），用于计算FIRE Number |
| `expected_return_rate` | INTEGER | NOT NULL | 预期年化回报率（基点，如700=7%） |
| `inflation_rate` | INTEGER | NOT NULL DEFAULT 300 | 年通胀率（基点，300=3%） |
| `withdrawal_rate` | INTEGER | NOT NULL | 提现率（基点，如350=3.5%）。中国市场建议350，全球建议400 |
| `retirement_years` | INTEGER | NOT NULL DEFAULT 30 | 退休后预期年限（长寿风险考量） |
| `post_retirement_monthly_income` | INTEGER | NOT NULL DEFAULT 0 | 退休后其他月收入（社保/兼职/租金，分） |
| `is_china_market` | INTEGER | NOT NULL DEFAULT 1 | 是否中国市场（影响默认提现率建议） |
| `is_active` | INTEGER | NOT NULL DEFAULT 1 | 是否活跃场景（可设为0归档） |
| `sync_version` | INTEGER | NOT NULL DEFAULT 0 | 同步版本号 |
| `updated_at` | INTEGER | NOT NULL | 最后修改时间戳 |
| `deleted_flag` | INTEGER | NOT NULL DEFAULT 0 | 软删除标志 |

#### 场景参数与知识库映射

| 字段 | 知识库概念 | 说明 |
|------|-----------|------|
| `current_portfolio_value` | `compound_growth_projection` (PV) | 资产增长预测模型的当前一次性资产 |
| `monthly_savings` | `compound_growth_projection` (PMT) | 资产增长预测模型的每月定期投入 |
| `expected_return_rate` | `investment_return` | 投资回报率（使用实际回报率，非名义） |
| `inflation_rate` | `inflation_risk` | 通胀侵蚀风险 |
| `withdrawal_rate` | `four_percent_rule` | 4%法则（中国市场下调至3-3.5%） |
| `annual_expenses` | `fire_number` | FIRE Number = annual_expenses × (10000 / withdrawal_rate) |
| `retirement_years` | `longevity_risk` | 长寿风险（FIRE退休期可达40-50年） |
| `post_retirement_monthly_income` | `retirement_income_diversification` | 退休后收入多元化 |
| `is_china_market` | `china_market_adjustment` | 中国市场特殊性调整 |

#### FIRE计算公式（实时计算）

投影引擎基于知识库 `compound_growth_projection` 概念的公式：

**积累阶段**（当前年龄 → 退休年龄）：
```
FV = PV × (1 + r)^n + PMT × ((1 + r)^n - 1) / r

其中:
  FV = 退休时资产总值
  PV = current_portfolio_value（当前投资组合总值）
  PMT = monthly_savings（每月储蓄）
  r = expected_return_rate / 12 / 10000（月实际回报率）
  n = (retirement_age - current_age) × 12（累计月数）
```

**FIRE Number 计算**：
```
fire_number = annual_expenses × (10000 / withdrawal_rate)

示例:
  annual_expenses = 50000元, withdrawal_rate = 350 (3.5%)
  fire_number = 50000 × (10000 / 350) = 50000 × 28.57 ≈ 1,428,571元
```

**退休后其他收入对FIRE Number的抵减**（对齐 `social_security_optimization` 知识库概念）：
```
adjusted_fire_number = fire_number - (post_retirement_monthly_income × 12 / withdrawal_rate × 10000)

示例:
  每月养老金3000元 → 年36000元
  抵减额 = 36000 / 0.035 = 1,028,571元
  adjusted_fire_number = 1,428,571 - 1,028,571 = 400,000元
```

**进度计算**：
```
progress = current_portfolio_value / fire_number × 100%
```

#### 设计说明

- **结果不持久化**：FIRE公式计算 600 个月度数据点在毫秒级完成，每次打开场景时实时计算。消除 `projection_results` 表，避免数据冗余和过期问题。
- **auto_sync_assets**：开启时，`current_portfolio_value` 每次读取场景时从 `accounts` 表实时汇总（`SUM(current_balance) WHERE asset_class IN ('liquid', 'invested')`）。关闭时使用手动输入值，支持假设性分析。
- **多场景对比**：用户可创建多个场景（如保守3%提现率 vs 标准4%提现率），对比不同参数下的退休时间线。
- **中国市场适配**：`is_china_market = 1` 时，UI层提示使用3-3.5%提现率（对齐知识库 `china_market_adjustment`）。
- **基点存储**：利率类字段（`expected_return_rate`、`inflation_rate`、`withdrawal_rate`）以基点存储，避免浮点数。

---

## 4. 表关系图 (ER Diagram)

```
users (1)
  │
  ├──< accounts (5-20)
  │       │
  │       ├──< transactions (100-10000+)
  │       │       │
  │       │       └──> recurring_transactions (5-20)
  │       │           │
  │       │           └──> accounts (to_account_id, 可空)
  │       │
  │       └── (accounts.to_account_id 自引用, 转账目标)
  │
  ├──< categories (15-40)
  │       │
  │       └──< categories (parent_id 自引用, 两级层级)
  │
  ├──< net_worth_snapshots (12-120)
  │
  └──< fire_scenarios (1-5)

关系说明:
  users 1:N accounts        — 一个用户有多个账户
  users 1:N transactions    — 一个用户有多笔交易
  users 1:N categories      — 一个用户有多个分类
  users 1:N recurring_txns  — 一个用户有多个经常性交易模板
  users 1:N net_worth_snapshots — 一个用户有多月度快照
  users 1:N fire_scenarios  — 一个用户有多个FIRE场景
  accounts 1:N transactions — 一个账户有多笔交易 (account_id)
  accounts 1:N transactions — 一个账户有多笔转入 (to_account_id)
  categories 1:N transactions — 一个分类有多笔交易
  categories 1:N categories — 一个父分类有多个子分类
  recurring_txns 1:N transactions — 一个模板生成多笔交易
```

---

## 5. 数据流设计

### 5.1 交易写入流程

```
用户录入交易
    │
    ▼
┌─────────────────────┐
│ 开启数据库事务       │
├─────────────────────┤
│ 1. 验证账户存在      │
│ 2. 验证分类存在      │
│ 3. INSERT transactions│
│ 4. UPDATE accounts   │
│    current_balance   │
│    (根据type调整)     │
│ 5. UPDATE accounts   │
│    last_updated      │
├─────────────────────┤
│ COMMIT (全部成功)    │
│ 或 ROLLBACK (任一失败)│
└─────────────────────┘
```

### 5.2 交易编辑流程

```
用户编辑交易
    │
    ▼
┌─────────────────────────┐
│ 开启数据库事务           │
├─────────────────────────┤
│ 1. 读取原交易记录         │
│ 2. 反向调整账户余额:      │
│    income  → 余额 -= 原amount │
│    expense → 余额 += 原amount │
│    transfer→ 源 += 目标 -= 原amount │
│ 3. UPDATE transactions   │
│    (写入新值)             │
│ 4. 正向调整账户余额:      │
│    income  → 余额 += 新amount │
│    expense → 余额 -= 新amount │
│    transfer→ 源 -= 目标 += 新amount │
│ 5. UPDATE accounts       │
│    last_updated          │
├─────────────────────────┤
│ COMMIT 或 ROLLBACK       │
└─────────────────────────┘
```

### 5.3 交易删除流程

```
用户删除交易
    │
    ▼
┌─────────────────────────┐
│ 开启数据库事务           │
├─────────────────────────┤
│ 1. 读取交易记录           │
│ 2. 反向调整账户余额       │
│    (同编辑流程的步骤2)    │
│ 3. UPDATE transactions   │
│    SET deleted_flag = 1  │
│ 4. UPDATE accounts       │
│    last_updated          │
├─────────────────────────┤
│ COMMIT 或 ROLLBACK       │
└─────────────────────────┘
```

### 5.4 经常性交易补生成流程

```
APP打开
    │
    ▼
查询 is_active=1 AND deleted_flag=0 的模板
    │
    ▼
对每条模板:
    WHILE next_due_date <= 当前时间:
        ┌─────────────────────────┐
        │ 开启事务                 │
        │ 1. 生成交易记录           │
        │    (recurring_id = 模板ID)│
        │ 2. 更新账户余额           │
        │ 3. 推进 next_due_date    │
        │ 4. 更新 last_generated   │
        │ COMMIT                   │
        └─────────────────────────┘
        │
        ▼
    检查 end_date (若 next_due_date > end_date:
        设 is_active = 0)
```

### 5.5 净资产快照生成流程

```
APP打开
    │
    ▼
查询当月是否已有快照
    │
    ├── 有 → 跳过
    │
    └── 无
        │
        ▼
    ┌─────────────────────────┐
    │ 开启事务                 │
    │ 1. SUM(liquid)           │
    │ 2. SUM(invested)         │
    │ 3. SUM(use_asset)        │
    │ 4. SUM(liability)        │
    │ 5. net_worth = 1+2+3+4  │
    │ 6. INSERT snapshot       │
    │ COMMIT                   │
    └─────────────────────────┘
```

### 5.6 FIRE投影计算流程

```
用户打开FIRE场景
    │
    ▼
auto_sync_assets = 1?
    │
    ├── 是 → 从accounts实时汇总 current_portfolio_value
    │        (SUM WHERE asset_class IN ('liquid','invested'))
    │
    └── 否 → 使用手动输入的 current_portfolio_value
    │
    ▼
读取场景参数
    │
    ▼
┌─────────────────────────────────┐
│ 实时计算引擎                     │
├─────────────────────────────────┤
│ 1. 计算 FIRE Number             │
│    = annual_expenses ×          │
│      (10000 / withdrawal_rate)  │
│ 2. 计算退休后收入抵减            │
│    = post_retirement_income×12  │
│      / (withdrawal_rate/10000)  │
│ 3. 计算调整后FIRE Number         │
│ 4. 积累阶段月度投影              │
│    (current_age → retirement_age)│
│    FV = PV×(1+r)^n + PMT×...    │
│ 5. 提现阶段月度投影              │
│    (retirement_age → +years)    │
│    逐年提现+通胀调整             │
│ 6. 计算进度百分比                │
│    = current / fire_number      │
├─────────────────────────────────┤
│ 返回内存中的计算结果（不持久化）   │
└─────────────────────────────────┘
    │
    ▼
UI渲染图表和数值
```

---

## 6. 错误处理与约束

### 6.1 数据库级约束

| 约束 | 说明 |
|------|------|
| `transactions.amount > 0` | 金额必须为正数（方向由type决定） |
| `accounts.current_balance` 对 liability 类型 ≤ 0 | 负债账户余额不能为正 |
| `fire_scenarios.retirement_age > current_age` | 退休年龄必须大于当前年龄 |
| `fire_scenarios.withdrawal_rate` 在 200-600 范围内 | 提现率2%-6%合理范围 |
| `recurring_transactions.next_due_date >= start_date` | 下次到期日不早于起始日 |
| `net_worth_snapshots` 每用户每月唯一 | 不重复生成同月快照 |

### 6.2 应用级约束

| 约束 | 说明 |
|------|------|
| 账户有关联交易时禁止删除 | 返回错误："该账户下有N笔交易，请先处理" |
| 分类有关联交易时禁止删除 | 返回错误："该分类下有N笔交易，请先迁移" |
| 转账交易必须指定 `to_account_id` | 应用层校验 |
| `to_account_id` 不能等于 `account_id` | 不能转账给自己 |
| 经常性交易模板的 `account_id` 必须存在且未删除 | 引用完整性 |
| 场景参数修改后实时重算 | 无需显式"保存并重算"操作 |

### 6.3 事务失败处理

所有事务操作遵循以下原则：

- 任一步骤失败 → 整个事务回滚
- 回滚后向用户展示友好错误信息
- 不留部分写入的脏数据
- 日志记录失败原因（本地日志，不同步）

---

## 7. 同步设计

### 7.1 同步架构

```
┌──────────────────────┐     ┌──────────────────────┐
│    设备A (本地DB)     │     │    设备B (本地DB)     │
│                      │     │                      │
│  SQLite/IndexedDB    │     │  SQLite/IndexedDB    │
│  ↑ AES-256 加密      │     │  ↑ AES-256 加密      │
│  ↑ Argon2id 密钥派生  │     │  ↑ Argon2id 密钥派生  │
└─────────┬────────────┘     └──────────┬────────────┘
          │                             │
          │  仅密文上传/下载              │
          ▼                             ▼
┌──────────────────────────────────────────────────┐
│              云端同步服务器                        │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │  加密 blob 存储                            │   │
│  │  （服务器无法解密，零知识架构）              │   │
│  └──────────────────────────────────────────┘   │
└──────────────────────────────────────────────────┘
```

### 7.2 同步流程

```
设备发起同步
    │
    ▼
1. 从本地DB读取所有 sync_version > last_synced_version 的记录
2. 加密为密文 blob
3. 上传到同步服务器
    │
    ▼
4. 从同步服务器下载其他设备的变更（密文 blob）
5. 本地解密
    │
    ▼
6. 对每条远程记录:
    a. 本地不存在 → INSERT
    b. 本地存在且 remote.updated_at > local.updated_at → UPDATE (LWW)
    c. 本地存在且 remote.updated_at <= local.updated_at → 跳过
    d. remote.deleted_flag = 1 且 local.deleted_flag = 0 → 软删除本地
    │
    ▼
7. 更新 users.last_sync_at
```

### 7.3 同步字段说明

| 字段 | 同步行为 |
|------|---------|
| `sync_version` | 每次本地修改 +1。同步时用于判断哪些记录需要上传 |
| `updated_at` | LWW 冲突解决的时间戳依据。精度毫秒 |
| `deleted_flag` | 软删除标志。同步时传播删除操作，不物理删除 |

---

## 8. 知识库映射总表

数据模型与 `fire-knowledge-schema.yaml` v5.0 的概念映射关系：

| 数据模型元素 | 知识库概念ID | 概念名称 | 映射方式 |
|-------------|-------------|---------|---------|
| `users.is_china_market` | `china_market_adjustment` | 中国市场特殊性 | 控制默认提现率 |
| `users.default_withdrawal_rate` | `four_percent_rule` | 4%法则 | 默认提现率参数 |
| `users.default_expected_return` | `investment_return` | 投资回报率 | 默认回报率参数 |
| `users.default_inflation_rate` | `inflation_risk` | 通胀侵蚀风险 | 默认通胀率参数 |
| `accounts.asset_class = invested` | `fire_number` | FIRE数字 | 可投资资产计入FIRE Number |
| `accounts.asset_class = use_asset` | — | 自住房产 | 不计入FIRE Number |
| `accounts.account_type = retirement` | `tax_planning` | 税务规划 | 退休账户类型 |
| `accounts.account_type = mortgage` | `debt_management` | 债务管理 | 房贷类型 |
| `categories.linked_fire_concept = insurance_planning` | `insurance_planning` | 保险规划 | 保险分类关联 |
| `categories.linked_fire_concept = china_medical_insurance` | `china_medical_insurance` | 医保体系 | 医疗分类关联 |
| `categories.linked_fire_concept = debt_management` | `debt_management` | 债务管理 | 债务还款分类 |
| `categories.linked_fire_concept = retirement_income_diversification` | `retirement_income_diversification` | 退休后收入多元化 | 租金收入分类 |
| `categories.linked_fire_concept = china_pension_system` | `china_pension_system` | 社保养老金体系 | 养老金收入分类 |
| `fire_scenarios.withdrawal_rate` | `four_percent_rule` | 4%法则 | 提现率参数 |
| `fire_scenarios.annual_expenses` | `fire_number` | FIRE数字 | 年支出→FIRE Number |
| `fire_scenarios.expected_return_rate` | `investment_return` | 投资回报率 | 回报率参数 |
| `fire_scenarios.inflation_rate` | `inflation_risk` | 通胀侵蚀风险 | 通胀率参数 |
| `fire_scenarios.retirement_years` | `longevity_risk` | 长寿风险 | 退休后年限 |
| `fire_scenarios.post_retirement_monthly_income` | `retirement_income_diversification` | 退休后收入多元化 | 其他退休收入 |
| `fire_scenarios.is_china_market` | `china_market_adjustment` | 中国市场特殊性 | 市场标志 |
| FIRE计算公式 | `compound_growth_projection` | 资产增长预测模型 | FV公式直接使用 |
| FIRE计算公式 | `savings_rate_retirement_years` | 储蓄率与退休年限 | 储蓄率→年限参考 |
| `net_worth_snapshots` 趋势 | `asset_allocation` | 股债配置 | 资产结构变化 |

---

## 9. 测试策略

### 9.1 单元测试

| 测试对象 | 测试内容 |
|---------|---------|
| 金额转换 | 分↔元转换正确性，边界值（0, 最大值） |
| 余额符号 | 资产正、负债负，净资产=SUM正确 |
| 交易类型语义 | income/expense/transfer/initial_balance 对余额的影响 |
| 反向调整 | 编辑/删除交易后余额正确回滚 |
| FIRE公式 | FV计算、FIRE Number计算、收入抵减计算 |

### 9.2 事务测试

| 测试场景 | 预期结果 |
|---------|---------|
| 写入交易时模拟账户更新失败 | 事务回滚，交易和余额都不变 |
| 编辑交易时模拟中间步骤失败 | 事务回滚，原交易和余额都不变 |
| 删除交易时模拟余额更新失败 | 事务回滚，交易和余额都不变 |
| 经常性交易补生成时模拟单条失败 | 该条回滚，不影响其他条目 |

### 9.3 同步测试

| 测试场景 | 预期结果 |
|---------|---------|
| 两设备同时修改同一记录 | LWW按 updated_at 决定保留哪个 |
| 一设备删除记录，另一设备修改 | 删除优先（deleted_flag传播） |
| 离线创建记录后上线同步 | UUID无冲突，正常合并 |
| 新设备首次同步 | 全量下载，无数据丢失 |

### 9.4 约束测试

| 测试场景 | 预期结果 |
|---------|---------|
| 删除有关联交易的账户 | 返回错误，不执行删除 |
| 删除有关联交易的分类 | 返回错误，不执行删除 |
| 转账时 to_account_id 为空 | 返回错误 |
| 转账时 to_account_id = account_id | 返回错误 |
| 同月重复生成快照 | 跳过，不生成重复快照 |

---

## 10. 未来扩展考虑

以下功能当前不实现（YAGNI），但数据模型预留了扩展空间：

| 功能 | 扩展方式 | 当前设计是否阻碍 |
|------|---------|----------------|
| 多币种支持 | 在 accounts 和 transactions 表增加 currency_code 字段 + 汇率表 | 否，新增字段不影响现有逻辑 |
| 蒙特卡洛模拟 | 新增 simulation_results 表存储 P10/P50/P90 结果 | 否，fire_scenarios 表已包含所需参数 |
| 交易导入（OFX/CSV） | 新增 import_logs 表 + 解析器 | 否，transactions 表结构兼容 OFX 字段映射 |
| 预算管理 | 新增 budgets 表 + budget_periods 表 | 否，categories 表的两级分类可直接用于预算 |
| 资产配置追踪 | 在 net_worth_snapshots 表增加 allocation JSON 字段 | 否，快照表可直接扩展 |
| 投资持仓明细 | 新增 holdings 表（股票/基金持仓）+ price_history 表 | 否，accounts 表的 investment 类型可粗粒度追踪 |

---

## 附录 A：设计决策记录

| # | 决策项 | 选择 | 日期 | 理由 |
|---|--------|------|------|------|
| 1 | 记账模型 | 单分录记账型 | 2026-07-12 | 简洁直观，适合个人FIRE计算，开发复杂度适中 |
| 2 | 存储架构 | 本地优先+加密同步 | 2026-07-12 | 兼顾隐私和跨设备便利性 |
| 3 | 资产分类 | FIRE导向（asset_class + account_type） | 2026-07-12 | 覆盖FIRE计算所需最小分类，不过度复杂 |
| 4 | 时间序列 | 混合型（交易+快照） | 2026-07-12 | 交易层支撑消费分析，快照层支撑趋势 |
| 5 | 货币支持 | 单一货币 | 2026-07-12 | 简化汇总逻辑，适合不涉及跨境资产的用户 |
| 6 | 投影模型 | 多场景投影，实时计算 | 2026-07-12 | 支持场景对比，FIRE公式计算快无需持久化 |
| 7 | 收支分类 | 标准+自定义，两级层级 | 2026-07-12 | 内置分类降低上手成本，自定义保证灵活度 |
| 8 | 经常性交易 | 支持模板 | 2026-07-12 | 减少重复录入，支持定投/房贷等FIRE核心场景 |
| 9 | 转账处理 | transaction_type + to_account_id | 2026-07-12 | 单记录转账，不污染收支统计 |
| 10 | 金额精度 | 整数存分 | 2026-07-12 | 金融系统业界标准，避免浮点误差 |
| 11 | FIRE场景参数 | 完整参数 | 2026-07-12 | 支持完整FIRE投影，含中国市场适配 |
| 12 | 余额符号 | 统一符号（资产正、负债负） | 2026-07-12 | 净资产=SUM(current_balance)，SQL最简 |
| 13 | 快照生成 | APP打开时生成 | 2026-07-12 | 本地APP无法可靠后台定时，打开时检查最务实 |
| 14 | 交易编辑/删除 | 反向调整余额 | 2026-07-12 | 事务强一致，余额始终准确 |
| 15 | 级联删除 | 禁止删除有关联数据的记录 | 2026-07-12 | 防止孤儿数据 |
| 16 | 初始余额 | 生成 initial_balance 交易 | 2026-07-12 | 所有余额变化可追溯 |
| 17 | 账户类型枚举 | 11种完整枚举 | 2026-07-12 | 覆盖中国用户常见场景 |
| 18 | 场景资产关联 | auto_sync_assets 可选 | 2026-07-12 | 兼顾真实状态和假设分析 |
| 19 | 快照粒度 | 分类存储5字段 | 2026-07-12 | 支持资产结构变化趋势分析 |
| 20 | 用户表内容 | 完整档案含FIRE默认偏好 | 2026-07-12 | 新建场景时自动填入默认值 |
| 21 | 整体架构 | 精简领域分层（7张表） | 2026-07-12 | 关注点分离，表数量可控 |
| 22 | 同步冲突 | 记录级LWW | 2026-07-12 | 个人单用户冲突概率低，实现简单 |
| 23 | 投影结果存储 | 不持久化，实时计算 | 2026-07-12 | 消除冗余表，参数修改立即生效 |

---

## 附录 B：调研参考来源

本设计参考了以下FIRE/财务应用的数据模型架构：

| 应用/项目 | 参考要点 |
|-----------|---------|
| **firenum** | 逐月模拟引擎、蒙特卡洛漂移校正、月度快照数据结构 |
| **cFIREsim** | 历史回测+蒙特卡洛双模式、多场景参数设计 |
| **FIRECalc** | 历史滚动窗口回测方法 |
| **Firefly III** | 双分录三层结构（Group→Journal→Transaction）、多货币设计参考 |
| **GnuCash** | prices表时间序列设计、value_num/value_denom精度方案、slots KVP扩展 |
| **Mint** | 写密集型架构、众包分类、monthly_spending预聚合表 |
| **YNAB** | 信封预算法、Budget→Account→Category层级 |
| **naya.finance** | 双分录SQL模式设计、不可变性原则、ACID事务 |

**行业标准参考**：
- OFX (Open Financial Exchange) — 个人财务数据交换标准
- ISO 4217 — 货币代码标准
- 数据仓库事实表模式 — 事务性/周期快照/累积快照三种模式
