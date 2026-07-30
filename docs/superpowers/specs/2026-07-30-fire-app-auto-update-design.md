# FIRE-APP 自动更新（electron-updater + GitHub Releases）设计

> **日期**：2026-07-30
> **状态**：已批准，待写实施计划
> **前置**：M1-M9 全部完成 + Electron 36 升级已合并（PR #1）+ Wiki 已同步
> **范围约束**：仅 Windows 桌面端自动更新，无代码签名，单渠道 latest，预发布版本

---

## 1. 目标

为打包后的 FIRE App 添加自动检查更新 + 下载 + 安装的能力。用户无需手动到 GitHub Releases 下载 .exe，应用内完成全流程。

## 2. 关键决策

| 决策项 | 选择 | 理由 |
|---|---|---|
| 检查触发策略 | 启动检查（延迟 10s） + 手动检查（设置页按钮） + 24h 定时轮询 | 最灵活，覆盖所有场景 |
| 更新源 | GitHub Releases | electron-updater 原生支持，零运维 |
| 安装方式 | 下载 + 退出应用启动 NSIS 安装程序 + 重启 | 用户有明确感知，可取消 |
| 代码签名 | 不签名（零成本） | dev 阶段，用户手动信任 SmartScreen 警告 |
| 版本号策略 | 自动预发布 `0.0.0-dev.yyyyMMdd.run_number` | 无需手动维护，每次 push 到 main 自动发版 |
| 更新渠道 | 单渠道 latest | 简化实现，dev 阶段无需 beta/alpha |
| 更新 UI | 模态对话框 + 设置页按钮 | 发现性强，不打扰 |

## 3. 架构

### 3.1 三层架构

```
┌─────────────────────────────────────────────────┐
│  Renderer（设置页 + UpdateDialog）              │
│  - UpdateDialog.tsx（模态对话框）                │
│  - UpdateSection.tsx（设置页更新区）             │
│  - useUpdateStore.ts（Zustand，订阅更新状态）    │
└──────────────────┬──────────────────────────────┘
                   │ IPC（update:* 通道）
┌──────────────────▼──────────────────────────────┐
│  Main（autoUpdater 封装 + 定时器）               │
│  - update-manager.ts（封装 electron-updater）    │
│  - update-handlers.ts（IPC handlers）            │
│  - 启动检查 + 24h 定时轮询                       │
└──────────────────┬──────────────────────────────┘
                   │ HTTPS
┌──────────────────▼──────────────────────────────┐
│  GitHub Releases                                 │
│  - latest.yml（版本元数据）                      │
│  - FIRE-App-Setup-x.x.x.exe（NSIS 安装包）       │
│  - FIRE-App-x.x.x.exe（portable）                │
└─────────────────────────────────────────────────┘
```

### 3.2 新增组件清单

| 组件 | 位置 | 职责 |
|---|---|---|
| `update-manager.ts` | `apps/desktop/src/main/` | 封装 `electron-updater` 的 `autoUpdater`，提供 checkForUpdates / downloadUpdate / installUpdate / skipVersion |
| `update-handlers.ts` | `apps/desktop/src/main/ipc/` | 注册 `update:*` IPC handlers |
| `useUpdateStore.ts` | `apps/desktop/src/renderer/src/stores/` | Zustand store，订阅 main 进程更新状态 |
| `UpdateDialog.tsx` | `apps/desktop/src/renderer/src/components/auxiliary/` | 模态对话框，显示新版本 + 下载进度 + 操作按钮 |
| `UpdateSection.tsx` | `apps/desktop/src/renderer/src/components/auxiliary/` | 设置页更新区，当前版本 + 手动检查按钮 |

### 3.3 修改组件清单

| 组件 | 改动 |
|---|---|
| `apps/desktop/package.json` | 加 `electron-updater` dependency |
| `apps/desktop/electron-builder.yml` | `publish` 从 `null` 改为 GitHub Releases 配置 |
| `apps/desktop/src/main/index.ts` | `app.whenReady()` 中初始化 `UpdateManager` + 注册 handlers |
| `apps/desktop/src/preload/index.ts` | 暴露 `update` API |
| `apps/desktop/src/renderer/src/pages/SettingsPage.tsx` | 加 UpdateSection |
| `apps/desktop/src/renderer/src/App.tsx` | 全局挂载 `<UpdateDialog />` |
| `.github/workflows/build-release.yml` | 自动生成预发布版本号 + electron-builder 自动上传 |

## 4. 主进程设计

### 4.1 UpdateManager API

```typescript
class UpdateManager {
  constructor(mainWindow: BrowserWindow)

  checkForUpdates(): Promise<UpdateCheckResult>
  downloadUpdate(): Promise<void>
  installUpdate(): Promise<void>
  skipVersion(version: string): Promise<void>
  getStatus(): UpdateStatus
  destroy(): void
}
```

### 4.2 UpdateStatus 类型

