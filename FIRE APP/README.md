# FIRE 计算APP

基于 Electron + React 19 的个人财务独立（FIRE）计算桌面应用。

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Electron | 31 | 桌面应用框架 |
| React | 19 | UI 渲染 |
| Zustand | 5 | 状态管理 |
| better-sqlite3 | 11 | 本地 SQLite 数据库 |
| Tailwind CSS | 4 | 样式 |
| electron-vite | 2 | 构建工具 |
| pnpm | 9+ | 包管理（workspace 模式） |

## 环境要求

- **Node.js** ≥ 20
- **pnpm** ≥ 9（安装：`npm install -g pnpm`）
- **Windows**: Visual Studio Build Tools（C++ 原生模块编译）
- **macOS**: Xcode Command Line Tools
- **Linux**: build-essential

## 快速开始

```bash
pnpm install    # 安装依赖（含自动 rebuild 原生模块）
pnpm dev        # 启动开发模式
```

## 常用命令

| 命令 | 作用 |
|------|------|
| `pnpm dev` | 启动 Electron 开发模式 |
| `pnpm build` | 构建桌面应用 |
| `pnpm test:shared` | 运行 shared 包测试 |
| `pnpm --filter @fire-app/desktop rebuild` | 手动重新编译原生模块 |

## 项目结构

```
FIRE APP/
├── apps/desktop/          # Electron 桌面应用
│   ├── src/main/          # 主进程（DB 管理、IPC handler）
│   ├── src/preload/       # Preload 脚本（contextBridge）
│   └── src/renderer/      # 渲染进程（React + Zustand）
├── packages/shared/       # 共享代码包
│   └── src/               # db, models, services, types, utils
├── docs/                  # 设计文档与 Code Wiki
├── .npmrc                 # Electron 镜像源配置
├── pnpm-workspace.yaml    # Workspace 配置
└── package.json           # Monorepo 根配置
```

## 故障排查

### 1. pnpm 未安装

**症状：** `pnpm : 无法将"pnpm"项识别为 cmdlet...`

**解决方案：**
```bash
npm install -g pnpm
```

### 2. Electron 下载慢或失败

**症状：** `pnpm install` 卡在 Electron 下载，或报网络超时

**原因：** Electron 二进制从 GitHub 下载，国内网络可能受限

**解决方案：** 项目已配置 `.npmrc` 镜像源。若仍失败，手动设置环境变量：
```powershell
# PowerShell
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
```

### 3. better-sqlite3 ABI 不匹配

**症状：** `Error: The module was compiled against a different Node.js version using NODE_MODULE_VERSION 137`

**原因：** better-sqlite3 针对系统 Node.js 编译，但 Electron 使用不同的 Node.js ABI

**解决方案：**
```bash
pnpm --filter @fire-app/desktop rebuild
```

### 4. preload 未加载（window.dataAccess undefined）

**症状：** `Cannot read properties of undefined (reading 'user')`

**原因：** Electron 31 默认 `sandbox: true`，preload 使用 externalizeDepsPlugin 需关闭沙箱

**解决方案：** 确认 `apps/desktop/src/main/index.ts` 中 `webPreferences.sandbox` 为 `false`

### 5. pnpm build scripts 被拦截

**症状：** `ERR_PNPM_IGNORED_BUILDS: Ignored build scripts: better-sqlite3, electron, esbuild`

**原因：** pnpm 11 默认阻止依赖执行 install scripts

**解决方案：** `pnpm-workspace.yaml` 中已配置 `onlyBuiltDependencies`。若仍报错，运行 `pnpm approve-builds`

### 6. minimumReleaseAge 拦截

**症状：** `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`

**原因：** pnpm 11 供应链安全策略拒绝最近发布的包

**解决方案：** `pnpm-workspace.yaml` 中已配置 `minimumReleaseAge: 0`

## 镜像配置说明

项目根目录 `.npmrc` 配置了 Electron 和 electron-builder 的国内镜像源：

- `electron_mirror` — Electron 二进制下载地址
- `electron_builder_binaries_mirror` — electron-builder 打包工具下载地址

海外开发者如需使用官方源，删除 `.npmrc` 中对应行即可，不影响 npm registry。

## 开发文档

- [设计文档索引](docs/superpowers/specs/)
- [实施计划](docs/superpowers/plans/)
- [Code Wiki](docs/wiki/CODE_WIKI.md)
