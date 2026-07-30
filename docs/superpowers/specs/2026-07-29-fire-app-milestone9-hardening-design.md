# FIRE-APP M9 加固里程碑设计（Hardening）

- **日期**：2026-07-29
- **状态**：已批准，待写实施计划
- **前置**：M8 数据导入/导出 + 清空交易已完成
- **范围约束**：可破坏性变更（应用 0.1.0 dev 阶段，无真实用户数据，可直接改表结构/加索引/加约束，不必为旧 dev 库写迁移）
- **实施路径**：方案 B 维度切片——4 个维度各做一个迷你 sprint，每个内含「扫描→修复→验证」闭环，加轻量前置跨维度扫描

---

## 1. 背景与目标

M1–M8 完成了 FIRE-APP 桌面 MVP 全部功能（账户/交易/净资产/FIRE 计算器/仪表盘/设置 + 数据导入导出 + CI 打包）。本里程碑不新增功能，而是对现有代码做全面加固扫描，覆盖性能、数据一致性、UX 体验、安全四个维度。

**目标**：消除 Critical/High 级别风险与缺陷，使应用从「能跑」提升到「可信、稳健、安全」。

---

## 2. 审计汇总

对 `packages/shared`（数据层/服务）与 `apps/desktop`（Electron 主进程/预加载/渲染端）做了四维度静态审计，共发现约 122 项 findings：

| 维度 | Critical | High | Medium | Low | 合计 |
|------|----------|------|--------|-----|------|
| 性能 | 4 | 11 | 17 | 4 | 36 |
| 数据一致性 | 1 | 8 | 13 | 9 | 31 |
| UX 体验 | 1 | 10 | 20 | 11 | 42 |
| 安全 | 0 | 4 | 7 | 6 | 17 |
| **合计** | **6** | **33** | **57** | **30** | **126** |

> 注：上表 High 数以各维度详细 findings 列表为准（部分报告汇总行有微小计数出入）。

### 最严重的代表性问题

- **安全**：导入路径 SQL 列名注入（恶意 JSON 可执行单条 INSERT/UPDATE 篡改任意表）；导出/导入任意文件读写（渲染端可绕过 dialog 读写任意路径）；Electron 31 已 EOL
- **一致性**：`clearAllTransactions` 三条 UPDATE 不更新 `sync_version`/`updated_at`（清空操作对同步层完全不可见）；recurring 补单非原子 + 非幂等（崩溃后重复补单）；CSV 导入绕过 `createTransaction` 余额联动
- **性能**：`getTransactionsByUser` 全表拉取无分页（Dashboard/Transactions 拉全量交易再前端聚合）；Table 无虚拟化（大列表全量渲染 DOM）
- **UX**：导出操作无 try/catch（IPC 失败静默）；无全局 Error Boundary（白屏崩溃）；货币硬编码 ¥ 与 USD 用户矛盾；CSV 导入后不刷新 store

---

## 3. 范围决策

按 YAGNI 原则，122 项全修不现实。本里程碑范围如下：

### 3.1 纳入 M9（本里程碑实施）

- **全部 6 Critical + 33 High = 39 项**
- 其中安全维度的 Electron 31→36 升级虽属 High，但升级大版本风险高且可能连锁破坏 better-sqlite3 原生模块，**单列为后续任务**，本里程碑先做沙箱+CSP+dev URL 守卫等低风险快速加固
- 实际实施约 36 项（扣除 Electron 升级 + 合并同源问题如 SQL 注入与 envelope 校验）

### 3.2 不纳入（转 backlog 跟踪）

- 57 Medium + 30 Low = 87 项，记录在本 spec 附录，后续按需处理
- 理由：多为体验打磨（骨架屏、aria 微调、紧凑数字展示、Intl 复用），非阻断；一次性全修 ROI 低且稀释重点

### 3.3 单列后续任务

- Electron 31→36 升级（含 better-sqlite3 原生模块重编译验证）
- 代码签名（electron-builder certificateFile 配置）
- `pnpm audit --audit-level=high` CI 门禁

---

## 4. Sprint 切片与顺序

