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

- **Node.js 20.x LTS**（Electron 31 内置版本，避免 ABI 不匹配；**不要用 Node 22/24**）
- **pnpm** ≥ 9（安装：`npm install -g pnpm`）
- ⚠️ **不要放在 OneDrive 目录**（文件同步会导致原生模块编译失败，详见 [手动安装](docs/env-setup.md#onedrive-问题)）
- **Windows**: Visual Studio Build Tools（C++ 原生模块编译，仅 Node 22+ 需要；Node 20 有预编译包可跳过）
- **macOS**: Xcode Command Line Tools
- **Linux**: build-essential

### Node 版本管理（推荐 nvm）

```bash
nvm install 20.18.0    # 安装 Node 20 LTS（项目 .nvmrc 已指定）
nvm use 20.18.0        # 切换到 Node 20
```

## 快速开始

### 方式一：Docker 开发环境（推荐，零本地配置）

```bash
docker compose up dev    # 构建并启动开发容器
```

浏览器访问 `http://localhost:6080` 即可看到应用 GUI（noVNC web 访问）。

> 首次构建需 5-10 分钟（下载基础镜像 + 安装依赖 + 编译原生模块）。
> 后续启动秒级（镜像已缓存）。
> 详见 [Docker 开发环境文档](docs/docker-dev.md)。

### 方式二：本地开发环境

```bash
pnpm bootstrap  # 一键安装（自动检测环境 + 镜像 + 原生模块编译）
pnpm dev        # 启动开发模式
```

> 首次 clone 后推荐用 `pnpm bootstrap`，它会自动检测环境问题并给出修复命令。
> 若已安装过依赖，直接 `pnpm dev` 即可。
> 遇到环境问题可随时跑 `pnpm check-env` 诊断。

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

## 手动安装 / 故障排查

如果 `pnpm bootstrap` 失败，或遇到环境问题，详见 [手动安装文档](docs/env-setup.md)（含 OneDrive、Node 版本、SSL、ABI、文件锁定等 9 类问题的完整解决方案）。

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

> `.npmrc` 中的 `strict-ssl=false` 是为绕过 npmmirror 证书链问题，对官方源无影响。
> `better_sqlite3_binary_host_mirror` 用于加速 better-sqlite3 预编译二进制下载。
> 详细的镜像配置与故障排查见 [手动安装文档](docs/env-setup.md)。

## 开发文档

- [设计文档索引](docs/superpowers/specs/)
- [实施计划](docs/superpowers/plans/)
- [Code Wiki](docs/wiki/CODE_WIKI.md)
