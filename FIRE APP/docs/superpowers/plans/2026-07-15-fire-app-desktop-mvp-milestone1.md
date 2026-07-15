# FIRE 计算APP 桌面 MVP — 里程碑 1：架构验证切片

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭建 Electron 桌面应用骨架，验证主进程持有 better-sqlite3 + IPC 桥 + React 渲染进程的完整数据通路，用一个可运行的 APP 完成"启动→初始化 DB→读取用户→显示用户名"的端到端验证。

**Architecture:** pnpm workspace monorepo，`packages/shared` 放现有 TypeScript 数据层代码（零改动迁移），`apps/desktop` 放 Electron 应用。主进程通过 `createDatabase()` + `initSchema()` 管理数据库，通过 `ipcMain.handle()` 暴露 IPC 通道。preload 脚本通过 `contextBridge` 将 IPC 调用封装为 `window.dataAccess` API。渲染进程用 React 19 + Zustand v5 管理状态，通过 `window.dataAccess` 调用数据层。

**Tech Stack:** pnpm 9 workspace, Electron 31, electron-vite 2, React 19, Tailwind CSS 4, Zustand 5, better-sqlite3 11, TypeScript 5.5

**Specs:**
- `docs/superpowers/specs/2026-07-15-fire-app-frontend-architecture-design.md` — 前端架构设计
- `docs/superpowers/specs/2026-07-15-fire-app-initialization-design.md` — 应用初始化设计

---

## 文件结构

本里程碑创建/修改的文件：

```
FIRE APP/
├── pnpm-workspace.yaml                    # Task 1: workspace 配置
├── package.json                            # Task 1: 根 package.json
├── tsconfig.base.json                      # Task 1: 共享 TS 配置
├── packages/
│   └── shared/
│       ├── package.json                    # Task 2: shared 包配置
│       ├── tsconfig.json                   # Task 2: shared TS 配置
│       └── src/                            # Task 2: 现有代码迁移（零改动）
│           ├── types/index.ts              #   从 fire-app/src/types/ 迁移
│           ├── db/connection.ts            #   从 fire-app/src/db/ 迁移
│           ├── db/schema.ts               #   从 fire-app/src/db/ 迁移
│           ├── models/account.ts          #   从 fire-app/src/models/ 迁移
│           ├── models/category.ts         #   从 fire-app/src/models/ 迁移
│           ├── models/recurring.ts        #   从 fire-app/src/models/ 迁移
│           ├── models/scenario.ts         #   从 fire-app/src/models/ 迁移
│           ├── models/snapshot.ts         #   从 fire-app/src/models/ 迁移
│           ├── models/transaction.ts      #   从 fire-app/src/models/ 迁移
│           ├── models/user.ts             #   从 fire-app/src/models/ 迁移
│           ├── services/fire-calc.ts      #   从 fire-app/src/services/ 迁移
│           ├── services/recurring-service.ts  # 从 fire-app/src/services/ 迁移
│           ├── services/snapshot-service.ts   # 从 fire-app/src/services/ 迁移
│           ├── services/transaction-service.ts # 从 fire-app/src/services/ 迁移
│           ├── utils/money.ts             #   从 fire-app/src/utils/ 迁移
│           ├── utils/sync.ts              #   从 fire-app/src/utils/ 迁移
│           └── utils/time.ts              #   从 fire-app/src/utils/ 迁移
├── apps/
│   └── desktop/
│       ├── package.json                    # Task 3: desktop 包配置
│       ├── tsconfig.json                   # Task 3: desktop TS 配置
│       ├── electron.vite.config.ts         # Task 3: electron-vite 配置
│       ├── src/
│       │   ├── main/
│       │   │   ├── index.ts                # Task 4: Electron 主进程入口
│       │   │   ├── db-manager.ts           # Task 4: DB 单例管理
│       │   │   └── ipc-handlers.ts         # Task 5: IPC handler 注册
│       │   ├── preload/
│       │   │   └── index.ts                # Task 6: preload 脚本 + contextBridge
│       │   └── renderer/
│       │       ├── index.html              # Task 3: HTML 入口
│       │       ├── src/
│       │       │   ├── main.tsx            # Task 7: React 入口
│       │       │   ├── App.tsx             # Task 7: 根组件
│       │       │   ├── stores/
│       │       │   │   └── user-store.ts   # Task 7: Zustand user store
│       │       │   ├── types/
│       │       │   │   └── ipc.d.ts        # Task 6: window.dataAccess 类型声明
│       │       │   └── pages/
│       │       │       └── TestPage.tsx    # Task 7: 验证页面
│       │       └── styles/
│       │           └── globals.css         # Task 7: Tailwind 入口
│       └── tailwind.config.ts              # Task 7: Tailwind 配置
└── fire-app/                               # 保留原有目录（测试不破坏）
```