```typescript
interface UpdateStatus {
  phase: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  currentVersion: string
  latestVersion?: string
  releaseNotes?: string
  downloadProgress?: number        // 0-100
  error?: string                   // 脱敏后
  skippedVersions: string[]
}
```

### 4.3 autoUpdater 配置

```typescript
autoUpdater.autoDownload = false;         // 不自动下载，等用户点击
autoUpdater.autoInstallOnAppQuit = false;  // 不在退出时自动安装
autoUpdater.allowDowngrade = false;
autoUpdater.allowPrerelease = true;        // 接受预发布版本
```

### 4.4 事件流

| autoUpdater 事件 | UpdateManager 处理 | IPC 推送 |
|---|---|---|
| checking-for-update | phase='checking' | update:status-changed |
| update-available | phase='available'（若 version 在 skippedVersions 中则静默） | update:status-changed |
| update-not-available | phase='not-available' | update:status-changed |
| download-progress | phase='downloading', downloadProgress=percent | update:status-changed |
| update-downloaded | phase='downloaded' | update:status-changed |
| error | phase='error', error=sanitize(msg) | update:status-changed |

### 4.5 启动检查 + 定时轮询

- `app.whenReady()` 后延迟 10s 调用 `checkForUpdates()`（避免与 DB 初始化抢资源）
- 启动后每 24h `setInterval` 调用 `checkForUpdates()`
- `app.on('before-quit')` 时 `destroy()` 清理定时器

### 4.6 跳过版本持久化

存 `userData/update-state.json`：
```json
{
  "skippedVersions": ["0.0.0-dev.20260730.1"]
}
```

`update-available` 触发时，若 `info.version` 在 `skippedVersions` 中则不推送事件给 renderer。用户点"不再提醒本版本"时追加到列表并持久化。文件损坏时 try/catch 回退到空列表。

### 4.7 IPC handlers

| 通道 | 方向 | 入参 | 返回 |
|---|---|---|---|
| `update:check` | renderer→main | 无 | `UpdateStatus` |
| `update:download` | renderer→main | 无 | `void` |
| `update:install` | renderer→main | 无 | `void`（应用退出） |
| `update:skipVersion` | renderer→main | `version: string` | `void` |
| `update:getStatus` | renderer→main | 无 | `UpdateStatus` |
| `update:status-changed` | main→renderer | `UpdateStatus` | （订阅） |

### 4.8 错误处理

- 网络失败：`phase='error'`，error="检查更新失败，请检查网络连接"。启动检查时静默不弹窗，仅更新 status；手动检查时弹 UpdateDialog 显示错误。
- 持久化文件损坏：try/catch，回退空列表，记录日志不阻塞。
- 脱敏：error 只保留用户可读摘要，不含堆栈/URL。

## 5. Renderer 设计

### 5.1 useUpdateStore

```typescript
interface UpdateStoreState {
  phase: UpdatePhase;
  currentVersion: string;
  latestVersion?: string;
  releaseNotes?: string;
  downloadProgress?: number;
  error?: string;
  skippedVersions: string[];
  dialogOpen: boolean;

  checkForUpdates: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
  skipVersion: (version: string) => Promise<void>;
  closeDialog: () => void;
  openDialog: () => void;
  syncStatus: () => Promise<void>;
}
```

**初始化**：
1. App 启动后 `syncStatus()` 拉取初始状态
2. 订阅 `update:status-changed`，事件触发时更新 store
3. `phase='available'` 且 `latestVersion` 不在 `skippedVersions` 中 → 自动 `set({ dialogOpen: true })`
4. 手动点"检查更新" → `checkForUpdates()` + `set({ dialogOpen: true })`（无论结果都弹窗）

### 5.2 UpdateDialog

根据 `phase` 显示不同内容：

- `available`：版本号 + release notes（`<pre className="whitespace-pre-wrap">` 显示原 markdown）+ 按钮"现在下载" / "跳过本次" / "不再提醒本版本"
- `downloading`：进度条 + 文案"下载中..."（按钮禁用，不支持取消）
- `downloaded`：按钮"安装并重启" / "稍后"
- `not-available`：文案"已是最新版本" + 按钮"关闭"
- `error`：错误信息 + 按钮"关闭"

**release notes 渲染**：直接 `<pre className="whitespace-pre-wrap">` 显示原 markdown 文本，不引入 markdown 渲染库（YAGNI）。

### 5.3 UpdateSection（设置页）

```
关于 / 更新
当前版本：v0.0.0-dev.20260729.1
最新版本：v0.0.0-dev.20260730.1（有更新）  ← 或"已是最新"
[检查更新]
```

- 显示 `currentVersion` + `latestVersion`（若有）
- "检查更新"按钮调用 `checkForUpdates()` + `openDialog()`
- 不显示下载进度（复杂操作走 UpdateDialog）

### 5.4 App.tsx 集成

```tsx
function App() {
  return (
    <>
      <RouterProvider router={router} />
      <UpdateDialog />
    </>
  );
}
```

