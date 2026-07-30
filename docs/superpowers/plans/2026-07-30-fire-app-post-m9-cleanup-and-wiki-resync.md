# FIRE-APP M9 收尾：死代码清理 + Code Wiki 全量重同步 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 清理 shared + desktop 死代码（Phase 1），再全量重同步 Code Wiki 到 M9 后状态并新增 2 个 desktop 分节（Phase 2），版本 v1.1→v2.0。

**Architecture:** 方案 A 先清理后重同步。Phase 1 用 Grep 逐符号扫描未使用导出，保守保留不确定项，小步提交+跨包回归。Phase 2 按分节逐文件核对代码差距，8 个旧分节更新 + 2 个新分节（09-desktop-main / 10-renderer），Glob 枚举防漏。

**Tech Stack:** TypeScript、Electron、React 19、better-sqlite3、vitest、pnpm workspace monorepo。无新依赖。

**Spec:** [docs/superpowers/specs/2026-07-30-fire-app-post-m9-cleanup-and-wiki-resync-design.md](../specs/2026-07-30-fire-app-post-m9-cleanup-and-wiki-resync-design.md)

**约束：** 仅文档 + 死代码清理，无新功能、无 schema 变更、无破坏性改动。不动 pnpm-lock.yaml / schema / IPC 通道。

**基线状态（执行前核实）：** shared 184 测试 + desktop 306 测试全绿；3 个 tsc exit 0。

---

## 文件结构总览

### Phase 1（死代码清理）— 修改/删除文件
| 文件 | 操作 | 职责 |
|------|------|------|
| `packages/shared/src/models/transaction.ts` | 修改 | 删除 `getTransactionsByUser` 函数（L14-25） |
| `packages/shared/tests/models/transaction.test.ts` | 修改 | 删除 `getTransactionsByUser` 专项测试用例 |
| `packages/shared/src/**/*.ts` | 修改 | 删除扫描出的未使用 import（如有） |
| `apps/desktop/src/**/*.{ts,tsx}` | 修改 | 删除扫描出的未使用 import（如有） |

### Phase 2（Wiki 重同步）— 修改/新建文件
| 文件 | 操作 | 职责 |
|------|------|------|
| `docs/wiki/CODE_WIKI.md` | 修改 | 主页 v2.0，导航加 09/10，速查表补 M9 约定 |
| `docs/wiki/01-overview.md` | 修改 | 状态表补 M5-M9，技术栈补依赖，架构图扩展 |
| `docs/wiki/02-database.md` | 修改 | 补 24 处 CHECK + 14 索引 + export envelope |
| `docs/wiki/03-types.md` | 修改 | 补 M8/M9 类型，删 getTransactionsByUser 引用 |
| `docs/wiki/04-models.md` | 修改 | 加 transaction-queries，删 getTransactionsByUser |
| `docs/wiki/05-services.md` | 修改 | 加 column-whitelist/clear-service，更新 4 服务，补模板系统 |
| `docs/wiki/06-utils.md` | 修改 | 校对 + 补 use-currency 常量 |
| `docs/wiki/07-tests.md` | 修改 | 计数更新 + 补新模块映射 |
| `docs/wiki/08-design-index.md` | 修改 | 扩容到 specs 30 + plans 18 |
| `docs/wiki/09-desktop-main.md` | 新建 | main 进程：IPC/path-guard/schemas/Electron 加固 |
| `docs/wiki/10-renderer.md` | 新建 | renderer：路由/stores/虚拟化/ErrorBoundary/hooks |

---

# Phase 1：死代码清理

## Task C1: 删除已知死代码 getTransactionsByUser

**Files:**
- Modify: `packages/shared/src/models/transaction.ts`（删除 L14-25，含 JSDoc 注释）
- Modify: `packages/shared/tests/models/transaction.test.ts`（删除对应测试用例）

- [ ] **Step 1: 核实基线测试绿**

Run: `cd /workspace/packages/shared && pnpm exec vitest run tests/models/transaction.test.ts`
Expected: PASS（当前全绿）

- [ ] **Step 2: 删除 getTransactionsByUser 函数**

用 Edit 删除 `packages/shared/src/models/transaction.ts` 的 L14-25（JSDoc 注释 + 函数定义）。删除后文件应只剩 `getTransaction` 和 `getTransactionById` 两个函数。

删除的内容（精确匹配）：
```typescript
/**
 * 获取用户的所有交易列表（排除已删除，按日期倒序）
 * Get all transactions for a user (excludes deleted, sorted by date desc)
 * @param db 数据库实例 / Database instance
 * @param userId 用户 ID / User ID
 * @returns 交易列表 / Transaction list
 */
export function getTransactionsByUser(db: DatabaseType, userId: string): Transaction[] {
  return db.prepare(
    'SELECT * FROM transactions WHERE user_id = ? AND deleted_flag = 0 ORDER BY transaction_date DESC, updated_at DESC'
  ).all(userId) as Transaction[];
}
```

- [ ] **Step 3: 删除对应测试用例**

用 Read 读取 `packages/shared/tests/models/transaction.test.ts`，找到测试 `getTransactionsByUser` 的 describe 块或 it 用例，用 Edit 删除。保留 `getTransaction` 和 `getTransactionById` 的测试。

- [ ] **Step 4: 验证 shared 测试通过**

Run: `cd /workspace/packages/shared && pnpm exec vitest run tests/models/transaction.test.ts`
Expected: PASS（剩余测试全绿，无 import 错误）

- [ ] **Step 5: 验证 shared 全量测试无回归**

Run: `cd /workspace/packages/shared && pnpm test`
Expected: 全绿（用例数减少 = 删除的 getTransactionsByUser 测试数）

- [ ] **Step 6: 验证 tsc 无错**

Run: `cd /workspace/packages/shared && pnpm exec tsc --noEmit -p tsconfig.json`
Expected: exit 0

- [ ] **Step 7: 验证 desktop 无回归**

Run: `cd /workspace/apps/desktop && pnpm exec tsc --noEmit -p tsconfig.json && pnpm exec tsc --noEmit -p tsconfig.node.json && pnpm test`
Expected: 全绿（desktop 通过 @shared/... deep import，不依赖 getTransactionsByUser）

- [ ] **Step 8: 提交**

```bash
cd /workspace && git add packages/shared/src/models/transaction.ts packages/shared/tests/models/transaction.test.ts && git commit -m "chore(cleanup): remove dead getTransactionsByUser (dead since P3 pagination)"
```

