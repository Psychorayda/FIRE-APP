# 自动更新下载加速设计

**日期**：2026-07-30
**状态**：已批准，待实施
**关联**：M9 加固 / Electron 36 升级 / 自动更新功能

## 背景与问题

当前自动更新链路依赖 electron-updater 的 `autoUpdater.downloadUpdate()`，直接从 GitHub Releases 下载安装包。实际下载会 302 重定向到 `objects.githubusercontent.com`（美国 CDN），国内直连存在两个问题：

1. **下载速度慢**：90MB 安装包，国内直连速度受限，下载耗时 5-30 分钟
2. **下载中断**：弱网下容易超时断流，已实际触发 `net_error`，导致更新失败

已验证的根因（通过诊断脚本确认）：
- DNS 解析正常（`github.com` → 真实 IP，非劫持）
- latest.yml 下载正常（365 字节小文件，不触发断流）
- exe 下载在弱网下断流（90MB 大文件，连接被重置）

## 设计目标

- **免费**：仅自用/少量用户，零成本
- **鲁棒**：多镜像轮询 + 断点续传，单点失败可自动切换
- **透明**：IPC 接口不变，renderer 零改动
- **可回滚**：单次提交即可回退到 electron-updater 原生下载

## 方案：自定义下载器（替换 electron-updater 下载阶段）

### 职责切分

- **保留** electron-updater 的 `checkForUpdates()`：负责 latest.yml 解析 + 版本比较 + releaseNotes 提取
- **替换** `downloadUpdate()` 为自研 `DownloadManager`：多镜像轮询 + 断点续传 + 进度回调
- **替换** `quitAndInstall()` 为自研 `InstallRunner`：调用 NSIS 安装包静默安装 + 重启

latest.yml 仍从 GitHub 官方拉取（小文件不会断流），仅 exe 下载走镜像加速。

## 架构

新增 3 个模块到 `apps/desktop/src/main/updater/`（注意是 `updater/` 不是 `update/`，避免与现有 `ipc/update-handlers.ts` 语义混淆），与现有 `update-manager.ts` 并列：

```
apps/desktop/src/main/
├── update-manager.ts          (改造：保留 check/skip 逻辑，download/install 委托给 DownloadManager/InstallRunner)
├── ipc/
│   └── update-handlers.ts     (现有：IPC 通道注册，不改)
└── updater/                   (新增：自研下载/安装子模块)
    ├── download-manager.ts    (新增：多镜像轮询 + 断点续传 + 进度回调)
    ├── mirror-registry.ts     (新增：镜像列表管理 + 健康状态)
    └── install-runner.ts      (新增：调用 NSIS 安装包静默安装 + 重启)
```

| 模块 | 职责 | 不做什么 |
|------|------|----------|
| `UpdateManager` | 检查更新、状态同步、跳过版本、调度下载/安装 | 不直接发 HTTP 请求 |
| `DownloadManager` | 多镜像轮询、断点续传、进度上报、临时文件管理 | 不解析 latest.yml、不比较版本 |
| `MirrorRegistry` | 维护镜像列表、URL 改写、健康标记 | 不发下载请求 |
| `InstallRunner` | 启动 NSIS 安装包、退出当前进程 | 不下载文件 |

### 数据流

```
UpdateManager.checkForUpdates()
  └─ autoUpdater.checkForUpdates()  (electron-updater 负责 latest.yml + 版本比较)
  └─ 监听 'update-available' 事件，从 UpdateInfo 提取下载元数据并缓存：
       UpdateInfo.files[0].url   → exeUrl (相对路径，需拼接 releaseBaseUrl)
       UpdateInfo.files[0].sha512 → sha512
       UpdateInfo.files[0].size   → expectedSize
     完整 exeUrl = releaseBaseUrl + files[0].url
     （releaseBaseUrl 由 electron-updater 根据 publish 配置自动生成）

UpdateManager.downloadUpdate()
  └─ MirrorRegistry.rewrite(exeUrl) → [mirror1, mirror2, github]
  └─ DownloadManager.start(urls, sha512, size, tmpPath)
       └─ 逐个镜像尝试，支持断点续传，失败切下一个
       └─ 完成后校验 sha512
  └─ status: downloading(进度) → downloaded

UpdateManager.installUpdate()
  └─ InstallRunner.run(installerPath)
       └─ spawn NSIS 安装包 /S 静默安装
       └─ app.relaunch() + 延迟退出重启
```

**UpdateInfo 字段说明**：electron-updater 的 `update-available` 事件回调参数 `UpdateInfo` 包含 `files: Array<{ url, sha512, size }>`。`url` 是相对路径（如 `FIRE-App-Setup-0.1.1-dev.49.exe`），需拼接 release base URL 才是完整下载地址。UpdateManager 在事件回调中缓存这些元数据，供 downloadUpdate 使用。

