# 验证后修复与文档更新设计

> **触发事件：** Task 8 端到端验证中发现 6 个环境/配置问题
> **目标：** 更新项目文档和代码，分析潜在类似问题并给出预防方案
> **运行环境：** Windows（开发）+ Linux（工作区）

---

## 1. 背景

Task 8 端到端验证过程中发现并修复了 6 个问题：

| 编号 | 问题 | 已修复方式 |
|------|------|-----------|
| 1 | pnpm 未安装 | `npm install -g pnpm` |
| 2 | `pnpm.onlyBuiltDependencies` 弃用 | 迁移到 `pnpm-workspace.yaml` |
| 3 | `minimumReleaseAge` 策略拦截 | 添加 `minimumReleaseAge: 0` |
| 4 | Electron 二进制未下载 | 使用 npmmirror 镜像手动安装 |
| 5 | better-sqlite3 ABI 不匹配 | `npx @electron/rebuild -f` |
| 6 | preload 脚本未加载（sandbox） | 添加 `sandbox: false` |

问题 2、3、6 的代码修复已提交。本次设计覆盖：将所有修复固化为项目配置、同步文档、创建 README、分析潜在问题。

---

## 2. 更新方案

采用**分类分组更新**，4 个独立提交，每个有明确职责。

---

## 3. 提交 1：配置修复

### 3.1 新建 `.npmrc`（项目根目录）

```
electron_mirror=https://npmmirror.com/mirrors/electron/
electron_builder_binaries_mirror=https://npmmirror.com/mirrors/electron-builder-binaries/
```

**作用：** Electron 二进制和 electron-builder 打包工具从国内镜像下载。提交后所有开发者 `pnpm install` 时自动生效，无需手动设环境变量。

**影响范围：** 仅影响 Electron 二进制下载地址，不影响 npm registry 地址。海外开发者访问 npmmirror 也能正常工作。

### 3.2 添加 `@electron/rebuild` 依赖和脚本

**文件：** `apps/desktop/package.json`

- devDependencies 添加：`"@electron/rebuild": "^3.6.0"`
- scripts 添加：`"rebuild": "electron-rebuild -f"`

**文件：** 根 `package.json`

- scripts 添加：`"postinstall": "pnpm --filter @fire-app/desktop rebuild"`

**作用：** `pnpm install` 后自动触发 `electron-rebuild`，将 better-sqlite3 针对当前 Electron 版本重新编译。避免手动执行 `npx @electron/rebuild -f`。

**容错设计：** postinstall 失败时 pnpm 会警告但不中止 install。开发者可手动 `pnpm --filter @fire-app/desktop rebuild`。

### 3.3 删除旧 lock 文件

**文件：** `fire-app/package-lock.json`

删除此文件。`fire-app/` 是 monorepo 迁移前的旧项目残留，其 `package-lock.json` 与根 `pnpm-lock.yaml` 共存可能引起混淆。

---

## 4. 提交 2：文档对齐

更新 3 份设计文档，使其与代码实际状态一致。**代码是事实来源，文档向代码对齐。**

### 4.1 `2026-07-15-fire-app-initialization-design.md`

| 位置 | 原内容 | 修改为 |
|------|--------|--------|
| §安全配置 | `sandbox: true` | `sandbox: false`，添加注释：preload 使用 externalizeDepsPlugin 需关闭沙箱 |
| §preload 路径 | `preload/index.js` | `preload/index.mjs`，说明 ESM 模式下 electron-vite 产物为 .mjs |

### 4.2 `2026-07-15-fire-app-frontend-architecture-design.md`

| 位置 | 原内容 | 修改为 |
|------|--------|--------|
| §安全策略 | `sandbox: true` + "沙箱模式" | `sandbox: false`，更新安全策略描述 |
| §IPC 桥 | `window.api` | `window.dataAccess` |
| §preload 路径 | `preload/index.js` | `preload/index.mjs` |

### 4.3 `2026-07-15-fire-app-desktop-mvp-milestone1.md`

| 位置 | 原内容 | 修改为 |
|------|--------|--------|
| §preload 路径 | `preload/index.js` | `preload/index.mjs` |

**安全说明：** `sandbox: false` + `contextIsolation: true` + `nodeIntegration: false` 仍是安全配置组合。contextIsolation 保证渲染进程与 preload 上下文隔离，渲染进程无法直接访问 Node.js API。

---

## 5. 提交 3：README 创建

创建项目根目录 `README.md`，章节结构：

### 5.1 项目简介
FIRE 计算APP — 基于 Electron + React 19 的个人财务独立(FIRE)计算桌面应用。

### 5.2 技术栈
Electron 31, React 19, Zustand 5, better-sqlite3 11, Tailwind CSS 4, electron-vite 2, pnpm workspace

### 5.3 环境要求
- Node.js ≥ 20
- pnpm ≥ 9（安装命令：`npm install -g pnpm`）
- Windows: Visual Studio Build Tools（C++ 原生模块编译）
- macOS: Xcode Command Line Tools
- Linux: build-essential