按依赖关系锁定顺序 **S → D → P → U**，前置 sprint 为后续扫清共享文件改动：

- Sprint S 改 `import-service.ts`（列白名单）→ Sprint D 也改 `import-service.ts`（CSV 复用 createTransaction），S 先行
- Sprint D 改 `schema.ts`（CHECK 约束）→ Sprint P 也改 `schema.ts`（partial index），D 先行一次性改完 schema

### 4.1 Sprint S — 安全加固

| 修复项 | 文件 | 做法 |
|--------|------|------|
| SQL 列名注入 + envelope 校验 | `packages/shared/src/services/import-service.ts` | 为每个 `ExportTableName` 维护列白名单（从 schema 派生）；`insertRecord`/`updateRecord` 过滤列名仅保留白名单 + 正则 `^[a-zA-Z_][a-zA-Z0-9_]*$` 校验；`validateEnvelope` 校验 data 键名严格等于 7 表名集合、每条记录字段名在该表列白名单内、`id`/`updated_at` 类型校验 |
| 任意文件读写 | `apps/desktop/src/main/ipc/export-import-handlers.ts` | 维护「dialog 签发路径 + 一次性 token」集合，`dialog:save/open` 返回时记录；写/读文件前校验路径在集合内且 token 匹配（一次性，用后即焚）；`path.resolve` 后拒绝含 `..` 的穿越；渲染端直接传入未经过 dialog 的路径一律拒绝（dialog 是唯一合法路径来源，不额外限制目录，由用户经 dialog 自行选择保存位置） |
| Electron 运行时 | `apps/desktop/src/main/index.ts` | `webPreferences.sandbox: true`；`index.html` 加 CSP meta（`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'`，dev 放行 ws+vite）；`app.isPackaged` 守卫 dev URL；`setWindowOpenHandler` 拦截外链转 `shell.openExternal`；`will-navigate` 非 dev 模式 preventDefault |
| 错误信息脱敏 | `apps/desktop/src/main/ipc/register-handlers.ts` | 白盒分类错误，仅向前端返回业务化文案（如「账户不存在」），完整错误仅写主进程日志；保留 `code` 字段做错误码 |
| IPC 输入校验 | `apps/desktop/src/main/ipc/*-handlers.ts` | 引入 zod，每个 handler 入口 schema 校验；`amount`/`rate` 数值做 `Number.isFinite()` + 范围校验；`Partial<FireScenario>` 显式 pick 允许修改列，剔除 `user_id`/`sync_version` |
| 导出脱敏 | `packages/shared/src/services/export-service.ts` | 导出 users 表时显式列出列名并剔除 `encryption_key_hash`（或置 null） |

### 4.2 Sprint D — 数据一致性

| 修复项 | 文件 | 做法 |
|--------|------|------|
| clear 同步可见性 | `packages/shared/src/services/clear-service.ts` | 三条 UPDATE 均补 `sync_version = sync_version + 1, updated_at = ?` |
| recurring 原子性 | `packages/shared/src/services/recurring-service.ts` | 整个 `for...of templates` 循环包 `db.transaction(() => {...})()`；循环内 createTransaction 与 updateRecurring 原子化（better-sqlite3 嵌套事务走 SAVEPOINT） |
| recurring 幂等 | `recurring-service.ts` + `schema.ts` | createTransaction 前查 `SELECT id FROM transactions WHERE recurring_id = ? AND transaction_date = ? AND deleted_flag = 0 LIMIT 1`，存在则跳过；加 partial unique index `UNIQUE(recurring_id, transaction_date) WHERE deleted_flag = 0` |
| CSV 导入复用 createTransaction | `import-service.ts` | 删除 `insertCsvTransaction`/`updateAccountBalance` 分叉，统一走 `createTransaction` 余额联动语义；消除符号处理路径分歧 |
| dedupHash 可靠性 | `import-service.ts` `markDuplicateTransactions` | hash 加入 `transaction_type` 字段；description 统一 `?? ''` 处理 |
| schema CHECK 约束 | `packages/shared/src/db/schema.ts` | transactions: `CHECK (transaction_type != 'transfer' OR to_account_id IS NOT NULL)`、`CHECK (to_account_id IS NULL OR to_account_id != account_id)`；recurring: `CHECK (interval > 0)`、`CHECK (end_date IS NULL OR end_date >= start_date)`；scenario: current_age≥0、retirement_years>0、rate 范围、金额≥0；accounts: `CHECK (asset_class != 'liability' OR current_balance <= 0)`；categories: `UNIQUE(user_id, name, type) WHERE deleted_flag = 0` |
| updateRecurring 字段 | `packages/shared/src/models/recurring.ts` | 收紧 `updates` 类型为 `Pick<RecurringTransaction, 'next_due_date' \| 'last_generated_date' \| 'is_active'>`，或扩展 SQL 覆盖所有可编辑字段 |

