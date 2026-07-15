# FIRE 计算APP — 前端架构设计
> 版本: 1.0  日期: 2026-07-15  状态: 待审核

## 1. 设计概述

### 1.1 目标

本文档为 FIRE 计算APP 的 Electron 桌面 MVP 提供完整的前端架构设计，核心目标如下：

1. **复用现有数据层**：将已完成的数据模型层（7 张表 schema、CRUD、服务层、测试）无缝接入 Electron 主进程，零逻辑改动。
2. **进程安全隔离**：数据库操作仅存在于主进程，渲染进程通过 IPC 桥间接调用，杜绝渲染进程直接接触 Node.js API。
3. **跨平台共享预留**：抽取纯逻辑代码（类型定义、工具函数、FIRE 计算）到 `packages/shared`，为后续 React Native 移动端扩展奠定基础。
4. **MVP 快速交付**：覆盖账户管理、交易记录、净资产趋势、FIRE 计算器四个核心功能页面，桌面优先发布。
5. **架构可扩展**：通过 DataAccessPort 抽象层，使数据访问方式（IPC / quick-sqlite）可切换，不侵入业务逻辑。

### 1.2 设计原则

| 原则 | 说明 |
|------|------|
| **进程隔离** | DB 操作仅在主进程，渲染进程通过 contextBridge 白名单暴露的 API 调用，nodeIntegration 设为 false |
| **共享逻辑最大化** | 所有不依赖 Node.js / Electron 的纯 TypeScript 代码（types、utils、纯计算函数）抽取到 `packages/shared` |
| **端口抽象** | 定义 `DataAccessPort` 接口，渲染进程面向接口编程；桌面走 IPC 实现，移动端走 react-native-quick-sqlite 实现 |
| **最小改动迁移** | 现有 models/services 函数签名保持不变（仍是同步的 `fn(db, ...args)`），仅在主进程增加 IPC handler 包装层 |
| **安全优先** | contextIsolation: true, nodeIntegration: false, sandbox: false，所有跨进程通信经 preload 白名单 |
| **类型端到端** | IPC 通道的请求/响应均使用 TypeScript 泛型约束，编译期类型安全 |