---

## Task C2: 全量扫描未使用导出符号（shared）

**Files:**
- Modify: `packages/shared/src/**/*.ts`（如发现死代码则删除）

- [ ] **Step 1: 枚举 shared 所有导出符号**

用 Grep 在 `/workspace/packages/shared/src` 搜索 `^export (function|const|class) ` （只查值导出，类型导出按 spec 3.3.2 保守保留）。

记录符号名清单 + 定义文件。

- [ ] **Step 2: 逐符号 Grep 引用**

对清单中每个符号，用 Grep 在 `/workspace`（排除 node_modules/out/dist/docs）搜索符号名。

判定规则（按 spec 3.3.1）：
- 仅自身定义文件命中 → 候选死代码
- 被 `packages/shared/src/index.ts` barrel re-export（通过 `export * from './models/xxx.js'`）→ **保留**（公共 API 预留）
- 被任意 `tests/` 文件命中 → **保留**
- 被 `apps/desktop/src/` 文件命中 → **保留**（有消费者）

**已知非死代码（无需扫描，已确认有消费者）：**
- `getTransaction` / `getTransactionById`：被 transaction-service.ts 引用
- `createTransaction` / `editTransaction` / `deleteTransaction`：被 desktop IPC 引用
- 所有 model 的 create/get/update/delete：被 desktop handlers 引用
- 所有 service 函数：被 desktop IPC 引用
- 所有 utils（nowMs/toYearMonth/addMonths/monthsBetween/createSyncMeta/bumpSyncVersion/money 函数）：被多处引用
- `TABLE_NAMES` / `initSchema` / `createDatabase` / `closeDatabase`：被 desktop db-manager 引用
- `EXPORT_TABLE_NAMES` / `ExportTableName` / `buildExportEnvelope` / `serializeExportEnvelope` / `buildCsvExport`：被 desktop export-import-handlers 引用
- `importJsonWithLww` / `importCsvTransactions` / `markDuplicateTransactions` / `resolveCategoryForTransactions`：被 desktop export-import-handlers 引用
- `clearAllTransactions` / `ClearResult`：被 desktop export-import-handlers 引用
- `getColumnWhitelist` / `isValidColumnName` / `filterRecordColumns`：被 import-service 引用
- `getTransactionsPage` / `getRecentTransactions` / `getMonthlyOverview`：被 desktop transaction-handlers 引用
- `processRecurringTransactions`：被 desktop recurring-handlers 引用
- `generateMonthlySnapshot`：被 desktop snapshot-handlers 引用
- `calculateFireNumber` / `calculateAdjustedFireNumber` / `calculateAccumulation` / `calculateProgress` / `runProjection`：被 desktop fire-calc-handlers 引用
- `resetSystemCategories`：被 desktop category-handlers 引用
- `seedCategories`：被 desktop 引用
- `rcuDebitTemplate`：被 registry.ts 引用

**重点扫描候选（可能死代码）：**
- `getTransactionById`（vs `getTransaction`，API 对称性，按 spec 3.3.2 保留）
- `updateAccountBalance`（account.ts，可能仅 test 用）
- `getInvestableBalance` / `getNetWorth` / `hasTransactions` / `softDeleteAccount`（account.ts，核实是否有 desktop 消费者）
- `getFirstUser`（user.ts，核实是否被 desktop 引用）
- `getActiveRecurring`（recurring.ts，核实是否被 recurring-service 或 desktop 引用）
- `getSnapshots` / `getSnapshotByMonth` / `insertSnapshot`（snapshot.ts，核实是否被 snapshot-service 或 desktop 引用）
- `getScenario` / `getScenarios` / `updateScenario` / `createScenario`（scenario.ts，核实 desktop 引用）
- `getCategories` / `createCategory` / `getCategory`（category.ts，核实 desktop 引用）
- `createUser` / `getUser` / `updateUser`（user.ts，核实 desktop 引用）
- `createAccount` / `getAccount` / `getAccounts` / `updateAccount`（account.ts，核实 desktop 引用）
- `createRecurring` / `updateRecurring`（recurring.ts，核实 desktop 引用）
- `EXPORT_TABLE_NAMES`（核实是否仅 ExportTableName 类型用）

- [ ] **Step 3: 对每个候选符号执行 Grep**

对 Step 2 列出的重点候选，逐个用 Grep 搜符号名，路径 `/workspace/apps/desktop/src` + `/workspace/packages/shared/src` + `/workspace/packages/shared/tests`。

示例命令（以 `updateAccountBalance` 为例）：
```
Grep pattern="updateAccountBalance" path="/workspace" output_mode=files_with_matches
```

- [ ] **Step 4: 判定并记录死代码清单**

对每个候选，根据 Grep 结果判定：
- 仅自身定义文件 + 自身测试命中 → 死代码，加入删除清单
- 有 desktop src 消费者 → 保留
- 仅 barrel re-export（无实际消费者）→ 保留（spec 3.3.1 规则）

记录最终删除清单 + 保留清单（含保留原因）。

- [ ] **Step 5: 逐个删除死代码（小步）**

对删除清单中每个符号：
1. 用 Edit 删除函数定义
2. 用 Grep 找到对应测试用例，用 Edit 删除
3. Run: `cd /workspace/packages/shared && pnpm exec vitest run <相关测试文件>`
4. Expected: PASS

- [ ] **Step 6: 验证 shared 全量测试 + tsc**

Run: `cd /workspace/packages/shared && pnpm test && pnpm exec tsc --noEmit -p tsconfig.json`
Expected: 全绿，exit 0

- [ ] **Step 7: 验证 desktop 无回归**

Run: `cd /workspace/apps/desktop && pnpm exec tsc --noEmit -p tsconfig.json && pnpm exec tsc --noEmit -p tsconfig.node.json && pnpm test`
Expected: 全绿

- [ ] **Step 8: 提交（如有删除）**

```bash
cd /workspace && git add packages/shared/src/ packages/shared/tests/ && git commit -m "chore(cleanup): remove unused exports in shared

Removed: <删除清单>
Kept (uncertain): <保留清单+原因>"
```

若 Step 4 判定无死代码（除 C1 已删的 getTransactionsByUser），则跳过本 Task 提交，在最终报告记录"扫描后无额外死代码"。

---

## Task C3: 全量扫描未使用导出符号（desktop）