---

## Task 1: 创建 pnpm workspace 根配置

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `package.json` (根)
- Create: `tsconfig.base.json`

- [ ] **Step 1: 创建 workspace 配置文件**

创建 `pnpm-workspace.yaml`：

```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

- [ ] **Step 2: 创建根 package.json**

创建 `package.json`：

```json
{
  "name": "fire-app-monorepo",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "pnpm --filter @fire-app/desktop dev",
    "build": "pnpm --filter @fire-app/desktop build",
    "test:shared": "pnpm --filter @fire-app/shared test"
  },
  "devDependencies": {
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Step 3: 创建共享 tsconfig.base.json**

创建 `tsconfig.base.json`：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 4: 验证 workspace 初始化**

Run: `cd "d:\Admin\OneDrive\Apps\FIRE APP" && pnpm install`
Expected: 输出无报错（此时 workspace 内还没有子包，pnpm 会输出空 workspace 提示，属正常）

- [ ] **Step 5: Commit**

```bash
cd "d:\Admin\OneDrive\Apps\FIRE APP"
git add pnpm-workspace.yaml package.json tsconfig.base.json
git commit -m "chore: 初始化 pnpm workspace 根配置"
```

---

## Task 2: 迁移现有代码到 packages/shared

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Move: `fire-app/src/**/*` → `packages/shared/src/**/*` (16 个文件)

- [ ] **Step 1: 创建 shared 包目录结构和 package.json**

创建 `packages/shared/package.json`：

```json
{
  "name": "@fire-app/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "better-sqlite3": "^11.0.0",
    "uuid": "^10.0.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.10",
    "@types/node": "^20.14.0",
    "@types/uuid": "^10.0.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: 创建 shared tsconfig.json**

创建 `packages/shared/tsconfig.json`：

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: 复制现有代码到 packages/shared/src/**

将 `fire-app/src/` 下的所有文件复制到 `packages/shared/src/`，保持目录结构不变：

```powershell
cd "d:\Admin\OneDrive\Apps\FIRE APP"
Copy-Item -Path "fire-app\src\*" -Destination "packages\shared\src\" -Recurse -Force
```

- [ ] **Step 4: 创建 shared 桶导出 index.ts**

创建 `packages/shared/src/index.ts`：

```typescript
// 桶导出 / Barrel export
// 类型 / Types
export * from './types/index.js';
// 数据库 / Database
export { createDatabase, closeDatabase } from './db/connection.js';
export { initSchema, TABLE_NAMES } from './db/schema.js';
// 模型 / Models
export * from './models/account.js';
export * from './models/category.js';
export * from './models/recurring.js';
export * from './models/scenario.js';
export * from './models/snapshot.js';
export * from './models/transaction.js';
export * from './models/user.js';
// 服务 / Services
export * from './services/fire-calc.js';
export * from './services/recurring-service.js';
export * from './services/snapshot-service.js';
export * from './services/transaction-service.js';
// 工具 / Utils
export * from './utils/money.js';
export * from './utils/sync.js';
export * from './utils/time.js';
```

- [ ] **Step 5: 运行 shared 包测试验证迁移正确**

Run: `cd "d:\Admin\OneDrive\Apps\FIRE APP" && pnpm install && pnpm --filter @fire-app/shared test`
Expected: 所有现有测试通过（与迁移前一致）

- [ ] **Step 6: Commit**

```bash
cd "d:\Admin\OneDrive\Apps\FIRE APP"
git add packages/shared/
git commit -m "refactor: 迁移数据层代码到 packages/shared"
```

---

## Task 3: 创建 apps/desktop Electron 应用骨架

**Files:**
- Create: `apps/desktop/package.json`
- Create: `apps/desktop/tsconfig.json`
- Create: `apps/desktop/tsconfig.node.json`
- Create: `apps/desktop/electron.vite.config.ts`
- Create: `apps/desktop/src/renderer/index.html`

- [ ] **Step 1: 创建 desktop package.json**

创建 `apps/desktop/package.json`：

```json
{
  "name": "@fire-app/desktop",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview"
  },
  "dependencies": {
    "@fire-app/shared": "workspace:*",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.0.0",
    "zustand": "^5.0.0",
    "better-sqlite3": "^11.0.0",
    "uuid": "^10.0.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.10",
    "@types/node": "^20.14.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/uuid": "^10.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "electron": "^31.0.0",
    "electron-vite": "^2.0.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0"
  }
}
```

- [ ] **Step 2: 创建 desktop tsconfig.json（渲染进程）**

创建 `apps/desktop/tsconfig.json`：

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["electron-vite/node"],
    "paths": {
      "@shared/*": ["../../packages/shared/src/*"],
      "@renderer/*": ["./src/renderer/src/*"]
    }
  },
  "include": ["src/renderer/src/**/*", "src/preload/**/*"]
}
```