### 4.3 Sprint P — 性能

| 修复项 | 文件 | 做法 |
|--------|------|------|
| partial index | `schema.ts` | transactions: `idx_tx_user_date` 改 `partial WHERE deleted_flag = 0` 且含 `updated_at` 二级键；新增 `idx_tx_to_account` partial；`idx_acc_user_class`；`idx_recur_active` partial |
| 服务端分页+聚合 | `packages/shared/src/models/transaction.ts` + 新增 service 函数 | `getTransactionsPage(userId, {dateFrom, dateTo, limit, offset, type, accountId})`（WHERE+ORDER+LIMIT/OFFSET）；`getRecentTransactions(userId, limit)`；`getMonthlyOverview(userId, yearMonth)`（SQL SUM/CASE WHEN 聚合）；保留旧 `getTransactionsByUser` 过渡，P sprint 末删除 |
| 写操作局部更新 | `apps/desktop/src/renderer/src/stores/{transaction,account,snapshot,scenario}-store.ts` | CRUD 返回受影响记录，前端用 upsert/移除方式局部更新 store，不再整表 refetch；transaction-store 联动的 account refetch 改为仅刷新余额 |
| 虚拟化表格 | `apps/desktop/src/renderer/src/components/base/Table.tsx` + 依赖 | 引入 `@tanstack/react-virtual`，仅渲染可视区 + 缓冲行；配合服务端分页每页 50-100 条 |
| selector 细粒度 | 各 pages | `useStore((s) => s.x)` 多个细粒度 selector 替代解构整个 store，避免无关字段变更触发渲染 |
| render 内 Map 查找 | `TransactionListTable.tsx` / `RecentTransactions.tsx` | `useMemo` 构造 `Map<id, name>`，render 内 `map.get(id)` O(1) 查找 |
| 路由懒加载 + manualChunks | `router/index.tsx` + `electron.vite.config.ts` | `React.lazy(() => import(...))` + `<Suspense fallback>`；`build.rollupOptions.output.manualChunks` 切分 `react-vendor`/`recharts`/`zustand` |
| 快照利用 | `DashboardPage.tsx` | 净资产卡片直接读最新 snapshot（snapshot 表已有聚合字段），减少重复计算；`generateMonthlySnapshot` 返回新 snapshot 前端 push，避免整表重拉 |

### 4.4 Sprint U — UX 体验

| 修复项 | 文件 | 做法 |
|--------|------|------|
| 全局 Error Boundary | `App.tsx` / `main.tsx` | 包裹 Boundary + 兜底页（错误信息 + 重试 + 查看日志入口） |
| 导出 try/catch + loading | `DataManagementPanel.tsx` | 整段（含 dialog）try/catch，`showError`；`exporting` state 控制按钮 loading/disabled |
| 表单 Enter 提交 | 各 FormModal（Account/Transaction/Onboarding/Settings/Scenario） | `<form onSubmit={handleSubmit}>` 包裹，Button `type="submit"` |
| 响应式布局 | `Sidebar.tsx` / `Table.tsx` / 各 grid | Sidebar 窄宽折叠为图标条/抽屉（断点 <768px）；Table 包裹层 `overflow-x-auto` + 关键列 min-width；grid 加 `grid-cols-1 sm:grid-cols-2 lg:grid-cols-N` |
| 货币动态化 | `transaction-constants.ts` / `account-constants.ts` / `fire-calc-constants.ts` / `net-worth-constants.ts` | format 函数接收 `currency` 参数，从 `useAppStore.currentUser.base_currency` 注入；按货币切换 ¥/$ 符号与 locale |
| 导入/清空后刷新 store | `CsvImportWizard.tsx` / `ClearTransactionsDialog.tsx` | 成功后显式 `fetchTransactions` + `fetchAccounts` + success toast |
| Fire 反馈 | `FireCalculatorPage.tsx` | 监听 scenario-store error 弹 `showError`；createScenario/updateScenario 成功弹 `showSuccess` |
| label 关联 | `components/base/Input.tsx` / `Select.tsx` | 内部生成唯一 id，`<label htmlFor={id}>` 绑定控件 |

