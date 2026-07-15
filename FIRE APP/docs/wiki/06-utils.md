# 06-utils.md — 工具模块

> **最后更新**: 2026-07-15
> **对应代码**: `fire-app/src/utils/`
> **导航**: [← 返回主页](CODE_WIKI.md) | [上一节](05-services.md) | [下一节](07-tests.md)

---

## 1. 模块概述

`utils/` 目录是项目的基础工具层，包含 3 个独立模块：

| 文件 | 职责 | 函数数 |
|------|------|--------|
| money.ts | 金额与利率转换（元↔分、基点→小数） | 3 |
| sync.ts | 同步元数据生成与 LWW 冲突判定 | 1 接口 + 3 函数 |
| time.ts | 时间工具（时间戳、年月、月份运算） | 4 |

**特点**：
- 所有函数为纯函数，无副作用，无数据库依赖
- 被 models / services 广泛引用（如 models 调用 `nowMs` / `bumpSyncVersion`，services 调用 `toYearMonth` / `addMonths`）
- sync.ts 内部依赖 time.ts 的 `nowMs`，是 utils 内部唯一的依赖关系

---

## 2. money.ts — 金额与利率转换

源码：[money.ts](file:///workspace/FIRE%20APP/fire-app/src/utils/money.ts)

本模块负责金额与利率的存储格式转换。项目统一约定：金额以整数"分"存储（避免浮点误差），利率以整数"基点"存储（350 基点 = 3.5%）。

### 2.1 `yuanToCents(yuan: number): number`

源码：[money.ts:8](file:///workspace/FIRE%20APP/fire-app/src/utils/money.ts#L8)

**用途**：元转分（用户输入的元转为数据库存储的整数分）

**实现**：两阶段取整

```typescript
return Math.round(Math.round(yuan * 1000) / 10);
```

**浮点误差陷阱说明**：直接 `Math.round(yuan * 100)` 会因 IEEE 754 浮点误差丢分。例如 `1.005 * 100` 在浮点下实际为 `100.4999...`，直接取整得 100 而非期望的 101。两阶段取整先到毫（×1000）再到分（÷10）规避此问题：

1. 第一阶段：`Math.round(yuan * 1000)` 把元转成整数毫，避免小数运算
2. 第二阶段：`/ 10` 转回分，再 `Math.round` 消除除法可能引入的尾差

### 2.2 `centsToYuan(cents: number): number`

源码：[money.ts:15](file:///workspace/FIRE%20APP/fire-app/src/utils/money.ts#L15)

**用途**：分转元（用于 UI 展示）

**实现**：

```typescript
return cents / 100;
```

**说明**：此方向不涉及取整（展示用浮点可接受），但若结果需再次入库应避免往返转换。

### 2.3 `basisPointsToDecimal(basisPoints: number): number`

源码：[money.ts:23](file:///workspace/FIRE%20APP/fire-app/src/utils/money.ts#L23)

**用途**：基点转小数（利率字段存储为基点整数，计算时需转为小数）

**实现**：

```typescript
return basisPoints / 10000;
```

**示例**：

| 基点 | 小数 | 百分比 | 语义 |
|------|------|--------|------|
| 350 | 0.035 | 3.5% | 中国市场默认提款率 |
| 400 | 0.04 | 4% | 非中国市场默认提款率 |
| 700 | 0.07 | 7% | 默认预期收益率 |
| 300 | 0.03 | 3% | 默认通胀率 |
| 100 | 0.01 | 1% | 换算基准（100 基点 = 1%）|

---

## 3. sync.ts — 同步元数据

源码：[sync.ts](file:///workspace/FIRE%20APP/fire-app/src/utils/sync.ts)

本模块为记录级 LWW（Last-Write-Wins）同步提供原语。所有数据表均含 `updated_at` / `sync_version` / `deleted_flag` 三字段，本模块封装这三字段的生成与冲突判定逻辑。

**依赖**：导入 [time.ts](file:///workspace/FIRE%20APP/fire-app/src/utils/time.ts) 的 `nowMs` 用于生成时间戳。

### 3.1 `SyncMeta` 接口

源码：[sync.ts:4](file:///workspace/FIRE%20APP/fire-app/src/utils/sync.ts#L4)

```typescript
export interface SyncMeta {
  updated_at: number;
  sync_version: number;
  deleted_flag: number;
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `updated_at` | number | 最后修改时间（Unix 毫秒），LWW 冲突判定的主键 |
| `sync_version` | number | 同步版本号，每次本地修改 +1（单调递增，可用于检测丢失更新）|
| `deleted_flag` | number | 软删除标志（0=活跃，1=已删除），删除通过置 1 实现以利同步传播 |

**说明**：该接口仅含同步元数据三字段，不含业务字段。models 层的实体接口（如 `User` / `Account`）在结构上兼容此接口（含相同三字段），便于在更新时复用 `bumpSyncVersion`。

### 3.2 `createSyncMeta(): SyncMeta`

源码：[sync.ts:13](file:///workspace/FIRE%20APP/fire-app/src/utils/sync.ts#L13)

**用途**：创建初始同步元数据（新记录插入时使用）

**返回**：

```typescript
{
  updated_at: nowMs(),
  sync_version: 0,
  deleted_flag: 0,
}
```

**说明**：新记录的 `sync_version` 从 0 起算，首次后续修改才会递增到 1。`deleted_flag` 默认 0（活跃）。

### 3.3 `bumpSyncVersion(current: SyncMeta): SyncMeta`

源码：[sync.ts:24](file:///workspace/FIRE%20APP/fire-app/src/utils/sync.ts#L24)

**用途**：更新记录时递增同步版本号并刷新时间戳

**返回**：

```typescript
{
  updated_at: nowMs(),
  sync_version: current.sync_version + 1,
  deleted_flag: current.deleted_flag,
}
```

**说明**：
- `updated_at` 刷新为当前时间，是 LWW 冲突判定的依据
- `sync_version` 在原值基础上 +1，保证单调递增
- `deleted_flag` 透传原值（普通更新不应改变删除状态；软删除单独处理）

**调用方**：models 层的所有 update 函数（如 `updateUser` / `updateAccount` / `updateRecurring` / `updateScenario`）在构造 UPDATE 字段时调用此函数生成新的同步元数据。

### 3.4 `shouldRemoteWin(local: SyncMeta, remote: SyncMeta): boolean`

源码：[sync.ts:36](file:///workspace/FIRE%20APP/fire-app/src/utils/sync.ts#L36)

**用途**：LWW 冲突解决：判断同步拉取的远程记录是否应该覆盖本地记录

**规则**：

```typescript
return remote.updated_at >= local.updated_at;
```

**LWW 冲突解决说明**：

- **比较依据**：仅比较 `updated_at`（Unix 毫秒时间戳），不参考 `sync_version`
- **使用 `>=` 而非 `>`**：当时间戳相等时也判定远程胜，避免在时钟精度相等时出现"双方互相拒绝对方更新"的同步死锁。代价是时间戳相等时本地修改会被远程覆盖，但这种情况罕见（需毫秒级时间戳碰撞）
- **不比较 `sync_version`**：`sync_version` 是单调递增的本地计数器，跨设备无全局可比性（两台设备各自从 0 开始递增），故不作为冲突判定依据
- **应用层职责**：本函数仅返回布尔判定；调用方（未来的同步引擎）需自行决定覆盖策略（如直接替换、字段级合并、提示用户）

**当前状态**：本模块仅提供 LWW 原语，尚未接入实际同步引擎（见 [08-design-index.md](08-design-index.md) 第 5 节"尚未实现的规划"）。

---

## 4. time.ts — 时间工具

源码：[time.ts](file:///workspace/FIRE%20APP/fire-app/src/utils/time.ts)

本模块提供时间戳生成与年月运算工具。所有方法使用 UTC 时区（详见第 5 节约定）。

### 4.1 `nowMs(): number`

源码：[time.ts:6](file:///workspace/FIRE%20APP/fire-app/src/utils/time.ts#L6)

**用途**：当前 Unix 时间戳（毫秒）

**实现**：

```typescript
return Date.now();
```

**说明**：项目所有时间戳字段（`updated_at` / `last_sync_at` / `transaction_date` / `snapshot_date` 等）统一使用 Unix 毫秒整数存储，与 `sync.ts` 的 `createSyncMeta` / `bumpSyncVersion` 配合使用。

### 4.2 `toYearMonth(timestampMs: number): string`

源码：[time.ts:13](file:///workspace/FIRE%20APP/fire-app/src/utils/time.ts#L13)

**用途**：从毫秒时间戳提取 "YYYY-MM" 格式字符串

**实现**：

```typescript
const date = new Date(timestampMs);
const year = date.getUTCFullYear();
const month = String(date.getUTCMonth() + 1).padStart(2, '0');
return `${year}-${month}`;
```

**示例**：

| 输入（毫秒） | 输出 | 对应 UTC 日期 |
|--------------|------|---------------|
| `1696118400000` | `"2023-10"` | 2023-10-01 00:00:00 UTC |
| `1704067199999` | `"2023-12"` | 2023-12-31 23:59:59 UTC |

**说明**：
- 使用 `getUTCFullYear()` 和 `getUTCMonth()` 而非本地版本，确保跨时区一致
- 月份补零（`padStart(2, '0')`）保证两位数格式
- 被 `snapshot-service.ts` 的 `generateMonthlySnapshot` 调用，用于确定本月快照的 `snapshot_year_month` 键

### 4.3 `addMonths(timestampMs: number, months: number): number`

源码：[time.ts:24](file:///workspace/FIRE%20APP/fire-app/src/utils/time.ts#L24)

**用途**：在时间戳上增加 N 个月，返回新的时间戳

**实现**：

```typescript
const date = new Date(timestampMs);
const day = date.getUTCDate();
date.setUTCMonth(date.getUTCMonth() + months);
// 处理月末溢出（如1月31日 + 1月 = 3月3日 → 修正为2月28/29日）
if (date.getUTCDate() < day) {
  date.setUTCDate(0); // 回退到上月最后一天
}
return date.getTime();
```

**行为**：保持日历日不变（如 1 月 15 日 + 3 月 = 4 月 15 日）。

**月末溢出处理说明**：

JavaScript 的 `setUTCMonth` 在目标月份天数不足时会自动"溢出"到下个月。例如：
- 1 月 31 日 + 1 月：`setUTCMonth(1)` 实际得到 3 月 3 日（非闰年）或 3 月 2 日（闰年），因为 2 月没有 31 天
- 3 月 31 日 + 1 月：得到 5 月 1 日（4 月只有 30 天）

代码用"溢出检测 + 回退"修正此行为：

1. 记录原始日 `day = date.getUTCDate()`（如 31）
2. 执行 `setUTCMonth` 后，若 `date.getUTCDate() < day`（如变成 3），说明发生溢出
3. 调用 `date.setUTCDate(0)` 回退到上月最后一天（如 2 月 28/29 日）

**调用方**：`recurring-service.ts` 的 `advanceDueDate` 函数对 `monthly` / `yearly` 频率的模板推进到期日时调用本函数。

### 4.4 `monthsBetween(startMs: number, endMs: number): number`

源码：[time.ts:38](file:///workspace/FIRE%20APP/fire-app/src/utils/time.ts#L38)

**用途**：计算两个时间戳之间的月数差

**实现**：

```typescript
const start = new Date(startMs);
const end = new Date(endMs);
const yearDiff = end.getUTCFullYear() - start.getUTCFullYear();
const monthDiff = end.getUTCMonth() - start.getUTCMonth();
return yearDiff * 12 + monthDiff;
```

**说明**：
- 返回完整月数差，**不计算剩余天数**（如 2023-01-15 到 2023-04-10 返回 3，而非 3 个月的近似小数）
- 结果可为负数（当 `endMs < startMs` 时）
- 仅比较年月，忽略日和时分秒，适合"按月计费 / 按月统计"场景

---

## 5. UTC vs 本地时间约定

项目在所有时间处理上统一使用 **UTC 时区**（即 `getUTC*` / `setUTC*` 系列方法），原因如下：

### 5.1 选择 UTC 的理由

| 理由 | 说明 |
|------|------|
| 跨时区同步 | 用户可能跨时区使用（未来同步场景），本地时间会导致同一时刻在不同设备上得到不同的"年月"，破坏 LWW 一致性 |
| 月度快照边界 | `net_worth_snapshots` 按 `snapshot_year_month` 聚合，若用本地时间，跨时区用户的月份边界会错位（如 UTC+8 的 10 月 1 日 0:30 在 UTC 下仍是 9 月 30 日）|
| 经常性模板到期 | `recurring_transactions.next_due_date` 的推进依赖 `addMonths`，UTC 保证"每月 15 日"在任何时区都是同一天的 UTC 15 日 |
| 时间戳存储无关性 | `updated_at` 等字段以 Unix 毫秒整数存储，本身时区无关；但提取年月/日做聚合时必须用 UTC，否则同一时间戳在不同设备上得到不同结果 |

### 5.2 实现位置

UTC 约定在以下函数中体现：

| 函数 | 使用的 UTC 方法 | 文件 |
|------|-----------------|------|
| `toYearMonth` | `getUTCFullYear` / `getUTCMonth` | [time.ts:15-16](file:///workspace/FIRE%20APP/fire-app/src/utils/time.ts#L15-L16) |
| `addMonths` | `getUTCDate` / `setUTCMonth` / `setUTCDate` | [time.ts:26-31](file:///workspace/FIRE%20APP/fire-app/src/utils/time.ts#L26-L31) |
| `monthsBetween` | `getUTCFullYear` / `getUTCMonth` | [time.ts:41-42](file:///workspace/FIRE%20APP/fire-app/src/utils/time.ts#L41-L42) |

### 5.3 注意事项

- `nowMs()` 返回的 `Date.now()` 本身是时区无关的 Unix 毫秒，无需 UTC 化
- 业务层（models / services）不应直接调用 `new Date().getFullYear()` 等本地时间方法做年月判断，应统一通过 `time.ts` 的函数
- 未来若引入 UI 层展示"本地时间"，应在展示层做 UTC→本地的转换，存储与计算层始终保持 UTC
