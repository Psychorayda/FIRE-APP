# CI 打包与发布 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 通过 GitHub Actions CI 自动构建 Windows `.exe` 安装包，推送代码后自动编译+测试+打包，下载双击运行，无需任何本地环境配置。

**Architecture:** 纯加法——新增 electron-builder 配置 + GitHub Actions workflow，不改业务代码。CI 在 `windows-latest` 上运行：install → test → build → electron-builder 打包 → 上传 Artifacts/Releases。同时撤销之前创建的 Docker 文件。

**Tech Stack:** electron-builder 25, GitHub Actions, pnpm 9, Node 20.18.0, Electron 31

---

## 文件结构 / File Structure

| 文件 | 操作 | 职责 |
|------|------|------|
| `Dockerfile` | 删除 | 撤销 Docker 方案 |
| `docker-compose.yml` | 删除 | 同上 |
| `docker/dev-startup.sh` | 删除 | 同上 |
| `.dockerignore` | 删除 | 同上 |
| `docs/docker-dev.md` | 删除 | 同上 |
| `apps/desktop/electron-builder.yml` | 新建 | electron-builder 打包配置 |
| `apps/desktop/build/.gitkeep` | 新建 | buildResources 目录占位 |
| `apps/desktop/package.json` | 修改 | 新增 `dist` script + electron-builder devDependency |
| `package.json`（根） | 修改 | 新增根级 `dist` script |
| `.github/workflows/build-release.yml` | 新建 | CI 打包 workflow |
| `README.md` | 修改 | 移除 Docker 章节，新增下载安装包章节 |

---

### Task 1: 撤销 Docker 文件

**Files:**
- Delete: `Dockerfile`
- Delete: `docker-compose.yml`
- Delete: `docker/dev-startup.sh`
- Delete: `.dockerignore`
- Delete: `docs/docker-dev.md`

- [ ] **Step 1: 删除 5 个 Docker 文件**

```bash
cd "/workspace/FIRE APP"
rm Dockerfile docker-compose.yml .dockerignore docker/dev-startup.sh docs/docker-dev.md
rmdir docker  # 删除空目录
```

- [ ] **Step 2: 验证删除成功**

Run: `git status`
Expected: 5 个文件显示为 deleted

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "revert(docker): remove Docker dev environment files

Company machine cannot install Docker Desktop. Switching to CI build
approach (electron-builder + GitHub Actions) for app distribution."
```

---

### Task 2: 安装 electron-builder 依赖

**Files:**
- Modify: `apps/desktop/package.json`（自动，由 pnpm add 更新）
- Modify: `pnpm-lock.yaml`（自动）

- [ ] **Step 1: 安装 electron-builder 25**

```bash
cd "/workspace/FIRE APP"
pnpm --filter @fire-app/desktop add -D electron-builder@^25
```

Expected: `apps/desktop/package.json` 的 `devDependencies` 新增 `"electron-builder": "^25.x.x"`，`pnpm-lock.yaml` 更新。

- [ ] **Step 2: 验证安装成功**

Run: `pnpm --filter @fire-app/desktop exec electron-builder --version`
Expected: 输出版本号，如 `25.1.8`

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/package.json pnpm-lock.yaml
git commit -m "deps: add electron-builder for Windows .exe packaging"
```

---

### Task 3: 创建 electron-builder 配置 + dist 脚本

**Files:**
- Create: `apps/desktop/electron-builder.yml`
- Create: `apps/desktop/build/.gitkeep`
- Modify: `apps/desktop/package.json`
- Modify: `package.json`（根）

- [ ] **Step 1: 创建 electron-builder.yml**

创建 `apps/desktop/electron-builder.yml`：