## 6. CI/CD + 版本号策略

### 6.1 版本号格式

push 到 main 时 CI 自动生成 `0.0.0-dev.yyyyMMdd.run_number`，例如 `0.0.0-dev.20260730.42`。

- `0.0.0`：dev 阶段，无正式语义版本承诺
- `dev`：semver 预发布标识，`allowPrerelease=true` 可识别
- `yyyyMMdd.run_number`：单调递增，autoUpdater 可判断"新版本"

### 6.2 CI 注入版本号

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
```

版本号写入 CI checkout 后的 working copy，不 commit，仅影响本次 build。

### 6.3 electron-builder publish 配置

`electron-builder.yml` 的 `publish: null` 改为：

```yaml
publish:
  provider: github
  owner: Psychorayda
  repo: FIRE-APP
  releaseType: prerelease
```

### 6.4 CI workflow 改造

| 触发条件 | 行为 |
|---|---|
| push 到 main | 生成 dev 版本号 → build → electron-builder `--publish always` 自动上传 Pre-release |
| workflow_dispatch | 同 push 到 main |
| 打 tag `v*` | 暂不处理（dev 阶段无正式版） |

**关键改动**：
1. 移除 `softprops/action-gh-release` 步骤（electron-builder 自带上传）
2. `Package .exe` 步骤加 `--publish always`
3. 移除 `if: startsWith(github.ref, 'refs/tags/')` 条件
4. 在 build 之前加 `Generate pre-release version` 步骤

### 6.5 客户端配置

打包后 app 内 `resources/app-update.yml` 由 electron-builder 自动生成，包含 GitHub owner/repo。autoUpdater 启动时自动读取，无需手动 `setFeedURL`。

## 7. 测试策略

### 7.1 自动化（CI 门禁）

- `pnpm test:all` 全绿
- `pnpm --filter @fire-app/desktop build` 成功
- `pnpm --filter @fire-app/desktop dist` 成功（验证 publish 配置有效）

### 7.2 单元测试

- `update-manager.test.ts`：mock `electron-updater`，验证状态转换 + 跳过版本逻辑 + 持久化
- `useUpdateStore.test.ts`：mock IPC，验证状态同步 + dialogOpen 自动触发

### 7.3 手动 E2E（合并后首次发版验证）

1. push 到 main → CI 生成 `0.0.0-dev.20260730.X` → GitHub Releases 出现 Pre-release
2. 安装旧版本 .exe → 启动 → 10s 后自动弹 UpdateDialog 显示新版本
3. 点"现在下载" → 进度条推进 → 下载完成
4. 点"安装并重启" → 应用退出 → NSIS 安装 → 重启后是新版本
5. 设置页"检查更新" → 显示"已是最新"
6. 跳过版本 → 下次启动不弹窗

**测试约束**：electron-updater 在 `app.isPackaged=false`（dev 模式）下不工作，需用打包后的 .exe 测试。需准备两个版本：旧版本（已安装）+ 新版本（GitHub Releases 上）。

## 8. 风险与缓解

| 风险 | 缓解 |
|---|---|
| GitHub Releases 不可达（国内网络） | 启动检查失败静默不弹窗，仅手动检查时显示错误；未来可加镜像 |
| electron-builder `--publish always` 在 PR 分支触发时失败 | workflow 已限制 `branches: [main]`，PR 分支不触发 |
| 版本号写入 package.json 污染 git 状态 | CI 在 checkout 后写入，不 commit，仅影响本次 build |
| latest.yml 未上传导致 autoUpdater 找不到 | electron-builder 自动生成并上传，CI 日志可验证 |
| SmartScreen 警告（未签名） | 用户手动信任，文档说明 |
| electron-updater 无原生取消下载 API | phase='downloading' 时按钮禁用 + 文案"下载中..." |

## 9. 不在本范围（YAGNI）

- 代码签名（用户已选不签名）
- 多渠道（beta/alpha）
- 差量更新（electron-updater + NSIS 自带 block map）
- macOS / Linux 支持（当前只 Windows）
- 强制更新（critical update 机制）
- markdown 渲染库（release notes 用 `<pre>`）
- 取消下载（API 限制）
- 打 tag 触发正式版（dev 阶段无需求）

## 10. 验收标准

1. push 到 main → CI 自动生成预发布版本号 → GitHub Releases 出现 Pre-release（含 latest.yml + .exe）
2. 安装旧版本 .exe → 启动 10s 后自动弹 UpdateDialog 显示新版本
3. UpdateDialog 支持下载 + 进度显示 + 安装重启
4. 设置页显示当前版本 + 手动检查按钮
5. 跳过版本持久化生效，下次启动不弹窗
6. 24h 定时轮询正常工作
7. 网络失败时启动检查静默，手动检查显示错误
8. `pnpm test:all` 全绿（含新增单测）
9. `pnpm dist` 成功产出可发布 .exe