**Files:**
- Modify: `apps/desktop/src/**/*.{ts,tsx}`（如发现死代码则删除）

- [ ] **Step 1: 枚举 desktop 所有导出符号**

用 Grep 在 `/workspace/apps/desktop/src` 搜索 `^export (function|const|class) ` （只查值导出）。

记录符号名清单 + 定义文件。

**注意：desktop 组件（`export function XxxPage` / `export default`）通常被 router 或父组件引用，需核实。**

- [ ] **Step 2: 逐符号 Grep 引用**

对清单中每个符号，用 Grep 在 `/workspace/apps/desktop/src` + `/workspace/apps/desktop/tests` 搜索符号名。

判定：
- 仅自身定义文件命中 → 候选死代码
- 被 router/index.tsx lazy import 命中 → 保留
- 被任意父组件 import 命中 → 保留
- 被测试命中 → 保留

**重点候选（可能死代码）：**
- 各 store 的方法（如 `useXxxStore.getState().xxx`，需核实是否有 UI 消费）
- 各 constants 文件的导出函数（如 format 函数，被组件消费）
- `data-access.ts`（若与 ipc-data-access.ts 重复）
- 各 base 组件（被页面消费）

- [ ] **Step 3: 对候选符号执行 Grep**

逐个 Grep，路径 `/workspace/apps/desktop`。

- [ ] **Step 4: 判定并记录死代码清单**

记录删除清单 + 保留清单。

**保守规则（按 spec 3.3.2）：**
- 组件导出（`export function Xxx`）即使疑似无引用也保留（可能被动态路由或未来使用）
- store 方法保留（Zustand 方法可能通过 hook 间接消费）
- 仅删除 100% 确认无引用的工具函数/常量

- [ ] **Step 5: 逐个删除死代码（小步，如有）**

对删除清单中每个符号：
1. Edit 删除定义
2. Grep 找测试，Edit 删除
3. Run: `cd /workspace/apps/desktop && pnpm exec vitest run <测试文件>`
4. Expected: PASS

- [ ] **Step 6: 验证 desktop 全量测试 + tsc**

Run: `cd /workspace/apps/desktop && pnpm test && pnpm exec tsc --noEmit -p tsconfig.json && pnpm exec tsc --noEmit -p tsconfig.node.json`
Expected: 全绿

- [ ] **Step 7: 提交（如有删除）**

```bash
cd /workspace && git add apps/desktop/src/ apps/desktop/tests/ && git commit -m "chore(cleanup): remove unused exports in desktop

Removed: <删除清单>
Kept (uncertain): <保留清单+原因>"
```

若 Step 4 判定无死代码，则跳过提交，记录"扫描后无额外死代码"。

---

## Task C4: 清理未使用 import

**Files:**
- Modify: `packages/shared/src/**/*.ts`、`apps/desktop/src/**/*.{ts,tsx}`（如发现）

- [ ] **Step 1: 检查 tsconfig 是否开启 noUnusedLocals**

用 Read 读取 `/workspace/packages/shared/tsconfig.json` 和 `/workspace/apps/desktop/tsconfig*.json`，确认是否含 `"noUnusedLocals": true` / `"noUnusedParameters": true`。

- [ ] **Step 2: 若未开启，用 tsc + 人工排查**

若未开启，临时开启跑 tsc 观察警告（不改 tsconfig，仅排查）：
```
cd /workspace/packages/shared && pnpm exec tsc --noEmit --noUnusedLocals --noUnusedParameters -p tsconfig.json 2>&1 | head -50
```
```
cd /workspace/apps/desktop && pnpm exec tsc --noEmit --noUnusedLocals --noUnusedParameters -p tsconfig.json 2>&1 | head -50
```

- [ ] **Step 3: 删除确认未使用的 import**

对 tsc 报出的每个 `is declared but never used`，用 Edit 删除该 import 行。

**保守规则：** 保留 `import type` （可能被 JSDoc 引用）；仅删除 `import { xxx }` 中确认未使用的具名 import。

- [ ] **Step 4: 验证测试 + tsc**

Run: `cd /workspace/packages/shared && pnpm test && pnpm exec tsc --noEmit -p tsconfig.json`
Run: `cd /workspace/apps/desktop && pnpm test && pnpm exec tsc --noEmit -p tsconfig.json && pnpm exec tsc --noEmit -p tsconfig.node.json`
Expected: 全绿

- [ ] **Step 5: 提交（如有删除）**

```bash
cd /workspace && git add packages/shared/src/ apps/desktop/src/ && git commit -m "chore(cleanup): remove unused imports"
```

若无未使用 import，跳过提交。

---

## Task C5: Phase 1 收尾验证

- [ ] **Step 1: shared 全量测试**

Run: `cd /workspace/packages/shared && pnpm test`
Expected: 全绿

- [ ] **Step 2: desktop 全量测试**

Run: `cd /workspace/apps/desktop && pnpm test`
Expected: 全绿

- [ ] **Step 3: 3 个 tsc**

Run: `cd /workspace/packages/shared && pnpm exec tsc --noEmit -p tsconfig.json`
Run: `cd /workspace/apps/desktop && pnpm exec tsc --noEmit -p tsconfig.json`
Run: `cd /workspace/apps/desktop && pnpm exec tsc --noEmit -p tsconfig.node.json`
Expected: 全部 exit 0

- [ ] **Step 4: 构建**

Run: `cd /workspace && pnpm build`
Expected: 成功

- [ ] **Step 5: 记录 Phase 1 总结**

记录：删除的死代码清单、保留清单+原因、测试数变化。Phase 1 完成，进入 Phase 2。

---

# Phase 2：Code Wiki 全量重同步

## Task W1: 新建 09-desktop-main.md

**Files:**
- Create: `docs/wiki/09-desktop-main.md`

- [ ] **Step 1: 枚举 main 进程代码文件**

用 Glob 确认 `/workspace/apps/desktop/src/main/**/*.ts` 文件清单（基线核实已知 17 个文件）：
- `index.ts`（入口 + Electron 加固）
- `db-manager.ts`（SQLite 连接管理）
- `ipc-handlers.ts`（注册总入口）
- `ipc/register-handlers.ts`（sanitizeError + 注册）
- `ipc/path-guard.ts`（dialog token 机制）
- `ipc/schemas.ts`（zod 输入校验）
- `ipc/db-handlers.ts` / `user-handlers.ts` / `account-handlers.ts` / `category-handlers.ts` / `transaction-handlers.ts` / `recurring-handlers.ts` / `scenario-handlers.ts` / `snapshot-handlers.ts` / `fire-calc-handlers.ts` / `export-import-handlers.ts`（10 个领域 handler）
- `import-csv-parser.ts`（CSV 解析）