## 镜像列表与 URL 改写

### 镜像列表（硬编码，按优先级排序）

| 优先级 | 镜像 id | 改写规则 | 说明 |
|------|------|----------|------|
| 1 | `ghproxy` | `https://github.com/{owner}/{repo}/...` → `https://ghproxy.com/https://github.com/{owner}/{repo}/...` | 老牌免费代理，国内速度好 |
| 2 | `gh-proxy` | `https://github.com/...` → `https://gh-proxy.com/https://github.com/...` | 备选，ghproxy 挂时顶上 |
| 3 | `github` | 原始 URL，不改写 | 兜底，慢但稳定 |

latest.yml 不改写：始终从 GitHub 官方拉（365 字节，不会断流），避免镜像缓存延迟导致版本信息滞后。

### MirrorRegistry 接口

```typescript
interface Mirror {
  id: string;                        // 'ghproxy' | 'gh-proxy' | 'github'
  name: string;                      // 显示名
  rewrite: (url: string) => string;  // URL 改写
}

interface MirrorHealth {
  id: string;
  consecutiveFailures: number;       // 连续失败次数
  lastFailureAt?: number;            // 最近失败时间
  disabledUntil?: number;            // 熔断到何时（指数退避）
}

class MirrorRegistry {
  getDownloadOrder(): Mirror[];            // 健康镜像在前，被熔断的排到后面
  markFailed(mirrorId: string): void;      // 连续失败触发熔断
  markSuccess(mirrorId: string): void;     // 成功一次清除计数
}
```

### 熔断策略

- 单次失败：计数 +1
- 连续失败 2 次：熔断 5 分钟（`disabledUntil = now + 5min`）
- 熔断期间不优先使用，但作为最后兜底仍可尝试（所有镜像都在熔断时全部重试）
- 成功一次：清除计数，恢复优先级

镜像列表硬编码（不做用户配置），原因：仅自用，无需用户自定义；避免配置 UI 和持久化逻辑；后续镜像变更通过发版更新。

## 下载器与断点续传

### DownloadManager 核心流程

```
download(exeUrl, sha512, expectedSize, destPath):
  1. mirrors = MirrorRegistry.getDownloadOrder()
  2. 已有部分文件？读 currentSize → 用于 Range 请求续传
  3. for mirror in mirrors:
       try:
         result = await downloadFromMirror(mirror, exeUrl, currentSize, destPath)
         if sha512(destPath) === sha512: return SUCCESS
         else: 删部分文件，继续下一个镜像
       catch:
         MirrorRegistry.markFailed(mirror.id)
         currentSize = fileSize(destPath)  // 保留已下部分，下个镜像续传
         continue
  4. 所有镜像失败 → 抛 ERROR，UI 显示"下载失败，请重试"
```

### 断点续传实现

用 Node 原生 `https` 模块（不用 Electron net，避免 Chromium 证书校验问题）：

- **Range 请求**：`Range: bytes={currentSize}-` 续传
- **追加写入**：`fs.createWriteStream(path, { flags: 'a' })` 追加模式
- **镜像必须支持 Range**：ghproxy / gh-proxy 都支持（本质是转发 GitHub 的 206）
- **不支持 Range 的镜像**：HTTP 200 响应 → 删除已有部分，从头下（记日志）

### 进度回调

```typescript
emit('progress', {
  totalBytes,
  downloadedBytes,  // 含续传部分
  percent,          // 0-100
  bytesPerSecond,   // 实时速度
  mirrorId,         // 当前镜像
});
```

`UpdateManager` 把 progress 转成现有 `UpdateStatus.downloadProgress`，UI 无需改动。

### 超时与中止

- **连接超时**：30 秒无响应 → 切镜像
- **速度超时**：连续 60 秒下载速度 < 10 KB/s → 切镜像（防卡死）
- **用户取消**：`abortController.abort()` → 中止当前请求，保留已下部分

### SHA512 校验

下载完成后必须校验，防止镜像篡改或传输损坏：

- 匹配 → 标记镜像 `markSuccess`，触发 `downloaded` 状态
- 不匹配 → 删除文件，标记镜像 `markFailed`，切下一个

### 临时文件管理

- 下载到 `%APPDATA%\fire-app\update-cache\FIRE-App-Setup-{version}.exe.partial`
- 校验通过 → 重命名为 `.exe`（去掉 `.partial`）
- 安装完成（或下次启动检查更新发现已是最新）→ 清理旧版本缓存

## 安装运行器

### InstallRunner

