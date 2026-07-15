# 验证后修复与文档更新 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Task 8 验证中发现的 6 个问题的修复固化为项目配置，同步设计文档与代码，创建 README，并分析潜在问题。

**Architecture:** 4 个独立提交，按职责分类：配置修复 → 文档对齐 → README → 验证文档更新。代码是事实来源，文档向代码对齐。

**Tech Stack:** pnpm 11 workspace, Electron 31, electron-vite 2, better-sqlite3 11

**Spec:** `docs/superpowers/specs/2026-07-15-fire-app-post-verification-fixes-design.md`

---

## 文件结构

| 操作 | 文件路径 | 职责 | 所属提交 |
|------|----------|------|----------|
| 新建 | `.npmrc` | Electron 镜像源配置 | 1 |
| 修改 | `apps/desktop/package.json` | 添加 @electron/rebuild 依赖和脚本 | 1 |
| 修改 | `package.json` | 添加 postinstall 脚本 | 1 |
| 删除 | `fire-app/package-lock.json` | 清理旧 lock 文件 | 1 |
| 修改 | `docs/.../initialization-design.md` | sandbox + preload 路径对齐 | 2 |
| 修改 | `docs/.../frontend-architecture-design.md` | sandbox + window.api + preload 路径对齐 | 2 |
| 修改 | `docs/.../desktop-mvp-milestone1.md` | preload 路径对齐 | 2 |
| 新建 | `README.md` | 项目说明 + 环境搭建 + 故障排查 | 3 |
| 修改 | `docs/.../task8-verification-design.md` | 更新实际遇到的问题 + DB 路径 | 4 |
| 修改 | `docs/.../task8-verification-execution.md` | 更新 DB 路径 + 添加附录 | 4 |
| 新建 | `docs/.../known-issues-analysis.md` | 潜在问题分析文档 | 4 |

---

### Task 1: 配置修复

**Files:**
- Create: `.npmrc`
- Modify: `apps/desktop/package.json`
- Modify: `package.json`
- Delete: `fire-app/package-lock.json`

- [ ] **Step 1: 创建 `.npmrc` 文件**

在项目根目录创建 `.npmrc`：

```
electron_mirror=https://npmmirror.com/mirrors/electron/
electron_builder_binaries_mirror=https://npmmirror.com/mirrors/electron-builder-binaries/
```

- [ ] **Step 2: 修改 `apps/desktop/package.json` — 添加 rebuild 依赖和脚本**

在 `scripts` 中添加 `rebuild` 脚本，在 `devDependencies` 中添加 `@electron/rebuild`。

将：
```json
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview"
  },
```
改为：
```json
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "rebuild": "electron-rebuild -f"
  },
```

在 `devDependencies` 中添加（按字母序插入 `@electron/rebuild` 在 `@tailwindcss/vite` 之前）：
```json
    "@electron/rebuild": "^3.6.0",
```

- [ ] **Step 3: 修改根 `package.json` — 添加 postinstall 脚本**

将：
```json
  "scripts": {
    "dev": "pnpm --filter @fire-app/desktop dev",
    "build": "pnpm --filter @fire-app/desktop build",
    "test:shared": "pnpm --filter @fire-app/shared test"
  },
```
改为：
```json
  "scripts": {
    "dev": "pnpm --filter @fire-app/desktop dev",
    "build": "pnpm --filter @fire-app/desktop build",
    "test:shared": "pnpm --filter @fire-app/shared test",
    "postinstall": "pnpm --filter @fire-app/desktop rebuild"
  },
```

- [ ] **Step 4: 删除旧 lock 文件**

删除 `fire-app/package-lock.json`。

- [ ] **Step 5: 验证 .npmrc 不被 .gitignore 排除**

Run: `git check-ignore .npmrc`
Expected: 无输出（表示文件未被忽略）

> 如果输出 `.npmrc`，需检查 `.gitignore` 是否有匹配规则。当前 `.gitignore` 不包含 `.npmrc` 排除规则，应无问题。

- [ ] **Step 6: 提交**

```bash
git add .npmrc apps/desktop/package.json package.json
git rm fire-app/package-lock.json
git commit -m "chore: 添加 .npmrc 镜像源 + electron-rebuild 自动编译 + 清理旧 lock 文件"
```

---

### Task 2: 文档对齐