- [ ] **Step 2: 读取关键文件提取事实**

用 Read 读取以下文件，提取函数签名/IPC 通道名/关键逻辑：
- `/workspace/apps/desktop/src/main/index.ts`（Electron 加固配置：sandbox/CSP/setWindowOpenHandler/will-navigate）
- `/workspace/apps/desktop/src/main/ipc/register-handlers.ts`（sanitizeError 分类逻辑）
- `/workspace/apps/desktop/src/main/ipc/path-guard.ts`（4 个函数签名 + 一次性消费逻辑）
- `/workspace/apps/desktop/src/main/ipc/schemas.ts`（7 个 zod schema 名）
- `/workspace/apps/desktop/src/main/ipc/export-import-handlers.ts`（IPC 通道名清单）
- `/workspace/apps/desktop/src/preload/index.ts`（window.dataAccess 暴露面，用 Glob 找路径）

- [ ] **Step 3: 写 09-desktop-main.md**

创建 `docs/wiki/09-desktop-main.md`，结构：
1. 文件头（`> 最后更新: 2026-07-30` + 导航 `[← 08] [10 →]`）
2. 概述（main 进程职责：Electron 生命周期 + SQLite + IPC 桥 + 安全加固）
3. 入口 `index.ts`（Electron 加固配置表：sandbox/contextIsolation/nodeIntegration/setWindowOpenHandler/will-navigate/CSP 注入）
4. `db-manager.ts`（WAL 模式 + initSchema + getDatabase）
5. IPC 注册 `register-handlers.ts`（sanitizeError 错误分类表：VALIDATION_ERROR/DB_ERROR/PATH_ERROR/UNKNOWN + 脱敏逻辑）
6. `path-guard.ts`（4 函数签名表 + 一次性 token 流程说明 + 安全规则：绝对路径/无 `..` 穿越/必须 dialog 签发）
7. `schemas.ts`（7 个 zod schema 名清单 + 校验接入方式 `.parse()` 抛 ZodError）
8. 领域 handlers 清单表（10 个 handler 文件 + 各自 IPC 通道名前缀）
9. `export-import-handlers.ts`（6 个通道名 + path-guard 校验点）
10. preload `index.ts`（window.dataAccess 命名空间表：accounts/tx/recurring/user/scenario/snapshot/exportImport）
11. `import-csv-parser.ts`（CSV 解析，iconv-lite GBK 处理）

所有源码引用用 `file:///workspace/apps/desktop/src/main/xxx.ts` 可点击链接。

- [ ] **Step 4: 自查文件完整性**

用 Grep 搜索 `09-desktop-main.md` 中的 `file:///` 链接，逐一确认对应文件存在（用 LS/Glob）。补漏。

- [ ] **Step 5: 提交**

```bash
cd /workspace && git add docs/wiki/09-desktop-main.md && git commit -m "docs(wiki): add 09-desktop-main section (IPC/path-guard/schemas/Electron hardening)"
```

---

## Task W2: 新建 10-renderer.md

**Files:**
- Create: `docs/wiki/10-renderer.md`

- [ ] **Step 1: 枚举 renderer 代码文件**

用 Glob 确认 `/workspace/apps/desktop/src/renderer/src/**/*.{ts,tsx}` 文件清单（基线核实已知 ~70 个文件），分类：
- 入口：`main.tsx` / `App.tsx`
- 路由：`router/index.tsx` / `router/RequireInit.tsx`
- stores：`stores/*.ts`（account/transaction/scenario/toast/app/category/snapshot/index）
- data 层：`data/data-access-port.ts` / `data/ipc-data-access.ts` / `data/data-access.ts` / `types/ipc.d.ts`
- hooks：`hooks/use-currency.ts`
- base 组件：`components/base/*.tsx`（Table/Input/Select/Button/ErrorBoundary/ConfirmDialog/Tag/Modal/ChartContainer/Card）
- layout：`components/layout/*.tsx`（AppLayout/Sidebar/PageHeader）
- auxiliary：`components/auxiliary/*.tsx`（EmptyState/Toast）
- 业务组件：accounts/transactions/dashboard/net-worth/fire-calculator/data-management 各目录
- pages：7 个页面
- constants：4 个 `*-constants.ts`

- [ ] **Step 2: 读取关键文件提取事实**

用 Read 读取：
- `/workspace/apps/desktop/src/renderer/src/router/index.tsx`（懒加载 7 页面 + RequireInit）
- `/workspace/apps/desktop/src/renderer/src/App.tsx`（ErrorBoundary + Suspense + RouterProvider）
- `/workspace/apps/desktop/src/renderer/src/stores/transaction-store.ts`（分页状态 + upsertLocal/removeLocal）
- `/workspace/apps/desktop/src/renderer/src/stores/account-store.ts`（局部 upsert/remove）
- `/workspace/apps/desktop/src/renderer/src/stores/scenario-store.ts`（error 状态）
- `/workspace/apps/desktop/src/renderer/src/stores/toast-store.ts`（showSuccess/showError）
- `/workspace/apps/desktop/src/renderer/src/stores/app-store.ts`（currentUser/base_currency）
- `/workspace/apps/desktop/src/renderer/src/components/base/Table.tsx`（虚拟化阈值=20）
- `/workspace/apps/desktop/src/renderer/src/components/base/ErrorBoundary.tsx`（class component + 重试）
- `/workspace/apps/desktop/src/renderer/src/components/base/Input.tsx` / `Select.tsx`（useId + htmlFor）
- `/workspace/apps/desktop/src/renderer/src/hooks/use-currency.ts`
- `/workspace/apps/desktop/electron.vite.config.ts`（manualChunks）

- [ ] **Step 3: 写 10-renderer.md**