- [ ] **Step 3: 创建 desktop tsconfig.node.json（主进程）**

创建 `apps/desktop/tsconfig.node.json`：

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022"],
    "types": ["node"],
    "paths": {
      "@shared/*": ["../../packages/shared/src/*"]
    }
  },
  "include": ["src/main/**/*"]
}
```

- [ ] **Step 4: 创建 electron.vite.config.ts**

创建 `apps/desktop/electron.vite.config.ts`：

```typescript
import { resolve } from 'path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve(__dirname, '../../packages/shared/src'),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve(__dirname, '../../packages/shared/src'),
      },
    },
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer/src'),
        '@shared': resolve(__dirname, '../../packages/shared/src'),
      },
    },
    plugins: [react()],
  },
});
```

- [ ] **Step 5: 创建 index.html**

创建 `apps/desktop/src/renderer/index.html`：

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>FIRE 计算APP</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: 安装依赖并验证**

Run: `cd "d:\Admin\OneDrive\Apps\FIRE APP" && pnpm install`
Expected: 依赖安装成功，无报错

- [ ] **Step 7: Commit**

```bash
cd "d:\Admin\OneDrive\Apps\FIRE APP"
git add apps/desktop/
git commit -m "chore: 创建 Electron 桌面应用骨架配置"
```

---

## Task 4: 实现 Electron 主进程（DB 管理 + 窗口创建）

**Files:**
- Create: `apps/desktop/src/main/db-manager.ts`
- Create: `apps/desktop/src/main/index.ts`
- Read: `packages/shared/src/db/connection.ts`, `packages/shared/src/db/schema.ts`

- [ ] **Step 1: 创建 DB 单例管理器**

创建 `apps/desktop/src/main/db-manager.ts`：

```typescript
// 主进程数据库单例管理器 / Main process database singleton manager
// 持有 better-sqlite3 连接，供 IPC handler 使用

import { app } from 'electron';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';
import { createDatabase, initSchema, closeDatabase } from '@shared/db/connection.js';
import type { Database as DatabaseType } from 'better-sqlite3';

let dbInstance: DatabaseType | null = null;

/**
 * 获取数据目录路径 / Get data directory path
 * 返回 {userData}/fire-app/data/ 目录
 */
function getDataDir(): string {
  const baseDir = join(app.getPath('userData'), 'fire-app', 'data');
  if (!existsSync(baseDir)) {
    mkdirSync(baseDir, { recursive: true });
  }
  return baseDir;
}

/**
 * 获取数据库文件路径 / Get database file path
 */
function getDbPath(): string {
  return join(getDataDir(), 'fire.db');
}

/**
 * 初始化数据库 / Initialize database
 * 创建连接、初始化 schema，返回 DB 实例
 */
export function initDatabase(): DatabaseType {
  if (dbInstance && dbInstance.open) {
    return dbInstance;
  }

  const dbPath = getDbPath();
  dbInstance = createDatabase(dbPath);
  initSchema(dbInstance);

  console.log(`[DB] 数据库已初始化: ${dbPath}`);
  return dbInstance;
}

/**
 * 获取数据库实例 / Get database instance
 * 必须在 initDatabase() 之后调用
 */