---

## 5. 新增依赖

| 依赖 | 用途 | 引入位置 |
|------|------|----------|
| `zod` | IPC 输入校验 schema | Sprint S，主进程 IPC 层 |
| `@tanstack/react-virtual` | 表格虚拟化 | Sprint P，renderer |

其余修复复用现有依赖。

---

## 6. 测试验证策略

沿用项目 TDD + 现有测试基础设施（vitest 2 + @testing-library/react 16）。

### 6.1 各 sprint 测试要求

- **Sprint S**：列白名单注入对抗测试（恶意 envelope 含注入列名 → 断言抛错/拒绝）；路径校验测试（`..` 穿越、非 dialog 路径 → 拒绝）；CSP/sandbox 配置断言；envelope 字段名校验
- **Sprint D**：clear 后断言 `sync_version` 递增；recurring 崩溃恢复测试（模拟中途失败 → 无重复补单）；dedupHash 含 type 维度；schema CHECK 约束违反测试（transfer 无 to_account → 拒绝；interval≤0 → 拒绝）
- **Sprint P**：分页查询 limit/offset/筛选下推测试；虚拟化渲染行数测试（1000 条只渲染可视区 N 行）；写操作局部更新测试（CRUD 后 store 不触发整表 refetch）；bundle 体积断言（首屏 chunk < 500KB）
- **Sprint U**：Error Boundary 触发兜底页；Enter 提交；响应式断点；货币 USD 切换显示 $；导入后 store 刷新断言

### 6.2 回归门禁

每个 sprint 完成后跑全量 `pnpm test:all`（当前 442 测试）+ tsc + build，不得低于现有绿线。

### 6.3 新增测试基础设施

性能 sprint 需大列表测试数据工厂（生成 1000/10000 条交易样本用于虚拟化与分页测试）。

---

## 7. 成功标准（Definition of Done）

1. 6 Critical + 33 High（除 Electron 升级单列）全部修复并有测试覆盖
2. `pnpm test:all` 全绿，测试数 ≥ 现有 442（预期新增 40-60 用例）
3. tsc（shared/renderer/main）+ electron-vite build 通过
4. CI 在 main 分支成功
5. 安全漏洞链路闭合：恶意 JSON 导入不再可注入 SQL；渲染端无法绕过 dialog 读写任意文件；CSP + sandbox 启用
6. 性能基线：1 万条交易下 TransactionsPage 首屏只渲染可视区行；renderer 首屏 bundle < 500KB（Onboarding/Accounts 路径）

---

## 8. 风险与缓解

| 风险 | 缓解 |
|------|------|
| 服务端分页改造波及 store + pages，回归面大 | 保留旧 `getTransactionsByUser` 作为过渡，新旧并存到 P sprint 末再删 |
| schema CHECK 约束在已存在脏数据上失败 | 可破坏性变更约束下，迁移时清空违规模拟数据；或先查询违规模拟数据再决定 |
| 虚拟化引入新依赖 | 选用轻量 `@tanstack/react-virtual`（~3KB），社区活跃 |
| zod 引入增加 bundle | zod tree-shaking 友好，且仅主进程 IPC 层用，不进 renderer bundle |
| recurring 事务包裹改变既有测试行为 | 同步更新 recurring-service.test.ts 期望 |

---

## 9. 范围外 Backlog（不在 M9 实施）

### 9.1 Medium（57 项，代表性条目）

