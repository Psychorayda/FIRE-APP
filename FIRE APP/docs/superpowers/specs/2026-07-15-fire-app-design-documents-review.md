# FIRE 计算APP — 设计文档全面复盘分析报告

> **版本**: 1.0
> **日期**: 2026-07-15
> **范围**: 跨文档一致性检查、文档与代码对齐验证、缺失内容识别
> **覆盖文档**: 4 份设计文档 + 关键代码文件

---

## 1. 审查范围

### 1.1 已审查的设计文档

| # | 文档 | 路径 | 行数 |
|---|------|------|------|
| 1 | 用户数据模型设计 | `specs/2026-07-12-fire-app-user-data-model-design.md` | ~950 |
| 2 | 缺失设计文档规划 | `specs/2026-07-15-fire-app-missing-design-documents-plan.md` | ~250 |
| 3 | 前端架构设计 | `specs/2026-07-15-fire-app-frontend-architecture-design.md` | 1316 |
| 4 | UI/UX 设计 | `specs/2026-07-15-fire-app-ui-ux-design.md` | 1511 |
| 5 | 应用初始化设计 | `specs/2026-07-15-fire-app-initialization-design.md` | 1464 |

### 1.2 已审查的代码文件

| 文件 | 用途 |
|------|------|
| `src/types/index.ts` | 7 张表的 TypeScript 接口定义 |
| `src/db/connection.ts` | SQLite 连接管理 |
| `src/db/schema.ts` | DDL 语句 + initSchema 函数 |
| `src/models/category.ts` | 分类 CRUD + seedCategories |
| `src/models/user.ts` | 用户 CRUD |
| `src/services/fire-calc.ts` | FIRE 计算引擎 |
| `src/services/recurring-service.ts` | 经常性交易引擎 |
| `src/services/snapshot-service.ts` | 月度快照生成 |

---

## 2. 确认的错误

### 2.1 规划文档种子分类数量错误

| 维度 | 内容 |
|------|------|
| **位置** | `2026-07-15-fire-app-missing-design-documents-plan.md` 第 155 行 |
| **错误内容** | "17 个内置分类的数据来源（对齐数据模型文档 3.4 节）" |
| **正确值** | **18 个**（11 支出 + 7 收入） |
| **验证来源** | 数据模型文档 3.4 节列出 18 个分类；代码 `category.ts` `SEED_CATEGORIES` 数组有 18 条记录；初始化文档正确写为 18 |
| **影响** | 低。规划文档仅用于阶段划分参考，不影响实现。但应修正以避免混淆。 |
| **修正** | 将"17 个"改为"18 个" |

### 2.2 数据模型文档账户类型枚举数量错误

| 维度 | 内容 |
|------|------|
| **位置** | `2026-07-12-fire-app-user-data-model-design.md` 第 925 行，决策记录 #17 |
| **错误内容** | "10种完整枚举" |
| **正确值** | **11 种** |
| **验证来源** | 代码 `types/index.ts` `AccountType` 类型有 11 个值（checking, savings, cash, investment, retirement, fund, real_estate, vehicle, credit_card, loan, mortgage）；数据模型文档 3.2 节表格也列出了 11 种 |
| **影响** | 低。决策记录正文和代码一致，仅决策摘要行计数有误。 |
| **修正** | 将"10种"改为"11种" |

---

## 3. 跨文档一致性检查结果

### 3.1 一致性验证通过项

| # | 检查项 | 文档 A | 文档 B | 代码 | 结论 |
|---|--------|--------|--------|------|------|
| 1 | 函数签名 `createDatabase(path)` | 架构文档 line 318 | 初始化文档 line 278 | `connection.ts` line 9 | 一致 |
| 2 | 函数签名 `initSchema(db)` | 架构文档 line 732 | 初始化文档 line 281 | `schema.ts` line 169 | 一致 |
| 3 | 函数签名 `seedCategories(db, userId)` | 架构文档 line 749 | 初始化文档 line 431 | `category.ts` line 93 | 一致 |
| 4 | 函数签名 `processRecurringTransactions(db, userId)` | — | 初始化文档 line 595 | `recurring-service.ts` line 17 | 一致 |
| 5 | 函数签名 `generateMonthlySnapshot(db, userId)` | — | 初始化文档 line 609 | `snapshot-service.ts` line 21 | 一致 |
| 6 | 函数签名 `runProjection(db, scenario)` | — | UI/UX 文档引用 | `fire-calc.ts` line 43 | 一致 |
| 7 | IPC 通道 `db:init` | 架构文档 line 725 | 初始化文档 line 1357 | — | 一致 |
| 8 | IPC 通道 `db:user:getFirst` | 架构文档 line 737 | 初始化文档 line 1358 | — | 一致 |
| 9 | IPC 通道 `db:category:seed` | 架构文档 line 749 | 初始化文档 line 420 | — | 一致 |
| 10 | 种子分类清单（18 个） | 数据模型文档 3.4 节 | 初始化文档 4.1 节 | `category.ts` SEED_CATEGORIES | 一致 |
| 11 | `linked_fire_concept` 关联（5 个有值） | 数据模型文档 3.4 节 | 初始化文档 4.1 节 | `category.ts` SEED_CATEGORIES | 一致 |
| 12 | 负债符号约定（负数存储） | 数据模型文档 3.2 节 | UI/UX 文档 line 468, 730 | `snapshot-service.ts` line 31 | 一致 |
| 13 | 净资产公式 `SUM(四项)` | 数据模型文档 3.6 节 | UI/UX 文档 line 468 | `snapshot-service.ts` line 31 | 一致 |
| 14 | FireScenario 字段覆盖 | 架构文档 DataAccessPort | UI/UX 文档 3.4 节表单 | `types/index.ts` FireScenario | 一致（15 个字段全覆盖） |
| 15 | 路由结构（6 个路由） | 架构文档 6.1 节 | UI/UX 文档 2.1 节 | — | 一致 |
| 16 | 技术栈选型（Electron+React+Tailwind+Zustand+Recharts） | 架构文档 2 节 | UI/UX 文档 1 节 | — | 一致 |
| 17 | `getFirstUser` 需新增 | 架构文档 7.2 节 | 初始化文档 4.1 节 | `user.ts` 缺失（待实现） | 一致（两份文档均标注为新增） |

