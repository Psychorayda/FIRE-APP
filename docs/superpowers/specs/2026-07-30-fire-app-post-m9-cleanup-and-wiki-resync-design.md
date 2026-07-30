# FIRE-APP M9 收尾：shared 死代码清理 + Code Wiki 全量重同步 设计

> **日期**：2026-07-30
> **状态**：已批准，待写实施计划
> **前置**：M9 加固里程碑已完成（21 commits 已推送，CI 全绿）
> **范围约束**：仅文档 + 死代码清理，无新功能、无 schema 变更、无破坏性改动
> **Spec 输入**：本文件

---

## 1. 背景与目标

### 1.1 背景

M9 加固里程碑已完成（Sprint S/D/P/U 共 18 个任务 + F1 收尾），代码已推送到 `origin/main`，CI 全绿。但遗留两件收尾事项：

1. **shared 死代码**：P3（服务端分页）在 desktop 侧移除了 `getTransactionsByUser` 的全部调用链，但 shared 的 model 函数及其专项测试保留未删，形成死代码。可能还有其他未使用导出/导入。
2. **Code Wiki 过时**：Wiki v1.1（最后更新 2026-07-29）在 M9 前/期间生成，仅覆盖 shared 数据层的 8 个分节，未反映 M5-M9 的代码演进（净资产趋势、FIRE 计算器、设置页、数据导入导出、加固），且无 desktop main/renderer 专节。Wiki 设计原则是"代码为权威"，当前严重偏离。

### 1.2 目标

- **Phase 1**：清理 `packages/shared` + `apps/desktop` 的死代码（未使用导出/导入），使代码表面定型
- **Phase 2**：全量重同步 Code Wiki 到 M9 后的代码实际状态，新增 2 个 desktop 分节，版本 v1.1 → v2.0

### 1.3 非目标

- 不重构代码结构（不拆文件、不改导出 barrel 设计、不调整模块边界）
- 不修复非死代码类问题（如类型不严谨、命名不一致）——仅清理"未被引用"的代码
- 不更新设计文档（specs/plans）——Wiki 的 08-design-index 仅导航到这些文档，不修改它们
- 不做 Electron 31→36 升级（M9 设计已单列后续）
- 不动 `pnpm-lock.yaml`、不动 schema、不动 IPC 通道

---

## 2. 执行顺序决策

**采用方案 A：先清理、后重同步。**

| 方案 | 描述 | 结论 |
|------|------|------|
| **A（采用）** | Phase 1 清死代码 → Phase 2 重同步 Wiki | Wiki 直接描述清理后最终状态，不返工 |
| B | 先 Wiki 后清理 | Wiki 同一片内容改两遍，浪费 |
| C | 按模块交错 | 清理是跨模块的，交错让 review 边界模糊 |

理由：死代码清理会改变 shared 的导出表面（删除函数/可能调整 index.ts re-export），Wiki 作为"代码镜像"必须在清理后定稿，否则必然返工。先定型代码、再镜像文档，符合"代码为权威"原则。

---

## 3. Phase 1：死代码清理

### 3.1 范围

- `packages/shared/src/**/*.ts`
- `packages/shared/tests/**/*.ts`
- `apps/desktop/src/**/*.{ts,tsx}`
- `apps/desktop/tests/**/*.{ts,tsx}`
- `apps/desktop/vitest.setup.ts`（测试 setup，单独纳入）

不扫描：`node_modules`、`out`、`dist`、配置文件（`*.config.ts`/`*.yml`/`*.json`）。

### 3.2 已知死代码

