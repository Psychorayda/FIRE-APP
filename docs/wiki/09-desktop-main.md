# 09 - Desktop 主进程（Main Process）

> 最后更新: 2026-07-30
> [← 08-design-index](./08-design-index.md) | [10-renderer →](./10-renderer.md)

## 概述

Desktop 主进程是 Electron 应用的核心宿主层，承担四项职责：**(1) Electron 应用生命周期与窗口管理**、**(2) SQLite 数据库连接单例管理**、**(3) IPC 桥接（主进程 ↔ 渲染进程）**、**(4) 安全加固（沙箱、上下文隔离、CSP、路径守卫、输入校验）**。主进程通过 `ipcMain.handle` 注册通道，渲染进程经 preload 暴露的 `window.dataAccess` 命名空间调用，所有数据层逻辑实际复用 `@shared` 包的 models 与 services，主进程本身不实现业务逻辑，仅做注册、校验、脱敏与文件 I/O 守卫。

入口 [index.ts](file:///workspace/apps/desktop/src/main/index.ts) 在 `app.whenReady()` 中依次执行：固定 userData 路径 → 初始化数据库 → 注册 IPC handlers → 注入 CSP → 创建窗口。本文档覆盖 main 进程全部源码与 preload 暴露面。

## 入口 main/index.ts

[index.ts](file:///workspace/apps/desktop/src/main/index.ts) 是 Electron 主进程入口，负责应用生命周期、窗口创建与 M9 安全加固。

**生命周期流程**（`app.whenReady()` 回调内顺序执行）：
1. `fixUserDataPath()` — 固定 userData 到 `{appData}/fire-app`，避免 portable exe 每次解压到不同临时目录导致数据库路径漂移丢数据。
2. `initDatabase()` — 初始化 SQLite 单例（见下节）。
3. `registerIpcHandlers()` — 注册全部 IPC 通道。
4. CSP 注入（仅生产模式 `app.isPackaged`）— 通过 `session.defaultSession.webRequest.onHeadersReceived` 注入响应头，比 index.html 的 meta CSP 更严格。
5. `createWindow()` — 创建主窗口。

**关闭流程**：`window-all-closed` 与 `before-quit` 两个事件均调用 `closeAppDatabase()`，后者为兜底（窗口未触发 closed 时确保 DB 关闭）。`debugLog()` 将诊断信息追加写入 `{userData}/fire-app-debug.log`，写入失败不阻塞主流程。

**M9 加固配置表**：

| 配置项 | 值 | 说明 |
|--------|-----|------|
| `sandbox` | `true` | 渲染进程沙箱，限制 Node API 访问 |
| `contextIsolation` | `true` | 上下文隔离，preload 与渲染页 JS 隔离 |
| `nodeIntegration` | `false` | 禁止渲染进程直接使用 Node API |
| `preload` | `join(__dirname, '../preload/index.mjs')` | preload 脚本路径（编译产物 .mjs） |
| `setWindowOpenHandler` | `{ action: 'deny' }` | 拦截 `window.open`，http/https 链接转 `shell.openExternal` 系统浏览器，其余一律拒绝 |
| `will-navigate` | `event.preventDefault()` | 阻止渲染端导航到外部协议；dev 模式下放行 vite HMR（`ELECTRON_RENDERER_URL` 前缀） |
| CSP（生产） | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'` | 仅允许同源资源，禁外网连接，style 放行 unsafe-inline 以兼容样式注入 |
| `fixUserDataPath` | `{appData}/fire-app` | 固定数据目录，防止 portable exe 路径漂移 |

窗口尺寸：`width: 1280, height: 800, minWidth: 1024, minHeight: 600`，`show: false` 直到 `ready-to-show` 才显示（避免白屏）。开发模式加载 `ELECTRON_RENDERER_URL`，生产模式 `loadFile` 加载打包后的 `renderer/index.html`。

## db-manager.ts

[db-manager.ts](file:///workspace/apps/desktop/src/main/db-manager.ts) 是主进程数据库单例管理器，持有 `better-sqlite3` 连接供 IPC handler 使用。

| 函数 | 签名 | 说明 |
|------|------|------|
| `getDataDir` | `() => string` | 返回 `{userData}/fire-app/data/`，不存在则 `mkdirSync` 递归创建 |
| `getDbPath` | `() => string` | 返回 `{dataDir}/fire.db` |
| `initDatabase` | `() => DatabaseType` | 创建连接（复用 `@shared/db/connection.createDatabase`）+ `initSchema`；若 `dbInstance.open` 已存在则直接返回（幂等） |
| `getDatabase` | `() => DatabaseType` | 获取已初始化实例；未初始化抛 `'数据库未初始化，请先调用 initDatabase()'` |
| `closeAppDatabase` | `() => void` | 调用 `closeDatabase` 关闭连接并置 `dbInstance = null` |

数据库文件路径为 `{userData}/fire-app/data/fire.db`。WAL 模式与 schema 初始化由 `@shared/db/connection.createDatabase` 与 `@shared/db/schema.initSchema` 负责（详见 [02-database.md](./02-database.md)）。

## IPC 注册 register-handlers.ts

[register-handlers.ts](file:///workspace/apps/desktop/src/main/ipc/register-handlers.ts) 提供统一错误处理包装与脱敏。

**`sanitizeError(error: unknown): IpcError`** 将底层错误映射为业务化文案，避免向渲染层泄露 SQL/表结构/堆栈。原始错误通过 `console.error` 记录在主进程日志，仅对渲染层脱敏。错误分类表：

| code | 触发条件 | message |
|------|----------|---------|
| `VALIDATION_ERROR` | `SQLITE_CONSTRAINT: CHECK`、通用 `SQLITE_CONSTRAINT`、zod 校验错误（`'validation'` 或 error 含 `issues`） | 数据校验失败 / 数据约束冲突，请检查输入 |
| `DUPLICATE_ERROR` | `SQLITE_CONSTRAINT: UNIQUE` | 数据已存在，请勿重复添加 |
| `NOT_FOUND` | 原始消息含 `'not found'` 或 `'不存在'` | 记录不存在或已被删除 |
| `PATH_FORBIDDEN` | 原始消息含 `'路径不安全'` 或 `'路径未经'`（path-guard 错误，对用户有意义，保留原消息） | 原始消息 |
| `DB_ERROR` | 兜底：所有未匹配的错误，不暴露 SQL/堆栈 | 操作失败，请稍后重试 |

**`registerHandler<TArgs, TResult>(channel, handler, db)`** 包装 `ipcMain.handle`：在 try/catch 中执行业务 handler，捕获异常后 `throw sanitizeError(error)`，使渲染进程收到的均为脱敏后的 `IpcError` 对象。

## path-guard.ts

[path-guard.ts](file:///workspace/apps/desktop/src/main/ipc/path-guard.ts) 实现文件操作路径守卫，核心是一次性 token 机制，防止渲染端复用旧路径或绕过对话框直接读写文件。

| 函数 | 签名 | 说明 |
|------|------|------|
| `issuePathToken` | `(filePath: string): void` | dialog 返回合法路径时签发：`path.resolve` 后加入 `issuedPaths` 集合 |
| `consumePathToken` | `(filePath: string): boolean` | 文件读写前消费：若路径已签发则从集合删除并返回 `true`，否则 `false`（一次性，消费即焚） |
| `isPathSafe` | `(filePath: string): boolean` | 路径本身安全性：必须绝对路径 + 不含 `..` 穿越 + `resolve` 后与 `normalize` 一致 |
| `assertFileOperationAllowed` | `(filePath: string, operation: 'read' \| 'write'): void` | 前置校验：先 `isPathSafe`（不安全抛 `路径不安全，拒绝读取/写入`），再 `consumePathToken`（未签发抛 `路径未经文件对话框选择，拒绝读取/写入`） |

**一次性 token 流程**：渲染端先调 `dialog:save` / `dialog:open` → 主进程 `dialog.showSaveDialog` / `showOpenDialog` 返回路径时 `issuePathToken` 签发 → 渲染端拿路径调 `export:*` / `import:*` → handler 内 `assertFileOperationAllowed` 校验并消费 token → 后续同一路径无法复用（已从集合删除）。

**安全规则**：(1) 路径必须绝对；(2) 不允许 `..` 穿越逃逸；(3) 必须经过 dialog 签发，渲染端无法凭空构造路径读写任意文件。

## schemas.ts

[schemas.ts](file:///workspace/apps/desktop/src/main/ipc/schemas.ts) 定义 7 个 zod schema，校验渲染进程传入参数并剔除不可信字段。

| schema 名 | 用途 | 关键约束 |
|-----------|------|----------|
| `createAccountSchema` | 创建账户 | `asset_class`/`account_type` 枚举校验；`name` 1-255 字符 |
| `editAccountSchema` | 编辑账户 | `.strict()` 拒绝未知字段，防止 `sync_version`/`user_id` 篡改 |
| `createTransactionSchema` | 创建交易 | `amount` 必须有限正数（拒 NaN/Infinity/负数）；`transaction_type` 枚举 |
| `editTransactionSchema` | 编辑交易 | `.strict()` 拒绝 `user_id`/`sync_version` |
| `createRecurringSchema` | 创建定期交易 | `frequency` 枚举（daily/weekly/monthly/yearly）；`amount` 正数 |
| `updateScenarioSchema` | 更新场景 | 默认 strip 行为：未声明字段（`user_id`/`sync_version`/`updated_at`/`deleted_flag`/`id`）静默丢弃 |
| `updateUserSchema` | 更新用户 | `.strict()` 剔除 `encryption_key_hash`/`last_sync_at`/`sync_version` 等服务端字段 |

**接入方式**：handler 内 `const safe = xxxSchema.parse(input)`，校验失败抛 `ZodError`，被 `sanitizeError` 捕获映射为 `VALIDATION_ERROR`。`.strict()` 模式拒绝未知字段，默认 strip 模式静默丢弃未知字段。

## 领域 IPC handlers 清单

[ipc-handlers.ts](file:///workspace/apps/desktop/src/main/ipc-handlers.ts) 是注册总入口，`registerIpcHandlers()` 获取 DB 实例后依次调用 10 个领域的注册函数。每个 handler 文件导出一个 `registerXxxHandlers(db)` 函数。

| handler 文件 | 注册函数 | 通道前缀 | 主要通道 |
|--------------|----------|----------|----------|
| [db-handlers.ts](file:///workspace/apps/desktop/src/main/ipc/db-handlers.ts) | `registerDbHandlers` | `db:` | `db:init`、`db:close` |
| [user-handlers.ts](file:///workspace/apps/desktop/src/main/ipc/user-handlers.ts) | `registerUserHandlers` | `db:user:` | `db:user:create`、`db:user:get`、`db:user:update`、`db:user:getFirst` |
| [account-handlers.ts](file:///workspace/apps/desktop/src/main/ipc/account-handlers.ts) | `registerAccountHandlers` | `db:account:` | `db:account:create`、`db:account:get`、`db:account:list`、`db:account:update`、`db:account:updateBalance`、`db:account:investableBalance`、`db:account:netWorth`、`db:account:hasTransactions`、`db:account:softDelete` |
| [category-handlers.ts](file:///workspace/apps/desktop/src/main/ipc/category-handlers.ts) | `registerCategoryHandlers` | `db:category:` | `db:category:create`、`db:category:get`、`db:category:list`、`db:category:seed`、`db:category:resetSystem` |
| [transaction-handlers.ts](file:///workspace/apps/desktop/src/main/ipc/transaction-handlers.ts) | `registerTransactionHandlers` | `db:tx:` | `db:tx:get`、`db:tx:getById`、`db:tx:page`、`db:tx:recent`、`db:tx:monthlyOverview`、`db:tx:create`、`db:tx:edit`、`db:tx:delete` |
| [recurring-handlers.ts](file:///workspace/apps/desktop/src/main/ipc/recurring-handlers.ts) | `registerRecurringHandlers` | `db:recurring:` | `db:recurring:create`、`db:recurring:listActive`、`db:recurring:update`、`db:recurring:process` |
| [scenario-handlers.ts](file:///workspace/apps/desktop/src/main/ipc/scenario-handlers.ts) | `registerScenarioHandlers` | `db:scenario:` | `db:scenario:create`、`db:scenario:get`、`db:scenario:list`、`db:scenario:update` |
| [snapshot-handlers.ts](file:///workspace/apps/desktop/src/main/ipc/snapshot-handlers.ts) | `registerSnapshotHandlers` | `db:snapshot:` | `db:snapshot:list`、`db:snapshot:getByMonth`、`db:snapshot:generateMonthly` |
| [fire-calc-handlers.ts](file:///workspace/apps/desktop/src/main/ipc/fire-calc-handlers.ts) | `registerFireCalcHandlers` | `db:fireCalc:` | `db:fireCalc:runProjection` |
| [export-import-handlers.ts](file:///workspace/apps/desktop/src/main/ipc/export-import-handlers.ts) | `registerExportImportHandlers` | `export:` / `import:` / `clear:` / `dialog:` | 见下节 |

**zod 接入点**：`db:account:create/update`（createAccountSchema/editAccountSchema）、`db:tx:create/edit`（createTransactionSchema/editTransactionSchema）、`db:recurring:create`（createRecurringSchema）、`db:scenario:update`（updateScenarioSchema）、`db:user:update`（updateUserSchema）。`db:user:create` 与 `db:category:create` 等 create 路径尚未接 zod（源码 TODO 标注）。

## export-import-handlers.ts

[export-import-handlers.ts](file:///workspace/apps/desktop/src/main/ipc/export-import-handlers.ts) 注册导出/导入/清空/对话框相关通道，是唯一涉及文件系统读写的 handler 集合，全部受 path-guard 守卫。

**通道清单（10 个）**：

| 通道 | 注册方式 | path-guard 校验 | 说明 |
|------|----------|-----------------|------|
| `export:json` | `registerHandler` | `assertFileOperationAllowed(filePath, 'write')` | JSON 全量导出，`buildExportEnvelope` + `serializeExportEnvelope` 写文件 |
| `export:csv` | `registerHandler` | `assertFileOperationAllowed(filePath, 'write')` | CSV 单表导出，`buildCsvExport` + BOM(`\uFEFF`) 写文件 |
| `import:json` | `registerHandler` | `assertFileOperationAllowed(filePath, 'read')` | JSON 导入，`importJsonWithLww` LWW 合并 |
| `import:parseCsv` | `registerHandler` | `assertFileOperationAllowed(filePath, 'read')` | CSV 解析预览，`parseCsvFile` + `resolveCategoryForTransactions` 分类解析 |
| `import:csvTransactions` | `registerHandler` | `assertFileOperationAllowed(params.filePath, 'read')` | CSV 交易批量导入，`importCsvTransactions` |
| `clear:transactions` | `registerHandler` | 无（不涉文件） | 清空所有交易，`clearAllTransactions` |
| `import:markDuplicates` | `registerHandler` | 无（不涉文件） | 标记重复交易，`markDuplicateTransactions` |
| `import:detectTemplate` | `registerHandler` | `assertFileOperationAllowed(filePath, 'read')` | 检测模板，读前 1024 字节，UTF-8 与 GBK 双解码后 `detectTemplate` |
| `dialog:save` | `ipcMain.handle` 直连 | 签发端：`issuePathToken` | 保存对话框，返回路径时签发 token |
| `dialog:open` | `ipcMain.handle` 直连 | 签发端：`issuePathToken` | 打开文件对话框，返回路径时签发 token |

**流程说明**：导出流程为 `dialog:save`（签发 token）→ `export:json`/`export:csv`（消费 token + 写文件）；导入流程为 `dialog:open`（签发）→ `import:detectTemplate`（检测模板，消费 token）→ `import:parseCsv`（预览，需重新 `dialog:open` 签发）→ `import:csvTransactions`（导入，再次签发）。因 token 一次性，每个文件操作前都必须重新经过对话框签发。

`getLocalUserId(db)` 辅助函数查询 `users WHERE deleted_flag = 0 LIMIT 1` 取本地用户 ID，无用户则抛 `'无用户数据'`。

## import-csv-parser.ts

[import-csv-parser.ts](file:///workspace/apps/desktop/src/main/import-csv-parser.ts) 是主进程 CSV 解析模块，负责读文件 + 按模板编码解码 + 调用模板 parseHook。

**`parseCsvFile(templateId, filePath): ParsedCsvTransaction[]`**：
1. `getTemplate(templateId)` 取模板，未找到抛 `'未找到模板: {id}'`。
2. `fs.readFileSync(filePath)` 读 Buffer。
3. `iconv.decode(buffer, template.encoding)` 按模板编码解码（支持 GBK / UTF-8，由模板声明）。
4. `parseCsvContent(content)` 简易 CSV 解析为 `string[][]`。
5. 若模板有 `parseHook` 则调用并返回结构化交易，否则返回空数组。

`parseCsvContent` 是自实现的极简 CSV 解析器，支持双引号转义（`""` → `"`）与 CRLF/LF/CR 换行，不依赖第三方 CSV 库。`iconv-lite` 的 GBK 解码能力用于处理中国银行导出的 GBK 编码 CSV 文件。

## preload/index.ts

[preload/index.ts](file:///workspace/apps/desktop/src/preload/index.ts) 通过 `contextBridge.exposeInMainWorld('dataAccess', dataAccess)` 将 IPC 调用安全暴露给渲染进程。所有方法均为 `ipcRenderer.invoke` 的薄封装，参数透传主进程。

**`window.dataAccess` 暴露面（命名空间 → 方法）**：

| 命名空间 | 方法 | 对应 IPC 通道 |
|----------|------|--------------|
| 顶层 | `initDatabase`、`closeDatabase` | `db:init`、`db:close` |
| `user` | `create`、`get`、`update`、`getFirst` | `db:user:create`、`db:user:get`、`db:user:update`、`db:user:getFirst` |
| `account` | `create`、`get`、`list`、`update`、`updateBalance`、`investableBalance`、`netWorth`、`hasTransactions`、`softDelete` | `db:account:*`（同名映射） |
| `category` | `create`、`get`、`list`、`seed`、`resetSystem` | `db:category:*`（同名映射） |
| `tx` | `get`、`getById`、`page`、`recent`、`monthlyOverview`、`create`、`edit`、`delete` | `db:tx:*`（同名映射） |
| `recurring` | `create`、`listActive`、`update`、`process` | `db:recurring:*`（同名映射） |
| `scenario` | `create`、`get`、`list`、`update` | `db:scenario:*`（同名映射） |
| `snapshot` | `list`、`getByMonth`、`generateMonthly` | `db:snapshot:*`（同名映射） |
| `fireCalc` | `runProjection` | `db:fireCalc:runProjection` |
| `exportImport` | `exportJson`、`exportCsv`、`importJson`、`parseCsv`、`importCsvTransactions`、`markDuplicates`、`detectTemplate`、`clearTransactions`、`showSaveDialog`、`showOpenDialog` | `export:*`、`import:*`、`clear:transactions`、`dialog:save`、`dialog:open` |

导出 `DataAccess` 类型供渲染进程 TypeScript 使用。preload 编译产物为 `index.mjs`（由 main/index.ts 的 `webPreferences.preload` 引用）。