### 1.3 架构总览

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           Electron 应用                                   │
│                                                                           │
│  ┌──────────────────────────────┐       ┌──────────────────────────────┐ │
│  │       主进程 (Main Process)    │       │      渲染进程 (Renderer)       │ │
│  │                                │       │                              │ │
│  │  ┌──────────────────────────┐  │       │  ┌────────────────────────┐  │ │
│  │  │   DB Connection          │  │       │  │   React 19 UI          │  │ │
│  │  │   (better-sqlite3)       │  │       │  │   (Vite + Tailwind)    │  │ │
│  │  └───────────┬──────────────┘  │       │  └───────────┬────────────┘  │ │
│  │              │                  │       │              │               │ │
│  │  ┌───────────▼──────────────┐  │       │  ┌───────────▼────────────┐  │ │
│  │  │   Models + Services      │  │       │  │   Zustand Stores        │  │ │
│  │  │   (现有代码, 零改动)       │  │       │  │   (全局状态管理)         │  │ │
│  │  └───────────┬──────────────┘  │       │  └───────────┬────────────┘  │ │
│  │              │                  │       │              │               │ │
│  │  ┌───────────▼──────────────┐  │       │  ┌───────────▼────────────┐  │ │
│  │  │   IPC Handlers            │  │       │  │   DataAccessPort       │  │ │
│  │  │   (ipcMain.handle)        │◄├───────┤  │   (IPC 实现, 接口实现)   │  │ │
│  │  └───────────▲──────────────┘  │  IPC  │  └───────────▲────────────┘  │ │
│  │              │                  │ Bridge│              │               │ │
│  │  ┌───────────┴──────────────┐  │       │  ┌───────────┴────────────┐  │ │
│  │  │   Preload Script          │  │       │  │   contextBridge        │  │ │
│  │  │   (contextBridge.expose)  │◄───────►  │   (window.dataAccess)          │  │ │
│  │  └──────────────────────────┘  │       │  └────────────────────────┘  │ │
│  └──────────────────────────────┘       └──────────────────────────────┘ │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │                  packages/shared (共享逻辑层)                      │    │
│  │                                                                    │    │
│  │   types/      → 7 个实体接口 + 枚举类型 + Input 类型                │    │
│  │   utils/      → time.ts, money.ts, sync.ts (纯函数)                │    │
│  │   services/   → fire-calc.ts 纯计算函数 (不含 DB 依赖)              │    │
│  │   db/         → schema.ts DDL 定义 (跨平台共享)                    │    │
│  └──────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
```

**数据流说明**：

1. 用户在 React UI 中操作 → 触发 Zustand Store 的 action
2. Store action 调用 `DataAccessPort` 接口方法
3. `DataAccessPort` 的 IPC 实现通过 `window.dataAccess`（contextBridge 暴露）发送 IPC 请求
4. 主进程的 IPC handler 接收请求 → 调用现有 models/services（传入 db 实例）→ 返回结果
5. Store 更新状态 → React 组件自动重渲染

---

## 2. 技术栈选型

### 2.1 Electron 主进程/渲染进程划分

| 进程 | 职责 | 可访问的 API |
|------|------|------------|
| **主进程 (Main)** | 数据库连接管理、所有 CRUD 操作、FIRE 计算引擎、经常性交易处理、快照生成、IPC handler 注册 | Node.js 完整 API、better-sqlite3、文件系统 |
| **Preload** | contextBridge 桥接，将 IPC 调用包装为类型安全的 API 暴露给渲染进程 | 受限的 Electron API（ipcRenderer.invoke） |
| **渲染进程 (Renderer)** | React UI、Zustand 状态管理、路由、用户交互 | 仅 `window.dataAccess`（preload 暴露的白名单 API），无 Node.js |

**安全配置**：

```typescript
// 主窗口安全配置 / Main window security configuration
const mainWindow = new BrowserWindow({
  webPreferences: {
    preload: path.join(__dirname, '../preload/index.mjs'),
    contextIsolation: true,      // 上下文隔离：渲染进程无法访问 preload 内部作用域
    nodeIntegration: false,       // 禁用 Node.js 集成：渲染进程无 require/import
    sandbox: false,               // 关闭沙箱：preload 使用 externalizeDepsPlugin 需访问 Node API
  },
});
```

### 2.2 React 版本与构建工具

**选型结论：electron-vite + React 19**

**理由**：

1. **electron-vite** 是当前 Electron + Vite 集成的最佳方案。它深度整合了 Vite 的闪电构建速度与 Electron 的多进程能力，统一管理主进程、preload、渲染进程三套构建配置，开箱即用 HMR（热模块替换）。
2. 相比手动配置 Vite + electron-forge，electron-vite 减少了约 60% 的配置代码，且内置了对 `contextIsolation`、preload 的正确处理。
3. **React 19** 是当前稳定版本（2026年），支持 `use()` hook、改进的 Suspense、自动批处理优化，配合 Vite 的 React 插件可获得最佳开发体验。
4. electron-vite 官方维护活跃，与 Electron 最新版本同步更新，社区生态成熟。

**构建配置概要**：

```typescript
// electron.vite.config.ts
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  main: {
    build: { rollupOptions: { input: resolve('src/main/index.ts') } },
  },
  preload: {
    build: { rollupOptions: { input: resolve('src/preload/index.ts') } },
  },
  renderer: {
    root: 'src/renderer',
    build: { rollupOptions: { input: resolve('src/renderer/index.html') } },
    plugins: [react()],
  },
});
```

### 2.3 CSS 方案

**选型结论：Tailwind CSS v4**

**理由**：

1. **原子化 CSS，零样式冲突**：FIRE 计算APP 是单人使用的桌面工具，UI 复杂度中等（5 个页面、表单、图表），Tailwind 的 utility-first 模式足够覆盖所有样式需求，无需 BEM 命名约定。
2. **与 Vite 深度集成**：Tailwind v4 的 Vite 插件（`@tailwindcss/vite`）零配置接入，构建时自动 Tree-shaking 未使用的样式，最终 CSS 体积通常 < 15KB。
3. **设计一致性**：Tailwind 的设计令牌系统（spacing、color、font）天然保证 UI 视觉统一，适合快速迭代 MVP。
4. **响应式预留**：虽然 MVP 桌面优先，但 Tailwind 的响应式前缀为后续移动端适配提供了便利。
5. 相比 CSS-in-JS（如 Emotion）：Tailwind 无运行时开销，构建时生成，对 Electron 渲染进程性能更友好。

### 2.4 选型决策记录表

| 领域 | 选型 | 版本 | 决策理由 |
|------|------|------|---------|
| 桌面框架 | Electron | ^31.x | 跨平台桌面应用标准方案，Chromium 渲染保证 UI 一致性，npm 生态最丰富 |
| 构建工具 | electron-vite | ^2.x | 深度整合 Vite + Electron，三进程统一构建，HMR 开箱即用，配置最少 |
| 前端框架 | React | ^19.x | 2026年稳定版，use() hook + 改进 Suspense，生态最成熟 |
| CSS 方案 | Tailwind CSS | ^4.x | 原子化零冲突，Vite 插件零配置，构建时 Tree-shaking，设计令牌统一 |
| 状态管理 | Zustand | ^5.x | 极简 API，无 Provider 包裹，TypeScript 友好，适合中小型应用（详见第5章） |
| 路由 | React Router | ^7.x | React 生态标准路由方案，v7 支持数据加载和嵌套路由 |
| 包管理 | pnpm | ^9.x | workspace 原生支持 monorepo，硬链接节省磁盘，安装速度最快 |
| 数据库 | better-sqlite3 | ^11.x | 现有代码已使用，同步 API 性能最优，Node.js 原生绑定 |
| 测试框架 | Vitest | ^2.x | 现有代码已使用，Vite 原生集成，零配置 |
| TypeScript | TypeScript | ^5.5.x | 现有代码已使用，端到端类型安全 |
| 图表库 | Recharts | ^2.x | React 原生组件式图表库，适合净资产趋势和 FIRE 投影可视化 |
| 表单库 | React Hook Form | ^7.x | 轻量高性能，与 Zod 验证集成良好，适合交易和账户表单 |
| 验证库 | Zod | ^3.x | TypeScript-first schema 验证，类型推断自动同步 |

---

## 3. 目录结构

### 3.1 Monorepo 结构设计（pnpm workspace）

```
fire-app/                          # 仓库根目录
├── pnpm-workspace.yaml            # pnpm workspace 配置
├── package.json                   # 根 package.json（scripts, devDeps）
├── tsconfig.base.json             # 共享 TypeScript 基础配置
├── .gitignore
│
├── packages/
│   └── shared/                    # 跨平台共享逻辑层
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── types/
│           │   └── index.ts       # 7 个实体接口 + 枚举 + Input 类型
│           ├── utils/
│           │   ├── time.ts        # 时间工具（nowMs, toYearMonth, addMonths, monthsBetween）
│           │   ├── money.ts       # 金额工具（yuanToCents, centsToYuan, basisPointsToDecimal）
│           │   └── sync.ts        # 同步元数据工具（LWW 冲突解决，MVP 预留）
│           ├── services/
│           │   └── fire-calc.ts   # FIRE 纯计算函数（不含 runProjection）
│           └── db/
│               └── schema.ts      # DDL 定义 + TABLE_NAMES + initSchema 函数
│
├── apps/
│   └── desktop/                   # Electron 桌面应用
│       ├── package.json
│       ├── electron.vite.config.ts
│       ├── tsconfig.json
│       ├── tsconfig.node.json
│       ├── tsconfig.web.json
│       │
│       ├── src/
│       │   ├── main/              # 主进程
│       │   │   ├── index.ts       # 应用入口，创建窗口，注册 IPC
│       │   │   ├── ipc/
│       │   │   │   ├── register-handlers.ts  # IPC handler 注册器
│       │   │   │   ├── user-handlers.ts      # User 相关 IPC handler
│       │   │   │   ├── account-handlers.ts   # Account 相关 IPC handler
│       │   │   │   ├── category-handlers.ts  # Category 相关 IPC handler
│       │   │   │   ├── transaction-handlers.ts  # Transaction 相关 IPC handler
│       │   │   │   ├── recurring-handlers.ts # Recurring 相关 IPC handler
│       │   │   │   ├── scenario-handlers.ts  # Scenario 相关 IPC handler
│       │   │   │   └── snapshot-handlers.ts  # Snapshot 相关 IPC handler
│       │   │   ├── db/
│       │   │   │   └── connection.ts  # better-sqlite3 连接管理
│       │   │   ├── models/        # 现有 models（零改动迁移）
│       │   │   │   ├── user.ts
│       │   │   │   ├── account.ts
│       │   │   │   ├── category.ts
│       │   │   │   ├── transaction.ts
│       │   │   │   ├── recurring.ts
│       │   │   │   ├── scenario.ts
│       │   │   │   └── snapshot.ts
│       │   │   └── services/     # 现有 services（零改动迁移）
│       │   │       ├── transaction-service.ts
│       │   │       ├── recurring-service.ts
│       │   │       ├── snapshot-service.ts
│       │   │       └── fire-calc-service.ts  # runProjection (需要 DB)
│       │   │
│       │   ├── preload/           # Preload 脚本
│       │   │   └── index.ts      # contextBridge 暴露 window.dataAccess
│       │   │
│       │   └── renderer/         # 渲染进程
│       │       ├── index.html
│       │       ├── main.tsx       # React 入口
│       │       ├── App.tsx        # 根组件 + 路由
│       │       ├── pages/         # 页面组件
│       │       │   ├── DashboardPage.tsx      # 净资产概览仪表盘
│       │       │   ├── AccountsPage.tsx       # 账户管理
│       │       │   ├── TransactionsPage.tsx    # 交易记录
│       │       │   ├── NetWorthTrendPage.tsx   # 净资产趋势图
│       │       │   ├── FireCalculatorPage.tsx  # FIRE 计算器
│       │       │   └── OnboardingPage.tsx     # 首次启动引导
│       │       ├── components/    # 可复用 UI 组件
│       │       │   ├── layout/    # 布局组件（Sidebar, Header）
│       │       │   ├── forms/     # 表单组件（AccountForm, TransactionForm）
│       │       │   ├── charts/    # 图表组件（NetWorthChart, FireProjectionChart）
│       │       │   └── common/    # 通用组件（AmountInput, CategorySelect, ConfirmDialog）
│       │       ├── stores/        # Zustand 状态管理
│       │       │   ├── user-store.ts
│       │       │   ├── account-store.ts
│       │       │   ├── transaction-store.ts
│       │       │   ├── snapshot-store.ts
│       │       │   └── scenario-store.ts
│       │       ├── data/          # 数据访问层
│       │       │   ├── data-access-port.ts    # DataAccessPort 接口定义
│       │       │   ├── ipc-data-access.ts     # IPC 实现（调用 window.dataAccess）
│       │       │   └── data-access.ts         # 导出当前使用的实例
│       │       ├── hooks/         # 自定义 React Hooks
│       │       │   ├── useAccounts.ts
│       │       │   ├── useTransactions.ts
│       │       │   └── useNetWorth.ts
│       │       ├── router/        # 路由配置
│       │       │   └── index.tsx
│       │       ├── styles/       # 全局样式
│       │       │   └── globals.css
│       │       └── types/         # 渲染进程特有类型
│       │           └── ipc-api.ts  # window.dataAccess 的 TypeScript 声明
│       │
│       └── tests/                # 测试（从现有 tests/ 迁移）
│           ├── unit/
│           └── integration/
│
└── docs/                         # 文档
    └── superpowers/
        └── specs/
```

**pnpm-workspace.yaml**：

```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

### 3.2 共享逻辑层 packages/shared

`packages/shared` 包含所有**不依赖 Node.js / Electron API** 的纯 TypeScript 代码，可被桌面端和移动端共同引用。

