# CI 打包与发布方案设计 / CI Build & Release Design

> **日期 / Date:** 2026-07-16
> **状态 / Status:** 设计已批准，待写实施计划 / Design approved, pending implementation plan
> **背景 / Context:** Docker 方案因公司电脑环境限制撤销；需要无痛的"启动并验证应用"方案，同时考虑未来 APP 分发

---

## 1. 概述 / Overview

通过 GitHub Actions CI 自动构建 Electron Windows 安装包，推送到仓库后 CI 自动编译 + 测试 + 打包，产出 `.exe` 安装包上传到 Artifacts/Releases。开发者（及未来最终用户）下载 `.exe` 双击运行，**无需任何本地环境配置**。

### 1.1 目标 / Goals

- 任意 Windows 电脑下载 `.exe` 双击运行，无需 Node/pnpm/Docker/编译工具
- 代码推送后 CI 自动构建，开发者只管 push + 下载
- 测试作为打包前置门禁，不发布残次品
- 解决"未来 APP 运行"——这就是 Electron 应用的标准分发方式
- 撤销 Docker 方案（公司电脑无法安装 Docker Desktop）

### 1.2 非目标 / Non-Goals

- 不做自动更新（electron-updater，YAGNI，后续按需）
- 不做代码签名（需购买证书，YAGNI）
- 不做多平台打包（仅 Windows x64，Mac/Linux 后续按需）
- 不改任何业务代码（纯加法：新增配置 + workflow）
- 不删除本地开发脚本（`pnpm bootstrap`/`pnpm dev` 保留并存）

### 1.3 对现有代码的影响 / Impact on Existing Code

| 维度 | 影响 |
|------|------|
| 业务代码（main/preload/renderer/shared/测试） | **零改动** |
| 日常开发（`pnpm dev`） | 不变 |
| package.json | 仅 apps/desktop 新增 `dist` script + electron-builder devDependency |
| 版本管理 | 打 `git tag v*` 触发正式 Release；electron-builder 用 package.json version |
| 仓库体积 | `release/` 产物不入仓库（.gitignore 排除），只存 GitHub Artifacts/Releases |

---

## 2. 整体架构与 CI 流程 / Architecture & CI Flow

### 2.1 核心流程

```
git push origin main
       ↓
GitHub Actions (windows-latest)
       ↓
  ① setup Node 20.18.0 + pnpm 9
  ② pnpm install --frozen-lockfile
  ③ pnpm test:all          ← 72 个测试，全过才继续
  ④ pnpm build              ← electron-vite build（main + preload + renderer）
  ⑤ electron-builder        ← 自动 electron-rebuild + 打包 .exe
       ↓
  产物：FIRE-App-Setup-0.1.0.exe（nsis 安装包）+ portable 免安装版
       ↓
  上传 GitHub Releases / Artifacts
```

### 2.2 触发方式

| 触发 | 场景 | 产物位置 |
|------|------|---------|
| `push: main` | 每次推送自动构建 | Actions Artifacts（临时，90 天） |
| `tag: v*` | 正式发布打 tag | GitHub Releases（永久） |
| `workflow_dispatch` | 手动触发 | Actions Artifacts |

### 2.3 关键设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| CI 平台 | `windows-latest` | better-sqlite3 不能跨平台交叉编译，必须在 Windows 上编译 + 打包 |
| 测试门禁 | `test:all` 失败则中止 | 不发布残次品 |
| electron-builder `npmRebuild` | 默认 true | 打包前自动针对 Electron ABI 重新编译原生模块，无需手动 electron-rebuild |
| 产物类型 | nsis + portable 双产物 | nsis 是标准安装体验；portable 备选，解压即用 |
| 产物存储 | Artifacts（临时）+ Releases（永久） | 日常推送用 Artifacts；正式发版打 tag 进 Releases |

### 2.4 打包后的 .exe 包含什么

Electron 安装包是完整的应用，内置：
- Electron 运行时（含 Node.js + Chromium）
- 编译后的应用代码（main/preload/renderer）
- 所有 node_modules 依赖（含 better-sqlite3 预编译的 `.node`）
- SQLite 数据库运行时自动创建（首次启动 `initSchema`）

**目标电脑只需：** 下载 `.exe` → 双击运行。无需 Node/pnpm/Docker/编译工具。

---