**Files:**
- Modify: `docs/superpowers/specs/2026-07-15-fire-app-initialization-design.md`
- Modify: `docs/superpowers/specs/2026-07-15-fire-app-frontend-architecture-design.md`
- Modify: `docs/superpowers/plans/2026-07-15-fire-app-desktop-mvp-milestone1.md`

- [ ] **Step 1: 修改 `initialization-design.md` — 第一处 sandbox + preload 路径（约第 585-588 行）**

将：
```typescript
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
```
改为：
```typescript
      preload: path.join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,  // preload 使用 externalizeDepsPlugin，需关闭沙箱
```

- [ ] **Step 2: 修改 `initialization-design.md` — 第二处 sandbox + preload 路径（约第 1145-1148 行）**

将：
```typescript
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
```
改为：
```typescript
      preload: path.join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,  // preload 使用 externalizeDepsPlugin，需关闭沙箱
```

- [ ] **Step 3: 修改 `frontend-architecture-design.md` — 设计原则表 sandbox（第 24 行）**

将：
```
| **安全优先** | contextIsolation: true, nodeIntegration: false, sandbox: true，所有跨进程通信经 preload 白名单 |
```
改为：
```
| **安全优先** | contextIsolation: true, nodeIntegration: false, sandbox: false，所有跨进程通信经 preload 白名单 |
```

- [ ] **Step 4: 修改 `frontend-architecture-design.md` — 安全配置代码块（第 94-97 行）**

将：
```typescript
    preload: path.join(__dirname, '../preload/index.js'),
    contextIsolation: true,      // 上下文隔离：渲染进程无法访问 preload 内部作用域
    nodeIntegration: false,       // 禁用 Node.js 集成：渲染进程无 require/import
    sandbox: true,                // 沙箱模式：限制 preload 可用的 Node API
```
改为：
```typescript
    preload: path.join(__dirname, '../preload/index.mjs'),
    contextIsolation: true,      // 上下文隔离：渲染进程无法访问 preload 内部作用域
    nodeIntegration: false,       // 禁用 Node.js 集成：渲染进程无 require/import
    sandbox: false,               // 关闭沙箱：preload 使用 externalizeDepsPlugin 需访问 Node API
```

- [ ] **Step 5: 修改 `frontend-architecture-design.md` — 技术选型说明（第 109 行）**

将：
```
2. 相比手动配置 Vite + electron-forge，electron-vite 减少了约 60% 的配置代码，且内置了对 `contextIsolation`、`sandbox` 的正确处理。
```
改为：
```
2. 相比手动配置 Vite + electron-forge，electron-vite 减少了约 60% 的配置代码，且内置了对 `contextIsolation`、preload 的正确处理。
```

- [ ] **Step 6: 修改 `frontend-architecture-design.md` — 全文 `window.api` 替换为 `window.dataAccess`**

使用 `replace_all` 将文件中所有 `window.api` 替换为 `window.dataAccess`。

> 注意：文件中约 15 处 `window.api` 引用，包括架构图、数据流描述、文件结构、ADR 等位置。全部替换为 `window.dataAccess`。

- [ ] **Step 7: 修改 `frontend-architecture-design.md` — ADR-009（第 1307 行）**

将：
```
| ADR-009 | 进程隔离策略 | contextIsolation + sandbox + preload contextBridge | Electron 安全最佳实践，渲染进程无法直接访问 Node API | 2026-07-15 |
```
改为：
```
| ADR-009 | 进程隔离策略 | contextIsolation + sandbox: false + preload contextBridge | preload 使用 externalizeDepsPlugin 需关闭沙箱，contextIsolation 仍保证隔离 | 2026-07-15 |
```

- [ ] **Step 8: 修改 `desktop-mvp-milestone1.md` — preload 路径（约第 547 行）**

将：
```typescript
      preload: join(__dirname, '../preload/index.js'),
```
改为：
```typescript
      preload: join(__dirname, '../preload/index.mjs'),
```

- [ ] **Step 9: 提交**

```bash
git add docs/superpowers/specs/2026-07-15-fire-app-initialization-design.md docs/superpowers/specs/2026-07-15-fire-app-frontend-architecture-design.md docs/superpowers/plans/2026-07-15-fire-app-desktop-mvp-milestone1.md
git commit -m "docs: 设计文档与代码对齐（sandbox: false, preload .mjs, window.dataAccess）"
```