| 模块 | 内容 | 复用方 |
|------|------|--------|
| `types/index.ts` | 7 个实体接口（User, Account, Transaction, Category, RecurringTransaction, NetWorthSnapshot, FireScenario）、5 个枚举类型、所有 Input 接口 | 桌面 + 移动 |
| `utils/time.ts` | `nowMs()`, `toYearMonth()`, `addMonths()`, `monthsBetween()` — 纯时间计算 | 桌面 + 移动 |
| `utils/money.ts` | `yuanToCents()`, `centsToYuan()`, `basisPointsToDecimal()` — 纯金额转换 | 桌面 + 移动 |
| `utils/sync.ts` | `createSyncMeta()`, `bumpSyncVersion()`, `shouldRemoteWin()` — LWW 同步元数据（MVP 不使用，预留） | 桌面 + 移动 |
| `services/fire-calc.ts` | `calculateFireNumber()`, `calculateAdjustedFireNumber()`, `calculateAccumulation()`, `calculateProgress()` — 纯计算函数 | 桌面 + 移动 |
| `db/schema.ts` | `DDL_STATEMENTS`, `TABLE_NAMES`, `initSchema()` — DDL 定义跨平台共享 | 桌面 + 移动 |

### 3.3 桌面应用层 apps/desktop

桌面应用层分为三个进程目录，严格隔离：

- **`src/main/`**：主进程，持有 DB 连接，包含所有 models/services（从现有代码零改动迁移），以及 IPC handler 包装层。
- **`src/preload/`**：preload 脚本，使用 contextBridge 将 IPC 调用暴露为类型安全的 `window.dataAccess`。
- **`src/renderer/`**：渲染进程，React + Zustand + React Router，通过 DataAccessPort 接口访问数据。

### 3.4 现有代码迁移映射表

| 现有路径 | 新路径 | 是否需要修改 | 修改说明 |
|---------|-------|------------|---------|
| `fire-app/src/types/index.ts` | `packages/shared/src/types/index.ts` | 否 | 直接迁移，内容不变 |
| `fire-app/src/utils/time.ts` | `packages/shared/src/utils/time.ts` | 否 | 直接迁移，纯函数无依赖 |
| `fire-app/src/utils/money.ts` | `packages/shared/src/utils/money.ts` | 否 | 直接迁移，纯函数无依赖 |
| `fire-app/src/utils/sync.ts` | `packages/shared/src/utils/sync.ts` | 否 | 直接迁移，MVP 预留 |
| `fire-app/src/db/schema.ts` | `packages/shared/src/db/schema.ts` | 否 | DDL 定义跨平台共享，直接迁移 |
| `fire-app/src/db/connection.ts` | `apps/desktop/src/main/db/connection.ts` | 是 | 移至主进程；添加 DB 单例管理（getDatabase() 全局获取）；保留 createDatabase/closeDatabase 函数签名 |
| `fire-app/src/models/user.ts` | `apps/desktop/src/main/models/user.ts` | 否 | 逻辑零改动，由主进程 IPC handler 调用 |
| `fire-app/src/models/account.ts` | `apps/desktop/src/main/models/account.ts` | 否 | 逻辑零改动，由主进程 IPC handler 调用 |
| `fire-app/src/models/category.ts` | `apps/desktop/src/main/models/category.ts` | 否 | 逻辑零改动，由主进程 IPC handler 调用 |
| `fire-app/src/models/transaction.ts` | `apps/desktop/src/main/models/transaction.ts` | 否 | 逻辑零改动，由主进程 IPC handler 调用 |
| `fire-app/src/models/recurring.ts` | `apps/desktop/src/main/models/recurring.ts` | 否 | 逻辑零改动，由主进程 IPC handler 调用 |
| `fire-app/src/models/scenario.ts` | `apps/desktop/src/main/models/scenario.ts` | 否 | 逻辑零改动，由主进程 IPC handler 调用 |
| `fire-app/src/models/snapshot.ts` | `apps/desktop/src/main/models/snapshot.ts` | 否 | 逻辑零改动，由主进程 IPC handler 调用 |
| `fire-app/src/services/transaction-service.ts` | `apps/desktop/src/main/services/transaction-service.ts` | 否 | 逻辑零改动，由主进程 IPC handler 调用 |
| `fire-app/src/services/recurring-service.ts` | `apps/desktop/src/main/services/recurring-service.ts` | 否 | 逻辑零改动，由主进程 IPC handler 调用 |
| `fire-app/src/services/snapshot-service.ts` | `apps/desktop/src/main/services/snapshot-service.ts` | 否 | 逻辑零改动，由主进程 IPC handler 调用 |
| `fire-app/src/services/fire-calc.ts` | 拆分为两处 | 是 | 纯计算函数（calculateFireNumber 等 4 个）→ `packages/shared/src/services/fire-calc.ts`；runProjection（需要 DB）→ `apps/desktop/src/main/services/fire-calc-service.ts`，runProjection 内部 import 纯计算函数 |
| `fire-app/tests/**` | `apps/desktop/tests/**` | 否 | 测试逻辑不变，调整 import 路径即可 |

---

## 4. 数据访问层

### 4.1 IPC 桥架构

**核心设计**：主进程持有唯一的 `better-sqlite3` Database 实例，所有数据操作在主进程中同步执行。渲染进程通过 `ipcRenderer.invoke()` 发起异步请求，主进程的 `ipcMain.handle()` 接收并执行后返回结果。

```
渲染进程                        Preload                     主进程
─────────                      ────────                    ──────
Zustand Store
    │
    ▼
DataAccessPort (接口)
    │
    ▼
IpcDataAccess (实现)
    │
    │  window.dataAccess.user.getUser(id)        contextBridge
    │  ──────────────────────────►            │
    │                                          │  ipcRenderer.invoke('db:user:get', id)
    │                                          │  ──────────────────────────────────►
    │                                          │                                      │
    │                                          │                                      │  ipcMain.handle('db:user:get')
    │                                          │                                      │  → getUser(db, id)
    │                                          │                                      │  → return result
    │                                          │  ◄──────────────────────────────────
    │  ◄───────────────────────────           │
    │  Promise<User | null>                   │
    ▼
React 组件重渲染
```

**Preload 脚本设计**：

```typescript
// apps/desktop/src/preload/index.ts
// Preload 脚本：通过 contextBridge 将 IPC 调用暴露为类型安全的 API
// Preload script: expose IPC calls as type-safe API via contextBridge

import { contextBridge, ipcRenderer } from 'electron';
import type { IpcApi } from '../renderer/types/ipc-api';

const api: IpcApi = {
  // 数据库初始化 / Database initialization
  initDatabase: () => ipcRenderer.invoke('db:init'),
  closeDatabase: () => ipcRenderer.invoke('db:close'),

  // User 相关 / User operations
  user: {
    create: (input) => ipcRenderer.invoke('db:user:create', input),
    get: (id) => ipcRenderer.invoke('db:user:get', id),
    update: (id, input) => ipcRenderer.invoke('db:user:update', id, input),
    getFirst: () => ipcRenderer.invoke('db:user:getFirst'),
  },

  // Account 相关 / Account operations
  account: {
    create: (input) => ipcRenderer.invoke('db:account:create', input),
    get: (id) => ipcRenderer.invoke('db:account:get', id),
    list: (userId) => ipcRenderer.invoke('db:account:list', userId),
    updateBalance: (id, balance) => ipcRenderer.invoke('db:account:updateBalance', id, balance),
    getInvestableBalance: (userId) => ipcRenderer.invoke('db:account:investableBalance', userId),
    getNetWorth: (userId) => ipcRenderer.invoke('db:account:netWorth', userId),
    hasTransactions: (accountId) => ipcRenderer.invoke('db:account:hasTransactions', accountId),
    softDelete: (id) => ipcRenderer.invoke('db:account:softDelete', id),
  },

  // Category 相关 / Category operations
  category: {
    create: (input) => ipcRenderer.invoke('db:category:create', input),
    get: (id) => ipcRenderer.invoke('db:category:get', id),
    list: (userId, type?) => ipcRenderer.invoke('db:category:list', userId, type),
    seed: (userId) => ipcRenderer.invoke('db:category:seed', userId),
  },

  // Transaction 相关 / Transaction operations
  transaction: {
    get: (id) => ipcRenderer.invoke('db:tx:get', id),
    getById: (id) => ipcRenderer.invoke('db:tx:getById', id),
    listByUser: (userId) => ipcRenderer.invoke('db:tx:listByUser', userId),
    create: (input) => ipcRenderer.invoke('db:tx:create', input),
    edit: (id, input) => ipcRenderer.invoke('db:tx:edit', id, input),
    delete: (id) => ipcRenderer.invoke('db:tx:delete', id),
  },

  // Recurring 相关 / Recurring transaction operations
  recurring: {
    create: (input) => ipcRenderer.invoke('db:recurring:create', input),
    listActive: (userId) => ipcRenderer.invoke('db:recurring:listActive', userId),
    update: (id, updates) => ipcRenderer.invoke('db:recurring:update', id, updates),
    process: (userId) => ipcRenderer.invoke('db:recurring:process', userId),
  },

  // Scenario 相关 / FIRE scenario operations
  scenario: {
    create: (input) => ipcRenderer.invoke('db:scenario:create', input),
    get: (id) => ipcRenderer.invoke('db:scenario:get', id),
    list: (userId) => ipcRenderer.invoke('db:scenario:list', userId),
    update: (id, updates) => ipcRenderer.invoke('db:scenario:update', id, updates),
  },

  // Snapshot 相关 / Net worth snapshot operations
  snapshot: {
    list: (userId) => ipcRenderer.invoke('db:snapshot:list', userId),
    getByMonth: (userId, yearMonth) => ipcRenderer.invoke('db:snapshot:getByMonth', userId, yearMonth),
    generateMonthly: (userId) => ipcRenderer.invoke('db:snapshot:generateMonthly', userId),
  },

  // FireCalc 相关 / FIRE calculation operations
  fireCalc: {
    runProjection: (scenario) => ipcRenderer.invoke('db:fireCalc:runProjection', scenario),
  },
};

contextBridge.exposeInMainWorld('api', api);
```