## 3. electron-builder 配置 / electron-builder Config

新建 `apps/desktop/electron-builder.yml`：

```yaml
appId: com.fireapp.desktop
productName: FIRE App

directories:
  output: ../../release    # 产物输出到项目根 release/
  buildResources: build     # 图标等资源目录（apps/desktop/build/）

# 打包文件：electron-vite build 产物 + package.json
files:
  - out/**/*
  - package.json

# asar 打包，但原生模块解包（better-sqlite3 的 .node 必须能被 require）
asar: true
asarUnpack:
  - "**/better-sqlite3/**"
  - "**/*.node"

# Windows 目标
win:
  target:
    - target: nsis        # 安装包（带向导）
      arch: [x64]
    - target: portable    # 免安装版（解压即用）
      arch: [x64]
  # icon: build/icon.ico  # 暂用默认，后续补图标

# nsis 安装包配置
nsis:
  oneClick: false                           # 非一键安装，有向导
  perMachine: false                         # 当前用户安装（无需管理员）
  allowToChangeInstallationDirectory: true  # 允许选安装路径
  createDesktopShortcut: true
  createStartMenuShortcut: true
```

### 3.1 配置决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 配置位置 | 独立 `electron-builder.yml` | 比 package.json build 字段更清晰，不污染 package.json |
| `asarUnpack` | 显式列出 better-sqlite3 + `*.node` | 确保原生模块 `.node` 文件能被 Electron 运行时 require（asar 内不能加载原生模块） |
| 产物类型 | nsis + portable | nsis 标准安装体验；portable 备选，解压即用 |
| `perMachine: false` | 当前用户安装 | 无需管理员权限，公司电脑友好 |
| icon | 暂用默认 | 项目暂无 .ico，后续补（不阻塞功能验证） |
| arch | 仅 x64 | 覆盖绝大多数 Windows 电脑；arm64 后续按需 |

### 3.2 与现有 build 命令的关系

| 命令 | 作用 | 产物 |
|------|------|------|
| `pnpm build`（现有） | `electron-vite build` | `out/` 编译产物（不打包） |
| `pnpm dist`（新增） | `electron-vite build && electron-builder` | `release/*.exe` 安装包 |

---

## 4. GitHub Actions Workflow / CI Workflow

新建 `.github/workflows/build-release.yml`：

```yaml
name: Build & Release

on:
  push:
    branches: [main]        # 每次推送 main 自动构建
    tags: ['v*']            # 打 tag 正式发布到 Releases
  workflow_dispatch:         # 手动触发

jobs:
  build:
    runs-on: windows-latest  # Windows 原生编译 better-sqlite3
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node 20.18.0
        uses: actions/setup-node@v4
        with:
          node-version: '20.18.0'

      - name: Setup pnpm 9
        uses: pnpm/action-setup@v4
        with:
          version: '9.15.0'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run tests (gate)
        run: pnpm test:all   # 72 个测试全过才继续

      - name: Build app
        run: pnpm --filter @fire-app/desktop build  # electron-vite build

      - name: Package .exe
        run: pnpm --filter @fire-app/desktop exec electron-builder --config electron-builder.yml
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}  # electron-builder 发布 Release 用

      - name: Upload artifact (临时，90 天)
        uses: actions/upload-artifact@v4
        with:
          name: fire-app-windows
          path: release/*.exe

      - name: Publish to GitHub Releases (仅打 tag 时)
        uses: softprops/action-gh-release@v2
        if: startsWith(github.ref, 'refs/tags/')
        with:
          files: release/*.exe
          generate_release_notes: true
```

### 4.1 使用流程

**日常验证：**
```bash
git push origin main
# 等 CI 构建完成（5-10 分钟）
# GitHub 仓库 → Actions 页面 → 最新运行 → Artifacts → 下载 fire-app-windows
# 解压 → 双击 .exe 运行
```

**正式发版：**
```bash
git tag v0.1.0
git push origin v0.1.0
# 自动构建并发布到 GitHub Releases 页面
```

---

## 5. 文件变更清单 / File Inventory

### 5.1 新建文件（3 个）

| 文件 | 职责 |
|------|------|
| `.github/workflows/build-release.yml` | CI 打包 workflow |
| `apps/desktop/electron-builder.yml` | electron-builder 配置 |
| `apps/desktop/build/.gitkeep` | 占位（buildResources 目录，后续放 icon.ico） |