### 3.2 发现的不一致

#### 3.2.1 初始化文档 import 路径风格不统一

| 维度 | 内容 |
|------|------|
| **位置** | `2026-07-15-fire-app-initialization-design.md` 第 293-294 行 |
| **问题** | 第 293 行使用相对路径 `import { createDatabase } from '../db/connection'`，第 294 行使用包别名 `import { initSchema } from '@fire-app/shared/db/schema'` |
| **应改为** | 统一使用 `@fire-app/shared` 包别名，因为架构文档定义的 monorepo 结构中这两个文件都在 `packages/shared` 下 |
| **严重性** | 低。代码示例性质，不影响实际实现。 |
| **修正** | 第 293 行改为 `import { createDatabase } from '@fire-app/shared/db/connection'` |

#### 3.2.2 初始化流程冗余调用 `initSchema`

| 维度 | 内容 |
|------|------|
| **位置** | 初始化文档第 1352 行（Step 3）和第 1357 行（Step 8） |
| **问题** | Step 3 主进程已调用 `initSchema(db)`，Step 8 渲染进程又通过 IPC `db:init` 再次调用 |
| **影响** | 无功能影响（`CREATE TABLE IF NOT EXISTS` 是幂等的），但流程不清晰 |
| **严重性** | 低。设计层面可优化。 |
| **建议** | 明确标注 Step 8 的 `db:init` 为"渲染进程确认初始化完成"的同步点，而非重复执行 schema 初始化；或移除 Step 8 的 `db:init` 调用 |

---

## 4. 文档与代码对齐检查

### 4.1 代码中缺失但文档已规划的函数

| 函数 | 定义位置 | 代码状态 | 影响 |
|------|---------|---------|------|
| `getFirstUser(db): User \| null` | 架构文档 DataAccessPort + 初始化文档 3.1 节 | `user.ts` 中不存在 | 需在实现阶段新增。两份文档已一致规划，无冲突。 |
| `getTransactionsByUser(db, userId)` | 架构文档 DataAccessPort | `transaction.ts` 中不存在 | 需在实现阶段新增。架构文档已标注为新增方法。 |
| `initDatabase()` (DataAccessPort) | 架构文档 line 584 | 不存在（IPC 层方法） | 属于新增的 IPC 桥层方法，非现有代码迁移。 |

### 4.2 代码中存在但文档未覆盖的行为

| 行为 | 代码位置 | 文档状态 | 建议 |
|------|---------|---------|------|
| `seedCategories` 未使用事务 | `category.ts` line 93-118 | 初始化文档 line 443 已识别并建议在 IPC handler 中包裹事务 | 文档已覆盖，无需修改 |
| `createUser` 的 `is_china_market` 影响默认提现率 | `user.ts` line 38 | 初始化文档向导步骤 3 已覆盖中国市场选择 | 文档已覆盖 |
| `runProjection` 的 `auto_sync_assets` 逻辑 | `fire-calc.ts` line 45-47 | UI/UX 文档 line 565 已覆盖开关行为 | 文档已覆盖 |

---

## 5. 缺失内容识别

### 5.1 设计文档层面的缺失（已在规划文档中列出）

这些缺失在规划文档中已识别，属于阶段 2/3 的设计范围，当前不构成问题：

| 缺失文档 | 规划阶段 | 状态 |
|---------|---------|------|
| 数据导出/导入设计 | 阶段 2 | 已规划 |
| 同步层详细设计 | 阶段 2 | 已规划 |
| 安全设计 | 阶段 2 | 已规划 |
| 移动端适配设计 | 阶段 3 | 已规划 |
| 部署与分发设计 | 阶段 3 | 已规划 |