创建 `docs/wiki/10-renderer.md`，结构：
1. 文件头（`> 最后更新: 2026-07-30` + 导航 `[← 09] [→ CODE_WIKI]`）
2. 概述（renderer 职责：React 19 + Zustand + 路由 + 组件 + IPC 消费）
3. 入口与路由（`main.tsx` → `App.tsx`（ErrorBoundary 最外 + Suspense + RouterProvider）→ `router/index.tsx`（createHashRouter + React.lazy 7 页面 + RequireInit 守卫））
4. 构建配置 `electron.vite.config.ts`（manualChunks：react-vendor/recharts/zustand + noExternal）
5. stores 层（表：store 名 + 状态字段 + 关键方法 + selector 模式）
   - account-store：局部 upsert/remove
   - transaction-store：分页（pagedTransactions/total/recentTransactions）+ upsertLocal/removeLocal
   - scenario-store：error 状态 + clearError
   - toast-store：showSuccess/showError
   - app-store：currentUser/base_currency
   - category-store / snapshot-store
6. data 层（data-access-port 接口定义 + ipc-data-access IPC 实现 + ipc.d.ts 类型声明 + data-access.ts）
7. base 组件（表：组件 + 职责 + 关键 prop）
   - Table：@tanstack/react-virtual 虚拟化，阈值=20（>20 行启用），estimateSize=48px，overscan=10
   - ErrorBoundary：class component，getDerivedStateFromError + componentDidCatch + 重试按钮
   - Input/Select：useId 生成 id + htmlFor label 关联
   - Button：type prop（button/submit/reset）
   - 其余：ConfirmDialog/Tag/Modal/ChartContainer/Card
8. layout 组件（AppLayout/Sidebar 响应式折叠/PageHeader）
9. auxiliary 组件（EmptyState/Toast）
10. 业务组件（按目录：accounts/transactions/dashboard/net-worth/fire-calculator/data-management，列关键组件 + 职责）
    - data-management：DataManagementPanel（try/catch+loading+store 刷新）/CsvImportWizard（5 步向导）/ClearTransactionsDialog
11. pages（7 页面表：页面 + 数据来源 + 关键特性）
    - Dashboard：getMonthlyOverview + getRecentTransactions SQL 聚合
    - Transactions：服务端分页 PAGE_SIZE=50 + 筛选下推 + 局部更新
    - FireCalculator：toast 反馈
    - Settings：DataManagementPanel 集成
    - NetWorth/Accounts/Onboarding
12. hooks（use-currency.ts：从 app-store 读 base_currency + formatCurrency）
13. constants（4 个 `*-constants.ts`：format 函数接收 currency 参数 + CURRENCY_SYMBOLS/CURRENCY_LOCALES）

所有源码引用用 `file:///` 可点击链接。

- [ ] **Step 4: 自查文件完整性**

用 Grep 搜索 `10-renderer.md` 中的 `file:///` 链接，逐一确认文件存在。补漏。

- [ ] **Step 5: 提交**

```bash
cd /workspace && git add docs/wiki/10-renderer.md && git commit -m "docs(wiki): add 10-renderer section (lazy routes/stores/virtualized table/ErrorBoundary/hooks)"
```

---

## Task W3: 更新 02-database.md

**Files:**
- Modify: `docs/wiki/02-database.md`

- [ ] **Step 1: 读取当前 02-database.md + schema.ts**

用 Read 读取 `/workspace/docs/wiki/02-database.md` 和 `/workspace/packages/shared/src/db/schema.ts`。

- [ ] **Step 2: 更新 schema 部分**

补 M9 的 24 处 CHECK 约束（按表分组列）：
- accounts：asset_class IN(...) / account_type IN(...) / current_balance（liability 时 <=0）
- categories：type IN('income','expense')
- transactions：transaction_type IN(...) / amount>0 / transfer 必须有 to_account_id / to_account_id != account_id
- recurring_transactions：transaction_type/amount>0/frequency/interval>0/next_due_date>=start_date/end_date>=start_date
- fire_scenarios：current_age>=0 / retirement_age>current_age / 各金额>=0 / expected_return_rate/inflation_rate BETWEEN / withdrawal_rate BETWEEN 200-600 / retirement_years>0

- [ ] **Step 3: 更新索引部分**

索引数从 9 更新为 14（13 partial index + 1 unique partial index）：
- transactions：6 个（idx_tx_user_date / idx_tx_account / idx_tx_to_account / idx_tx_category / idx_tx_recurring / idx_tx_recurring_date），均 WHERE deleted_flag=0
- accounts：2 个（idx_acc_user_class / idx_acc_user），WHERE deleted_flag=0
- categories：2 个（idx_cat_user / idx_cat_unique_active UNIQUE），WHERE deleted_flag=0
- recurring_transactions：2 个（idx_recur_active WHERE is_active=1 AND deleted_flag=0 / idx_recur_user WHERE deleted_flag=0）
- net_worth_snapshots：1 个（idx_snap_user），WHERE deleted_flag=0
- fire_scenarios：1 个（idx_fire_user），WHERE deleted_flag=0

- [ ] **Step 4: 补 export envelope 结构说明**

补一小节描述 M8 的 export envelope：7 表数据（users/accounts/categories/transactions/recurring_transactions/net_worth_snapshots/fire_scenarios）+ header（format/appVersion/exportedAt）+ crypto 标记（M9 拒绝导入加密文件）。引用 `export-service.ts`。

- [ ] **Step 5: 更新文件头日期**

`> 最后更新: 2026-07-30`

- [ ] **Step 6: 提交**

```bash
cd /workspace && git add docs/wiki/02-database.md && git commit -m "docs(wiki): update 02-database (CHECK constraints + partial indexes + export envelope)"
```

---

## Task W4: 更新 04-models.md

**Files:**
- Modify: `docs/wiki/04-models.md`

- [ ] **Step 1: 读取当前 04-models.md**

用 Read 读取 `/workspace/docs/wiki/04-models.md`。

- [ ] **Step 2: 删除 getTransactionsByUser 条目**

找到 transaction.ts 的 `getTransactionsByUser` 描述，删除（Phase 1 已删该函数）。

- [ ] **Step 3: 新增 transaction-queries.ts 小节**

补 `packages/shared/src/models/transaction-queries.ts` 描述：
- `getTransactionsPage(db, userId, params: TransactionPageParams): TransactionPage` — 分页查询（支持 dateFrom/dateTo/type/accountId 过滤 + LIMIT/OFFSET + total 计数）
- `getRecentTransactions(db, userId, limit): Transaction[]` — 最近 N 条
- `getMonthlyOverview(db, userId, yearMonth): MonthlyOverview` — 月度收支聚合（income/expense/transfer 求和）
- 类型：`TransactionPageParams`（dateFrom/dateTo/type/accountId/limit/offset）、`TransactionPage`（items/total）、`MonthlyOverview`（income/expense/transfer）