| 符号 | 文件 | 判定依据 |
|------|------|----------|
| `getTransactionsByUser` | [packages/shared/src/models/transaction.ts](file:///workspace/packages/shared/src/models/transaction.ts) | P3 已在 desktop 移除全部调用链；Grep 全仓引用仅命中自身定义 + 自身测试 + 历史文档注释；非 barrel re-export |
| `getTransactionsByUser` 专项测试用例 | [packages/shared/tests/models/transaction.test.ts](file:///workspace/packages/shared/tests/models/transaction.test.ts) | 随函数删除一并移除 |

### 3.3 全量扫描方法

#### 3.3.1 未使用导出符号

对 `packages/shared/src` 与 `apps/desktop/src` 下所有 `.ts`/`.tsx` 文件，执行：

1. 枚举所有 `export function` / `export const` / `export class` / `export interface` / `export type` 符号
2. 对每个符号，用 Grep 在整个 monorepo（shared + desktop src + tests）搜符号名
3. 命中规则判定：
   - 仅自身定义文件命中 → 候选死代码
   - 被 `index.ts` barrel re-export 命中 → **保留被 re-export 的符号**（公共 API 预留）；re-export 语句本身若无人消费，本次也不删（保守，避免破坏未来消费意图）
   - 被任意测试文件命中 → **保留**（有测试覆盖即视为有意保留）
   - 被其他源文件命中 → 保留（有消费者）

#### 3.3.2 保守保留规则（不删）

以下情况即使疑似无引用也**保留**，并在 spec 的"保留清单"记录原因：

- **类型导出**（`export interface` / `export type`）：可能被 JSDoc、外部隐式使用，除非 100% 确认无用
- **疑似动态引用**：符号名出现在字符串字面量、`require()`、动态 `import()`、配置文件中
- **electron-builder / vite / vitest 配置间接引用**：如 `vitest.setup.ts` 引用的模块
- **不确定的公共 API**：导出符号虽当前无消费者，但语义上像预留 API（如 `getTransactionById` vs `getTransaction`，两者都保留，因为 API 对称性）

#### 3.3.3 未使用 import

- `packages/shared` 的 `tsconfig.json` 若未开 `noUnusedLocals`/`noUnusedParameters`，用 `pnpm exec tsc --noEmit` + 人工排查
- D3 已清过 `import-service.ts` 的 `uuid`/`nowMs`，此步覆盖其余文件
- 仅删除 100% 未使用的 import；保留可能被 JSDoc `@param` 引用的类型 import

### 3.4 安全约束

- **小步提交**：每删一个符号立即跑 `packages/shared && pnpm test` + `pnpm exec tsc --noEmit -p tsconfig.json`，绿了再删下一个
- **跨包回归**：删完一批后跑 `apps/desktop && pnpm test` + `pnpm exec tsc --noEmit -p tsconfig.json` + `tsconfig.node.json`，确认 desktop 无回归
- **不删不确定项**：疑似死代码但无法 100% 确认的，记录到"保留清单"并附原因，不强行删除

### 3.5 交付物

单个 commit：
```
chore(cleanup): remove dead code in shared and desktop

- Remove getTransactionsByUser (dead since P3 pagination migration)
- Remove <其他扫描出的死代码>
- Clean unused imports in <文件>

Kept (uncertain): <保留清单>
```

---

## 4. Phase 2：Code Wiki 全量重同步

### 4.1 版本与结构

- 版本：v1.1 → **v2.0**（结构变化，新增 2 分节）
- 文件数：9 → **11**（新增 09-desktop-main.md、10-renderer.md）
- 总预估行数：3270 → ~5000-6000（含 desktop 两个新分节约 1500-2000 行）

### 4.2 比对方法（代码为权威）

每个分节执行：
1. 列出该分节对应的代码文件清单（用 Glob 实际枚举，如 `packages/shared/src/models/*.ts`）
2. 逐文件核对当前代码 vs wiki 描述
3. 差距分类：**新增**（代码有 wiki 无）、**变更**（字段/签名/行为变了）、**过时**（wiki 有代码无）
4. 过时条目**删除**（Wiki 不是 changelog，不留历史记录）

### 4.3 现有 8 个分节的更新要点

基于 M5-M9 实际代码差距：

| 分节 | 主要更新 |
|------|----------|
| **CODE_WIKI.md** 主页 | 版本 v2.0；导航目录加 09/10；架构图补 desktop main + renderer 层；速查表加 M9 安全/性能约定（CSP/沙箱/路径 token/虚拟化阈值=20/懒加载/manualChunks）；测试计数更新（shared 184 + desktop 306） |
| **01-overview.md** | 当前状态表补 M5-M9 成果（净资产趋势、FIRE 计算器、设置页、数据导入导出、加固）；技术栈补 zod / @tanstack/react-virtual / iconv-lite；4 层架构图扩展为含 desktop main + renderer；使用场景补"CSV 导入" |
| **02-database.md** | schema 加 M9 CHECK 约束（transactions.amount>0 / recurring.interval>=1 / end_date>=start_date / retirement_years 等）+ 13 个 partial index + categories 偏唯一索引 `idx_cat_unique_active`；索引数 9→22；补 M8 export envelope 结构（7 表 + header + crypto 标记） |
| **03-types.md** | 补 M8 类型：`ExportEnvelope`/`ExportHeader`/`ParsedCsvTransaction`/`ImportResult`/`CsvTemplate`/`ExportTableName`；补 M9 类型：`TransactionPageParams`/`TransactionPage`/`MonthlyOverview`/`RecurringUpdateFields`；删除 `getTransactionsByUser` 相关引用 |
| **04-models.md** | 新增 `transaction-queries.ts`（getTransactionsPage/getRecentTransactions/getMonthlyOverview 3 函数）；`recurring.ts` updateRecurring 类型收紧为 `RecurringUpdateFields`；删除 `getTransactionsByUser` 条目（过时） |
| **05-services.md** | 新增 `column-whitelist.ts`（getColumnWhitelist/isValidColumnName/filterRecordColumns）、`clear-service.ts`（clearAllTransactions + sync_version 递增）；更新 import-service（白名单过滤+复用 createTransaction+dedupHash 加 transaction_type）/export-service（剔除 encryption_key_hash）/recurring-service（事务包裹+幂等检查）；补 M8 模板系统（7 套预设模板 + registry + detectTemplate + 关键词推断） |
| **06-utils.md** | 校对 `money.ts`/`sync.ts`/`time.ts` 是否有 M5-M9 改动；若有 use-currency 的 CURRENCY_SYMBOLS/CURRENCY_LOCALES 常量则补；format 函数签名变更（接收 currency 参数）则记录 |
| **07-tests.md** | 测试计数从"13 文件/97 用例"更新为"shared 23 文件/184 用例 + desktop 23 文件/306 用例"；补代码-测试映射表的新模块（path-guard/schemas/ErrorBoundary/transaction-queries/column-whitelist/clear-service/ipc-schemas/error-boundary） |
| **08-design-index.md** | 从 9 份扩容到 specs 30 + plans 18 份，补 M2-M9 各里程碑摘要；"尚未实现"清单更新（加密同步仍规划中，前端已实现 → 移除该项） |

### 4.4 新增分节内容

#### 09-desktop-main.md — Desktop 主进程

| 小节 | 内容 |
|------|------|
| 入口 `main/index.ts` | Electron 生命周期、窗口创建、M9 加固（sandbox:true / contextIsolation / nodeIntegration:false / setWindowOpenHandler 拦截 window.open / will-navigate dev URL 守卫 / app.isPackaged 时注入严格 CSP 头） |
| `db-manager.ts` | SQLite 连接管理（WAL 模式、initSchema、用户隔离） |
| IPC 注册 `register-handlers.ts` | sanitizeError 函数（错误分类 VALIDATION_ERROR/DB_ERROR/PATH_ERROR + 脱敏对外消息）、handler 注册总览 |
| 各 `*-handlers.ts` | account/transaction/recurring/user/scenario/snapshot/export-import 各 handler 的 zod 校验接入点与 IPC 通道名清单 |
| `path-guard.ts` | dialog 签发 token 机制（issuePathToken/consumePathToken/isPathSafe/assertFileOperationAllowed）、一次性消费、`..` 穿越/非绝对路径拒绝 |
| `schemas.ts` | zod 输入 schema 定义（createAccountSchema/editAccountSchema/createTransactionSchema/editTransactionSchema/createRecurringSchema/updateUserSchema/updateScenarioSchema） |
| `export-import-handlers.ts` | export:json/export:csv/import:json/import:parseCsv/import:csvTransactions/import:detectTemplate 通道，文件读写前 path-guard 校验 |
| preload `index.ts` | `window.dataAccess` 暴露面（accounts/tx/recurring/user/scenario/snapshot/exportImport 各命名空间的方法清单） |

#### 10-renderer.md — Renderer 渲染层

| 小节 | 内容 |
|------|------|
| 路由 `router/index.tsx` | createHashRouter、React.lazy 懒加载 7 页面、RequireInit 守卫 |
| `App.tsx` | ErrorBoundary（最外层）+ Suspense（懒加载 fallback）+ RouterProvider |
| `electron.vite.config.ts` | manualChunks 分包（react-vendor / recharts / zustand）、noExternal 配置 |
| stores | account-store（局部 upsert/remove）、transaction-store（分页 pagedTransactions/total/recentTransactions + upsertLocal/removeLocal）、scenario-store（error 状态 + clearError）、toast-store（showSuccess/showError）、app-store（currentUser/base_currency） |
| data 层 | data-access-port.ts（接口定义）、ipc-data-access.ts（IPC 实现）、ipc.d.ts（window.dataAccess 类型声明） |
| base 组件 | Table.tsx（@tanstack/react-virtual 虚拟化，阈值=20，>20 行启用）、Input/Select（useId + htmlFor label 关联）、Button（type prop）、ErrorBoundary.tsx（class component + getDerivedStateFromError + 重试） |
| data-management | DataManagementPanel（try/catch + loading + 导入/清空后 store 刷新）、CsvImportWizard（5 步向导）、ClearTransactionsDialog（输入确认 + 警告） |
| pages | Dashboard（getMonthlyOverview + getRecentTransactions SQL 聚合替代前端聚合）、Transactions（服务端分页 PAGE_SIZE=50 + 筛选下推 + 局部更新）、FireCalculator（toast 反馈）、Settings（DataManagementPanel 集成）、NetWorth（趋势图）、Accounts（局部更新）、Onboarding |
| hooks | use-currency.ts（从 app-store 读 base_currency + formatCurrency） |
| constants | 各 `*-constants.ts` 的 format 函数签名变更（接收 currency 参数） |

### 4.5 防漏机制

落实"代码为权威"：

1. **每个分节开头列"对应代码文件清单"**，用 Glob 实际枚举（如 `packages/shared/src/models/*.ts`），确保无遗漏
2. **写完后交叉校验**：`ls` 所有代码文件 vs wiki 里 `file:///` 链接出现的文件，差集人工复核
3. **过时条目必删**：如 `getTransactionsByUser`，不留"历史记录"
4. **版本/日期/计数同步**：所有分节顶部 `> 最后更新: 2026-07-30`，主页版本 v2.0

### 4.6 交付物

单个 commit：
```
docs(wiki): full resync M5-M9 + add desktop sections (v2.0)

- Update 8 existing sections (01-08) to reflect M5-M9 code changes
- Add 09-desktop-main.md (main process: IPC/path-guard/schemas/Electron hardening)
- Add 10-renderer.md (renderer: lazy routes/stores/virtualized table/ErrorBoundary/hooks)
- Update CODE_WIKI.md to v2.0 with 11-section navigation
- Test counts: shared 184 + desktop 306
```

---

## 5. 风险与缓解

| 风险 | 缓解 |
|------|------|
| 误删非死代码（如被动态引用） | 3.3.2 保守保留规则；不确定项进"保留清单"不删 |
| 删符号导致 desktop 编译失败 | 3.4 小步提交 + 跨包 tsc/test 回归 |
| Wiki 漏写新模块 | 4.5 防漏机制（Glob 枚举 + 交叉校验） |
| Wiki 描述与代码细节不符 | 4.2 逐文件核对，不以记忆为准 |
| 工作量超预期 | 按 Phase 推进，每个 Phase 完成即可提交，可中断 |

---

## 6. 成功标准

- Phase 1：shared + desktop 全量测试绿（≥ 490 用例）+ tsc exit 0 + 死代码减少（`getTransactionsByUser` 必删）
- Phase 2：Wiki 11 个分节全部 `最后更新: 2026-07-30` + 主页 v2.0 + 交叉校验无遗漏文件 + 8 个旧分节无过时条目
- 整体：2 个 commit，CI 全绿

---

## 7. 范围外 Backlog

- Electron 31→36 升级（M9 设计已单列）
- 加密同步层实现（仍规划中）
- shared 导出 barrel 结构重构（本设计明确不做）
- Wiki 英文版（当前中文为主）
- Wiki 自动生成工具（如 typedoc，当前手工维护）
