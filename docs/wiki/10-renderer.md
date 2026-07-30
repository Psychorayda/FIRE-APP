# 10 - Renderer 渲染层

> 最后更新: 2026-07-30
> [← 09-desktop-main](./09-desktop-main.md) | [CODE_WIKI →](./CODE_WIKI.md)

## 概述

renderer 是 FIRE APP 的 Electron 渲染层，运行在 BrowserWindow 中，承担全部 UI 渲染与用户交互职责。技术栈为 **React 19 + Zustand 5 + react-router-dom 7 + Tailwind 4 + Recharts 2**，通过 electron-vite 打包。渲染层不直接接触 better-sqlite3，所有数据操作经 `window.dataAccess`（preload 暴露的 IPC 桥）下发到主进程，再由主进程调用 `@fire-app/shared` 数据层完成。

渲染层代码位于 `apps/desktop/src/renderer/src/`，按职责分为：入口与路由（[main.tsx](file:///workspace/apps/desktop/src/renderer/src/main.tsx) / [App.tsx](file:///workspace/apps/desktop/src/renderer/src/App.tsx) / [router/](file:///workspace/apps/desktop/src/renderer/src/router/)）、stores 状态管理（7 个 Zustand store）、data 数据访问抽象（DataAccessPort + IPC 实现 + 单例）、components（base / layout / auxiliary / accounts / transactions / dashboard / net-worth / fire-calculator / data-management）、pages（7 个页面）、hooks 与 constants。本章描述 renderer 的实际落地结构，数值与签名均取自源码。

## 入口与路由

### 启动链路

1. [main.tsx](file:///workspace/apps/desktop/src/renderer/src/main.tsx) 是渲染进程入口：`createRoot(container).render(<React.StrictMode><App /></React.StrictMode>)`，根容器 id 为 `root`，缺失时抛错；引入全局样式 `styles/globals.css`。
2. [App.tsx](file:///workspace/apps/desktop/src/renderer/src/App.tsx) 是根组件，层级为 **ErrorBoundary（最外）→ Suspense → RouterProvider**。`useEffect` 中调用 `useAppStore.initialize()`（通过 selector 取 `s.initialize`），完成首次启动的用户探测。Suspense fallback 为「加载中...」占位。
3. [router/index.tsx](file:///workspace/apps/desktop/src/renderer/src/router/index.tsx) 用 `createHashRouter` 定义路由（Electron 文件协议下 hash 路由更稳）。

### 懒加载策略

7 个页面全部用 `React.lazy` 动态导入，每个通过 `.then(m => ({ default: m.XxxPage }))` 适配具名导出：

| 路径 | 组件 |
|------|------|
| `/onboarding` | OnboardingPage（独立，不进布局） |
| `/` | DashboardPage |
| `/accounts` | AccountsPage |
| `/transactions` | TransactionsPage |
| `/net-worth` | NetWorthPage |
| `/fire-calculator` | FireCalculatorPage |
| `/settings` | SettingsPage |
| `*` | `<Navigate to="/" replace />` 兜底 |

路由结构分两层守卫：外层 [RequireInit.tsx](file:///workspace/apps/desktop/src/renderer/src/router/RequireInit.tsx) 读取 `useAppStore.initialized`，未初始化时 `<Navigate to="/onboarding" replace />`，否则渲染 `<Outlet />`；内层 [AppLayout.tsx](file:///workspace/apps/desktop/src/renderer/src/components/layout/AppLayout.tsx) 包裹 6 个业务页面（Sidebar + 主内容区 + Toast）。OnboardingPage 在布局外独立全屏渲染。

## 构建配置 electron.vite.config.ts

[electron.vite.config.ts](file:///workspace/apps/desktop/electron.vite.config.ts) 配置 main / preload / renderer 三段。

- **noExternal**：`['@fire-app/shared']` 被排除在 externalize 之外，打包进 `out/` 产物，解决 monorepo workspace 符号链接打包问题。main / preload / renderer 三段统一通过 `externalizeDepsPlugin({ exclude: noExternal })` 处理。
- **别名**：`@shared` → `packages/shared/src`，`@renderer` → `apps/desktop/src/renderer/src`（仅 renderer 段）。
- **renderer 插件**：`@vitejs/plugin-react` + `@tailwindcss/vite`。
- **manualChunks**（`build.rollupOptions.output.manualChunks`）将第三方依赖拆为 3 个 chunk：
  - `react-vendor`：`['react', 'react-dom', 'react-router-dom']`
  - `recharts`：`['recharts']`
  - `zustand`：`['zustand']`

## stores 层

7 个 Zustand store，每个文件导出一个 `useXxxStore` hook。所有 store 采用 **细粒度 selector 模式**：组件用 `useXxxStore((s) => s.field)` 仅订阅用到的字段，避免 store 任意字段变更触发整页重渲染。写操作的错误不抛出，而是写入 `state.error`，由调用方通过 `useXxxStore.getState().error` 判定成功/失败。

| store 文件 | hook | 状态字段 | 关键方法 |
|-----------|------|---------|---------|
| [app-store.ts](file:///workspace/apps/desktop/src/renderer/src/stores/app-store.ts) | useAppStore | currentUser, initialized, loading, error | initialize（调 getFirstUser 探测用户）, completeOnboarding, setCurrentUser, clearError |
| [account-store.ts](file:///workspace/apps/desktop/src/renderer/src/stores/account-store.ts) | useAccountStore | accounts, loading, error | fetchAccounts, createAccount, updateAccount, softDeleteAccount, **upsertLocal, removeLocal**, clear |
| [transaction-store.ts](file:///workspace/apps/desktop/src/renderer/src/stores/transaction-store.ts) | useTransactionStore | **pagedTransactions, total, recentTransactions**, loading, error | fetchTransactionPage, fetchRecentTransactions, createTransaction, editTransaction, deleteTransaction, upsertLocal, removeLocal, clear |
| [scenario-store.ts](file:///workspace/apps/desktop/src/renderer/src/stores/scenario-store.ts) | useScenarioStore | scenarios, loading, **error**, currentScenarioId, projectionResult, projectionLoading | fetchScenarios, createScenario, updateScenario, selectScenario, runProjection, clear |
| [toast-store.ts](file:///workspace/apps/desktop/src/renderer/src/stores/toast-store.ts) | useToastStore | toasts | **show, showSuccess, showError**, showWarning, showInfo, remove, clear |
| [category-store.ts](file:///workspace/apps/desktop/src/renderer/src/stores/category-store.ts) | useCategoryStore | categories, loading, error | fetchCategories（自动 seed 兜底）, clear |
| [snapshot-store.ts](file:///workspace/apps/desktop/src/renderer/src/stores/snapshot-store.ts) | useSnapshotStore | snapshots, loading, error | fetchSnapshots, generateMonthly, clear |

关键设计要点：

- **app-store**：承载 `currentUser`（含 `base_currency`）与 `initialized` 守卫标志。`initialize` 调 `dataAccess.getFirstUser()`，有用户则置 `initialized: true`，无用户则 `false`（触发跳转 Onboarding）。
- **account-store**：写操作后局部更新——`createAccount`/`updateAccount` 调 `upsertLocal`（按 id 替换或追加），`softDeleteAccount` 调 `removeLocal`（按 id 过滤），不再全量重拉。
- **transaction-store**：双分页通道——`pagedTransactions` + `total` 服务交易页（服务端分页），`recentTransactions` 服务仪表盘近期列表。写操作后 `upsertLocal` 同时更新两个列表（已存在则替换，否则插入头部），并调整 `total`（create +1 / delete -1，下限 0）。**跨 store 联动**：写操作后调 `useAccountStore.getState().fetchAccounts(userId)` 刷新账户余额（交易影响余额）。
- **scenario-store**：含 `error` 状态；`updateScenario` 采用**乐观更新**——先 `set` 本地 scenarios 映射 + 清除上一次 `error: null`，再 `await dataAccess.updateScenario` 持久化并重拉列表。`selectScenario` 切换后自动 `runProjection`。`createScenario` 后新场景按 `updated_at DESC` 排第一并自动投影。
- **toast-store**：`ToastItem` 含 `id`(uuid)/`type`(success/error/warning/info)/`message`/`duration`(默认 3000ms)。`show` 用 `setTimeout` 在 duration 后自动 `remove`；`showSuccess`/`showError` 等是 `show` 的便捷封装。
- **category-store**：**自动 seed 兜底**——首次 `fetchCategories` 返回空时自动 `dataAccess.seedCategories(userId)` 再重拉。用模块级 `seedInProgress: Promise | null` 缓存防止并发 fetch 重复 seed。
- **snapshot-store**：`generateMonthly` 生成当月快照后重拉全量 snapshots。各页面直接按需 import 具体 store 文件。

## data 层

data 层是渲染进程的数据访问抽象，使渲染层与具体数据后端解耦（桌面端走 IPC，未来移动端可走 react-native-quick-sqlite）。

| 文件 | 职责 |
|------|------|
| [data-access-port.ts](file:///workspace/apps/desktop/src/renderer/src/data/data-access-port.ts) | `DataAccessPort` 接口定义，按域分 9 组方法 |
| [ipc-data-access.ts](file:///workspace/apps/desktop/src/renderer/src/data/ipc-data-access.ts) | `IpcDataAccess` 类实现 `DataAccessPort`，全部方法转发到 `window.dataAccess` |
| [data-access.ts](file:///workspace/apps/desktop/src/renderer/src/data/data-access.ts) | 导出单例 `dataAccess = new IpcDataAccess()`，stores 与 pages 统一引用此单例 |
| [ipc.d.ts](file:///workspace/apps/desktop/src/renderer/src/types/ipc.d.ts) | `DataAccessAPI` 接口声明 `window.dataAccess` 形状，`declare global { interface Window { dataAccess: DataAccessAPI } }` |

`DataAccessPort` 接口按域分组：Database 管理（initDatabase / closeDatabase）、User、Account、Category、Transaction（含 `getTransactionsPage` 分页 + `getRecentTransactions` + `getMonthlyOverview` SQL 聚合）、Recurring、Scenario、Snapshot、FireCalc（`runProjection`）、Export/Import/Clear（嵌套对象，10 个方法：exportJson / exportCsv / importJson / parseCsv / importCsvTransactions / markDuplicates / detectTemplate / clearTransactions / showSaveDialog / showOpenDialog）。

`IpcDataAccess` 是薄封装：每个方法一行 `return window.dataAccess.<域>.<方法>(...)`，将接口方法名映射到 preload 暴露的 IPC 通道名（如 `getAccounts` → `account.list`，`getTransactionsPage` → `tx.page`）。`ipc.d.ts` 的 `DataAccessAPI` 与 `DataAccessPort` 一一对应，为 `window.dataAccess` 提供类型安全。

## base 组件

通用基础组件，位于 [components/base/](file:///workspace/apps/desktop/src/renderer/src/components/base/)，共 8 个。

| 组件 | 职责 | 关键 prop |
|------|------|----------|
| [Table.tsx](file:///workspace/apps/desktop/src/renderer/src/components/base/Table.tsx) | 通用表格，支持虚拟化滚动 | columns, data, loading, emptyText, onRowClick |
| [ErrorBoundary.tsx](file:///workspace/apps/desktop/src/renderer/src/components/base/ErrorBoundary.tsx) | 全局错误边界，捕获子树渲染错误 | children |
| [Input.tsx](file:///workspace/apps/desktop/src/renderer/src/components/base/Input.tsx) | 输入框 | type(text/number/date), label, value, error, prefix, suffix, ... |
| [Select.tsx](file:///workspace/apps/desktop/src/renderer/src/components/base/Select.tsx) | 下拉选择 | options, value, label, error, placeholder, ... |
| [Button.tsx](file:///workspace/apps/desktop/src/renderer/src/components/base/Button.tsx) | 按钮 | variant(primary/secondary/danger), size(sm/md/lg), type(button/submit/reset), loading, icon |
| [ConfirmDialog.tsx](file:///workspace/apps/desktop/src/renderer/src/components/base/ConfirmDialog.tsx) | 确认对话框（Modal+Button 组合） | open, title, message, confirmText, cancelText, variant(primary/danger), onConfirm, onCancel |
| [Modal.tsx](file:///workspace/apps/desktop/src/renderer/src/components/base/Modal.tsx) | 模态弹窗 | open, title, children, footer, onClose, width(默认 480) |
| [Card.tsx](file:///workspace/apps/desktop/src/renderer/src/components/base/Card.tsx) | 卡片容器 | title, extra, children, padding(默认 true) |

关键实现细节：

- **Table 虚拟化**：基于 `@tanstack/react-virtual` 的 `useVirtualizer`。常量：`VIRTUALIZE_THRESHOLD = 20`（行数 > 20 才启用虚拟滚动）、`ROW_HEIGHT = 48`（`estimateSize`）、`OVERSCAN = 10`。两条渲染路径：非虚拟化路径（`!loading && data.length <= 20`）直接渲染全部行（保证测试与小列表 `getByText` 可命中）；虚拟化路径用绝对定位 + `translateY` 渲染可见 + overscan 行，容器 `maxHeight: 600px`。`TableColumn<T>` 含 `key`/`title`/`render`/`width`/`align`。
- **ErrorBoundary**：class component，`static getDerivedStateFromError(error)` 置 `hasError: true`，`componentDidCatch` 调 `console.error` 上报钩子（生产环境可扩展）。兜底 UI 展示错误 message + 「重试」按钮（`handleRetry` 重置 state）。
- **Input / Select**：均用 React 18+ 的 `useId()` 生成稳定 id（可被外部 `id` prop 覆盖），`<label htmlFor={inputId}>` 关联标签，无障碍友好。
- **Button**：`type` prop 接受 `'button' | 'submit' | 'reset'`，默认 `'button'`；`loading` 时显示旋转 svg 并 `disabled`；`variant` × `size` 通过 `VARIANT_CLASSES` / `SIZE_CLASSES` 映射 Tailwind 类名。
- **Modal**：`useEffect` 监听 Escape 键关闭，遮罩点击关闭；`width` 可配置。
- **ConfirmDialog**：基于 Modal + Button，`variant: 'danger'` 时确认按钮用红色。

## layout 组件

| 组件 | 职责 |
|------|------|
| [AppLayout.tsx](file:///workspace/apps/desktop/src/renderer/src/components/layout/AppLayout.tsx) | 主布局：`flex h-screen` 容器内 Sidebar + `<main>`(Outlet) + Toast |
| [Sidebar.tsx](file:///workspace/apps/desktop/src/renderer/src/components/layout/Sidebar.tsx) | 侧边栏导航，6 个 NAV_ITEMS（仪表盘/账户管理/交易记录/净资产趋势/FIRE 计算器/设置），响应式折叠 |
| [PageHeader.tsx](file:///workspace/apps/desktop/src/renderer/src/components/layout/PageHeader.tsx) | 页面头部，props: title / subtitle / extra |

Sidebar 响应式折叠：`useEffect` 监听 `window.resize`，**窗口宽度 < 768px 自动折叠为图标条**（`w-16`，仅显示图标与首字母「F」logo），否则展开为 `w-64` 显示完整标签。`NavLink` 对 `/` 路径用 `end` prop 精确匹配，active 态高亮（蓝底 + 右边框）。

## auxiliary 组件

| 组件 | 职责 |
|------|------|
| [EmptyState.tsx](file:///workspace/apps/desktop/src/renderer/src/components/auxiliary/EmptyState.tsx) | 空状态占位，props: icon / title / description / action |
| [Toast.tsx](file:///workspace/apps/desktop/src/renderer/src/components/auxiliary/Toast.tsx) | Toast 通知组件，订阅 `useToastStore.toasts`，fixed 定位右上角 |

Toast 用 `TYPE_CLASSES` / `TYPE_ICONS` 映射 4 种类型（success ✓ / error ✕ / warning ⚠ / info ℹ）的背景色与图标，每条 toast 带关闭按钮调 `remove(id)`。

## 业务组件

按目录分组列关键组件与职责。

### accounts/（账户域）

| 组件 | 职责 |
|------|------|
| [AccountOverviewCards.tsx](file:///workspace/apps/desktop/src/renderer/src/components/accounts/AccountOverviewCards.tsx) | 账户概览卡片（按资产类别聚合） |
| [AccountListTable.tsx](file:///workspace/apps/desktop/src/renderer/src/components/accounts/AccountListTable.tsx) | 账户列表表格，支持编辑/删除回调 |
| [AccountFormModal.tsx](file:///workspace/apps/desktop/src/renderer/src/components/accounts/AccountFormModal.tsx) | 账户新建/编辑表单弹窗 |

### transactions/（交易域）

| 组件 | 职责 |
|------|------|
| [TransactionOverviewCards.tsx](file:///workspace/apps/desktop/src/renderer/src/components/transactions/TransactionOverviewCards.tsx) | 交易概览卡片（基于当前页可见交易计算收支） |
| [TransactionFilters.tsx](file:///workspace/apps/desktop/src/renderer/src/components/transactions/TransactionFilters.tsx) | 交易筛选器（type / account / category / dateFrom / dateTo） |
| [TransactionListTable.tsx](file:///workspace/apps/desktop/src/renderer/src/components/transactions/TransactionListTable.tsx) | 交易列表表格，支持编辑/删除回调 |
| [TransactionFormModal.tsx](file:///workspace/apps/desktop/src/renderer/src/components/transactions/TransactionFormModal.tsx) | 交易新建/编辑表单弹窗 |

### dashboard/（仪表盘域）

| 组件 | 职责 |
|------|------|
| [NetWorthCards.tsx](file:///workspace/apps/desktop/src/renderer/src/components/dashboard/NetWorthCards.tsx) | 净资产 3 卡（总资产 / 净资产 / 负债） |
| [MonthlyOverviewCards.tsx](file:///workspace/apps/desktop/src/renderer/src/components/dashboard/MonthlyOverviewCards.tsx) | 本月收支 3 卡（收入 / 支出 / 结余） |
| [NetWorthTrendChart.tsx](file:///workspace/apps/desktop/src/renderer/src/components/dashboard/NetWorthTrendChart.tsx) | 净资产趋势图（Recharts，近 6 月） |
| [RecentTransactions.tsx](file:///workspace/apps/desktop/src/renderer/src/components/dashboard/RecentTransactions.tsx) | 近期交易表 |

### net-worth/（净资产趋势域）

| 组件 | 职责 |
|------|------|
| [TrendChart.tsx](file:///workspace/apps/desktop/src/renderer/src/components/net-worth/TrendChart.tsx) | 趋势折线图（4 指标 × 4 时间范围） |
| [AllocationDonut.tsx](file:///workspace/apps/desktop/src/renderer/src/components/net-worth/AllocationDonut.tsx) | 资产配比环形图 |
| [AllocationDetail.tsx](file:///workspace/apps/desktop/src/renderer/src/components/net-worth/AllocationDetail.tsx) | 配比明细列表 |

### fire-calculator/（FIRE 计算器域）

| 组件 | 职责 |
|------|------|
| [FireIntro.tsx](file:///workspace/apps/desktop/src/renderer/src/components/fire-calculator/FireIntro.tsx) | 无场景时的介绍页 + 创建按钮 |
| [ScenarioSidebar.tsx](file:///workspace/apps/desktop/src/renderer/src/components/fire-calculator/ScenarioSidebar.tsx) | 场景列表侧栏，支持选择/新建 |
| [ScenarioForm.tsx](file:///workspace/apps/desktop/src/renderer/src/components/fire-calculator/ScenarioForm.tsx) | 场景参数表单（手动保存） |
| [ResultCards.tsx](file:///workspace/apps/desktop/src/renderer/src/components/fire-calculator/ResultCards.tsx) | 投影结果卡片（FIRE Number 等） |
| [ProgressGauge.tsx](file:///workspace/apps/desktop/src/renderer/src/components/fire-calculator/ProgressGauge.tsx) | 进度仪表盘 |
| [ProjectionChart.tsx](file:///workspace/apps/desktop/src/renderer/src/components/fire-calculator/ProjectionChart.tsx) | 投影面积图（Recharts AreaChart） |

### data-management/（数据管理域）

| 组件 | 职责 |
|------|------|
| [DataManagementPanel.tsx](file:///workspace/apps/desktop/src/renderer/src/components/data-management/DataManagementPanel.tsx) | 数据管理面板，集成 4 个功能块：备份恢复（JSON）/ 数据导出（CSV 7 表）/ 交易导入（CSV 向导）/ 危险操作（清空交易） |
| [CsvImportWizard.tsx](file:///workspace/apps/desktop/src/renderer/src/components/data-management/CsvImportWizard.tsx) | CSV 交易导入 5 步向导 |
| [ClearTransactionsDialog.tsx](file:///workspace/apps/desktop/src/renderer/src/components/data-management/ClearTransactionsDialog.tsx) | 清空交易确认对话框（输入确认 + 警告） |
| [TemplateSelectStep.tsx](file:///workspace/apps/desktop/src/renderer/src/components/data-management/TemplateSelectStep.tsx) | 步骤 1：选模板 |
| [FileAccountSelectStep.tsx](file:///workspace/apps/desktop/src/renderer/src/components/data-management/FileAccountSelectStep.tsx) | 步骤 2：选文件与目标账户 |
| [PreviewEditStep.tsx](file:///workspace/apps/desktop/src/renderer/src/components/data-management/PreviewEditStep.tsx) | 步骤 3：预览与编辑（含分类指派、去重标记） |
| [ConfirmImportStep.tsx](file:///workspace/apps/desktop/src/renderer/src/components/data-management/ConfirmImportStep.tsx) | 步骤 4：确认导入 |
| [ImportResultStep.tsx](file:///workspace/apps/desktop/src/renderer/src/components/data-management/ImportResultStep.tsx) | 步骤 5：导入结果展示 |

- **DataManagementPanel**：每个动作（导出 JSON / 导出 CSV / 导入 JSON）独立 `loading` state + `try/catch` + `showSuccess`/`showError` toast 反馈；`refreshStoresAfterDataChange` 在导入/清空后刷新 `fetchRecentTransactions` 与 `fetchAccounts`，让其他页面看到最新数据。`TABLE_OPTIONS` 列 7 张表（transactions / accounts / categories / recurring_transactions / net_worth_snapshots / fire_scenarios / users）。
- **CsvImportWizard**：`Step = 1 | 2 | 3 | 4 | 5`，进度指示器显示「选模板 → 选文件 → 预览 → 确认 → 完成」。步骤 2 → 3 调 `parseCsv` + `markDuplicates`（去重标记，默认勾选非重复项）；步骤 4 → 5 调 `importCsvTransactions`，成功后刷新 stores 并 toast。
- **ClearTransactionsDialog**：`CONFIRM_TEXT = '确认清空'`，需用户手动输入匹配才启用确认按钮（`canConfirm = confirmInput === CONFIRM_TEXT && !clearing`），红色警告框说明不可恢复；清空后 toast 报告清除的交易数 / 模板数 / 归零账户数。

## pages

7 个页面，全部用 `React.lazy` 懒加载。

| 页面 | 数据来源 | 关键特性 |
|------|---------|---------|
| [DashboardPage.tsx](file:///workspace/apps/desktop/src/renderer/src/pages/DashboardPage.tsx) | `Promise.all` 并发拉 `getAccounts` + `getRecentTransactions(userId, 10)` + `getSnapshots` + `getMonthlyOverview(currentYearMonth)` | SQL 聚合查询（recent + monthlyOverview），不再前端全量计算；静默调 `generateMonthlySnapshot`（不阻塞主流程，失败忽略）；派生 `computeNetWorthSummary` + `formatTrendData` |
| [TransactionsPage.tsx](file:///workspace/apps/desktop/src/renderer/src/pages/TransactionsPage.tsx) | `useTransactionStore.fetchTransactionPage`（服务端分页）+ `useAccountStore` + `useCategoryStore` | **PAGE_SIZE = 50** 服务端分页，筛选（type / account / dateFrom / dateTo）下推到 SQL；`category_id` 因 SQL 未支持下推，在前端当前页内过滤；`ONE_DAY_MS` 让 dateTo 含当天 23:59:59.999；写操作后局部更新 + toast |
| [FireCalculatorPage.tsx](file:///workspace/apps/desktop/src/renderer/src/pages/FireCalculatorPage.tsx) | `useScenarioStore`（fetchScenarios / runProjection）+ `dataAccess.getInvestableBalance` | **toast 反馈**：监听 store `error` 弹 `showError`，create/save 成功弹 `showSuccess`；`auto_sync_assets === 1` 时拉取 investableBalance 作为投影起点；无场景时显示 FireIntro |
| [SettingsPage.tsx](file:///workspace/apps/desktop/src/renderer/src/pages/SettingsPage.tsx) | `dataAccess.updateUser` / `getCategories` / `resetSystemCategories` | 三段：用户偏好编辑（基点 ↔ 百分比转换 `bpToPercent` / `percentToBp`，市场切换联动默认提款率 350/400）、内置分类展示与重置、**DataManagementPanel 集成** |
| [NetWorthPage.tsx](file:///workspace/apps/desktop/src/renderer/src/pages/NetWorthPage.tsx) | `useSnapshotStore.fetchSnapshots` | 时间范围（默认 `6m`）× 指标（默认 `netWorth`）双选；`filterByTimeRange` + `formatTrendForMetric` + `getAllocationData` 派生趋势与配比 |
| [AccountsPage.tsx](file:///workspace/apps/desktop/src/renderer/src/pages/AccountsPage.tsx) | `useAccountStore`（fetchAccounts + CRUD） | 账户 CRUD：AccountOverviewCards + AccountListTable + AccountFormModal + ConfirmDialog；写操作后局部更新 + toast |
| [OnboardingPage.tsx](file:///workspace/apps/desktop/src/renderer/src/pages/OnboardingPage.tsx) | `dataAccess.createUser` + `seedCategories` | 5 步向导（欢迎 → 显示名称 → 市场选择 → 利率偏好 → 确认）；`MARKET_DEFAULTS`（china: 350/700/300/CNY，global: 400/700/300/USD）；完成后 `completeOnboarding` + `navigate('/')` |

DashboardPage 与 TransactionsPage 体现了「SQL 聚合下推」策略——概览统计由主进程 SQL 完成，渲染层只持有当前页/近期切片，避免前端全量扫描。

## hooks

| hook | 职责 |
|------|------|
| [use-currency.ts](file:///workspace/apps/desktop/src/renderer/src/hooks/use-currency.ts) | `useCurrency(): string`——从 app-store 读 `currentUser?.base_currency`，未登录时回退到 `'CNY'` |

`useCurrency` 是 selector 一行实现：`useAppStore((s) => s.currentUser?.base_currency ?? 'CNY')`，供 constants 的 `formatAmount` / `formatBalance` / `formatFireAmount` / `formatYuan` 接收 currency 参数切换 ¥ / $。

## constants

5 个 `*-constants.ts` 文件，集中存放各业务域的纯函数与常量，全部无副作用、易于单元测试。所有 `format*` 函数接收 `currency` 参数（默认 `'CNY'`），通过 `CURRENCY_SYMBOLS` / `CURRENCY_LOCALES` 切换货币符号（¥ / $）与区域（zh-CN / en-US）。

| 文件 | 关键导出 |
|------|---------|
| [transaction-constants.ts](file:///workspace/apps/desktop/src/renderer/src/components/transactions/transaction-constants.ts) | `TRANSACTION_TYPE_CONFIG`、`TRANSACTION_TYPE_OPTIONS`、`TransactionFilters`、`TransactionOverview`、`CURRENCY_SYMBOLS`({CNY:¥, USD:$})、`CURRENCY_LOCALES`({CNY:zh-CN, USD:en-US})、`formatAmount(cents, currency='CNY')`、`formatDate`、`computeOverview`、`sortTransactions`、`hasActiveFilters` |
| [dashboard-constants.ts](file:///workspace/apps/desktop/src/renderer/src/components/dashboard/dashboard-constants.ts) | `NetWorthSummary`、`TrendPoint`、`computeNetWorthSummary(accounts)`、`getRecentTransactions(txs, limit)`、`formatTrendData(snapshots)` |
| [net-worth-constants.ts](file:///workspace/apps/desktop/src/renderer/src/components/net-worth/net-worth-constants.ts) | `TIME_RANGE_CONFIG`(3m/6m/1y/all)、`METRIC_CONFIG`(4 指标)、`formatYuan(yuan, currency='CNY')`（处理元，区别于 formatAmount 处理分）、`filterByTimeRange`、`formatTrendForMetric`、`getAllocationData` |
| [fire-calc-constants.ts](file:///workspace/apps/desktop/src/renderer/src/components/fire-calculator/fire-calc-constants.ts) | `basisPointsToPercent` / `percentToBasisPoints`、`formatFireAmount(cents, currency='CNY')`、`formatProgress`、`createDefaultScenarioInput`、`validateScenarioField`、`formatProjectionForChart`、`FORM_FIELD_GROUPS`、`CHINA_WITHDRAWAL_RATE_HINT` |
| [account-constants.ts](file:///workspace/apps/desktop/src/renderer/src/components/accounts/account-constants.ts) | `ASSET_CLASS_CONFIG`、`ACCOUNT_TYPE_LABELS`(11 种)、`ASSET_CLASS_OPTIONS`、`ACCOUNT_TYPE_OPTIONS`、`formatBalance(cents, currency='CNY')`、`AccountOverview`、`computeOverview(accounts)` |

`CURRENCY_SYMBOLS` / `CURRENCY_LOCALES` 在 [transaction-constants.ts](file:///workspace/apps/desktop/src/renderer/src/components/transactions/transaction-constants.ts) 中定义一次，net-worth / fire-calc / account 三个 constants 文件均从此 re-import 复用，避免重复声明。金额格式化统一用 `Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })`，负数显示为 `-¥xxx`。

---

> [← 09-desktop-main](./09-desktop-main.md) | [CODE_WIKI →](./CODE_WIKI.md)