### 4.2 DataAccessPort 接口定义

`DataAccessPort` 是渲染进程面向的数据访问抽象接口。所有 Store 和组件只依赖此接口，不直接调用 IPC。

```typescript
// apps/desktop/src/renderer/data/data-access-port.ts
// DataAccessPort 接口：渲染进程的数据访问抽象层
// DataAccessPort interface: data access abstraction for the renderer process
// 桌面端通过 IPC 实现，移动端可通过 react-native-quick-sqlite 实现

import type {
  User, Account, Category, Transaction, RecurringTransaction,
  NetWorthSnapshot, FireScenario,
  AssetClass, AccountType, CategoryType, TransactionType, Frequency,
} from '@fire-app/shared';
import type { ProjectionResult } from '@fire-app/shared';

// ============= Input 类型（从现有代码对应文件导入） =============

export interface CreateUserInput {
  id?: string;
  display_name: string;
  base_currency?: string;
  is_china_market?: number;
  default_withdrawal_rate?: number;
  default_expected_return?: number;
  default_inflation_rate?: number;
}

export interface UpdateUserInput {
  display_name?: string;
  base_currency?: string;
  is_china_market?: number;
  default_withdrawal_rate?: number;
  default_expected_return?: number;
  default_inflation_rate?: number;
  encryption_key_hash?: string | null;
  last_sync_at?: number | null;
}

export interface CreateAccountInput {
  user_id: string;
  name: string;
  asset_class: AssetClass;
  account_type: AccountType;
  initial_balance?: number;
  display_order?: number;
  note?: string | null;
}

export interface CreateCategoryInput {
  user_id: string;
  parent_id?: string | null;
  name: string;
  type: CategoryType;
  icon?: string | null;
  color?: string | null;
  linked_fire_concept?: string | null;
  display_order?: number;
}

export interface CreateTransactionInput {
  user_id: string;
  account_id: string;
  to_account_id?: string | null;
  category_id?: string | null;
  recurring_id?: string | null;
  transaction_type: TransactionType;
  amount: number;
  transaction_date: number;
  description?: string | null;
}

export interface EditTransactionInput {
  account_id?: string;
  to_account_id?: string | null;
  category_id?: string | null;
  transaction_type?: TransactionType;
  amount?: number;
  transaction_date?: number;
  description?: string | null;
}

export interface CreateRecurringInput {
  user_id: string;
  account_id: string;
  to_account_id?: string | null;
  category_id?: string | null;
  transaction_type: TransactionType;
  amount: number;
  frequency: Frequency;
  interval?: number;
  start_date: number;
  end_date?: number | null;
  next_due_date: number;
  description?: string | null;
  is_active?: number;
  auto_create?: number;
}

export interface CreateScenarioInput {
  user_id: string;
  name: string;
  description?: string | null;
  current_age: number;
  retirement_age: number;
  current_portfolio_value?: number;
  auto_sync_assets?: number;
  monthly_savings?: number;
  annual_expenses: number;
  expected_return_rate: number;
  inflation_rate?: number;
  withdrawal_rate: number;
  retirement_years?: number;
  post_retirement_monthly_income?: number;
  is_china_market?: number;
}

// ============= DataAccessPort 接口 =============

/**
 * 数据访问端口接口
 * Data access port interface
 *
 * 渲染进程通过此接口访问所有数据操作。
 * 桌面端使用 IpcDataAccess 实现（通过 IPC 调用主进程）。
 * 移动端预留使用 QuickSqliteDataAccess 实现（直接操作本地 SQLite）。
 */
export interface DataAccessPort {

  // ===== 数据库管理 / Database management =====

  /** 初始化数据库（创建表、索引，执行种子数据） / Initialize database */
  initDatabase(): Promise<void>;

  /** 关闭数据库连接 / Close database connection */
  closeDatabase(): Promise<void>;

  // ===== User =====

  /** 创建用户 / Create a user */
  createUser(input: CreateUserInput): Promise<User>;

  /** 根据 ID 获取用户 / Get user by ID */
  getUser(id: string): Promise<User | null>;

  /** 更新用户信息 / Update user info */
  updateUser(id: string, input: UpdateUserInput): Promise<User>;

  /** 获取第一个用户（MVP 单用户模式，用于启动时检查是否已初始化） / Get first user (single-user mode for startup check) */
  getFirstUser(): Promise<User | null>;

  // ===== Account =====

  /** 创建账户 / Create an account */
  createAccount(input: CreateAccountInput): Promise<Account>;

  /** 根据 ID 获取账户 / Get account by ID */
  getAccount(id: string): Promise<Account | null>;

  /** 获取用户的所有账户 / List all accounts for a user */
  getAccounts(userId: string): Promise<Account[]>;

  /** 更新账户余额 / Update account balance */
  updateAccountBalance(id: string, newBalance: number): Promise<void>;

  /** 获取可投资余额（liquid + invested） / Get investable balance */
  getInvestableBalance(userId: string): Promise<number>;

  /** 获取净资产（所有账户余额之和） / Get net worth */
  getNetWorth(userId: string): Promise<number>;

  /** 检查账户是否有关联交易 / Check if account has transactions */
  hasTransactions(accountId: string): Promise<boolean>;

  /** 软删除账户（有关联交易时抛出错误） / Soft delete account */
  softDeleteAccount(id: string): Promise<void>;

  // ===== Category =====

  /** 创建分类 / Create a category */
  createCategory(input: CreateCategoryInput): Promise<Category>;

  /** 根据 ID 获取分类 / Get category by ID */
  getCategory(id: string): Promise<Category | null>;

  /** 获取用户的分类列表 / List categories for a user, optionally filtered by type */
  getCategories(userId: string, type?: CategoryType): Promise<Category[]>;

  /** 为新用户创建预置分类 / Seed default categories for a new user */
  seedCategories(userId: string): Promise<void>;

  // ===== Transaction =====

  /** 根据 ID 获取交易（排除已删除） / Get transaction by ID (excludes deleted) */
  getTransaction(id: string): Promise<Transaction | null>;

  /** 根据 ID 获取交易（包括已删除） / Get transaction by ID (includes deleted) */
  getTransactionById(id: string): Promise<Transaction | null>;

  /** 获取用户的所有交易列表 / List all transactions for a user (new method, required by UI) */
  getTransactionsByUser(userId: string): Promise<Transaction[]>;

  /** 创建交易（自动更新账户余额） / Create a transaction (auto-updates account balance) */
  createTransaction(input: CreateTransactionInput): Promise<Transaction>;

  /** 编辑交易（自动调整账户余额） / Edit a transaction (auto-adjusts account balance) */
  editTransaction(id: string, input: EditTransactionInput): Promise<Transaction>;

  /** 删除交易（软删除，自动回滚账户余额） / Delete a transaction (soft delete, reverts balance) */
  deleteTransaction(id: string): Promise<void>;

  // ===== Recurring Transaction =====

  /** 创建经常性交易模板 / Create a recurring transaction template */
  createRecurring(input: CreateRecurringInput): Promise<RecurringTransaction>;

  /** 获取用户所有活跃的经常性交易 / Get all active recurring transactions for a user */
  getActiveRecurring(userId: string): Promise<RecurringTransaction[]>;

  /** 更新经常性交易模板 / Update a recurring transaction template */
  updateRecurring(id: string, updates: Partial<RecurringTransaction>): Promise<void>;

  /** 处理所有到期的经常性交易（生成交易记录） / Process due recurring transactions */
  processRecurringTransactions(userId: string): Promise<Transaction[]>;

  // ===== Scenario =====

  /** 创建 FIRE 场景 / Create a FIRE scenario */
  createScenario(input: CreateScenarioInput): Promise<FireScenario>;

  /** 根据 ID 获取场景 / Get scenario by ID */
  getScenario(id: string): Promise<FireScenario | null>;

  /** 获取用户的所有场景 / List all scenarios for a user */
  getScenarios(userId: string): Promise<FireScenario[]>;

  /** 更新场景 / Update a scenario */
  updateScenario(id: string, updates: Partial<FireScenario>): Promise<FireScenario>;

  // ===== Snapshot =====

  /** 获取用户的所有净资产快照 / List all net worth snapshots for a user */
  getSnapshots(userId: string): Promise<NetWorthSnapshot[]>;

  /** 根据年月获取快照 / Get snapshot by year-month */
  getSnapshotByMonth(userId: string, yearMonth: string): Promise<NetWorthSnapshot | null>;

  /** 生成当月净资产快照（如已存在则返回 null） / Generate monthly snapshot (returns null if exists) */
  generateMonthlySnapshot(userId: string): Promise<NetWorthSnapshot | null>;

  // ===== FireCalc =====

  /** 运行 FIRE 投影计算（需要 DB 访问以同步资产） / Run FIRE projection calculation */
  runProjection(scenario: FireScenario): Promise<ProjectionResult>;
}
```