---

### Task 3: README 创建

**Files:**
- Create: `README.md`

- [ ] **Step 1: 创建 `README.md`**

在项目根目录创建 `README.md`，完整内容如下：

````markdown
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
````

- [ ] **Step 2: 提交**

```bash
git add README.md
git commit -m "docs: 创建项目 README（含环境搭建指南和故障排查）"
```

---

### Task 4: 验证文档更新 + 潜在问题分析

**Files:**
- Modify: `docs/superpowers/specs/2026-07-15-fire-app-task8-verification-design.md`
- Modify: `docs/superpowers/plans/2026-07-15-fire-app-task8-verification-execution.md`
- Create: `docs/superpowers/specs/2026-07-15-fire-app-known-issues-analysis.md`

- [ ] **Step 1: 修改 `task8-verification-design.md` — DB 路径替换**

使用 `replace_all` 将文件中所有 `fire-app-desktop` 替换为 `@fire-app/desktop`。

> 文件中约 7 处 `fire-app-desktop` 引用（阶段 4 的 PowerShell 命令路径、故障排查说明、重置命令），全部替换为 `@fire-app/desktop`。

- [ ] **Step 2: 修改 `task8-verification-design.md` — 阶段 0 添加"实际遇到的问题"小节**

在阶段 0 的故障排查之后（"## 阶段 1" 之前），插入以下内容：

```markdown
### 实际遇到的问题（验证记录）

在 Windows 环境实际执行阶段 0 时，遇到了以下 6 个问题：

1. **pnpm 未安装** — 系统只有 npm，需先 `npm install -g pnpm`
2. **pnpm.onlyBuiltDependencies 弃用** — pnpm 11 不再读取 package.json 中的 `pnpm` 字段，需迁移到 `pnpm-workspace.yaml`
3. **minimumReleaseAge 拦截** — pnpm 11 供应链安全策略拒绝最近发布的包，需添加 `minimumReleaseAge: 0`
4. **Electron 二进制未下载** — install scripts 被拦截导致 Electron postinstall 未执行，需手动设置镜像源并运行 `node node_modules/electron/install.js`
5. **better-sqlite3 ABI 不匹配** — 原生模块针对系统 Node.js 编译，需 `npx @electron/rebuild -f` 重新编译
6. **preload 脚本未加载** — Electron 31 默认 `sandbox: true`，需设置 `sandbox: false`

这些问题已通过项目配置修复（.npmrc 镜像源、postinstall 自动 rebuild、pnpm-workspace.yaml 配置、sandbox: false），详见 README 故障排查章节。
```

- [ ] **Step 3: 修改 `task8-verification-execution.md` — DB 路径替换**

使用 `replace_all` 将文件中所有 `fire-app-desktop` 替换为 `@fire-app/desktop`。

> 文件中约 8 处 `fire-app-desktop` 引用。

- [ ] **Step 4: 修改 `task8-verification-execution.md` — 阶段 0 添加 pnpm 检查步骤**

在阶段 0 的 Step 1 之前，插入以下内容：

```markdown
- [ ] **Step 0: 验证 pnpm 已安装**

Run: `pnpm -v`
Expected: 输出 pnpm 版本号（≥ 9）

> 如果报 "无法将 pnpm 项识别为 cmdlet"，运行 `npm install -g pnpm` 安装。
```

- [ ] **Step 5: 修改 `task8-verification-execution.md` — 添加附录**

在文件末尾（"删除后重新运行" 之后），添加以下内容：

```markdown
---

## 附录：已知问题与解决方案

| 编号 | 问题 | 症状 | 解决方案 |
|------|------|------|----------|
| 1 | pnpm 未安装 | `无法将"pnpm"项识别为 cmdlet` | `npm install -g pnpm` |
| 2 | Electron 下载慢 | `pnpm install` 卡住 | .npmrc 已配置镜像；或 `$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"` |
| 3 | better-sqlite3 ABI 不匹配 | `NODE_MODULE_VERSION 137` vs `125` | `pnpm --filter @fire-app/desktop rebuild` |
| 4 | preload 未加载 | `Cannot read properties of undefined (reading 'user')` | 确认 `sandbox: false` |
| 5 | build scripts 被拦截 | `ERR_PNPM_IGNORED_BUILDS` | `pnpm-workspace.yaml` 已配置；或 `pnpm approve-builds` |
| 6 | minimumReleaseAge 拦截 | `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` | `pnpm-workspace.yaml` 已配置 `minimumReleaseAge: 0` |
```

- [ ] **Step 6: 创建 `known-issues-analysis.md`**

在 `docs/superpowers/specs/` 目录下创建 `2026-07-15-fire-app-known-issues-analysis.md`，完整内容如下：

```markdown
# 已知问题与潜在风险分析