### 5.2 当前文档中的内容缺失

| # | 缺失内容 | 位置 | 严重性 | 建议 |
|---|---------|------|--------|------|
| 1 | **服务层校验规则文档** | 无 | 中 | UI/UX 文档定义了 Zod 前端校验，数据模型文档定义了 SQL CHECK 约束，但服务层的业务校验规则（如"转账必须指定 to_account_id"、"删除账户前检查关联交易"）分散在各文档中，未集中定义。建议在后续 API/服务接口设计文档中集中定义。 |
| 2 | **错误码体系** | UI/UX 文档有 15 条错误码映射，但无系统性定义 | 中 | 当前错误码分散在 UI/UX 文档中。建议在阶段 2 的 API/服务接口设计中定义完整的错误码体系。 |
| 3 | **日志格式规范** | 初始化文档定义了日志文件路径，但未定义日志格式 | 低 | 建议在实现阶段确定日志格式（JSON 结构化日志 vs 纯文本），可纳入部署与分发设计文档。 |
| 4 | **数据库备份触发机制** | 初始化文档定义了备份目录，但未定义备份触发时机 | 低 | 建议在阶段 2 的数据导出/导入设计中明确：是否在迁移前自动备份、是否支持定时备份。 |
| 5 | **暗色主题实现细节** | UI/UX 文档提到"亮色/暗色/跟随系统"，初始化文档提到主题偏好存储，但无暗色主题的色彩体系定义 | 低 | 当前 UI/UX 文档仅定义了亮色色彩体系。暗色主题可作为后续增强，MVP 阶段先实现亮色。 |

---

## 6. 文档质量评估

### 6.1 评分总览

| 文档 | 一致性 | 完整性 | 准确性 | 可实施性 | 总评 |
|------|--------|--------|--------|---------|------|
| 数据模型设计 | 9/10（决策记录 #17 计数错误） | 9/10 | 9/10 | 10/10 | 优秀 |
| 缺失文档规划 | 8/10（种子分类数量错误） | 10/10 | 8/10 | 10/10 | 良好 |
| 前端架构设计 | 10/10 | 9/10 | 10/10 | 9/10 | 优秀 |
| UI/UX 设计 | 10/10 | 9/10 | 10/10 | 9/10 | 优秀 |
| 应用初始化设计 | 9/10（import 风格不统一、冗余 initSchema） | 9/10 | 9/10 | 9/10 | 优秀 |

### 6.2 整体评价

五份文档整体质量优秀，跨文档一致性高。主要问题集中在两处数量计数错误（17→18、10→11）和两处轻微的代码示例风格不统一。所有函数签名、IPC 通道定义、类型接口、种子数据清单均与代码完全对齐。`getFirstUser` 等新增函数已在两份文档中一致规划，无冲突。

---

## 7. 修正建议

### 7.1 立即修正（影响准确性）

| # | 文件 | 修正内容 |
|---|------|---------|
| 1 | `2026-07-15-fire-app-missing-design-documents-plan.md` 第 155 行 | "17 个内置分类" → "18 个内置分类" |
| 2 | `2026-07-12-fire-app-user-data-model-design.md` 第 925 行 | "10种完整枚举" → "11种完整枚举" |

### 7.2 建议修正（提升一致性）

| # | 文件 | 修正内容 |
|---|------|---------|
| 3 | `2026-07-15-fire-app-initialization-design.md` 第 293 行 | import 路径统一为 `@fire-app/shared/db/connection` |
| 4 | `2026-07-15-fire-app-initialization-design.md` 第 1357 行 | 标注 `db:init` 为"渲染进程同步确认点"，避免与 Step 3 主进程初始化混淆 |

### 7.3 后续补充（纳入阶段 2 设计）

| # | 内容 | 纳入文档 |
|---|------|---------|
| 5 | 服务层业务校验规则集中定义 | API/服务接口设计（阶段 2） |
| 6 | 完整错误码体系 | API/服务接口设计（阶段 2） |
| 7 | 日志格式规范 | 部署与分发设计（阶段 3） |
| 8 | 数据库备份触发机制 | 数据导出/导入设计（阶段 2） |

---

## 附录：检查清单

| 检查维度 | 检查项数 | 通过 | 不通过 | 通过率 |
|---------|---------|------|--------|--------|
| 函数签名一致性 | 6 | 6 | 0 | 100% |
| IPC 通道一致性 | 3 | 3 | 0 | 100% |
| 类型定义一致性 | 7（7 张表） | 7 | 0 | 100% |
| 种子数据一致性 | 18（逐条核对） | 18 | 0 | 100% |
| 技术栈选型一致性 | 8 | 8 | 0 | 100% |
| 路由结构一致性 | 6 | 6 | 0 | 100% |
| 数量计数准确性 | 2 | 0 | 2 | 0% |
| 代码示例风格一致性 | 2 | 0 | 2 | 0% |
| **总计** | **52** | **48** | **4** | **92%** |