> **注**：FIRE 纯计算函数（`calculateFireNumber`, `calculateAdjustedFireNumber`, `calculateAccumulation`, `calculateProgress`）不包含在 DataAccessPort 中，因为它们是纯函数，渲染进程可直接从 `@fire-app/shared` 导入调用，无需经过 IPC。

### 4.3 IPC 通道定义规范

**通道命名规则**：

```
db:{entity}:{action}
```

- `db` — 固定前缀，表示数据操作类通道
- `{entity}` — 实体名称，使用小写驼峰（user, account, category, tx, recurring, scenario, snapshot, fireCalc）
- `{action}` — 操作名称，使用小写驼峰（create, get, list, update, delete, softDelete, 等）

**特殊通道**：

- `db:init` — 数据库初始化
- `db:close` — 数据库关闭

**完整 IPC 通道列表**：

| 通道名 | 参数 | 返回值 | 对应的主进程函数 |
|--------|------|--------|-----------------|
| `db:init` | 无 | `void` | `initSchema(db)` |
| `db:close` | 无 | `void` | `closeDatabase(db)` |
| `db:user:create` | `CreateUserInput` | `User` | `createUser(db, input)` |
| `db:user:get` | `string` (id) | `User \| null` | `getUser(db, id)` |
| `db:user:update` | `string`, `UpdateUserInput` | `User` | `updateUser(db, id, input)` |
| `db:user:getFirst` | 无 | `User \| null` | `getFirstUser(db)` (新增方法) |
| `db:account:create` | `CreateAccountInput` | `Account` | `createAccount(db, input)` |
| `db:account:get` | `string` (id) | `Account \| null` | `getAccount(db, id)` |
| `db:account:list` | `string` (userId) | `Account[]` | `getAccounts(db, userId)` |
| `db:account:updateBalance` | `string`, `number` | `void` | `updateAccountBalance(db, id, balance)` |
| `db:account:investableBalance` | `string` (userId) | `number` | `getInvestableBalance(db, userId)` |
| `db:account:netWorth` | `string` (userId) | `number` | `getNetWorth(db, userId)` |
| `db:account:hasTransactions` | `string` (accountId) | `boolean` | `hasTransactions(db, accountId)` |
| `db:account:softDelete` | `string` (id) | `void` | `softDeleteAccount(db, id)` |
| `db:category:create` | `CreateCategoryInput` | `Category` | `createCategory(db, input)` |
| `db:category:get` | `string` (id) | `Category \| null` | `getCategory(db, id)` |
| `db:category:list` | `string`, `CategoryType?` | `Category[]` | `getCategories(db, userId, type?)` |
| `db:category:seed` | `string` (userId) | `void` | `seedCategories(db, userId)` |
| `db:tx:get` | `string` (id) | `Transaction \| null` | `getTransaction(db, id)` |
| `db:tx:getById` | `string` (id) | `Transaction \| null` | `getTransactionById(db, id)` |
| `db:tx:listByUser` | `string` (userId) | `Transaction[]` | `getTransactionsByUser(db, userId)` (新增方法) |
| `db:tx:create` | `CreateTransactionInput` | `Transaction` | `createTransaction(db, input)` |
| `db:tx:edit` | `string`, `EditTransactionInput` | `Transaction` | `editTransaction(db, id, input)` |
| `db:tx:delete` | `string` (id) | `void` | `deleteTransaction(db, id)` |
| `db:recurring:create` | `CreateRecurringInput` | `RecurringTransaction` | `createRecurring(db, input)` |
| `db:recurring:listActive` | `string` (userId) | `RecurringTransaction[]` | `getActiveRecurring(db, userId)` |
| `db:recurring:update` | `string`, `Partial<RecurringTransaction>` | `void` | `updateRecurring(db, id, updates)` |
| `db:recurring:process` | `string` (userId) | `Transaction[]` | `processRecurringTransactions(db, userId)` |
| `db:scenario:create` | `CreateScenarioInput` | `FireScenario` | `createScenario(db, input)` |
| `db:scenario:get` | `string` (id) | `FireScenario \| null` | `getScenario(db, id)` |
| `db:scenario:list` | `string` (userId) | `FireScenario[]` | `getScenarios(db, userId)` |
| `db:scenario:update` | `string`, `Partial<FireScenario>` | `FireScenario` | `updateScenario(db, id, updates)` |
| `db:snapshot:list` | `string` (userId) | `NetWorthSnapshot[]` | `getSnapshots(db, userId)` |
| `db:snapshot:getByMonth` | `string`, `string` | `NetWorthSnapshot \| null` | `getSnapshotByMonth(db, userId, yearMonth)` |
| `db:snapshot:generateMonthly` | `string` (userId) | `NetWorthSnapshot \| null` | `generateMonthlySnapshot(db, userId)` |
| `db:fireCalc:runProjection` | `FireScenario` | `ProjectionResult` | `runProjection(db, scenario)` |

### 4.4 数据序列化策略

IPC 通信使用 Electron 的**结构化克隆算法（Structured Clone Algorithm）**进行序列化，无需手动 JSON.stringify/parse。

**支持的类型**：
- 所有 TypeScript 基本类型（string, number, boolean, null, undefined）
- 普通对象（POJO）和数组
- Date 对象（但现有数据模型使用 number 时间戳，无此问题）

**限制**：
- 不支持函数、Symbol、DOM 节点
- 不支持 Class 实例（仅传输属性，丢失原型链）

**现有数据模型兼容性**：现有所有实体接口（User, Account, Transaction 等）均为纯数据对象（POJO），字段类型为 string/number/null，完全兼容结构化克隆算法，无需额外序列化处理。

### 4.5 错误传播机制

**主进程 → 渲染进程的错误传播**：

主进程中的 IPC handler 捕获同步异常，将其包装为标准化的 `IpcError` 对象返回。`ipcRenderer.invoke()` 的 Promise 会 reject，渲染进程通过 try-catch 捕获。