- [ ] **Step 4: 更新 recurring.ts 的 updateRecurring**

将 updateRecurring 的 updates 参数类型从 `Partial<RecurringTransaction>` 更新为 `RecurringUpdateFields = Partial<Pick<RecurringTransaction, 'next_due_date' | 'last_generated_date' | 'is_active'>>`（M9 D4 收紧）。

- [ ] **Step 5: 更新文件头日期**

`> 最后更新: 2026-07-30`

- [ ] **Step 6: 提交**

```bash
cd /workspace && git add docs/wiki/04-models.md && git commit -m "docs(wiki): update 04-models (add transaction-queries, remove getTransactionsByUser, tighten updateRecurring type)"
```

---

## Task W5: 更新 05-services.md

**Files:**
- Modify: `docs/wiki/05-services.md`

- [ ] **Step 1: 读取当前 05-services.md**

用 Read 读取 `/workspace/docs/wiki/05-services.md`。

- [ ] **Step 2: 新增 column-whitelist.ts 小节**

补 `packages/shared/src/services/column-whitelist.ts`：
- `getColumnWhitelist(tableName: ExportTableName): readonly string[]` — 返回指定表的合法列名
- `isValidColumnName(column: string): boolean` — 校验列名（正则 `^[a-zA-Z_][a-zA-Z0-9_]*$`，防注入）
- `filterRecordColumns(tableName, record): Record<string, unknown>` — 过滤记录仅保留白名单列
- 用途：import-service LWW 合并时防 SQL 注入

- [ ] **Step 3: 新增 clear-service.ts 小节**

补 `packages/shared/src/services/clear-service.ts`：
- `clearAllTransactions(db, userId): ClearResult` — 清空所有交易 + 经常性交易模板 + 账户余额归零（soft-delete，补 sync_version+1/updated_at，M9 D1）
- `ClearResult` 类型（clearedTransactions/clearedRecurring/resetAccounts）

- [ ] **Step 4: 更新 import-service.ts 描述**

更新 `packages/shared/src/services/import-service.ts`：
- `importJsonWithLww`：envelope 校验（格式 + 拒绝加密文件）+ 列白名单过滤（M9 S1）+ LWW 合并（updated_at 比较，跨用户 user_id 归一）
- `importCsvTransactions`：复用 createTransaction（M9 D3，余额更新逻辑一致）+ 事务性批量
- `markDuplicateTransactions`：dedupHash 加入 transaction_type（M9 D3，格式 `日期|金额|摘要|对方账户|transaction_type`）
- `resolveCategoryForTransactions`：模板映射 → 关键词推断 → 默认分类

- [ ] **Step 5: 更新 export-service.ts 描述**

更新 `packages/shared/src/services/export-service.ts`：
- `buildExportEnvelope`：users 表剔除 encryption_key_hash（M9 S5 脱敏，用显式列名 + NULL as encryption_key_hash）
- 其余不变

- [ ] **Step 6: 更新 recurring-service.ts 描述**

更新 `packages/shared/src/services/recurring-service.ts`：
- `processRecurringTransactions`：db.transaction 包裹（M9 D2）+ 幂等检查（last_generated_date 已覆盖则跳过，查 transactions.recurring_id + transaction_date）

- [ ] **Step 7: 补 M8 模板系统小节**

补 `packages/shared/src/import-templates/` 描述：
- 7 套预设模板：alipay/wechat-pay/cmb-debit/icbc-debit/ccb-debit/boc-debit/rcu-debit
- `registry.ts`：getAllTemplates / getTemplate / detectTemplate（文件特征自动识别）
- `types.ts`：CsvImportTemplate 接口
- `keyword-rules.ts`：关键词推断规则
- `placeholder-resolver.ts`：占位符解析（如 `__CATEGORY_FOOD__` → 真实分类 ID）

- [ ] **Step 8: 更新文件头日期**

`> 最后更新: 2026-07-30`

- [ ] **Step 9: 提交**

```bash
cd /workspace && git add docs/wiki/05-services.md && git commit -m "docs(wiki): update 05-services (column-whitelist/clear-service/import-export/recurring + template system)"
```

---

## Task W6: 更新 03-types.md

**Files:**
- Modify: `docs/wiki/03-types.md`

- [ ] **Step 1: 读取当前 03-types.md + types/index.ts**

用 Read 读取 `/workspace/docs/wiki/03-types.md` 和 `/workspace/packages/shared/src/types/index.ts`。

- [ ] **Step 2: 补 M8 类型**

补以下类型（注明定义文件位置）：
- `ExportTableName`（export-service.ts，union of 7 表名）
- `ExportEnvelope`（export-service.ts，header + data）
- `ExportHeader`（export-service.ts，format/appVersion/exportedAt）
- `ParsedCsvTransaction`（import-templates/types.ts）
- `CsvImportTemplate`（import-templates/types.ts）
- `ImportResult`（import-service.ts，success/inserted/updated/skipped/errors）
- `CsvImportParams`（import-service.ts）
- `ClearResult`（clear-service.ts）

- [ ] **Step 3: 补 M9 类型**

补：
- `TransactionPageParams`（transaction-queries.ts，dateFrom/dateTo/type/accountId/limit/offset）
- `TransactionPage`（transaction-queries.ts，items/total）
- `MonthlyOverview`（transaction-queries.ts，income/expense/transfer）
- `RecurringUpdateFields`（recurring.ts，`Partial<Pick<RecurringTransaction, 'next_due_date'|'last_generated_date'|'is_active'>>`）

- [ ] **Step 4: 删除 getTransactionsByUser 相关引用**

若 03-types.md 提到 getTransactionsByUser，删除。

- [ ] **Step 5: 更新文件头日期**

`> 最后更新: 2026-07-30`

- [ ] **Step 6: 提交**

```bash
cd /workspace && git add docs/wiki/03-types.md && git commit -m "docs(wiki): update 03-types (M8 export/import types + M9 pagination/recurring types)"
```

---

## Task W7: 更新 07-tests.md

**Files:**
- Modify: `docs/wiki/07-tests.md`

- [ ] **Step 1: 读取当前 07-tests.md**

用 Read 读取 `/workspace/docs/wiki/07-tests.md`。

- [ ] **Step 2: 更新测试计数**

