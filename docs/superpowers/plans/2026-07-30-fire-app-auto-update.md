# FIRE-APP 自动更新 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 FIRE App 添加基于 electron-updater + GitHub Releases 的自动更新能力，覆盖启动检查 + 手动检查 + 24h 定时轮询，模态对话框呈现下载进度并支持安装重启。

**Architecture:** 三层架构——Main 层封装 `electron-updater` 的 `autoUpdater` 为 `UpdateManager`（启动延迟 10s 检查 + 24h 轮询 + 跳过版本持久化），通过 `update:*` IPC 通道同步状态给 Renderer 层的 `useUpdateStore`（Zustand），后者驱动 `UpdateDialog`（模态对话框）+ `UpdateSection`（设置页更新区）。CI 层每次 push 到 main 自动生成 `0.0.0-dev.yyyyMMdd.run_number` 预发布版本号，electron-builder `--publish always` 上传到 GitHub Releases。

**Tech Stack:** electron-updater 6.x / electron 36 / electron-builder 26 / Zustand 5 / React 19 / Tailwind 4 / vitest 3

**Spec 输入**: [docs/superpowers/specs/2026-07-30-fire-app-auto-update-design.md](file:///workspace/docs/superpowers/specs/2026-07-30-fire-app-auto-update-design.md)

**关键约束**:
- 不签名（dev 阶段）
- 单渠道 latest
- 仅 Windows
- release notes 用 `<pre>` 显示，不引入 markdown 库
- 不支持取消下载（electron-updater API 限制）

---

## 文件结构

### 将要创建的文件

| 文件 | 责任 |
|---|---|
| `apps/desktop/src/main/update-manager.ts` | 封装 electron-updater 的 autoUpdater，提供 check/download/install/skipVersion |
| `apps/desktop/src/main/ipc/update-handlers.ts` | 注册 update:* IPC handlers |
| `apps/desktop/src/renderer/src/stores/update-store.ts` | Zustand store，订阅 main 进程更新状态 |
| `apps/desktop/src/renderer/src/components/auxiliary/UpdateDialog.tsx` | 模态对话框，显示新版本 + 下载进度 + 操作按钮 |
| `apps/desktop/src/renderer/src/components/auxiliary/UpdateSection.tsx` | 设置页更新区，当前版本 + 手动检查按钮 |
| `apps/desktop/tests/update-store.test.ts` | useUpdateStore 单测 |
| `apps/desktop/tests/update-dialog.test.tsx` | UpdateDialog 组件测试 |
| `apps/desktop/tests/update-section.test.tsx` | UpdateSection 组件测试 |

### 将要修改的文件

| 文件 | 改动 |
|---|---|
| `apps/desktop/package.json` | 加 `electron-updater` dependency |
| `apps/desktop/electron-builder.yml` | `publish: null` → GitHub Releases 配置 |
| `apps/desktop/src/main/index.ts` | 初始化 UpdateManager + 注册 handlers |
| `apps/desktop/src/main/ipc-handlers.ts` | 调用 registerUpdateHandlers |
| `apps/desktop/src/preload/index.ts` | 暴露 `update` API |
| `apps/desktop/src/renderer/src/App.tsx` | 全局挂载 `<UpdateDialog />` |
| `apps/desktop/src/renderer/src/pages/SettingsPage.tsx` | 加 UpdateSection |
| `apps/desktop/vitest.setup.ts` | 加 `window.update` mock |
| `.github/workflows/build-release.yml` | 自动生成预发布版本号 + --publish always |

---

## Task 1: 安装 electron-updater + electron-builder publish 配置

**Files:**
- Modify: `apps/desktop/package.json`
- Modify: `apps/desktop/electron-builder.yml`

- [ ] **Step 1: 查询 electron-updater 最新版**

Run:
```bash
npm view electron-updater@^6 version | tail -3
```
Expected: 列出 6.x 最新版（如 `6.3.9`）

- [ ] **Step 2: 修改 apps/desktop/package.json 加 electron-updater dependency**

在 `dependencies` 块中加一行（位置在 `better-sqlite3` 之后）：

```json
"better-sqlite3": "^11.0.0",
"electron-updater": "^6.3.9",
"iconv-lite": "^0.7.3",
```

实际版本号以 Step 1 查询为准。

- [ ] **Step 3: 修改 electron-builder.yml 的 publish 配置**

Edit `apps/desktop/electron-builder.yml`，将：

```yaml
# 关闭自动发布：CI 检测到 GH_TOKEN 会尝试发布到 Releases，但当前只需构建 .exe 下载验证
# 打 tag 时再通过 workflow 的 softprops/action-gh-release 单独发布
publish: null
```

改为：

```yaml
# 发布到 GitHub Releases（electron-updater 自动更新源）
# CI 每次 push 到 main 会自动生成预发布版本号并上传
publish:
  provider: github
  owner: Psychorayda
  repo: FIRE-APP
  releaseType: prerelease
```

- [ ] **Step 4: 安装依赖**

Run:
```bash
pnpm install
```
Expected: electron-updater 安装成功，无 peer dep 冲突。

注意：沙箱环境可能无法 pnpm install，可跳过此步由 CI 验证。

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/package.json apps/desktop/electron-builder.yml pnpm-lock.yaml
git commit -m "feat(update): add electron-updater dep + GitHub Releases publish config

- electron-updater ^6.3.9: 自动更新客户端库
- electron-builder publish: github provider + prerelease releaseType"
```

---

## Task 2: UpdateManager（主进程封装）

**Files:**
- Create: `apps/desktop/src/main/update-manager.ts`

**Why:** 封装 electron-updater 的 autoUpdater，提供统一的 check/download/install/skipVersion API，屏蔽底层事件细节，处理跳过版本持久化和 24h 定时轮询。

- [ ] **Step 1: 创建 update-manager.ts**

Create file `apps/desktop/src/main/update-manager.ts`:

```typescript
// 自动更新管理器 / Auto-update manager
// 封装 electron-updater 的 autoUpdater，提供统一的 check/download/install/skipVersion API

import { app, BrowserWindow } from 'electron';
import { autoUpdater, UpdateInfo } from 'electron-updater';
import { join } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';

// 更新状态阶段 / Update status phase
export type UpdatePhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

// 更新状态（通过 IPC 同步给 renderer）/ Update status (synced to renderer via IPC)
export interface UpdateStatus {
  phase: UpdatePhase;
  currentVersion: string;
  latestVersion?: string;
  releaseNotes?: string;
  downloadProgress?: number;        // 0-100
  error?: string;
  skippedVersions: string[];
}

// 跳过版本持久化文件结构 / Skipped versions persistence file structure
interface UpdateStateFile {
  skippedVersions: string[];
}

const STATE_FILE = 'update-state.json';
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;  // 24h
const STARTUP_DELAY_MS = 10 * 1000;              // 10s

/**
 * 自动更新管理器 / Auto-update manager
 * 封装 electron-updater，提供状态同步 + 跳过版本持久化 + 定时轮询
 */
export class UpdateManager {
  private mainWindow: BrowserWindow | null;
  private status: UpdateStatus;
  private pollTimer: NodeJS.Timeout | null = null;
  private startupTimer: NodeJS.Timeout | null = null;
  private stateFilePath: string;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
    this.stateFilePath = join(app.getPath('userData'), STATE_FILE);

    this.status = {
      phase: 'idle',
      currentVersion: app.getVersion(),
      skippedVersions: this.loadSkippedVersions(),
    };

    // autoUpdater 配置 / autoUpdater configuration
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.allowDowngrade = false;
    autoUpdater.allowPrerelease = true;

    this.registerAutoUpdaterEvents();
  }

  /**
   * 启动更新检查（启动延迟 + 定时轮询）
   * Start update checking (startup delay + periodic polling)
   */
  start(): void {
    // 启动后 10s 检查一次（避免与 DB 初始化抢资源）
    this.startupTimer = setTimeout(() => {
      this.checkForUpdates().catch(() => {
        // 启动检查失败静默处理，不弹窗
      });
    }, STARTUP_DELAY_MS);

    // 每 24h 轮询一次
    this.pollTimer = setInterval(() => {
      this.checkForUpdates().catch(() => {
        // 轮询失败静默处理
      });
    }, CHECK_INTERVAL_MS);
  }

  /**
   * 手动检查更新 / Manually check for updates
   */
  async checkForUpdates(): Promise<UpdateStatus> {
    try {
      this.updateStatus({ phase: 'checking', error: undefined });
      await autoUpdater.checkForUpdates();
      return this.status;
    } catch (err) {
      this.updateStatus({
        phase: 'error',
        error: '检查更新失败，请检查网络连接',
      });
      return this.status;
    }
  }

  /**
   * 下载更新 / Download update
   */
  async downloadUpdate(): Promise<void> {
    try {
      await autoUpdater.downloadUpdate();
    } catch (err) {
      this.updateStatus({
        phase: 'error',
        error: '下载更新失败，请检查网络连接',
      });
    }
  }

  /**
   * 安装更新（退出应用并启动安装程序）
   * Install update (quit app and launch installer)
   */
  async installUpdate(): Promise<void> {
    await autoUpdater.quitAndInstall(false, true);
  }

  /**
   * 跳过指定版本（不再提示直到更高版本发布）
   * Skip a specific version (no more prompts until a higher version is released)
   */
  async skipVersion(version: string): Promise<void> {
    if (!this.status.skippedVersions.includes(version)) {
      this.status.skippedVersions.push(version);
      this.saveSkippedVersions();
      this.updateStatus({ phase: 'idle' });
    }
  }

  /**
   * 获取当前状态 / Get current status
   */
  getStatus(): UpdateStatus {
    return { ...this.status };
  }

  /**
   * 销毁（清理定时器和监听）
   * Destroy (cleanup timers and listeners)
   */
  destroy(): void {
    if (this.startupTimer) {
      clearTimeout(this.startupTimer);
      this.startupTimer = null;
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    autoUpdater.removeAllListeners();
    this.mainWindow = null;
  }

  // ===== 私有方法 / Private methods =====

  private registerAutoUpdaterEvents(): void {
    autoUpdater.on('checking-for-update', () => {
      this.updateStatus({ phase: 'checking' });
    });

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      // 检查是否在跳过列表中 / Check if version is in skip list
      if (this.status.skippedVersions.includes(info.version)) {
        // 静默跳过，不推送事件给 renderer
        this.updateStatus({ phase: 'idle' });
        return;
      }
      this.updateStatus({
        phase: 'available',
        latestVersion: info.version,
        releaseNotes: typeof info.releaseNotes === 'string'
          ? info.releaseNotes
          : Array.isArray(info.releaseNotes)
            ? info.releaseNotes.map(n => typeof n === 'string' ? n : n.note).join('\n')
            : undefined,
      });
    });

    autoUpdater.on('update-not-available', () => {
      this.updateStatus({ phase: 'not-available' });
    });

    autoUpdater.on('download-progress', (progress) => {
      this.updateStatus({
        phase: 'downloading',
        downloadProgress: Math.round(progress.percent),
      });
    });

    autoUpdater.on('update-downloaded', () => {
      this.updateStatus({
        phase: 'downloaded',
        downloadProgress: 100,
      });
    });

    autoUpdater.on('error', (_err) => {
      this.updateStatus({
        phase: 'error',
        error: '更新检查失败，请检查网络连接',
      });
    });
  }

  private updateStatus(patch: Partial<UpdateStatus>): void {
    this.status = { ...this.status, ...patch };
    this.notifyRenderer();
  }

  private notifyRenderer(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('update:status-changed', this.getStatus());
    }
  }

  private loadSkippedVersions(): string[] {
    try {
      if (!existsSync(this.stateFilePath)) {
        return [];
      }
      const data = JSON.parse(readFileSync(this.stateFilePath, 'utf-8')) as UpdateStateFile;
      return Array.isArray(data.skippedVersions) ? data.skippedVersions : [];
    } catch {
      // 文件损坏时回退到空列表 / Fallback to empty list on file corruption
      return [];
    }
  }

  private saveSkippedVersions(): void {
    try {
      const dir = app.getPath('userData');
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      const data: UpdateStateFile = {
        skippedVersions: this.status.skippedVersions,
      };
      writeFileSync(this.stateFilePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch {
      // 持久化失败不阻塞主流程 / Persistence failure does not block main flow
    }
  }
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run:
```bash
pnpm --filter @fire-app/desktop exec tsc --noEmit
```
Expected: 无错误。

注意：沙箱可能无 node_modules，可跳过由 CI 验证。

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/main/update-manager.ts
git commit -m "feat(update): add UpdateManager to wrap electron-updater

- 封装 autoUpdater：checkForUpdates / downloadUpdate / installUpdate / skipVersion
- 启动延迟 10s 检查 + 24h 定时轮询
- 跳过版本持久化到 userData/update-state.json
- 状态同步给 renderer 通过 update:status-changed 事件
- 错误信息脱敏（不含堆栈/URL）"
```

---

## Task 3: Update IPC handlers + preload API

**Files:**
- Create: `apps/desktop/src/main/ipc/update-handlers.ts`
- Modify: `apps/desktop/src/main/ipc-handlers.ts`
- Modify: `apps/desktop/src/preload/index.ts`

- [ ] **Step 1: 创建 update-handlers.ts**

Create file `apps/desktop/src/main/ipc/update-handlers.ts`:

```typescript
// 自动更新 IPC handlers / Auto-update IPC handlers
// 注册 update:* 通道，供渲染进程通过 IPC 调用 UpdateManager

import { ipcMain } from 'electron';
import type { UpdateManager } from '../update-manager.js';

let updateManager: UpdateManager | null = null;

/**
 * 注册自动更新 IPC handlers
 * Register auto-update IPC handlers
 * @param manager UpdateManager 实例 / UpdateManager instance
 */
export function registerUpdateHandlers(manager: UpdateManager): void {
  updateManager = manager;

  // 检查更新 / Check for updates
  ipcMain.handle('update:check', async () => {
    return await manager.checkForUpdates();
  });

  // 下载更新 / Download update
  ipcMain.handle('update:download', async () => {
    await manager.downloadUpdate();
  });

  // 安装更新（应用退出）/ Install update (app quits)
  ipcMain.handle('update:install', async () => {
    await manager.installUpdate();
  });

  // 跳过版本 / Skip version
  ipcMain.handle('update:skipVersion', async (_event, version: string) => {
    await manager.skipVersion(version);
  });

  // 获取当前状态 / Get current status
  ipcMain.handle('update:getStatus', () => {
    return manager.getStatus();
  });

  console.log('[IPC] 已注册 update handlers');
}
```

- [ ] **Step 2: 修改 ipc-handlers.ts 注册 update handlers**

Edit `apps/desktop/src/main/ipc-handlers.ts`，在 import 块加一行（在 `registerExportImportHandlers` import 之后）：

```typescript
import { registerExportImportHandlers } from './ipc/export-import-handlers.js';
import { registerUpdateHandlers } from './ipc/update-handlers.js';
```

并在 `registerIpcHandlers` 函数末尾（在 `registerExportImportHandlers(db);` 之后、`console.log` 之前）加：

```typescript
  registerExportImportHandlers(db);
  // update handlers 在 main/index.ts 中单独注册（需要 UpdateManager 实例）
```

注意：update handlers 需要 UpdateManager 实例，不能在 `registerIpcHandlers` 中注册（该函数只有 db 参数）。实际注册在 `main/index.ts` 中调用 `registerUpdateHandlers(updateManager)`。此步仅在 ipc-handlers.ts 中加 import，注册逻辑在 Task 5 的 main/index.ts 改动中完成。

实际上更简单的做法：不在 ipc-handlers.ts 中改动，直接在 main/index.ts 中 import 并调用。撤销此步对 ipc-handlers.ts 的改动。

- [ ] **Step 3: 撤销 Step 2 对 ipc-handlers.ts 的改动（改用 main/index.ts 直接注册）**

如果 Step 2 已改 ipc-handlers.ts，恢复原状。update handlers 在 Task 5 中直接在 main/index.ts 注册。

- [ ] **Step 4: 修改 preload/index.ts 暴露 update API**

Edit `apps/desktop/src/preload/index.ts`，在 `dataAccess` 对象定义之后、`contextBridge.exposeInMainWorld` 之前，加 `update` 对象：

```typescript
// 暴露给渲染进程的自动更新 API / Auto-update API exposed to renderer
const update = {
  check: () => ipcRenderer.invoke('update:check'),
  download: () => ipcRenderer.invoke('update:download'),
  install: () => ipcRenderer.invoke('update:install'),
  skipVersion: (version: string) => ipcRenderer.invoke('update:skipVersion', version),
  getStatus: () => ipcRenderer.invoke('update:getStatus'),
  onStatusChanged: (callback: (status: unknown) => void) => {
    const handler = (_event: unknown, status: unknown) => callback(status);
    ipcRenderer.on('update:status-changed', handler);
    // 返回取消订阅函数 / Return unsubscribe function
    return () => ipcRenderer.removeListener('update:status-changed', handler);
  },
};
```

然后在文件末尾的 `contextBridge.exposeInMainWorld` 之后加一行：

```typescript
contextBridge.exposeInMainWorld('dataAccess', dataAccess);
contextBridge.exposeInMainWorld('update', update);

// 类型声明：告诉 TypeScript window.update 存在
export type UpdateApi = typeof update;
```

- [ ] **Step 5: 验证 TypeScript 编译**

Run:
```bash
pnpm --filter @fire-app/desktop exec tsc --noEmit
```
Expected: 无错误。

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/main/ipc/update-handlers.ts apps/desktop/src/preload/index.ts
git commit -m "feat(update): add update IPC handlers + preload API

- update-handlers.ts: 注册 update:check/download/install/skipVersion/getStatus
- preload/index.ts: 暴露 window.update API + onStatusChanged 订阅"
```

---

## Task 4: useUpdateStore（renderer 状态管理）

**Files:**
- Create: `apps/desktop/src/renderer/src/stores/update-store.ts`
- Test: `apps/desktop/tests/update-store.test.ts`

- [ ] **Step 1: 写失败测试**

Create file `apps/desktop/tests/update-store.test.ts`:

```typescript
// useUpdateStore 单测 / useUpdateStore unit test

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useUpdateStore } from '@renderer/stores/update-store.js';

// mock window.update API
const mockUpdateApi = {
  check: vi.fn(),
  download: vi.fn(),
  install: vi.fn(),
  skipVersion: vi.fn(),
  getStatus: vi.fn(),
  onStatusChanged: vi.fn().mockReturnValue(() => {}),
};

describe('useUpdateStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).update = mockUpdateApi;
    // 重置 store 状态
    useUpdateStore.setState({
      phase: 'idle',
      currentVersion: '0.0.0',
      latestVersion: undefined,
      releaseNotes: undefined,
      downloadProgress: undefined,
      error: undefined,
      skippedVersions: [],
      dialogOpen: false,
    });
  });

  it('初始状态正确', () => {
    const state = useUpdateStore.getState();
    expect(state.phase).toBe('idle');
    expect(state.dialogOpen).toBe(false);
    expect(state.currentVersion).toBe('0.0.0');
  });

  it('syncStatus 从 main 拉取初始状态', async () => {
    mockUpdateApi.getStatus.mockResolvedValue({
      phase: 'idle',
      currentVersion: '0.0.0-dev.1',
      skippedVersions: [],
    });
    await useUpdateStore.getState().syncStatus();
    const state = useUpdateStore.getState();
    expect(state.currentVersion).toBe('0.0.0-dev.1');
    expect(mockUpdateApi.onStatusChanged).toHaveBeenCalled();
  });

  it('checkForUpdates 调用 window.update.check', async () => {
    mockUpdateApi.check.mockResolvedValue({
      phase: 'not-available',
      currentVersion: '0.0.0-dev.1',
      skippedVersions: [],
    });
    await useUpdateStore.getState().checkForUpdates();
    expect(mockUpdateApi.check).toHaveBeenCalled();
    expect(useUpdateStore.getState().dialogOpen).toBe(true);
  });

  it('phase=available 且版本未跳过时自动打开 dialog', async () => {
    mockUpdateApi.check.mockResolvedValue({
      phase: 'available',
      currentVersion: '0.0.0-dev.1',
      latestVersion: '0.0.0-dev.2',
      skippedVersions: [],
    });
    await useUpdateStore.getState().checkForUpdates();
    expect(useUpdateStore.getState().dialogOpen).toBe(true);
    expect(useUpdateStore.getState().phase).toBe('available');
  });

  it('phase=available 但版本已跳过时不打开 dialog', async () => {
    mockUpdateApi.check.mockResolvedValue({
      phase: 'available',
      currentVersion: '0.0.0-dev.1',
      latestVersion: '0.0.0-dev.2',
      skippedVersions: ['0.0.0-dev.2'],
    });
    await useUpdateStore.getState().checkForUpdates();
    expect(useUpdateStore.getState().dialogOpen).toBe(false);
  });

  it('downloadUpdate 调用 window.update.download', async () => {
    mockUpdateApi.download.mockResolvedValue(undefined);
    await useUpdateStore.getState().downloadUpdate();
    expect(mockUpdateApi.download).toHaveBeenCalled();
  });

  it('installUpdate 调用 window.update.install', async () => {
    mockUpdateApi.install.mockResolvedValue(undefined);
    await useUpdateStore.getState().installUpdate();
    expect(mockUpdateApi.install).toHaveBeenCalled();
  });

  it('skipVersion 调用 window.update.skipVersion', async () => {
    mockUpdateApi.skipVersion.mockResolvedValue(undefined);
    await useUpdateStore.getState().skipVersion('0.0.0-dev.2');
    expect(mockUpdateApi.skipVersion).toHaveBeenCalledWith('0.0.0-dev.2');
  });

  it('closeDialog 设置 dialogOpen=false', () => {
    useUpdateStore.setState({ dialogOpen: true });
    useUpdateStore.getState().closeDialog();
    expect(useUpdateStore.getState().dialogOpen).toBe(false);
  });

  it('openDialog 设置 dialogOpen=true', () => {
    useUpdateStore.getState().openDialog();
    expect(useUpdateStore.getState().dialogOpen).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run:
```bash
pnpm --filter @fire-app/desktop test tests/update-store.test.ts
```
Expected: FAIL with "Cannot find module '@renderer/stores/update-store.js'"

- [ ] **Step 3: 创建 update-store.ts**

Create file `apps/desktop/src/renderer/src/stores/update-store.ts`:

```typescript
// 自动更新状态管理 / Auto-update state management
// 订阅 main 进程的 update:status-changed 事件，暴露状态 + 操作方法

import { create } from 'zustand';

// 更新状态阶段（与 main 进程 UpdatePhase 对齐）
export type UpdatePhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

interface UpdateStatus {
  phase: UpdatePhase;
  currentVersion: string;
  latestVersion?: string;
  releaseNotes?: string;
  downloadProgress?: number;
  error?: string;
  skippedVersions: string[];
}

interface UpdateStoreState extends UpdateStatus {
  dialogOpen: boolean;

  checkForUpdates: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
  skipVersion: (version: string) => Promise<void>;
  closeDialog: () => void;
  openDialog: () => void;
  syncStatus: () => Promise<void>;
}

// 初始状态 / Initial state
const initialState: UpdateStatus & { dialogOpen: boolean } = {
  phase: 'idle',
  currentVersion: '0.0.0',
  latestVersion: undefined,
  releaseNotes: undefined,
  downloadProgress: undefined,
  error: undefined,
  skippedVersions: [],
  dialogOpen: false,
};

export const useUpdateStore = create<UpdateStoreState>((set, get) => ({
  ...initialState,

  checkForUpdates: async () => {
    try {
      const status = await window.update.check();
      // phase=available 且版本未跳过 → 自动弹窗
      const shouldOpenDialog =
        status.phase === 'available' &&
        status.latestVersion !== undefined &&
        !status.skippedVersions.includes(status.latestVersion);
      // phase=not-available 或 error → 手动检查时弹窗显示结果
      const shouldOpenForResult =
        status.phase === 'not-available' || status.phase === 'error';
      set({
        ...status,
        dialogOpen: shouldOpenDialog || shouldOpenForResult,
      });
    } catch {
      set({ phase: 'error', error: '检查更新失败', dialogOpen: true });
    }
  },

  downloadUpdate: async () => {
    await window.update.download();
  },

  installUpdate: async () => {
    await window.update.install();
  },

  skipVersion: async (version) => {
    await window.update.skipVersion(version);
    set({ phase: 'idle', dialogOpen: false });
  },

  closeDialog: () => set({ dialogOpen: false }),
  openDialog: () => set({ dialogOpen: true }),

  syncStatus: async () => {
    try {
      const status = await window.update.getStatus();
      set(status);
    } catch {
      // 状态拉取失败静默处理
    }
    // 订阅 main 进程推送的状态变更
    window.update.onStatusChanged((status: unknown) => {
      const s = status as UpdateStatus;
      // phase=available 且版本未跳过 → 自动弹窗
      const shouldOpenDialog =
        s.phase === 'available' &&
        s.latestVersion !== undefined &&
        !s.skippedVersions.includes(s.latestVersion);
      set({
        ...s,
        dialogOpen: shouldOpenDialog || get().dialogOpen,
      });
    });
  },
}));
```

- [ ] **Step 4: 运行测试验证通过**

Run:
```bash
pnpm --filter @fire-app/desktop test tests/update-store.test.ts
```
Expected: 所有 10 个测试通过。

- [ ] **Step 5: 修改 vitest.setup.ts 加 window.update mock**

Edit `apps/desktop/vitest.setup.ts`，在 `window.dataAccess = {...} as any;` 之后加：

```typescript
  window.update = {
    check: fn(),
    download: fn(),
    install: fn(),
    skipVersion: fn(),
    getStatus: fn(),
    onStatusChanged: fn().mockReturnValue(() => {}),
  } as any;
```

注意 `fn` 已在文件中定义为 `const fn = () => vi.fn();`，但 `onStatusChanged` 需要返回取消订阅函数，所以用 `fn().mockReturnValue(() => {})`。

- [ ] **Step 6: 重新运行测试验证 mock 生效**

Run:
```bash
pnpm --filter @fire-app/desktop test tests/update-store.test.ts
```
Expected: 所有测试通过。

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/renderer/src/stores/update-store.ts apps/desktop/tests/update-store.test.ts apps/desktop/vitest.setup.ts
git commit -m "feat(update): add useUpdateStore with 10 passing tests

- Zustand store 订阅 main 进程 update:status-changed 事件
- checkForUpdates: 自动判断是否弹窗（available+未跳过 / not-available / error）
- syncStatus: 启动时拉取初始状态 + 订阅事件
- vitest.setup.ts: 加 window.update mock"
```

---

## Task 5: main/index.ts 初始化 UpdateManager

**Files:**
- Modify: `apps/desktop/src/main/index.ts`
- Modify: `apps/desktop/src/main/ipc-handlers.ts`

- [ ] **Step 1: 修改 main/index.ts 初始化 UpdateManager + 注册 handlers**

Edit `apps/desktop/src/main/index.ts`，在 import 块加：

```typescript
import { registerIpcHandlers } from './ipc-handlers.js';
import { UpdateManager } from './update-manager.js';
import { registerUpdateHandlers } from './ipc/update-handlers.js';
```

在文件顶部 `let mainWindow: BrowserWindow | null = null;` 之后加：

```typescript
let updateManager: UpdateManager | null = null;
```

在 `createWindow` 函数中，`mainWindow = new BrowserWindow({...})` 之后（在 `mainWindow.on('ready-to-show'` 之前）加：

```typescript
  // 初始化自动更新管理器（需要 mainWindow 引用）
  // Initialize auto-update manager (needs mainWindow reference)
  updateManager = new UpdateManager(mainWindow);
  registerUpdateHandlers(updateManager);
```

在 `app.whenReady().then(() => {...})` 块中，`createWindow();` 之后加：

```typescript
  // 5. 启动自动更新检查（延迟 10s + 24h 轮询）
  // Start auto-update checking (10s delay + 24h polling)
  updateManager?.start();
```

在 `app.on('before-quit', ...)` 中加 `updateManager?.destroy();`：

```typescript
app.on('before-quit', () => {
  debugLog('before-quit: closing database');
  closeAppDatabase();
  debugLog('before-quit: database closed');
  updateManager?.destroy();
});
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run:
```bash
pnpm --filter @fire-app/desktop exec tsc --noEmit
```
Expected: 无错误。

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/main/index.ts
git commit -m "feat(update): initialize UpdateManager in main process

- app.whenReady 后 createWindow 内创建 UpdateManager + 注册 IPC handlers
- updateManager.start() 启动延迟检查 + 24h 轮询
- before-quit 时 destroy() 清理定时器"
```

---

## Task 6: UpdateDialog 组件

**Files:**
- Create: `apps/desktop/src/renderer/src/components/auxiliary/UpdateDialog.tsx`
- Test: `apps/desktop/tests/update-dialog.test.tsx`

- [ ] **Step 1: 写失败测试**

Create file `apps/desktop/tests/update-dialog.test.tsx`:

```typescript
// UpdateDialog 组件测试 / UpdateDialog component test

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UpdateDialog } from '@renderer/components/auxiliary/UpdateDialog.js';
import { useUpdateStore } from '@renderer/stores/update-store.js';

describe('UpdateDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUpdateStore.setState({
      phase: 'idle',
      currentVersion: '0.0.0-dev.1',
      latestVersion: undefined,
      releaseNotes: undefined,
      downloadProgress: undefined,
      error: undefined,
      skippedVersions: [],
      dialogOpen: false,
    });
  });

  it('dialogOpen=false 时不渲染', () => {
    render(<UpdateDialog />);
    expect(screen.queryByText('发现新版本')).not.toBeInTheDocument();
  });

  it('phase=available 时显示新版本信息和下载按钮', () => {
    useUpdateStore.setState({
      phase: 'available',
      currentVersion: '0.0.0-dev.1',
      latestVersion: '0.0.0-dev.2',
      releaseNotes: '修复 bug',
      dialogOpen: true,
    });
    render(<UpdateDialog />);
    expect(screen.getByText('发现新版本 v0.0.0-dev.2')).toBeInTheDocument();
    expect(screen.getByText('当前版本：v0.0.0-dev.1')).toBeInTheDocument();
    expect(screen.getByText('修复 bug')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '现在下载' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '跳过本次' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '不再提醒本版本' })).toBeInTheDocument();
  });

  it('点击"现在下载"调用 downloadUpdate', () => {
    const downloadUpdate = vi.fn();
    useUpdateStore.setState({
      phase: 'available',
      latestVersion: '0.0.0-dev.2',
      dialogOpen: true,
      downloadUpdate,
    });
    render(<UpdateDialog />);
    fireEvent.click(screen.getByRole('button', { name: '现在下载' }));
    expect(downloadUpdate).toHaveBeenCalled();
  });

  it('点击"跳过本次"关闭弹窗', () => {
    const closeDialog = vi.fn();
    useUpdateStore.setState({
      phase: 'available',
      latestVersion: '0.0.0-dev.2',
      dialogOpen: true,
      closeDialog,
    });
    render(<UpdateDialog />);
    fireEvent.click(screen.getByRole('button', { name: '跳过本次' }));
    expect(closeDialog).toHaveBeenCalled();
  });

  it('点击"不再提醒本版本"调用 skipVersion', () => {
    const skipVersion = vi.fn();
    useUpdateStore.setState({
      phase: 'available',
      latestVersion: '0.0.0-dev.2',
      dialogOpen: true,
      skipVersion,
    });
    render(<UpdateDialog />);
    fireEvent.click(screen.getByRole('button', { name: '不再提醒本版本' }));
    expect(skipVersion).toHaveBeenCalledWith('0.0.0-dev.2');
  });

  it('phase=downloading 时显示进度条', () => {
    useUpdateStore.setState({
      phase: 'downloading',
      downloadProgress: 65,
      dialogOpen: true,
    });
    render(<UpdateDialog />);
    expect(screen.getByText('下载中...')).toBeInTheDocument();
    expect(screen.getByText('65%')).toBeInTheDocument();
  });

  it('phase=downloaded 时显示安装按钮', () => {
    const installUpdate = vi.fn();
    useUpdateStore.setState({
      phase: 'downloaded',
      dialogOpen: true,
      installUpdate,
    });
    render(<UpdateDialog />);
    expect(screen.getByRole('button', { name: '安装并重启' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '安装并重启' }));
    expect(installUpdate).toHaveBeenCalled();
  });

  it('phase=not-available 时显示已是最新', () => {
    useUpdateStore.setState({
      phase: 'not-available',
      dialogOpen: true,
    });
    render(<UpdateDialog />);
    expect(screen.getByText('已是最新版本')).toBeInTheDocument();
  });

  it('phase=error 时显示错误信息', () => {
    useUpdateStore.setState({
      phase: 'error',
      error: '检查更新失败，请检查网络连接',
      dialogOpen: true,
    });
    render(<UpdateDialog />);
    expect(screen.getByText('检查更新失败，请检查网络连接')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run:
```bash
pnpm --filter @fire-app/desktop test tests/update-dialog.test.tsx
```
Expected: FAIL with "Cannot find module '@renderer/components/auxiliary/UpdateDialog.js'"

- [ ] **Step 3: 创建 UpdateDialog.tsx**

Create file `apps/desktop/src/renderer/src/components/auxiliary/UpdateDialog.tsx`:

```typescript
// 自动更新对话框 / Auto-update dialog
// 根据 phase 显示不同内容：新版本信息 / 下载进度 / 安装按钮 / 错误信息

import { useUpdateStore } from '../../stores/update-store.js';

export function UpdateDialog() {
  const phase = useUpdateStore((s) => s.phase);
  const currentVersion = useUpdateStore((s) => s.currentVersion);
  const latestVersion = useUpdateStore((s) => s.latestVersion);
  const releaseNotes = useUpdateStore((s) => s.releaseNotes);
  const downloadProgress = useUpdateStore((s) => s.downloadProgress);
  const error = useUpdateStore((s) => s.error);
  const dialogOpen = useUpdateStore((s) => s.dialogOpen);

  const downloadUpdate = useUpdateStore((s) => s.downloadUpdate);
  const installUpdate = useUpdateStore((s) => s.installUpdate);
  const skipVersion = useUpdateStore((s) => s.skipVersion);
  const closeDialog = useUpdateStore((s) => s.closeDialog);

  if (!dialogOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        {/* 标题 */}
        {phase === 'available' && (
          <h2 className="mb-2 text-lg font-semibold text-gray-900">
            发现新版本 v{latestVersion}
          </h2>
        )}
        {phase === 'downloading' && (
          <h2 className="mb-2 text-lg font-semibold text-gray-900">下载更新</h2>
        )}
        {phase === 'downloaded' && (
          <h2 className="mb-2 text-lg font-semibold text-gray-900">下载完成</h2>
        )}
        {phase === 'not-available' && (
          <h2 className="mb-2 text-lg font-semibold text-gray-900">已是最新版本</h2>
        )}
        {phase === 'error' && (
          <h2 className="mb-2 text-lg font-semibold text-gray-900">更新失败</h2>
        )}

        {/* 内容 */}
        {phase === 'available' && (
          <div className="mb-4 space-y-2">
            <p className="text-sm text-gray-600">当前版本：v{currentVersion}</p>
            {releaseNotes && (
              <div>
                <p className="mb-1 text-sm font-medium text-gray-700">更新内容：</p>
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-2 text-xs text-gray-600">
                  {releaseNotes}
                </pre>
              </div>
            )}
          </div>
        )}

        {phase === 'downloading' && (
          <div className="mb-4">
            <p className="mb-2 text-sm text-gray-600">下载中...</p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full bg-blue-600 transition-all"
                style={{ width: `${downloadProgress ?? 0}%` }}
              />
            </div>
            <p className="mt-1 text-right text-xs text-gray-500">{downloadProgress ?? 0}%</p>
          </div>
        )}

        {phase === 'downloaded' && (
          <p className="mb-4 text-sm text-gray-600">
            新版本已下载完成，点击"安装并重启"立即安装。
          </p>
        )}

        {phase === 'not-available' && (
          <p className="mb-4 text-sm text-gray-600">
            当前版本 v{currentVersion} 已是最新。
          </p>
        )}

        {phase === 'error' && (
          <p className="mb-4 text-sm text-red-600">{error ?? '更新检查失败'}</p>
        )}

        {/* 按钮 */}
        <div className="flex justify-end gap-2">
          {phase === 'available' && (
            <>
              <button
                onClick={() => skipVersion(latestVersion!)}
                className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
              >
                不再提醒本版本
              </button>
              <button
                onClick={closeDialog}
                className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
              >
                跳过本次
              </button>
              <button
                onClick={downloadUpdate}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
              >
                现在下载
              </button>
            </>
          )}

          {phase === 'downloading' && (
            <button
              disabled
              className="cursor-not-allowed rounded-md bg-gray-300 px-3 py-1.5 text-sm text-gray-500"
            >
              下载中...
            </button>
          )}

          {phase === 'downloaded' && (
            <>
              <button
                onClick={closeDialog}
                className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
              >
                稍后
              </button>
              <button
                onClick={installUpdate}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
              >
                安装并重启
              </button>
            </>
          )}

          {(phase === 'not-available' || phase === 'error') && (
            <button
              onClick={closeDialog}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
            >
              关闭
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 运行测试验证通过**

Run:
```bash
pnpm --filter @fire-app/desktop test tests/update-dialog.test.tsx
```
Expected: 所有 9 个测试通过。

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/renderer/src/components/auxiliary/UpdateDialog.tsx apps/desktop/tests/update-dialog.test.tsx
git commit -m "feat(update): add UpdateDialog component with 9 passing tests

- 5 个 phase 显示不同内容：available/downloading/downloaded/not-available/error
- available: 版本号 + release notes (pre) + 下载/跳过/不再提醒按钮
- downloading: 进度条 + 百分比 + 禁用按钮
- downloaded: 安装并重启 / 稍后
- not-available/error: 关闭按钮"
```

---

## Task 7: UpdateSection 组件 + SettingsPage 集成

**Files:**
- Create: `apps/desktop/src/renderer/src/components/auxiliary/UpdateSection.tsx`
- Test: `apps/desktop/tests/update-section.test.tsx`
- Modify: `apps/desktop/src/renderer/src/pages/SettingsPage.tsx`

- [ ] **Step 1: 写失败测试**

Create file `apps/desktop/tests/update-section.test.tsx`:

```typescript
// UpdateSection 组件测试 / UpdateSection component test

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UpdateSection } from '@renderer/components/auxiliary/UpdateSection.js';
import { useUpdateStore } from '@renderer/stores/update-store.js';

describe('UpdateSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUpdateStore.setState({
      phase: 'idle',
      currentVersion: '0.0.0-dev.1',
      latestVersion: undefined,
      skippedVersions: [],
      dialogOpen: false,
    });
  });

  it('显示当前版本号', () => {
    render(<UpdateSection />);
    expect(screen.getByText('v0.0.0-dev.1')).toBeInTheDocument();
  });

  it('无新版本时显示"已是最新"', () => {
    useUpdateStore.setState({ phase: 'not-available' });
    render(<UpdateSection />);
    expect(screen.getByText('已是最新')).toBeInTheDocument();
  });

  it('有新版本时显示最新版本号', () => {
    useUpdateStore.setState({
      phase: 'available',
      latestVersion: '0.0.0-dev.2',
    });
    render(<UpdateSection />);
    expect(screen.getByText('v0.0.0-dev.2（有更新）')).toBeInTheDocument();
  });

  it('点击"检查更新"调用 checkForUpdates + openDialog', () => {
    const checkForUpdates = vi.fn().mockResolvedValue(undefined);
    const openDialog = vi.fn();
    useUpdateStore.setState({ checkForUpdates, openDialog });
    render(<UpdateSection />);
    fireEvent.click(screen.getByRole('button', { name: '检查更新' }));
    expect(checkForUpdates).toHaveBeenCalled();
    expect(openDialog).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run:
```bash
pnpm --filter @fire-app/desktop test tests/update-section.test.tsx
```
Expected: FAIL with "Cannot find module '@renderer/components/auxiliary/UpdateSection.js'"

- [ ] **Step 3: 创建 UpdateSection.tsx**

Create file `apps/desktop/src/renderer/src/components/auxiliary/UpdateSection.tsx`:

```typescript
// 设置页更新区 / Settings page update section
// 显示当前版本 + 最新版本 + 手动检查按钮

import { useUpdateStore } from '../../stores/update-store.js';

export function UpdateSection() {
  const currentVersion = useUpdateStore((s) => s.currentVersion);
  const latestVersion = useUpdateStore((s) => s.latestVersion);
  const phase = useUpdateStore((s) => s.phase);
  const checkForUpdates = useUpdateStore((s) => s.checkForUpdates);
  const openDialog = useUpdateStore((s) => s.openDialog);

  const handleCheck = () => {
    checkForUpdates();
    openDialog();
  };

  // 判断最新版本显示文案
  let latestText = '检查中...';
  if (phase === 'idle' || phase === 'checking') {
    latestText = '未知';
  } else if (phase === 'not-available') {
    latestText = '已是最新';
  } else if (phase === 'available' && latestVersion) {
    latestText = `v${latestVersion}（有更新）`;
  } else if (latestVersion) {
    latestText = `v${latestVersion}`;
  }

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <h3 className="mb-3 text-base font-semibold text-gray-900">关于 / 更新</h3>
      <div className="space-y-1 text-sm text-gray-600">
        <p>当前版本：v{currentVersion}</p>
        <p>最新版本：{latestText}</p>
      </div>
      <button
        onClick={handleCheck}
        className="mt-3 rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
      >
        检查更新
      </button>
    </div>
  );
}
```

- [ ] **Step 4: 运行测试验证通过**

Run:
```bash
pnpm --filter @fire-app/desktop test tests/update-section.test.tsx
```
Expected: 所有 4 个测试通过。

- [ ] **Step 5: 修改 SettingsPage.tsx 集成 UpdateSection**

Edit `apps/desktop/src/renderer/src/pages/SettingsPage.tsx`，在 import 块加：

```typescript
import { UpdateSection } from '../components/auxiliary/UpdateSection.js';
```

在 SettingsPage 组件的 JSX 末尾（在 `DataManagementPanel` 之后、闭合标签之前）加：

```tsx
        {/* 自动更新 / Auto-update */}
        <div className="mt-6">
          <UpdateSection />
        </div>
```

注意：具体插入位置需读取 SettingsPage.tsx 的完整 JSX 结构确定，在 DataManagementPanel 所在的 div 之后追加。

- [ ] **Step 6: 运行 settings-components 测试验证不破坏现有测试**

Run:
```bash
pnpm --filter @fire-app/desktop test tests/settings-components.test.tsx
```
Expected: 所有现有测试通过（UpdateSection 无需在 settings-components 测试中验证，已有独立测试）。

如果现有测试因新增 UpdateSection 而失败（如 `getByText` 命中多个元素），需调整测试 mock。

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/renderer/src/components/auxiliary/UpdateSection.tsx apps/desktop/tests/update-section.test.tsx apps/desktop/src/renderer/src/pages/SettingsPage.tsx
git commit -m "feat(update): add UpdateSection + integrate into SettingsPage

- UpdateSection: 当前版本 + 最新版本 + 检查更新按钮
- SettingsPage: 末尾追加 UpdateSection
- 4 个组件测试通过"
```

---

## Task 8: App.tsx 全局挂载 UpdateDialog + syncStatus

**Files:**
- Modify: `apps/desktop/src/renderer/src/App.tsx`

- [ ] **Step 1: 修改 App.tsx 挂载 UpdateDialog + 启动时 syncStatus**

Edit `apps/desktop/src/renderer/src/App.tsx`：

```tsx
// 应用根组件：挂载 RouterProvider + 启动时初始化 app-store + 自动更新
// App root: mount RouterProvider + initialize app-store + auto-update on startup

import { Suspense, useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { ErrorBoundary } from './components/base/ErrorBoundary.js';
import { UpdateDialog } from './components/auxiliary/UpdateDialog.js';
import { router } from './router/index.js';
import { useAppStore } from './stores/app-store.js';
import { useUpdateStore } from './stores/update-store.js';

export default function App() {
  const initialize = useAppStore((s) => s.initialize);
  const syncUpdateStatus = useUpdateStore((s) => s.syncStatus);

  useEffect(() => {
    initialize();
    // 启动时同步更新状态 + 订阅 main 进程事件
    // Sync update status on startup + subscribe to main process events
    syncUpdateStatus();
  }, [initialize, syncUpdateStatus]);

  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="p-8 text-gray-500">加载中...</div>}>
        <RouterProvider router={router} />
      </Suspense>
      <UpdateDialog />
    </ErrorBoundary>
  );
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run:
```bash
pnpm --filter @fire-app/desktop exec tsc --noEmit
```
Expected: 无错误。

- [ ] **Step 3: 运行全部单测验证不破坏**

Run:
```bash
pnpm test:all
```
Expected: 所有测试通过。

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/renderer/src/App.tsx
git commit -m "feat(update): mount UpdateDialog globally + syncStatus on startup

- App.tsx 全局挂载 UpdateDialog（受 store.dialogOpen 控制）
- useEffect 中调用 syncUpdateStatus 拉取初始状态 + 订阅事件"
```

---

## Task 9: CI workflow 自动预发布版本号 + --publish always

**Files:**
- Modify: `.github/workflows/build-release.yml`

- [ ] **Step 1: 在 CI workflow 加 Generate pre-release version 步骤**

Edit `.github/workflows/build-release.yml`，在 `Install dependencies` 步骤之后、`Run tests (gate)` 之前加：

```yaml
      - name: Generate pre-release version
        run: |
          DATE=$(date -u +%Y%m%d)
          RUN_NUM=${{ github.run_number }}
          VERSION="0.0.0-dev.${DATE}.${RUN_NUM}"
          node -e "
            const fs = require('fs');
            const p = 'apps/desktop/package.json';
            const pkg = JSON.parse(fs.readFileSync(p, 'utf8'));
            pkg.version = '${VERSION}';
            fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + '\n');
          "
          echo "Generated version: ${VERSION}"
```

- [ ] **Step 2: 修改 Package .exe 步骤加 --publish always**

Edit `.github/workflows/build-release.yml`，将：

```yaml
      - name: Package .exe
        run: pnpm --filter @fire-app/desktop exec electron-builder --config electron-builder.yml
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

改为：

```yaml
      - name: Package .exe and publish to GitHub Releases
        run: pnpm --filter @fire-app/desktop exec electron-builder --config electron-builder.yml --publish always
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

- [ ] **Step 3: 移除 softprops/action-gh-release 步骤（electron-builder 自带上传）**

Edit `.github/workflows/build-release.yml`，删除：

```yaml
      - name: Publish to GitHub Releases
        uses: softprops/action-gh-release@v2
        if: startsWith(github.ref, 'refs/tags/')
        with:
          files: release/*.exe
          generate_release_notes: true
```

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/build-release.yml
git commit -m "ci: auto-generate pre-release version + publish to GitHub Releases

- Generate pre-release version 步骤：自动生成 0.0.0-dev.yyyyMMdd.run_number
- Package 步骤加 --publish always：electron-builder 自动上传到 GitHub Releases (pre-release)
- 移除 softprops/action-gh-release：electron-builder 自带上传，无需二次发布"
```

---

## Task 10: 全量验证 + PR

**Files:**
- 无代码改动，纯验证 + PR 准备

- [ ] **Step 1: 运行全部单测**

Run:
```bash
pnpm test:all
```
Expected: 所有测试通过（含新增 23 个：update-store 10 + update-dialog 9 + update-section 4）。

- [ ] **Step 2: 验证 TypeScript 编译**

Run:
```bash
pnpm --filter @fire-app/desktop exec tsc --noEmit
```
Expected: 无错误。

- [ ] **Step 3: 验证 build**

Run:
```bash
pnpm --filter @fire-app/desktop build
```
Expected: `out/` 产物生成，无错误。

- [ ] **Step 4: 验证 dist（打包）**

Run:
```bash
pnpm --filter @fire-app/desktop dist
```
Expected: `release/` 下生成 .exe，无错误。

注意：沙箱环境可能无法执行，由 CI 验证。

- [ ] **Step 5: Push 到分支并创建 PR**

```bash
git checkout -b feat/auto-update
git push -u origin feat/auto-update
gh pr create --title "feat: auto-update via electron-updater + GitHub Releases" --body "..."
```

- [ ] **Step 6: 合并后手动 E2E 验证**

合并后首次 push 到 main 触发 CI 发预发布版本，需本地准备两个版本验证：

1. 安装旧版本 .exe → 启动 → 10s 后自动弹 UpdateDialog
2. 点"现在下载" → 进度条 → 下载完成
3. 点"安装并重启" → 应用退出 → NSIS 安装 → 重启是新版本
4. 设置页"检查更新" → 显示"已是最新"
5. 跳过版本 → 下次启动不弹窗

---

## Self-Review 结果

**1. Spec 覆盖**：
- ✅ §3 架构 → Task 2-8 覆盖三层架构
- ✅ §4 主进程设计 → Task 2 (UpdateManager) + Task 3 (IPC) + Task 5 (初始化)
- ✅ §5 Renderer 设计 → Task 4 (store) + Task 6 (dialog) + Task 7 (section) + Task 8 (App.tsx)
- ✅ §6 CI/CD → Task 1 (electron-builder config) + Task 9 (workflow)
- ✅ §7 测试策略 → Task 4/6/7 单测 + Task 10 E2E
- ✅ §10 验收标准 → Task 10 逐条验证

**2. 占位符扫描**：无 TBD/TODO/笼统描述。

**3. 类型一致性**：
- `UpdatePhase` / `UpdateStatus` 在 Task 2 (main) 和 Task 4 (renderer) 重复定义——这是有意的，因为 main 和 renderer 是独立编译单元，不能共享 import。两处定义字段完全一致。
- `window.update` API 签名在 Task 3 (preload) 和 Task 4 (store 调用) 一致。
- `UpdateManager` 方法名在 Task 2 (定义) 和 Task 3 (handlers 调用) 一致。