```typescript
// apps/desktop/src/main/ipc/register-handlers.ts
// IPC handler 注册器：统一错误处理包装
// IPC handler registrar: unified error handling wrapper

import { ipcMain } from 'electron';
import type { Database as DatabaseType } from 'better-sqlite3';

/**
 * 标准化 IPC 错误对象
 * Standardized IPC error object
 */
export interface IpcError {
  code: string;        // 错误码（如 'VALIDATION_ERROR', 'NOT_FOUND', 'DB_ERROR'）
  message: string;      // 人类可读的错误消息
  entity?: string;      // 相关实体名称
}

/**
 * 包装 IPC handler，统一错误处理
 * Wrap IPC handler with unified error handling
 * @param channel IPC 通道名 / IPC channel name
 * @param handler 业务处理函数 / Business handler function
 * @param db 数据库实例 / Database instance
 */
function registerHandler<TArgs extends unknown[], TResult>(
  channel: string,
  handler: (db: DatabaseType, ...args: TArgs) => TResult,
  db: DatabaseType,
): void {
  ipcMain.handle(channel, async (_event, ...args: TArgs): Promise<TResult | IpcError> => {
    try {
      return handler(db, ...args);
    } catch (error) {
      const ipcError: IpcError = {
        code: error instanceof Error && error.message.includes('not found') ? 'NOT_FOUND' : 'DB_ERROR',
        message: error instanceof Error ? error.message : String(error),
      };
      // ipcRenderer.invoke 的 Promise 会 reject，渲染进程 catch 捕获
      throw ipcError;
    }
  });
}
```

**渲染进程的错误处理**：

```typescript
// 渲染进程中的错误处理示例 / Error handling example in renderer
try {
  await dataAccess.createTransaction(input);
  store.notifySuccess('交易创建成功');
} catch (error) {
  const ipcError = error as IpcError;
  if (ipcError.code === 'VALIDATION_ERROR') {
    store.notifyError(`输入错误: ${ipcError.message}`);
  } else {
    store.notifyError(`操作失败: ${ipcError.message}`);
  }
}
```

---

## 5. 状态管理

### 5.1 方案选型

**选型结论：Zustand v5**

**理由**：

1. **极简 API**：Zustand 不需要 Provider 包裹、不需要 action dispatch、不需要 reducer，一个 `create()` 函数即可创建 Store。对于 FIRE 计算APP 的 5 个页面、中等复杂度的状态需求，Zustand 的开销远低于 Redux Toolkit。
2. **TypeScript 原生友好**：Zustand v5 的泛型设计完美支持 TypeScript，Store 的状态类型和方法类型在创建时自动推断，无需额外的类型声明文件。
3. **性能优势**：Zustand 使用细粒度订阅（selector），组件只在自己关心的状态变化时重渲染，无需 React.memo 优化。2026 年社区数据显示，从 Redux 迁移到 Zustand 后，状态管理相关代码量减少约 60%。
4. **与 React 19 兼容**：Zustand v5 完全支持 React 19 的 `use()` hook 和并发特性。
5. **无 boilerplate**：相比 Redux Toolkit 的 `createSlice + configureStore + useDispatch + useSelector` 流程，Zustand 只需 `create((set, get) => ({...}))`，开发效率更高。
6. **不选 Redux Toolkit 的理由**：RTK 功能全面但过于重型，其 DevTools、middleware、thunk/saga 体系对单人桌面 MVP 来说是过度工程化。

### 5.2 全局状态结构定义

```typescript
// apps/desktop/src/renderer/stores/app-store.ts
// 应用级全局状态 / Application-level global state

import { create } from 'zustand';

interface AppState {
  // 当前登录用户 / Current logged-in user
  currentUser: User | null;
  isInitialized: boolean;      // 数据库是否已初始化 / Database initialized flag
  isLoading: boolean;          // 全局加载状态 / Global loading state
  error: string | null;        // 全局错误消息 / Global error message

  // Actions
  setCurrentUser: (user: User | null) => void;
  setInitialized: (value: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentUser: null,
  isInitialized: false,
  isLoading: false,
  error: null,
  setCurrentUser: (user) => set({ currentUser: user }),
  setInitialized: (value) => set({ isInitialized: value }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
}));
```

**各领域 Store 划分**：

| Store 名称 | 管理的状态 | 主要 Actions |
|-----------|-----------|-------------|
| `useAppStore` | currentUser, isInitialized, isLoading, error | setCurrentUser, setInitialized, setLoading, setError |
| `useAccountStore` | accounts[], selectedAccount, investableBalance, netWorth | loadAccounts, addAccount, removeAccount, refreshBalances |
| `useTransactionStore` | transactions[], selectedTransaction | loadTransactions, addTransaction, editTransaction, removeTransaction |
| `useSnapshotStore` | snapshots[] | loadSnapshots, generateSnapshot |
| `useScenarioStore` | scenarios[], selectedScenario, projectionResult | loadScenarios, addScenario, updateScenario, runProjection |

### 5.3 数据流：IPC 调用 → Zustand Store → React 组件

```
用户操作                     Zustand Store                  DataAccessPort            IPC
────────                    ──────────────                 ──────────────            ───
点击"添加交易"
      │
      ▼
TransactionForm
onSubmit(input)
      │
      ▼
useTransactionStore
.addTransaction(input)
      │                          1. set({ isLoading: true })
      │──┐
      │  │  2. dataAccess.createTransaction(input)
      │  └──────────────────────────────────────────►  window.dataAccess.transaction.create(input)
      │                                                   │  ipcRenderer.invoke('db:tx:create')
      │                                                   │  ──────────────────────────────►
      │                                                   │                                 │
      │                                                   │                                 │  主进程:
      │                                                   │                                 │  createTransaction(db, input)
      │                                                   │                                 │  → 返回 Transaction
      │                                                   │  ◄──────────────────────────────
      │  ◄─────────────────────────────────────────────────  Promise<Transaction>
      │
      │  3. set((state) => ({
      │       transactions: [newTx, ...state.transactions],
      │       isLoading: false,
      │     }))
      ▼
React 组件自动重渲染
TransactionList 显示新交易
```

### 5.4 交易写入后的状态刷新机制

交易写入会改变账户余额和净资产快照，需要联动刷新多个 Store：

```typescript
// apps/desktop/src/renderer/stores/transaction-store.ts
// 交易状态管理：包含写入后的联动刷新逻辑
// Transaction state management: includes post-write cascade refresh

import { create } from 'zustand';
import { dataAccess } from '../data/data-access';
import { useAccountStore } from './account-store';
import { useSnapshotStore } from './snapshot-store';

interface TransactionState {
  transactions: Transaction[];
  isLoading: boolean;
  error: string | null;

  loadTransactions: (userId: string) => Promise<void>;
  addTransaction: (input: CreateTransactionInput) => Promise<void>;
  editTransaction: (id: string, input: EditTransactionInput) => Promise<void>;
  removeTransaction: (id: string, userId: string) => Promise<void>;
}

export const useTransactionStore = create<TransactionState>((set, get) => ({
  transactions: [],
  isLoading: false,
  error: null,

  loadTransactions: async (userId) => {
    set({ isLoading: true, error: null });
    try {
      // 注意：现有 models/transaction.ts 只有 getTransaction(id)，
      // 需要新增 getTransactionsByUser(userId) 方法（见 7.2 需要调整的模块清单）
      const transactions = await dataAccess.getTransactionsByUser(userId);
      set({ transactions, isLoading: false });
    } catch (error) {
      set({ error: (error as IpcError).message, isLoading: false });
    }
  },

  addTransaction: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const newTx = await dataAccess.createTransaction(input);

      // 1. 更新交易列表
      set((state) => ({
        transactions: [newTx, ...state.transactions],
        isLoading: false,
      }));

      // 2. 联动刷新账户余额（交易改变了账户余额）
      await useAccountStore.getState().refreshBalances(input.user_id);

      // 3. 联动刷新净资产快照（交易改变了净资产）
      await useSnapshotStore.getState().generateSnapshot(input.user_id);

    } catch (error) {
      set({ error: (error as IpcError).message, isLoading: false });
    }
  },

  editTransaction: async (id, input) => {
    set({ isLoading: true, error: null });
    try {
      const updatedTx = await dataAccess.editTransaction(id, input);
      set((state) => ({
        transactions: state.transactions.map((t) => (t.id === id ? updatedTx : t)),
        isLoading: false,
      }));
      // 联动刷新账户余额和快照
      const accountStore = useAccountStore.getState();
      if (accountStore.currentUserId) {
        await accountStore.refreshBalances(accountStore.currentUserId);
        await useSnapshotStore.getState().generateSnapshot(accountStore.currentUserId);
      }
    } catch (error) {
      set({ error: (error as IpcError).message, isLoading: false });
    }
  },

  removeTransaction: async (id, userId) => {
    set({ isLoading: true, error: null });
    try {
      await dataAccess.deleteTransaction(id);
      set((state) => ({
        transactions: state.transactions.filter((t) => t.id !== id),
        isLoading: false,
      }));
      // 联动刷新
      await useAccountStore.getState().refreshBalances(userId);
      await useSnapshotStore.getState().generateSnapshot(userId);
    } catch (error) {
      set({ error: (error as IpcError).message, isLoading: false });
    }
  },
}));
```