从"13 文件/97 用例"更新为：
- shared：23 文件 / 184 用例（减去 Phase 1 删除的 getTransactionsByUser 测试后的实际数，执行时以 `pnpm test` 输出为准）
- desktop：23 文件 / 306 用例

- [ ] **Step 3: 补代码-测试映射表的新模块**

补以下新模块的测试映射：
| 代码文件 | 测试文件 |
|----------|----------|
| `shared/src/services/column-whitelist.ts` | `shared/tests/services/column-whitelist.test.ts` |
| `shared/src/services/clear-service.ts` | `shared/tests/services/clear-service.test.ts` |
| `shared/src/services/export-service.ts` | `shared/tests/services/export-service.test.ts` |
| `shared/src/services/import-service.ts` | `shared/tests/services/import-service.test.ts` |
| `shared/src/models/transaction-queries.ts` | `shared/tests/models/transaction-queries.test.ts` |
| `shared/src/db/schema.ts`（CHECK+index） | `shared/tests/db/schema.test.ts` |
| `shared/src/import-templates/*` | `shared/tests/import-templates/*` |
| `desktop/src/main/ipc/path-guard.ts` | `desktop/tests/path-guard.test.ts` |
| `desktop/src/main/ipc/schemas.ts` | `desktop/tests/ipc-schemas.test.ts` |
| `desktop/src/renderer/src/components/base/ErrorBoundary.tsx` | `desktop/tests/error-boundary.test.tsx` |
| `desktop/src/renderer/src/components/data-management/*` | `desktop/tests/data-management-panel.test.tsx` / `csv-import-wizard.test.tsx` / `clear-transactions.test.tsx` |
| `desktop/src/renderer/src/components/base/Table.tsx`（虚拟化） | `desktop/tests/TransactionListTable.test.tsx` |
| `desktop/src/renderer/src/pages/FireCalculatorPage.tsx`（toast） | `desktop/tests/fire-calc-components.test.tsx` |
| `desktop/src/renderer/src/stores/transaction-store.ts`（分页） | `desktop/tests/TransactionsPage.test.tsx` |
| `desktop CSV 解析` | `desktop/tests/csv-parser-e2e.test.ts` |

- [ ] **Step 4: 更新文件头日期**

`> 最后更新: 2026-07-30`

- [ ] **Step 5: 提交**

```bash
cd /workspace && git add docs/wiki/07-tests.md && git commit -m "docs(wiki): update 07-tests (counts + new module test mappings)"
```

---

## Task W8: 更新 08-design-index.md

**Files:**
- Modify: `docs/wiki/08-design-index.md`

- [ ] **Step 1: 枚举当前 specs + plans**

用 Glob 确认 `/workspace/docs/superpowers/specs/*.md` 和 `/workspace/docs/superpowers/plans/*.md` 的文件清单。

基线（已核实）：
- specs：30 份
- plans：18 份

- [ ] **Step 2: 读取当前 08-design-index.md**

用 Read 读取 `/workspace/docs/wiki/08-design-index.md`。

- [ ] **Step 3: 补 M2-M9 各里程碑摘要**

为新增的 spec/plan 补摘要（每份 2-3 行）：
- M2（dashboard 等）、M3、M4（transaction management）、M5（net worth trend）、M6（fire calculator）、M7（settings）、M8（data export/import）、M9（hardening）
- 以及各非里程碑文档（code-wiki / env-setup / security / sync-layer / ui-ux / docker / verification 等）

按日期排序，格式与现有条目一致（路径 + 日期/版本/状态 + 范围 + 关键贡献）。

- [ ] **Step 4: 更新"尚未实现"清单**

更新第 5 节：
- 移除"前端代码（已实现）"
- 保留"加密同步层（仍规划中）"
- 补"Electron 31→36 升级（M9 单列后续）"

- [ ] **Step 5: 更新文件头日期 + 文档计数**

`> 最后更新: 2026-07-30`
第 1 节"共 9 份"更新为"specs 30 份 + plans 18 份"。

- [ ] **Step 6: 提交**

```bash
cd /workspace && git add docs/wiki/08-design-index.md && git commit -m "docs(wiki): update 08-design-index (expand to 30 specs + 18 plans, M2-M9 milestones)"
```

---

## Task W9: 更新 01-overview.md

**Files:**
- Modify: `docs/wiki/01-overview.md`

- [ ] **Step 1: 读取当前 01-overview.md**

用 Read 读取 `/workspace/docs/wiki/01-overview.md`。

- [ ] **Step 2: 更新当前状态表**

第 1.2 节状态表补 M5-M9 成果：
- 净资产趋势可视化（M5）✅
- FIRE 计算器（M6）✅
- 设置页 + 数据导入导出（M7/M8）✅
- 安全/性能/UX 加固（M9）✅
- 加密同步层 ⏳ 规划中（保留）

- [ ] **Step 3: 更新技术栈**

补 M8/M9 新增依赖：
- zod（IPC 输入校验）
- @tanstack/react-virtual（表格虚拟化）
- iconv-lite（CSV GBK 编码处理）

- [ ] **Step 4: 更新 4 层架构图**

扩展架构图，补 desktop main + renderer 层：
- 数据层（shared：db/types/models/services/utils）
- desktop main 层（Electron + IPC + path-guard + schemas + db-manager）
- preload 层（dataAccess 暴露）
- renderer 层（router + stores + components + pages）

- [ ] **Step 5: 补使用场景**

第 1.3 节使用场景补"CSV 导入（7 套预设模板 + 关键词推断）"。

- [ ] **Step 6: 更新文件头日期**

`> 最后更新: 2026-07-30`

- [ ] **Step 7: 提交**

```bash
cd /workspace && git add docs/wiki/01-overview.md && git commit -m "docs(wiki): update 01-overview (M5-M9 status + tech stack + architecture + CSV import)"
```

---

## Task W10: 更新 06-utils.md

**Files:**
- Modify: `docs/wiki/06-utils.md`

- [ ] **Step 1: 读取当前 06-utils.md + utils 文件 + use-currency**

用 Read 读取 `/workspace/docs/wiki/06-utils.md`、`/workspace/packages/shared/src/utils/*.ts`、`/workspace/apps/desktop/src/renderer/src/hooks/use-currency.ts`、`/workspace/apps/desktop/src/renderer/src/components/transactions/transaction-constants.ts`（看 format 函数签名）。

- [ ] **Step 2: 校对 money.ts/sync.ts/time.ts**

核实 M5-M9 是否改动了 shared utils。若无改动，仅更新日期。