NSIS 安装包支持 `/S` 静默安装参数：

```typescript
class InstallRunner {
  run(installerPath: string): void {
    // spawn 安装程序 → relaunch（延迟）→ quit
    spawn(installerPath, ['/S'], { detached: true, stdio: 'ignore' }).unref();

    // 延迟 3 秒后重启（给安装程序时间完成覆盖）
    setTimeout(() => {
      app.relaunch();
      app.exit(0);  // 用 exit(0) 而非 quit()，跳过 before-quit 钩子，避免数据库关闭竞争
    }, 3000);
  }
}
```

**自动重启方案**：`relaunch + 3s 延迟`。简单可用，如果出现重启失败，再升级到 NSIS `MUI_FINISHPAGE_RUN`（需自定义 NSIS 脚本，增加复杂度）。

## IPC 与状态

### IPC 通道（保持现有接口不变）

现有 5 个 IPC 通道完全保留，renderer 代码零改动：

| IPC 通道 | 改造前 | 改造后 |
|---------|--------|--------|
| `update:check` | `autoUpdater.checkForUpdates()` | 不变 |
| `update:download` | `autoUpdater.downloadUpdate()` | `DownloadManager.download()` |
| `update:install` | `autoUpdater.quitAndInstall()` | `InstallRunner.run()` |
| `update:skipVersion` | 不变 | 不变 |
| `update:getStatus` | 不变 | 不变 |
| `update:status-changed` 事件 | 不变 | 不变 |

### 状态扩展

`UpdateStatus` 新增 2 个可选字段：

```typescript
interface UpdateStatus {
  // ...现有字段
  downloadMirror?: string;    // 当前下载镜像 id
  retryCount?: number;        // 已重试次数
}
```

现有 UI 不读这两个字段就不显示，向后兼容。

## 错误处理

| 场景 | 处理 | UI 表现 |
|------|------|---------|
| latest.yml 下载失败 | electron-updater 内部重试，最终失败 → `phase: error` | "检查更新失败，请检查网络" |
| 所有镜像下载失败 | 抛 ERROR，保留 `.partial` 文件 | "下载失败，已尝试 N 个镜像。点击重试" |
| SHA512 校验失败 | 删文件，切下一个镜像；全失败 → ERROR | "下载文件校验失败，请重试" |
| 单镜像连接超时 | 切下一个镜像，保留 `.partial` 续传 | 进度条不回退，UI 无感知切换 |
| 单镜像速度超时 | 切下一个镜像，保留 `.partial` 续传 | 同上 |
| 安装程序启动失败 | 记日志，UI 报错 | "安装失败，请手动运行安装包：{path}" |
| 安装后重启失败 | 应用已退出，用户手动启动 | 桌面快捷方式仍存在，用户可手动打开 |

关键原则：

- 下载失败保留 `.partial`，用户重试时从断点继续
- 镜像切换对 UI 透明，不弹"切换镜像"提示（避免打扰）
- 安装失败暴露安装包路径，让用户能手动双击安装

## 测试策略

### 单元测试（vitest，纯逻辑，无网络）

1. `MirrorRegistry`：URL 改写正确性、熔断触发与恢复、优先级排序
2. `DownloadManager`：续传偏移量计算、SHA512 校验逻辑、镜像切换决策（mock https 模块）
3. `InstallRunner`：参数构造、relaunch 时机（mock child_process）

### 集成测试（vitest，mock HTTP）

4. 完整下载流程：镜像 1 失败 → 镜像 2 续传成功 → 校验通过
5. 全失败场景：所有镜像失败 → 抛 ERROR + 保留 .partial

### 手动 E2E（Windows 验证，非自动化）

6. 安装 dev.54 → 触发更新到 dev.55 → 观察下载速度 + 镜像切换 + 安装重启

## 回滚方案

如果方案上线后出现严重问题，回滚路径：

1. **代码回滚**：git revert 本次改动，恢复 electron-updater 原生 `downloadUpdate()`
2. **快速修复**：如果只是某个镜像不稳定，从 `MirrorRegistry` 镜像列表移除该镜像，发版
3. **完全回退**：如果自研下载器整体不可靠，恢复到 electron-updater 原生下载（慢但能用）

风险评估：

- 最大风险点是断点续传 + 多镜像组合，复杂度集中在 `DownloadManager`
- 通过单元测试覆盖核心逻辑 + 手动 E2E 验证，风险可控
- 回滚成本低，git revert 一次提交即可

## 实施顺序

1. `mirror-registry.ts` + 单测
2. `download-manager.ts` + 单测
3. `install-runner.ts` + 单测
4. 改造 `update-manager.ts`（集成上述 3 个模块）
5. 手动 E2E 验证