---

## 6. 路由设计

### 6.1 页面路由结构

MVP 包含 5 个核心页面 + 1 个引导页面：

| 路由路径 | 页面组件 | 功能说明 | 导航入口 |
|---------|---------|---------|---------|
| `/onboarding` | OnboardingPage | 首次启动引导：创建用户、初始化分类 | 自动重定向（未初始化时） |
| `/` | DashboardPage | 仪表盘首页：净资产概览、FIRE 进度、快捷入口 | 侧边栏"首页" |
| `/accounts` | AccountsPage | 账户管理：账户列表、创建/编辑/删除账户 | 侧边栏"账户" |
| `/transactions` | TransactionsPage | 交易记录：交易列表、创建/编辑/删除交易 | 侧边栏"交易" |
| `/net-worth` | NetWorthTrendPage | 净资产趋势：历史快照图表、资产分类占比 | 侧边栏"净资产趋势" |
| `/fire-calculator` | FireCalculatorPage | FIRE 计算器：场景管理、投影图表 | 侧边栏"FIRE计算器" |

```typescript
// apps/desktop/src/renderer/router/index.tsx
// 路由配置：使用 React Router v7 的 createBrowserRouter
// Router config: using React Router v7's createBrowserRouter

import { createHashRouter, Navigate } from 'react-router-dom';
import { useAppStore } from '../stores/app-store';
import App from '../App';
import DashboardPage from '../pages/DashboardPage';
import AccountsPage from '../pages/AccountsPage';
import TransactionsPage from '../pages/TransactionsPage';
import NetWorthTrendPage from '../pages/NetWorthTrendPage';
import FireCalculatorPage from '../pages/FireCalculatorPage';
import OnboardingPage from '../pages/OnboardingPage';

// 路由守卫组件 / Route guard component
function RequireInit({ children }: { children: React.ReactNode }) {
  const isInitialized = useAppStore((s) => s.isInitialized);
  if (!isInitialized) {
    return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
}

export const router = createHashRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { path: 'onboarding', element: <OnboardingPage /> },
      {
        element: <RequireInit><Outlet /></RequireInit>,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'accounts', element: <AccountsPage /> },
          { path: 'transactions', element: <TransactionsPage /> },
          { path: 'net-worth', element: <NetWorthTrendPage /> },
          { path: 'fire-calculator', element: <FireCalculatorPage /> },
        ],
      },
    ],
  },
]);
```

### 6.2 单窗口策略

MVP 采用单窗口策略，不使用多窗口或多 BrowserWindow：

- **理由**：FIRE 计算APP 是单人财务管理工具，所有操作在一个窗口内完成即可。多窗口增加状态同步复杂度，与 MVP "快速交付"目标不符。
- **弹窗处理**：表单编辑（如添加交易、创建账户）使用模态对话框（Modal Dialog），而非新窗口。
- **未来扩展**：如需多窗口（如独立图表窗口），可在 `apps/desktop/src/main/index.ts` 中新增 BrowserWindow 创建逻辑，不影响现有架构。

### 6.3 路由守卫

**首次启动引导重定向**：

应用启动时检查数据库是否已初始化（即是否存在 User 记录）。未初始化时重定向到 `/onboarding`。

```typescript
// apps/desktop/src/renderer/App.tsx
// 应用根组件：启动时检查初始化状态 / Root component: check init state on startup

import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useAppStore } from './stores/app-store';
import { dataAccess } from './data/data-access';

export default function App() {
  const setInitialized = useAppStore((s) => s.setInitialized);
  const setCurrentUser = useAppStore((s) => s.setCurrentUser);

  useEffect(() => {
    // 应用启动时初始化数据库并检查用户状态
    // Initialize database and check user status on app launch
    async function bootstrap() {
      await dataAccess.initDatabase();
      // 尝试获取第一个用户（MVP 单用户模式）
      // Try to get the first user (MVP single-user mode)
      const user = await dataAccess.getFirstUser();
      if (user) {
        setCurrentUser(user);
        setInitialized(true);
      } else {
        setInitialized(false);
      }
    }
    bootstrap();
  }, [setInitialized, setCurrentUser]);

  return <Outlet />;
}
```

---

## 7. 现有代码复用方案

### 7.1 可直接复用的模块清单（零改动迁移）

以下模块不依赖 Node.js / Electron API，可直接迁移到 `packages/shared`：

| 文件 | 新位置 | 说明 |
|------|-------|------|
| `types/index.ts` | `packages/shared/src/types/index.ts` | 7 个实体接口 + 枚举 + 所有 Input 类型定义 |
| `utils/time.ts` | `packages/shared/src/utils/time.ts` | nowMs, toYearMonth, addMonths, monthsBetween — 纯时间计算 |
| `utils/money.ts` | `packages/shared/src/utils/money.ts` | yuanToCents, centsToYuan, basisPointsToDecimal — 纯金额转换 |
| `utils/sync.ts` | `packages/shared/src/utils/sync.ts` | createSyncMeta, bumpSyncVersion, shouldRemoteWin — LWW 同步工具（MVP 预留） |
| `db/schema.ts` | `packages/shared/src/db/schema.ts` | DDL 语句 + TABLE_NAMES + initSchema 函数 — DDL 跨平台共享 |
| `services/fire-calc.ts`（纯函数部分） | `packages/shared/src/services/fire-calc.ts` | calculateFireNumber, calculateAdjustedFireNumber, calculateAccumulation, calculateProgress — 4 个纯计算函数 |

### 7.2 需要调整的模块清单

| 文件 | 新位置 | 调整内容 |
|------|-------|---------|
| `db/connection.ts` | `apps/desktop/src/main/db/connection.ts` | 添加 DB 单例管理器：`getDatabase()` 返回全局 DB 实例；`initDatabase()` 初始化并执行 schema；保留原有 createDatabase/closeDatabase 函数 |
| `services/fire-calc.ts`（runProjection 部分） | `apps/desktop/src/main/services/fire-calc-service.ts` | 拆分：纯函数移至 shared 包；runProjection 需访问 DB，留在主进程，import shared 包的纯函数 |
| `models/transaction.ts` | `apps/desktop/src/main/models/transaction.ts` | 需新增 `getTransactionsByUser(db, userId, options?)` 方法，现有只有按 ID 查询，缺少列表查询（UI 需要） |
| `models/user.ts` | `apps/desktop/src/main/models/user.ts` | 需新增 `getFirstUser(db)` 方法，用于应用启动时检查是否已有用户（MVP 单用户模式） |

### 7.3 需要新增的模块清单