- [ ] **Step 3: 补 renderer 侧 currency 工具**

补一小节描述 renderer 的 currency 工具（跨层引用，但与 utils 主题相关）：
- `hooks/use-currency.ts`：从 app-store 读 base_currency，返回 formatCurrency 函数
- `transaction-constants.ts` 的 `formatAmount(amount, currency)`：接收 currency 参数（M9 U3 变更）
- `CURRENCY_SYMBOLS` / `CURRENCY_LOCALES` 常量映射

- [ ] **Step 4: 更新文件头日期**

`> 最后更新: 2026-07-30`

- [ ] **Step 5: 提交**

```bash
cd /workspace && git add docs/wiki/06-utils.md && git commit -m "docs(wiki): update 06-utils (add renderer currency helpers)"
```

---

## Task W11: 更新 CODE_WIKI.md 主页

**Files:**
- Modify: `docs/wiki/CODE_WIKI.md`

- [ ] **Step 1: 读取当前 CODE_WIKI.md**

用 Read 读取 `/workspace/docs/wiki/CODE_WIKI.md`。

- [ ] **Step 2: 更新版本号**

v1.1 → v2.0（顶部 `> 版本: v2.0`）。

- [ ] **Step 3: 更新导航目录**

Wiki 导航目录加 09/10：
- 09-desktop-main.md — Desktop 主进程
- 10-renderer.md — Renderer 渲染层

各分节导航链接的"上一节/下一节"需同步（08 的下一节改为 09，09 的下一节 10，10 无下一节）。

- [ ] **Step 4: 更新架构图**

主页架构图扩展为含 desktop main + renderer 层（与 01-overview 一致）。

- [ ] **Step 5: 更新速查表**

全局约定速查表补 M9 安全/性能约定：
- CSP：prod 严格（script-src 'self'），dev 放宽（unsafe-inline + ws://localhost）
- 沙箱：sandbox:true + contextIsolation:true + nodeIntegration:false
- 路径安全：dialog 签发 token + 一次性消费 + 绝对路径 + 无 `..` 穿越
- 虚拟化：Table 行数 > 20 启用 @tanstack/react-virtual
- 懒加载：7 页面 React.lazy + manualChunks（react-vendor/recharts/zustand）
- 分页：TransactionsPage PAGE_SIZE=50 服务端分页

- [ ] **Step 6: 更新测试计数**

"13 文件/97 用例"更新为"shared 23/184 + desktop 23/306"（执行时以实际为准）。

- [ ] **Step 7: 更新文件头日期**

`> 最后更新: 2026-07-30`

- [ ] **Step 8: 提交**

```bash
cd /workspace && git add docs/wiki/CODE_WIKI.md && git commit -m "docs(wiki): update CODE_WIKI main page to v2.0 (11 sections + M9 conventions)"
```

---

## Task W12: 交叉校验与收尾

**Files:**
- 无修改（校验任务）

- [ ] **Step 1: 枚举所有代码文件**

用 Glob 列出：
- `/workspace/packages/shared/src/**/*.ts`
- `/workspace/apps/desktop/src/**/*.{ts,tsx}`

记录完整文件清单。

- [ ] **Step 2: 提取 wiki 中所有 file:/// 链接**

用 Grep 在 `/workspace/docs/wiki/*.md` 搜索 `file:///workspace` ，提取所有链接路径，去重。

- [ ] **Step 3: 比对差集**

对比 Step 1 代码文件清单 vs Step 2 wiki 链接清单：
- 代码有 wiki 无 → 补到对应分节
- wiki 有代码无 → 删除过时链接（如已删的 getTransactionsByUser）

- [ ] **Step 4: 补漏/删过时**

对 Step 3 差集，用 Edit 修改对应 wiki 文件。

- [ ] **Step 5: 验证所有 wiki 文件头日期**

用 Grep 搜索 `/workspace/docs/wiki/*.md` 的 `最后更新`，确认全部为 `2026-07-30`。

- [ ] **Step 6: 提交（如有改动）**

```bash
cd /workspace && git add docs/wiki/ && git commit -m "docs(wiki): cross-check fixups (all code files covered, no stale links)"
```

若无改动，跳过提交。

- [ ] **Step 7: 全量验证**

Run: `cd /workspace/packages/shared && pnpm test`
Run: `cd /workspace/apps/desktop && pnpm test`
Run: `cd /workspace/packages/shared && pnpm exec tsc --noEmit -p tsconfig.json`
Run: `cd /workspace/apps/desktop && pnpm exec tsc --noEmit -p tsconfig.json && pnpm exec tsc --noEmit -p tsconfig.node.json`
Expected: 全绿（确认 Phase 1 清理未破坏任何东西）

- [ ] **Step 8: 推送 + CI 验证**

```bash
cd /workspace && git push origin main
```
监控 CI 至成功（用 gh CLI 或观察 GitHub Actions）。

---

## Self-Review 备注

**Spec 覆盖检查:**
- Phase 1 死代码清理：C1（已知 getTransactionsByUser）✓、C2（shared 扫描）✓、C3（desktop 扫描）✓、C4（import 清理）✓、C5（收尾验证）✓
- Phase 2 Wiki 重同步：8 旧分节（W3 02-database / W4 04-models / W5 05-services / W6 03-types / W7 07-tests / W8 08-design-index / W9 01-overview / W10 06-utils）✓ + 2 新分节（W1 09-desktop-main / W2 10-renderer）✓ + 主页（W11 CODE_WIKI）✓ + 交叉校验（W12）✓

**占位符检查:** C2/C3/C4 的提交信息含 `<删除清单>` / `<保留清单>` 模板占位符——这是 commit message 模板，执行时由 agent 填充实际内容，符合 spec 3.5 设计。非步骤占位符。

**类型一致性:** `RecurringUpdateFields` 在 W4（04-models）和 W6（03-types）描述一致；`TransactionPageParams`/`TransactionPage`/`MonthlyOverview` 在 W4 和 W6 一致；`ClearResult`/`ImportResult` 在 W5 和 W6 一致。

**已知简化:** 
- C2/C3 扫描依赖 agent 实时 Grep 判定，无法预知死代码清单，计划给出候选清单 + 判定规则，agent 执行时填充
- W3-W11 各 wiki 分节的更新内容以"要点"形式给出，agent 执行时需 Read 实际 wiki 文件 + 代码文件后写入完整内容（非填空模板，是描述性指引）