export function getDatabase(): DatabaseType {
  if (!dbInstance || !dbInstance.open) {
    throw new Error('数据库未初始化，请先调用 initDatabase()');
  }
  return dbInstance;
}

/**
 * 关闭数据库 / Close database
 */
export function closeAppDatabase(): void {
  if (dbInstance) {
    closeDatabase(dbInstance);
    dbInstance = null;
    console.log('[DB] 数据库已关闭');
  }
}
```

- [ ] **Step 2: 新增 getFirstUser 函数到 shared/models/user.ts**

在 `packages/shared/src/models/user.ts` 文件末尾追加：

```typescript
/**
 * 获取第一个用户（用于启动时判断是否首次启动）
 * Get first user (for first-launch detection on startup)
 * @param db 数据库实例 / Database instance
 * @returns 第一个用户或 null / First user or null
 */
export function getFirstUser(db: DatabaseType): User | null {
  const row = db.prepare(
    'SELECT * FROM users WHERE deleted_flag = 0 LIMIT 1'
  ).get() as User | undefined;
  return row ?? null;
}
```

- [ ] **Step 3: 创建 Electron 主进程入口**

创建 `apps/desktop/src/main/index.ts`：

```typescript
// Electron 主进程入口 / Electron main process entry

import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { initDatabase, closeAppDatabase, getDatabase } from './db-manager.js';

let mainWindow: BrowserWindow | null = null;

/**
 * 创建主窗口 / Create main window
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });

  // 开发模式加载 dev server，生产模式加载打包文件
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  // 1. 初始化数据库
  initDatabase();

  // 2. 创建窗口
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  closeAppDatabase();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
```

- [ ] **Step 4: 验证主进程编译**

Run: `cd "d:\Admin\OneDrive\Apps\FIRE APP" && pnpm --filter @fire-app/desktop build`
Expected: electron-vite 构建成功，`apps/desktop/dist/main/index.js` 生成

- [ ] **Step 5: Commit**

```bash
cd "d:\Admin\OneDrive\Apps\FIRE APP"
git add apps/desktop/src/main/ packages/shared/src/models/user.ts
git commit -m "feat: 实现 Electron 主进程（DB 管理 + 窗口创建）"
```

---

## Task 5: 实现 IPC handler 注册

**Files:**
- Create: `apps/desktop/src/main/ipc-handlers.ts`
- Modify: `apps/desktop/src/main/index.ts`（添加 IPC 注册调用）

- [ ] **Step 1: 创建 IPC handler 注册模块**

创建 `apps/desktop/src/main/ipc-handlers.ts`：

```typescript
// IPC handler 注册 / IPC handler registration
// 主进程注册 ipcMain.handle 通道，供渲染进程通过 IPC 调用数据层

import { ipcMain } from 'electron';
import { getDatabase } from './db-manager.js';
import { getFirstUser, createUser } from '@shared/models/user.js';
import { seedCategories } from '@shared/models/category.js';
import { getAccounts } from '@shared/models/account.js';
import type { CreateUserInput } from '@shared/models/user.js';

/**
 * 注册所有 IPC handler / Register all IPC handlers
 */
export function registerIpcHandlers(): void {
  const db = getDatabase();

  // --- 用户相关 / User ---

  // 获取第一个用户（启动检查）
  ipcMain.handle('db:user:getFirst', () => {
    return getFirstUser(db);
  });

  // 创建用户
  ipcMain.handle('db:user:create', (_event, input: CreateUserInput) => {
    return createUser(db, input);
  });

  // --- 分类相关 / Category ---

  // 创建种子分类
  ipcMain.handle('db:category:seed', (_event, userId: string) => {
    seedCategories(db, userId);
  });

  // --- 账户相关 / Account ---

  // 获取用户所有账户
  ipcMain.handle('db:account:list', (_event, userId: string) => {
    return getAccounts(db, userId);
  });

  // --- 初始化 / Init ---

  // 数据库初始化确认（幂等，主进程已初始化，此处仅返回确认）
  ipcMain.handle('db:init', () => {
    return;
  });
}
```

- [ ] **Step 2: 在主进程入口中调用 IPC 注册**

修改 `apps/desktop/src/main/index.ts`，在 `createWindow()` 之前添加 IPC 注册：

```typescript
import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { initDatabase, closeAppDatabase, getDatabase } from './db-manager.js';
import { registerIpcHandlers } from './ipc-handlers.js';  // 新增