### 5.4 快速开始
```bash
pnpm install    # 安装依赖（含自动 rebuild 原生模块）
pnpm dev        # 启动开发模式
```

### 5.5 常用命令
| 命令 | 作用 |
|------|------|
| `pnpm dev` | 启动 Electron 开发模式 |
| `pnpm build` | 构建桌面应用 |
| `pnpm test:shared` | 运行 shared 包测试 |
| `pnpm --filter @fire-app/desktop rebuild` | 手动重新编译原生模块 |

### 5.6 项目结构
```
FIRE APP/
├── apps/desktop/          # Electron 桌面应用
│   ├── src/main/          # 主进程
│   ├── src/preload/       # Preload 脚本
│   └── src/renderer/      # 渲染进程（React）
├── packages/shared/       # 共享代码包
│   └── src/               # db, models, services, types, utils
├── docs/                  # 设计文档与 Code Wiki
└── pnpm-workspace.yaml    # Workspace 配置
```

### 5.7 故障排查
6 个已知问题及解决方案，每个含：症状、原因、解决方案。

1. **pnpm 未安装** → `npm install -g pnpm`
2. **Electron 下载慢/失败** → .npmrc 镜像源已配置；手动设置 `$env:ELECTRON_MIRROR`
3. **better-sqlite3 ABI 不匹配** → `pnpm --filter @fire-app/desktop rebuild`
4. **preload 未加载（window.dataAccess undefined）** → 确认 `sandbox: false`
5. **pnpm build scripts 被拦截** → `pnpm-workspace.yaml` 中 `onlyBuiltDependencies` 已配置
6. **minimumReleaseAge 拦截** → `pnpm-workspace.yaml` 中 `minimumReleaseAge: 0` 已配置

### 5.8 镜像配置说明
说明 `.npmrc` 中镜像源的作用，以及海外开发者如何自定义。

---

## 6. 提交 4：验证文档更新 + 潜在问题分析

### 6.1 更新验证设计文档

**文件：** `2026-07-15-fire-app-task8-verification-design.md`

- 阶段 0 补充"实际遇到的问题"小节，记录 6 个问题及解决过程
- 阶段 4 更新 DB 路径：`@fire-app/desktop`（实际 app name）替代 `fire-app-desktop`（计划值）

### 6.2 更新验证执行计划

**文件：** `2026-07-15-fire-app-task8-verification-execution.md`

- 阶段 0 步骤更新：添加 pnpm 安装检查、.npmrc 验证
- 阶段 4 DB 路径更新
- 添加附录"已知问题与解决方案"

### 6.3 新建潜在问题分析文档

**文件：** `docs/superpowers/specs/2026-07-15-fire-app-known-issues-analysis.md`

| 编号 | 潜在问题 | 严重程度 | 预防方案 | 状态 |
|------|----------|----------|----------|------|
| 1 | 新开发者 pnpm 未安装 | 中 | README 环境要求 + 安装命令 | 本次修复 |
| 2 | Electron 二进制下载慢/失败 | 高 | .npmrc 镜像源配置 | 本次修复 |
| 3 | better-sqlite3 ABI 不匹配 | 高 | postinstall 自动 rebuild | 本次修复 |
| 4 | preload 脚本未加载（sandbox） | 高 | sandbox: false + 文档说明 | 已修复 |
| 5 | pnpm 11 build scripts 拦截 | 中 | pnpm-workspace.yaml onlyBuiltDependencies | 已修复 |
| 6 | pnpm 11 minimumReleaseAge 拦截 | 中 | pnpm-workspace.yaml minimumReleaseAge: 0 | 已修复 |
| 7 | createDatabase 默认相对路径误用 | 低 | 建议移除默认值或改为抛错 | 建议 |
| 8 | 文档与代码不一致 | 中 | 本次文档对齐 + 建议建立文档 review 流程 | 本次修复 |

---

## 7. 文件变更清单

| 操作 | 文件路径 | 提交 |
|------|----------|------|
| 新建 | `.npmrc` | 1 |
| 修改 | `apps/desktop/package.json` | 1 |
| 修改 | `package.json` | 1 |
| 删除 | `fire-app/package-lock.json` | 1 |
| 修改 | `docs/superpowers/specs/2026-07-15-fire-app-initialization-design.md` | 2 |
| 修改 | `docs/superpowers/specs/2026-07-15-fire-app-frontend-architecture-design.md` | 2 |
| 修改 | `docs/superpowers/plans/2026-07-15-fire-app-desktop-mvp-milestone1.md` | 2 |
| 新建 | `README.md` | 3 |
| 修改 | `docs/superpowers/specs/2026-07-15-fire-app-task8-verification-design.md` | 4 |
| 修改 | `docs/superpowers/plans/2026-07-15-fire-app-task8-verification-execution.md` | 4 |
| 新建 | `docs/superpowers/specs/2026-07-15-fire-app-known-issues-analysis.md` | 4 |