> **触发事件：** Task 8 端到端验证中发现 6 个环境/配置问题
> **目的：** 记录已修复问题，分析潜在类似风险，给出预防方案

---

## 1. 已修复问题（6 项）

| 编号 | 问题 | 严重程度 | 根因 | 修复方式 | 状态 |
|------|------|----------|------|----------|------|
| 1 | pnpm 未安装 | 中 | 开发环境未预装 pnpm | README 环境要求 + 安装命令 | 已修复 |
| 2 | pnpm.onlyBuiltDependencies 弃用 | 中 | pnpm 11 不再读取 package.json 的 pnpm 字段 | 迁移到 pnpm-workspace.yaml | 已修复 |
| 3 | minimumReleaseAge 拦截 | 中 | pnpm 11 供应链安全策略 | pnpm-workspace.yaml 添加 minimumReleaseAge: 0 | 已修复 |
| 4 | Electron 二进制未下载 | 高 | install scripts 被拦截 + 默认源慢 | .npmrc 镜像源 + postinstall rebuild | 已修复 |
| 5 | better-sqlite3 ABI 不匹配 | 高 | 原生模块针对系统 Node.js 编译，非 Electron | postinstall 自动 electron-rebuild | 已修复 |
| 6 | preload 脚本未加载 | 高 | Electron 31 默认 sandbox: true | sandbox: false + 文档说明 | 已修复 |

---

## 2. 潜在问题分析（2 项）

### 2.1 createDatabase 默认相对路径误用

**严重程度：** 低

**位置：** `packages/shared/src/db/connection.ts`

**当前代码：**
```typescript
export function createDatabase(path: string = 'data/fire-app.db'): DatabaseType {
```

**风险：** 默认值为相对路径 `'data/fire-app.db'`。桌面端 `db-manager.ts` 始终传入绝对路径，默认值未被使用。但若其他入口（如测试或脚本）误用默认值，会在当前工作目录创建数据库文件，可能导致数据丢失或路径混乱。

**预防方案：** 建议移除默认值，改为必填参数，或改为抛出错误：
```typescript
export function createDatabase(path: string): DatabaseType {
  if (!path) throw new Error('数据库路径不能为空');
```

**状态：** 建议（暂未修改）

### 2.2 文档与代码不一致

**严重程度：** 中

**根因：** 设计文档在代码实现前编写，实现过程中做了调整（sandbox、preload 路径、API 命名），但未回溯更新文档。

**已修复项：**
- sandbox: true → false（3 份设计文档）
- preload/index.js → index.mjs（3 份设计文档）
- window.api → window.dataAccess（1 份设计文档）

**预防方案：** 建议建立文档 review 流程——每次代码合并前，检查相关设计文档是否需要同步更新。

**状态：** 本次修复完成

---

## 3. 预防措施清单

| 措施 | 对应问题 | 实施状态 |
|------|----------|----------|
| .npmrc 镜像源配置 | #4 Electron 下载 | 已实施 |
| postinstall 自动 rebuild | #5 ABI 不匹配 | 已实施 |
| pnpm-workspace.yaml 配置 | #2 #3 pnpm 策略 | 已实施 |
| sandbox: false + 文档说明 | #6 preload 加载 | 已实施 |
| README 故障排查章节 | #1 所有问题 | 已实施 |
| 设计文档对齐 | 文档不一致 | 已实施 |
| createDatabase 默认值移除 | #2.1 相对路径 | 建议中 |
| 文档 review 流程 | #2.2 文档不一致 | 建议中 |
```

- [ ] **Step 7: 提交**

```bash
git add docs/superpowers/specs/2026-07-15-fire-app-task8-verification-design.md docs/superpowers/plans/2026-07-15-fire-app-task8-verification-execution.md docs/superpowers/specs/2026-07-15-fire-app-known-issues-analysis.md
git commit -m "docs: 更新验证文档 + 创建潜在问题分析"
```