// ... createWindow 函数不变 ...

app.whenReady().then(() => {
  // 1. 初始化数据库
  initDatabase();

  // 2. 注册 IPC handlers（新增）
  registerIpcHandlers();

  // 3. 创建窗口
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// ... 其余不变 ...
```

- [ ] **Step 3: 验证编译**

Run: `cd "d:\Admin\OneDrive\Apps\FIRE APP" && pnpm --filter @fire-app/desktop build`
Expected: 构建成功

- [ ] **Step 4: Commit**

```bash
cd "d:\Admin\OneDrive\Apps\FIRE APP"
git add apps/desktop/src/main/
git commit -m "feat: 实现 IPC handler 注册（用户/分类/账户/初始化）"
```

---

## Task 6: 实现 preload 脚本和类型声明

**Files:**
- Create: `apps/desktop/src/preload/index.ts`
- Create: `apps/desktop/src/renderer/src/types/ipc.d.ts`

- [ ] **Step 1: 创建 preload 脚本**

创建 `apps/desktop/src/preload/index.ts`：

```typescript
// Preload 脚本 / Preload script
// 通过 contextBridge 将 IPC 调用安全地暴露给渲染进程

import { contextBridge, ipcRenderer } from 'electron';

// 暴露给渲染进程的数据访问 API
const dataAccess = {
  // 初始化 / Init
  initDatabase: () => ipcRenderer.invoke('db:init'),

  // 用户 / User
  user: {
    getFirst: () => ipcRenderer.invoke('db:user:getFirst'),
    create: (input: unknown) => ipcRenderer.invoke('db:user:create', input),
  },

  // 分类 / Category
  category: {
    seed: (userId: string) => ipcRenderer.invoke('db:category:seed', userId),
  },

  // 账户 / Account
  account: {
    list: (userId: string) => ipcRenderer.invoke('db:account:list', userId),
  },
};

// 将 dataAccess 挂载到 window 上
contextBridge.exposeInMainWorld('dataAccess', dataAccess);

// 类型声明：告诉 TypeScript window.dataAccess 存在
export type DataAccess = typeof dataAccess;
```

- [ ] **Step 2: 创建渲染进程类型声明**

创建 `apps/desktop/src/renderer/src/types/ipc.d.ts`：

```typescript
// 渲染进程 IPC 类型声明 / Renderer IPC type declarations
// 声明 window.dataAccess 的类型，供渲染进程使用

import type { User, Account } from '@shared/types/index.js';
import type { CreateUserInput } from '@shared/models/user.js';

export interface DataAccessAPI {
  initDatabase(): Promise<void>;

  user: {
    getFirst(): Promise<User | null>;
    create(input: CreateUserInput): Promise<User>;
  };

  category: {
    seed(userId: string): Promise<void>;
  };

  account: {
    list(userId: string): Promise<Account[]>;
  };
}

declare global {
  interface Window {
    dataAccess: DataAccessAPI;
  }
}
```

- [ ] **Step 3: 验证编译**

Run: `cd "d:\Admin\OneDrive\Apps\FIRE APP" && pnpm --filter @fire-app/desktop build`
Expected: 构建成功

- [ ] **Step 4: Commit**

```bash
cd "d:\Admin\OneDrive\Apps\FIRE APP"
git add apps/desktop/src/preload/ apps/desktop/src/renderer/src/types/
git commit -m "feat: 实现 preload 脚本和 contextBridge 类型声明"
```

---

## Task 7: 实现 React 渲染进程（验证页面 + Zustand store）

**Files:**
- Create: `apps/desktop/tailwind.config.ts`
- Create: `apps/desktop/src/renderer/src/styles/globals.css`
- Create: `apps/desktop/src/renderer/src/stores/user-store.ts`
- Create: `apps/desktop/src/renderer/src/pages/TestPage.tsx`
- Create: `apps/desktop/src/renderer/src/App.tsx`
- Create: `apps/desktop/src/renderer/src/main.tsx`

- [ ] **Step 1: 创建 Tailwind 配置**

创建 `apps/desktop/tailwind.config.ts`：

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#3B82F6',
          dark: '#2563EB',
          darker: '#1D4ED8',
          sidebar: '#1E3A8A',
        },
        secondary: {
          DEFAULT: '#10B981',
          dark: '#059669',
        },
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 2: 创建全局 CSS**

创建 `apps/desktop/src/renderer/src/styles/globals.css`：

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  font-family: 'PingFang SC', 'Microsoft YaHei', 'Inter', system-ui, sans-serif;
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 3: 创建 Zustand user store**

创建 `apps/desktop/src/renderer/src/stores/user-store.ts`：

```typescript
// 用户状态管理 / User state management
// 使用 Zustand 管理用户状态，通过 IPC 调用数据层

import { create } from 'zustand';
import type { User } from '@shared/types/index.js';

interface UserStore {
  // 状态 / State
  user: User | null;
  loading: boolean;
  error: string | null;

  // 操作 / Actions
  fetchUser: () => Promise<void>;
  createUser: (input: {
    display_name: string;
    is_china_market?: number;
    default_withdrawal_rate?: number;
    default_expected_return?: number;
    default_inflation_rate?: number;
  }) => Promise<void>;
  clear: () => void;
}

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  loading: false,
  error: null,

  fetchUser: async () => {
    set({ loading: true, error: null });
    try {
      const user = await window.dataAccess.user.getFirst();
      set({ user, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  createUser: async (input) => {
    set({ loading: true, error: null });
    try {
      const user = await window.dataAccess.user.create(input);
      // 创建用户后立即创建种子分类
      await window.dataAccess.category.seed(user.id);
      set({ user, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  clear: () => set({ user: null, error: null, loading: false }),
}));
```

- [ ] **Step 4: 创建验证页面**

创建 `apps/desktop/src/renderer/src/pages/TestPage.tsx`：

```typescript
// 架构验证页面 / Architecture validation page
// 验证 IPC 桥 + 数据层 + React 渲染的完整数据通路

import { useEffect } from 'react';
import { useUserStore } from '../stores/user-store';

export function TestPage() {
  const { user, loading, error, fetchUser, createUser } = useUserStore();

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const handleCreateUser = () => {
    createUser({
      display_name: '测试用户',
      is_china_market: 1,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          FIRE 计算APP — 架构验证
        </h1>

        {/* 状态指示器 / Status indicator */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">数据通路验证</h2>

          {loading && (
            <p className="text-blue-600">加载中...</p>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-4">
              <p className="text-red-600 font-medium">错误: {error}</p>
            </div>
          )}

          {!loading && !error && user && (
            <div className="bg-green-50 border border-green-200 rounded p-4">
              <p className="text-green-700 font-medium">✓ IPC 桥验证通过</p>
              <p className="text-gray-600 mt-2">用户名: {user.display_name}</p>
              <p className="text-gray-600">货币: {user.base_currency}</p>
              <p className="text-gray-600">中国市场: {user.is_china_market ? '是' : '否'}</p>
              <p className="text-gray-600">用户 ID: {user.id}</p>
            </div>
          )}

          {!loading && !error && !user && (
            <div className="bg-amber-50 border border-amber-200 rounded p-4">
              <p className="text-amber-700 font-medium">无用户记录（首次启动）</p>
              <button
                onClick={handleCreateUser}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
              >
                创建测试用户 + 种子分类
              </button>
            </div>
          )}
        </div>

        {/* 技术栈验证清单 / Tech stack checklist */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">技术栈验证</h2>
          <ul className="space-y-2 text-gray-600">
            <li>✓ Electron 主进程启动</li>
            <li>✓ better-sqlite3 数据库连接</li>
            <li>✓ IPC 桥（ipcMain.handle → contextBridge）</li>
            <li>✓ React 19 渲染进程</li>
            <li>✓ Zustand 状态管理</li>
            <li>✓ Tailwind CSS 样式</li>
            {user && <li>✓ 数据层 CRUD（用户创建 + 种子分类）</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: 创建 App 根组件**

创建 `apps/desktop/src/renderer/src/App.tsx`：

```typescript
// 应用根组件 / App root component

import { TestPage } from './pages/TestPage';

export default function App() {
  return <TestPage />;
}
```

- [ ] **Step 6: 创建 React 入口文件**

创建 `apps/desktop/src/renderer/src/main.tsx`：

```typescript
// React 渲染进程入口 / React renderer entry

import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/globals.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root container not found');

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 7: 验证完整构建**

Run: `cd "d:\Admin\OneDrive\Apps\FIRE APP" && pnpm --filter @fire-app/desktop build`
Expected: electron-vite 构建成功，`dist/main/`、`dist/preload/`、`dist/renderer/` 均有输出

- [ ] **Step 8: Commit**

```bash
cd "d:\Admin\OneDrive\Apps\FIRE APP"
git add apps/desktop/
git commit -m "feat: 实现 React 渲染进程（验证页面 + Zustand store + Tailwind）"
```

---

## Task 8: 端到端验证

**Files:**
- 无新文件，运行和验证

- [ ] **Step 1: 启动开发模式**

Run: `cd "d:\Admin\OneDrive\Apps\FIRE APP" && pnpm dev`
Expected: Electron 窗口打开，显示"FIRE 计算APP — 架构验证"页面

- [ ] **Step 2: 验证首次启动（无用户场景）**

观察窗口内容：
- 页面显示"无用户记录（首次启动）"的黄色提示
- 点击"创建测试用户 + 种子分类"按钮
- 页面刷新为绿色框，显示用户名"测试用户"、货币"CNY"、中国市场"是"
- 技术栈验证清单出现"✓ 数据层 CRUD"项

- [ ] **Step 3: 验证后续启动（有用户场景）**

关闭 APP 窗口，重新运行 `pnpm dev`：
- 页面直接显示绿色框，包含已创建的用户信息
- 无需再次点击创建按钮

- [ ] **Step 4: 验证数据库文件创建**

检查数据库文件是否在正确位置创建：
Run: `Get-ChildItem -Path "$env:APPDATA\fire-app-desktop\fire-app\data\fire.db"`
Expected: 文件存在

- [ ] **Step 5: 验证种子分类创建**

在开发者工具 Console 中执行（确认 18 个分类已创建）：
打开 DevTools (Ctrl+Shift+I)，在 Console 中无报错，页面正常显示用户数据。

- [ ] **Step 6: 关闭 APP 并验证日志**

关闭 APP 窗口，检查终端输出是否包含：
- `[DB] 数据库已初始化: ...fire.db`
- `[DB] 数据库已关闭`

- [ ] **Step 7: Commit 最终状态**

```bash
cd "d:\Admin\OneDrive\Apps\FIRE APP"
git add -A
git commit -m "feat: 里程碑1完成 — 架构验证切片端到端验证通过"
```

---

## 完成标准

| 检查项 | 标准 |
|--------|------|
| Monorepo 结构 | `packages/shared` + `apps/desktop` 正确创建 |
| 现有代码迁移 | shared 包测试全部通过 |
| Electron 启动 | `pnpm dev` 能打开窗口 |
| DB 初始化 | `fire.db` 文件在 `userData` 目录创建 |
| IPC 通路 | 渲染进程能通过 `window.dataAccess` 读取用户数据 |
| 首次启动 | 无用户时显示引导，点击创建后用户+种子分类创建成功 |
| 后续启动 | 有用户时直接显示用户信息 |
| Tailwind CSS | 页面样式正确渲染（蓝色按钮、灰色背景等） |
| Zustand | 状态正确管理（loading/error/user） |

---

## 后续里程碑（架构验证通过后）

| 里程碑 | 范围 | 独立计划 |
|--------|------|---------|
| 里程碑 2 | 核心基础设施：完整 IPC 通道、5 个 Zustand Store、React Router 路由、9 个基础组件、Onboarding 向导 | 待编写 |
| 里程碑 3 | 账户管理页：账户列表 + 资产概览卡片 + 新增/编辑/删除 | 待编写 |
| 里程碑 4 | 交易记录页：交易列表 + 筛选 + 新增/编辑/删除弹窗 | 待编写 |
| 里程碑 5 | 净资产趋势页：折线图 + 环形图 + 时间范围切换 | 待编写 |
| 里程碑 6 | FIRE 计算器页：场景列表 + 参数表单 + 投影图 + 仪表盘 | 待编写 |
| 里程碑 7 | 设置页：用户偏好编辑 + 数据管理 | 待编写 |