- 性能：Intl.NumberFormat 复用、useEffect 依赖项修正、SettingsPage 拉全分类前端过滤、markDuplicate 内存比对改 SQL JOIN、跨页缓存层（React Query/SWR）、generateMonthlySnapshot 后二次全量拉取、TransactionsPage 三 store 串行 fetch、Dashboard 首屏串行 IPC、Onboarding seedCategories 串行+单条 INSERT、FireCalc fetchScenarios→runProjection 串行、recharts v2 tree-shaking 差
- 一致性：snapshot read-then-write 未原子化、updateRecurring SELECT 不过滤 deleted_flag、clearAllTransactions 不清理 snapshots/scenarios、markDuplicate 与软删除记录去重漏判、snapshots UNIQUE 含软删除、sync_version 非原子 read-modify-write、WAL 无 BUSY 重试、importJson 外键引用语义混乱、LWW 比较运算符不一致
- UX：Dashboard 加载卡显示 ¥0.00、Accounts 加载概览卡缺失、Table 加载态无 skeleton、静默吞错多处、store getState 判定成功脆弱、Onboarding 提交不重校验、利率单位 bps vs % 不一致、AccountForm 负值/上限校验、TransactionForm 未来日期/默认值、ScenarioForm 乐观更新失败不回滚、表单无实时校验、Modal 无焦点陷阱、SettingsPage 重置自建浮层、ConfirmDialog 无 loading、表头不可排序、CSV 预览格式化不一致、日期魔法数、FireCalc 投影失败无错误态、Toast 堆叠上限、颜色对比度
- 安全：JSON.parse 错误未友好处理、文本字段无长度限制、数值无有限性校验、dialog 通道绕过统一错误包装、DB 路径日志、明文导出提示

### 9.2 Low（30 项，代表性条目）

- 性能：formatAmount compact 展示、recurring partial index、categories/fire_scenarios partial index、main 进程启动串行（合理）
- 一致性：getTransactionById 不过滤 deleted_flag、transactions category 与 type 一致性、LWW 运算符统一
- UX：Onboarding 步骤可点击、表格行双击编辑、ProjectionChart 单位转换、Toast 关闭按钮 aria-label、skip link、html lang、FireCalc 刷新失败区分、ScenarioForm deps 时序、超大金额紧凑展示
- 安全：dev 远程加载无来源校验（已部分覆盖于 S sprint 的 app.isPackaged 守卫）

### 9.3 单列后续任务

- Electron 31→36 升级（含 better-sqlite3 原生模块重编译验证、electron-updater 自动更新接入）
- 代码签名（electron-builder `certificateFile` 配置，EV 证书优先）
- `pnpm audit --audit-level=high` CI 门禁

---

## 10. 附录：审计 findings 索引

完整 findings 列表见审计报告（四维度 agent 输出），本 spec 引用其文件:行号定位。关键索引：

- 性能：`packages/shared/src/models/transaction.ts:21-24`（getTransactionsByUser 无分页）、`apps/desktop/src/renderer/src/pages/DashboardPage.tsx:35-44`、`components/base/Table.tsx:62-77`、`db/schema.ts:155-158`（索引）、`router/index.tsx:1-13`（路由 eager）
- 一致性：`services/clear-service.ts:27-29`、`services/recurring-service.ts:17-53`、`services/import-service.ts:88-98`（insertRecord/updateRecord）、`services/import-service.ts:158-170`（markDuplicate）、`db/schema.ts:72-88`（transfer 约束）
- UX：`components/data-management/DataManagementPanel.tsx:34-48`、`renderer/src/main.tsx:11-15`（无 Error Boundary）、`components/base/Input.tsx:19-38`（label 未关联）、`components/transactions/transaction-constants.ts:52-59`（货币硬编码）、`components/layout/Sidebar.tsx:71`（无折叠）
- 安全：`services/import-service.ts:88-92`（列名注入）、`main/ipc/export-import-handlers.ts:34,44,50,59,96`（任意文件读写）、`main/index.ts:49-54`（sandbox）、`services/export-service.ts:29`（key_hash 泄漏）