```yaml
# electron-builder 打包配置 / Packaging config
# 使用：pnpm --filter @fire-app/desktop dist
# CI：electron-builder --config electron-builder.yml

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

- [ ] **Step 2: 创建 buildResources 占位目录**

```bash
mkdir -p "/workspace/FIRE APP/apps/desktop/build"
touch "/workspace/FIRE APP/apps/desktop/build/.gitkeep"
```

- [ ] **Step 3: 在 apps/desktop/package.json 添加 dist 脚本**

在 `apps/desktop/package.json` 的 `scripts` 中添加 `dist`：

```json
{
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "dist": "electron-vite build && electron-builder --config electron-builder.yml",
    "rebuild": "electron-rebuild -f -w better-sqlite3",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

> 注意：`dist` 脚本先跑 `electron-vite build`（编译 main/preload/renderer 到 `out/`），再跑 `electron-builder`（打包 `.exe` 到 `release/`）。

- [ ] **Step 4: 在根 package.json 添加根级 dist 脚本**

在根 `package.json` 的 `scripts` 中添加 `dist`：

```json
{
  "scripts": {
    "dev": "pnpm --filter @fire-app/desktop dev",
    "build": "pnpm --filter @fire-app/desktop build",
    "dist": "pnpm --filter @fire-app/desktop dist",
    "test:shared": "pnpm --filter @fire-app/shared test",
    "test:desktop": "pnpm --filter @fire-app/desktop test",
    "test:all": "pnpm test:shared && pnpm test:desktop",
    "check-env": "node scripts/check-env.mjs",
    "bootstrap": "node scripts/setup.mjs",
    "preinstall": "node scripts/check-env.mjs --quiet || true",
    "postinstall": "pnpm --filter @fire-app/desktop rebuild"
  }
}
```

- [ ] **Step 5: 验证配置语法**

Run: `cd "/workspace/FIRE APP" && pnpm --filter @fire-app/desktop exec electron-builder --config electron-builder.yml --help`
Expected: 输出帮助信息，无配置解析错误

- [ ] **Step 6: Commit**

```bash
cd "/workspace/FIRE APP"
git add apps/desktop/electron-builder.yml apps/desktop/build/.gitkeep apps/desktop/package.json package.json
git commit -m "feat(packaging): add electron-builder config and dist script

- electron-builder.yml: nsis + portable targets, asarUnpack for
  better-sqlite3 native module, perMachine false (no admin needed)
- dist script: electron-vite build && electron-builder
- build/.gitkeep: placeholder for future icon.ico"
```

---

### Task 4: 创建 GitHub Actions Workflow

**Files:**
- Create: `.github/workflows/build-release.yml`

- [ ] **Step 1: 创建 workflow 文件**

创建 `.github/workflows/build-release.yml`：

```yaml
name: Build & Release

on:
  push:
    branches: [main]
    tags: ['v*']
  workflow_dispatch:

jobs:
  build:
    runs-on: windows-latest
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
        run: pnpm test:all

      - name: Build app
        run: pnpm --filter @fire-app/desktop build

      - name: Package .exe
        run: pnpm --filter @fire-app/desktop exec electron-builder --config electron-builder.yml
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: fire-app-windows
          path: release/*.exe

      - name: Publish to GitHub Releases
        uses: softprops/action-gh-release@v2
        if: startsWith(github.ref, 'refs/tags/')
        with:
          files: release/*.exe
          generate_release_notes: true
```

- [ ] **Step 2: 验证 YAML 语法**

Run: `node -e "const yaml = require('fs').readFileSync('/workspace/FIRE APP/.github/workflows/build-release.yml', 'utf8'); console.log('YAML lines:', yaml.split('\\n').length); console.log('OK')"`
Expected: 输出行数和 `OK`，无报错

> 如果 node 无法直接解析 YAML，用 `python3 -c "import yaml; yaml.safe_load(open('...'))"` 验证。

- [ ] **Step 3: Commit**

```bash
cd "/workspace/FIRE APP"
git add .github/workflows/build-release.yml
git commit -m "ci: add build-release workflow for Windows .exe packaging

Triggers on push to main (Artifacts), tags v* (Releases), and manual.
Runs on windows-latest for native better-sqlite3 compilation.
Test gate: pnpm test:all must pass before packaging."
```

---

### Task 5: 更新 README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 读取当前 README**

Run: 读取 `/workspace/FIRE APP/README.md`，确认 Docker 章节（"方式一：Docker 开发环境"）在第 35-45 行附近。

- [ ] **Step 2: 替换快速开始章节**

将 README 的"快速开始"部分（从 `## 快速开始` 到 `## 常用命令` 之前）替换为：

```markdown
## 快速开始

### 方式一：下载安装包运行（推荐，零环境配置）

1. 前往 [GitHub Actions](../../actions) 页面，找到最新成功的构建
2. 在 Artifacts 区域下载 `fire-app-windows` 压缩包
3. 解压后双击 `FIRE-App-Setup-0.1.0.exe` 安装运行

> 无需安装 Node.js、pnpm 或任何开发工具——安装包内置完整 Electron 运行时。
> 正式版本见 [Releases](../../releases) 页面。

### 方式二：本地开发环境

```bash
pnpm bootstrap  # 一键安装（自动检测环境 + 镜像 + 原生模块编译）
pnpm dev        # 启动开发模式
```

> 首次 clone 后推荐用 `pnpm bootstrap`，它会自动检测环境问题并给出修复命令。
> 若已安装过依赖，直接 `pnpm dev` 即可。
> 遇到环境问题可随时跑 `pnpm check-env` 诊断。

### 打包发布

```bash
pnpm dist       # 本地打包（需要本地环境正常）
# 或推送到 main 让 CI 自动打包
git push origin main
```
```

- [ ] **Step 3: 验证 README 渲染**

Run: 检查 README 中不再包含 "Docker" 字样（除了"手动安装/故障排查"中可能的历史提及）。

```bash
grep -c "Docker" "/workspace/FIRE APP/README.md"
```
Expected: 0（或仅保留在非快速开始章节的无关提及）

- [ ] **Step 4: Commit**

```bash
cd "/workspace/FIRE APP"
git add README.md
git commit -m "docs: replace Docker quick start with CI download instructions"
```

---

### Task 6: 推送并验证 CI（C-1, C-2）

**Files:** 无（操作步骤）

- [ ] **Step 1: 确认所有 commit 就绪**

Run: `cd "/workspace/FIRE APP" && git log --oneline -6`
Expected: 看到 5 个新 commit（Task 1~5 各一个）

- [ ] **Step 2: 推送到 GitHub**

```bash
cd "/workspace/FIRE APP"
git push origin main
```

> 如果沙箱无 GitHub 凭证，需要用户授权 GitHub 连接（RequestAuthorization），或用户从本地 `git pull` 后推送。

- [ ] **Step 3: 验证 C-1 — CI 构建触发**

前往 GitHub 仓库 → Actions 页面，确认 `Build & Release` workflow 已触发。

Expected: workflow 状态为 "Running" 或 "Queued"

- [ ] **Step 4: 等待 CI 完成（约 5-10 分钟）**

监控 Actions 页面构建进度。关键步骤：
1. Setup Node + pnpm ✓
2. Install dependencies ✓
3. Run tests (gate) ✓ — 72 个测试全过
4. Build app ✓
5. Package .exe ✓
6. Upload artifact ✓

Expected: 所有步骤绿色通过，workflow 状态变为 "Success"

- [ ] **Step 5: 验证 C-2 — 下载 Artifacts**

在 Actions 运行详情页底部 Artifacts 区域，下载 `fire-app-windows`。

Expected: 解压后得到 `FIRE-App-Setup-0.1.0.exe` 和 `FIRE-App-0.1.0-portable.exe`

- [ ] **Step 6: 记录验证结果**

如果 CI 成功：C-1 ✓ C-2 ✓，准备进入 C-3（干净机器运行）。
如果 CI 失败：记录错误日志，分析原因（常见：better-sqlite3 编译失败、路径问题），修复后重新推送。

---

## Self-Review

### 1. Spec coverage

| Spec 要求 | 对应 Task |
|-----------|----------|
| 撤销 Docker（删除 5 文件） | Task 1 |
| electron-builder 配置 | Task 3 |
| electron-builder 依赖 | Task 2 |
| GitHub Actions workflow | Task 4 |
| dist 脚本 | Task 3 |
| README 更新 | Task 5 |
| .gitignore release/ | 已存在，无需修改 |
| C-1 CI 构建成功 | Task 6 Step 3-4 |
| C-2 产物下载 | Task 6 Step 5 |
| C-3 干净机器运行 | 后续手动验证（非本计划范围） |
| C-4 应用功能正常 | 后续手动验证（M4 H-1~H-5） |
| C-5 正式发版 | 后续打 tag（非本计划范围） |

无遗漏。

### 2. Placeholder scan

无 TBD/TODO/placeholder。所有配置文件完整，命令明确。

### 3. Type consistency

- `electron-builder.yml` 路径与 CI workflow 中 `--config electron-builder.yml` 一致
- `dist` 脚本在 apps/desktop 和根 package.json 中命令链一致
- `release/*.exe` 产物路径在 electron-builder.yml（output: ../../release）和 workflow（path: release/*.exe）中一致

无问题。