### 5.2 修改文件（3 个）

| 文件 | 修改内容 |
|------|---------|
| `apps/desktop/package.json` | 新增 `"dist": "electron-vite build && electron-builder"` script + `electron-builder` devDependency |
| `README.md` | 移除 Docker 章节，新增"下载安装包运行"章节 |
| `.gitignore` | 确保 `release/` 被忽略（产物不入仓库） |

### 5.3 删除文件（5 个）— 撤销 Docker

| 文件 | 原因 |
|------|------|
| `Dockerfile` | Docker 方案撤销 |
| `docker-compose.yml` | 同上 |
| `docker/dev-startup.sh` | 同上 |
| `.dockerignore` | 同上 |
| `docs/docker-dev.md` | 同上 |

### 5.4 保留不变

| 文件 | 理由 |
|------|------|
| `scripts/check-env.mjs` + `scripts/setup.mjs` | 本地开发仍用（`pnpm bootstrap`/`pnpm dev` 保留） |
| `docs/superpowers/specs/2026-07-16-docker-dev-environment-design.md` | 历史记录，不删（设计文档保留供回溯） |
| `.npmrc` + `.nvmrc` + `pnpm-workspace.yaml` | 本地开发配置 |

---

## 6. 验收策略 / Acceptance

### 6.1 验收标准（C-1 ~ C-5）

| # | 验收项 | 通过标准 |
|---|--------|---------|
| C-1 | CI 构建成功 | 推送 main 后，GitHub Actions 绿色通过，无报错 |
| C-2 | 产物下载 | Actions 页面能下载 Artifacts，解压得到 `.exe` |
| C-3 | 干净机器运行 | `.exe` 在**未装 Node/pnpm** 的 Windows 上双击启动成功 |
| C-4 | 应用功能正常 | GUI 内能完成 M4 验证（H-1~H-5：账户 CRUD、交易 CRUD、筛选、概览、排序） |
| C-5 | 正式发版 | `git tag v0.1.0` 后，Releases 页面出现带版本号的安装包 |

### 6.2 验收执行顺序

```
C-1 CI 构建成功（推送配置后自动触发）
  ↓
C-2 下载 Artifacts（从 Actions 页面下载）
  ↓
C-3 干净机器运行（公司电脑双击 .exe）← 关键验证点
  ↓
C-4 应用功能正常（复用 M4 H-1~H-5）
  ↓
C-5 正式发版（可选，后续打 tag）
```

**C-3 是关键验证点** —— 如果能在未装开发环境的 Windows 上双击运行成功，就证明方案彻底解决了"未来 APP 运行"的问题。

---

## 7. 已知风险 / Known Risks

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| better-sqlite3 在 CI 编译失败 | 低 | 阻断 | `windows-latest` 预装 VS Build Tools + Python，满足 node-gyp 要求；若失败可加 `npm rebuild` 步骤 |
| 打包后 `.node` 加载失败 | 低 | 应用崩溃 | `asarUnpack` 显式配置解包；electron-builder `npmRebuild` 默认针对 Electron ABI 编译 |
| CI 构建慢（首次 >10 分钟） | 中 | 体验 | pnpm store 缓存；后续推送有缓存会快 |
| portable 版被 Defender 误报 | 中 | 用户困惑 | 常见问题；后续可加代码签名（需购买证书，YAGNI 暂不做） |
| 无自定义图标 | 确定 | 不影响功能 | electron-builder 用默认 Electron 图标；后续补 `build/icon.ico` |

---

## 附录 A：方案选型依据 / Alternatives Considered

| 方案 | 否决理由 |
|------|---------|
| Docker 开发环境 | 公司电脑无法安装 Docker Desktop；已尝试失败 |
| 替换 better-sqlite3 为 sql.js（WASM） | 改动大（同步→异步/手动持久化）；性能下降；Electron 打包仍需单独配置 |
| GitHub Codespaces 云开发 | 运行验证仍需打包；强依赖网络；公司网络可能受限 |
| 本地 pnpm bootstrap 修复 | 已多次尝试，better-sqlite3 编译 + electron-rebuild 反复失败，系统性痛点 |

**方案 A（CI 打包）被选原因：** 纯加法不改代码；彻底解决运行验证 + 未来分发；一次性配置后续零维护；与本地开发解耦。