| 模块 | 位置 | 说明 |
|------|------|------|
| IPC handler 注册器 | `apps/desktop/src/main/ipc/register-handlers.ts` | 统一 IPC handler 注册和错误处理包装 |
| User IPC handlers | `apps/desktop/src/main/ipc/user-handlers.ts` | User CRUD 的 IPC handler |
| Account IPC handlers | `apps/desktop/src/main/ipc/account-handlers.ts` | Account CRUD 的 IPC handler |
| Category IPC handlers | `apps/desktop/src/main/ipc/category-handlers.ts` | Category CRUD 的 IPC handler |
| Transaction IPC handlers | `apps/desktop/src/main/ipc/transaction-handlers.ts` | Transaction CRUD 的 IPC handler |
| Recurring IPC handlers | `apps/desktop/src/main/ipc/recurring-handlers.ts` | Recurring CRUD 的 IPC handler |
| Scenario IPC handlers | `apps/desktop/src/main/ipc/scenario-handlers.ts` | Scenario CRUD 的 IPC handler |
| Snapshot IPC handlers | `apps/desktop/src/main/ipc/snapshot-handlers.ts` | Snapshot 操作的 IPC handler |
| Preload 脚本 | `apps/desktop/src/preload/index.ts` | contextBridge 暴露 window.dataAccess |
| IpcApi 类型声明 | `apps/desktop/src/renderer/types/ipc-api.ts` | window.dataAccess 的 TypeScript 类型声明 |
| DataAccessPort 接口 | `apps/desktop/src/renderer/data/data-access-port.ts` | 数据访问抽象接口定义 |
| IpcDataAccess 实现 | `apps/desktop/src/renderer/data/ipc-data-access.ts` | DataAccessPort 的 IPC 实现 |
| data-access 导出 | `apps/desktop/src/renderer/data/data-access.ts` | 导出当前使用的 DataAccessPort 实例 |
| Zustand Stores (5个) | `apps/desktop/src/renderer/stores/*.ts` | app, account, transaction, snapshot, scenario |
| React 页面组件 (6个) | `apps/desktop/src/renderer/pages/*.tsx` | Dashboard, Accounts, Transactions, NetWorth, FireCalc, Onboarding |
| 布局组件 | `apps/desktop/src/renderer/components/layout/` | Sidebar, Header, Layout |
| 表单组件 | `apps/desktop/src/renderer/components/forms/` | AccountForm, TransactionForm, ScenarioForm |
| 图表组件 | `apps/desktop/src/renderer/components/charts/` | NetWorthChart, FireProjectionChart |
| 通用组件 | `apps/desktop/src/renderer/components/common/` | AmountInput, CategorySelect, ConfirmDialog, Toast |
| 路由配置 | `apps/desktop/src/renderer/router/index.tsx` | React Router v7 路由定义 |
| Vite 配置 | `apps/desktop/electron.vite.config.ts` | electron-vite 构建配置 |
| pnpm workspace 配置 | 根目录 `pnpm-workspace.yaml` | Monorepo workspace 配置 |
| Tailwind 配置 | `apps/desktop/tailwind.config.js` | Tailwind CSS 配置 |

---

## 8. 预留扩展点

### 8.1 DataAccessPort 抽象层

`DataAccessPort` 接口（见第 4.2 节）是核心扩展点。渲染进程的所有数据操作都通过此接口，不直接依赖 IPC：

```typescript
// apps/desktop/src/renderer/data/data-access.ts
// 导出当前使用的 DataAccessPort 实例
// Export the currently used DataAccessPort instance

import { IpcDataAccess } from './ipc-data-access';

// 桌面端：使用 IPC 实现
// Desktop: use IPC implementation
export const dataAccess: DataAccessPort = new IpcDataAccess();
```

**移动端扩展时**，只需新增一个 `QuickSqliteDataAccess` 实现：

```typescript
// 未来：apps/mobile/src/data/quick-sqlite-data-access.ts
// Future: mobile implementation using react-native-quick-sqlite

import type { DataAccessPort } from '@fire-app/shared';
import { openDatabase } from 'react-native-quick-sqlite';

// 移动端实现：直接操作本地 SQLite，无需 IPC
// Mobile implementation: direct local SQLite access, no IPC needed
export class QuickSqliteDataAccess implements DataAccessPort {
  private db = openDatabase({ name: 'fire-app.db' });

  async createUser(input: CreateUserInput): Promise<User> {
    // 直接调用 models 层（共享包中的代码）
    // Direct call to models layer (shared package code)
    return createUser(this.db, input);
  }
  // ... 其他方法实现
}
```

### 8.2 移动端适配预留

| 预留点 | 当前状态 | 移动端适配方式 |
|--------|---------|--------------|
| `packages/shared` 共享包 | 已抽取 types/utils/fire-calc 纯函数 | React Native 直接 import，零改动 |
| `DataAccessPort` 接口 | 已定义完整接口 | 新增 QuickSqliteDataAccess 实现 |
| `db/schema.ts` DDL | 已在 shared 包中 | react-native-quick-sqlite 执行相同 DDL |
| 同步层 (`sync.ts`) | MVP 不使用，但 sync_version/deleted_flag 字段已预留 | 移动端上线时实现同步逻辑 |
| UI 组件 | 桌面端使用 React + Tailwind | 移动端使用 React Native + NativeWind（Tailwind for RN） |
| 路由 | React Router v7 (hash router) | React Navigation v7（移动端导航方案） |

### 8.3 同步层预留接口

现有数据模型已为同步预留了以下字段：

| 字段 | 类型 | 用途 |
|------|------|------|
| `sync_version` | `number` | 记录版本号，每次更新递增，用于冲突检测 |
| `updated_at` | `number` | 最后更新时间戳（毫秒），用于 LWW（Last-Write-Wins）冲突解决 |
| `deleted_flag` | `number` | 软删除标记，同步时传播删除操作 |
| `last_sync_at` (User) | `number \| null` | 最后同步时间，记录同步游标 |

**`utils/sync.ts` 已实现的同步工具**：

- `createSyncMeta()` — 新记录的初始同步元数据
- `bumpSyncVersion(current)` — 更新时递增版本号
- `shouldRemoteWin(local, remote)` — LWW 冲突解决：`remote.updated_at >= local.updated_at` 时远程胜

**未来同步实现路径**：

1. 选择同步后端（自建服务端 / Supabase / Cloudflare D1）
2. 实现 `SyncPort` 接口（push/pull/resolve-conflict）
3. 在 DataAccessPort 中增加 `sync()` 方法
4. 主进程定时或手动触发同步

---

## 附录：决策记录表

| 编号 | 决策项 | 选型 | 理由 | 日期 |
|------|--------|------|------|------|
| ADR-001 | 桌面框架 | Electron ^31.x | 跨平台标准方案，Chromium 渲染一致性，npm 生态最丰富 | 2026-07-15 |
| ADR-002 | 构建工具 | electron-vite ^2.x | 深度整合 Vite + Electron，三进程统一构建，HMR 开箱即用 | 2026-07-15 |
| ADR-003 | 前端框架 | React ^19.x | 2026年稳定版，use() hook + 改进 Suspense，生态最成熟 | 2026-07-15 |
| ADR-004 | CSS 方案 | Tailwind CSS ^4.x | 原子化零冲突，Vite 插件零配置，构建时 Tree-shaking | 2026-07-15 |
| ADR-005 | 状态管理 | Zustand ^5.x | 极简 API，无 Provider，TypeScript 友好，代码量比 RTK 少 60% | 2026-07-15 |
| ADR-006 | 路由方案 | React Router ^7.x | React 生态标准路由，v7 支持数据加载和嵌套路由 | 2026-07-15 |
| ADR-007 | 包管理 | pnpm ^9.x | workspace 原生支持 monorepo，硬链接节省磁盘 | 2026-07-15 |
| ADR-008 | Monorepo 结构 | packages/shared + apps/desktop | 纯逻辑抽取到 shared，Electron 专属代码在 apps/desktop | 2026-07-15 |
| ADR-009 | 进程隔离策略 | contextIsolation + sandbox: false + preload contextBridge | preload 使用 externalizeDepsPlugin 需关闭沙箱，contextIsolation 仍保证隔离 | 2026-07-15 |
| ADR-010 | 数据访问抽象 | DataAccessPort 接口 | 渲染进程面向接口编程，桌面走 IPC，移动端走 quick-sqlite | 2026-07-15 |
| ADR-011 | 现有代码迁移 | models/services 零改动迁移到主进程 | 保持函数签名 `fn(db, ...args)` 不变，仅加 IPC 包装层 | 2026-07-15 |
| ADR-012 | fire-calc 拆分 | 纯函数→shared，runProjection→主进程 | 纯计算函数跨平台共享，DB 依赖函数留在主进程 | 2026-07-15 |
| ADR-013 | 窗口策略 | 单窗口 + 模态对话框 | MVP 快速交付，多窗口增加状态同步复杂度 | 2026-07-15 |
| ADR-014 | 同步层 | MVP 不做，预留 sync_version + LWW 工具 | 本地单设备优先，字段和工具已就位 | 2026-07-15 |
| ADR-015 | 图表库 | Recharts ^2.x | React 原生组件式，适合净资产趋势和 FIRE 投影可视化 | 2026-07-15 |
| ADR-016 | 表单方案 | React Hook Form ^7.x + Zod ^3.x | 轻量高性能，类型推断自动同步 | 2026-07-15 |
| ADR-017 | 数据序列化 | Electron 结构化克隆算法 | 现有数据模型均为 POJO，零序列化代码 | 2026-07-15 |
| ADR-018 | 交易联动刷新 | Store 间联动调用 | 交易写入后自动刷新账户余额和净资产快照 | 2026-07-15 |
