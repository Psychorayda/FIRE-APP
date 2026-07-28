# Task 8 端到端验证 — 执行计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Windows 环境上执行桌面 MVP 里程碑 1 的 Task 8 端到端验证，确认 Electron 应用从启动到数据持久化的完整数据通路正常工作。

**Architecture:** 验证分 8 个阶段顺序执行：前置准备（依赖安装+构建）→ 启动开发模式 → 首次启动验证（无用户场景）→ 后续启动验证（有用户场景）→ 数据库文件验证 → 种子分类验证 → 日志验证 → 提交最终状态。每阶段含具体操作命令、预期结果、通过标准和故障排查。

**Tech Stack:** pnpm 9 workspace, Electron 31, electron-vite 2, React 19, better-sqlite3 11, PowerShell (Windows)

**Spec:** `docs/superpowers/specs/2026-07-15-fire-app-task8-verification-design.md`

---

## 阶段 0：前置准备

**Files:**
- 无新文件，环境准备

- [ ] **Step 0: 验证 pnpm 已安装**

Run: `pnpm -v`
Expected: 输出 pnpm 版本号（≥ 9）

> 如果报 "无法将 pnpm 项识别为 cmdlet"，运行 `npm install -g pnpm` 安装。

- [ ] **Step 1: 安装 workspace 依赖**

Run: `cd "d:\Admin\OneDrive\Apps\FIRE APP" && pnpm install`
Expected: 依赖安装成功，退出码 0，`node_modules` 目录生成

- [ ] **Step 2: 验证 shared 包测试全部通过**

Run: `cd "d:\Admin\OneDrive\Apps\FIRE APP" && pnpm --filter @fire-app/shared test`
Expected: Vitest 输出所有测试 PASS，无失败

> 如果测试失败，说明 Task 2 的代码迁移有问题，需先修复再继续。

- [ ] **Step 3: 构建桌面应用**

Run: `cd "d:\Admin\OneDrive\Apps\FIRE APP" && pnpm --filter @fire-app/desktop build`
Expected: electron-vite 构建成功，生成以下文件：
- `apps/desktop/dist/main/index.js`
- `apps/desktop/dist/preload/index.js`
- `apps/desktop/dist/renderer/` 目录

> 如果 better-sqlite3 编译失败，确认已安装 Visual Studio Build Tools。

---

## 阶段 1：启动开发模式

**Files:**
- 无新文件，运行时验证

- [ ] **Step 1: 启动 Electron 开发模式**

Run: `cd "d:\Admin\OneDrive\Apps\FIRE APP" && pnpm dev`
Expected: 终端输出 electron-vite 启动日志，约 5-10 秒后 Electron 窗口自动打开

- [ ] **Step 2: 验证窗口和页面加载**

观察 Electron 窗口：
- 窗口标题栏显示 "FIRE 计算APP"
- 页面显示标题 "FIRE 计算APP — 架构验证"
- "数据通路验证" 区域显示**黄色提示框**："无用户记录（首次启动）"
- "创建测试用户 + 种子分类" 按钮可见且可点击

通过标准：黄色框可见，按钮可点击

> 如果窗口白屏，按 Ctrl+Shift+I 打开 DevTools，检查 Console 红色错误。常见原因：preload 脚本路径错误、`@shared` 别名未解析。

- [ ] **Step 3: 验证终端 DB 初始化日志**

查看终端输出，确认包含：
```
[DB] 数据库已初始化: ...fire.db
```

通过标准：日志中可见 DB 初始化路径

> 如果终端报 `Cannot find module 'better-sqlite3'`，运行 `pnpm install` 重新安装依赖。

---

## 阶段 2：验证首次启动（无用户场景）

**Files:**
- 无新文件，交互验证

- [ ] **Step 1: 点击创建用户按钮**

在 Electron 窗口中点击 "创建测试用户 + 种子分类" 按钮。

预期结果：
- 页面从黄色框变为**绿色框**
- 绿色框显示 "✓ IPC 桥验证通过"

通过标准：绿色框出现，无红色错误提示

> 如果点击后显示红色错误框，检查终端是否有 IPC handler 报错。常见原因：DB schema 未初始化、`createUser` 函数参数不匹配。
> 如果点击后页面无反应，打开 DevTools Console 检查 `window.dataAccess` 是否定义。若 undefined 说明 preload 脚本未加载。

- [ ] **Step 2: 验证用户信息正确显示**

查看绿色框内容，确认显示以下四项信息：
- 用户名：测试用户
- 货币：CNY
- 中国市场：是
- 用户 ID：UUID 格式字符串

通过标准：四项信息全部正确显示

- [ ] **Step 3: 验证技术栈清单更新**

查看页面下方 "技术栈验证" 区域，确认清单末尾新增：
- ✓ 数据层 CRUD（用户创建 + 种子分类）

通过标准：该条目出现且为绿色 ✓

---

## 阶段 3：验证后续启动（有用户场景）

**Files:**
- 无新文件，持久化验证

- [ ] **Step 1: 关闭 Electron 应用**

点击窗口右上角 X 关闭 Electron 窗口。

预期结果：
- 窗口关闭
- 终端显示 `[DB] 数据库已关闭`

通过标准：窗口关闭，DB 关闭日志出现

> 如果无 "数据库已关闭" 日志，检查 `apps/desktop/src/main/index.ts` 中 `app.on('window-all-closed', ...)` 是否调用了 `closeAppDatabase()`。

- [ ] **Step 2: 重新启动应用**

Run: `cd "d:\Admin\OneDrive\Apps\FIRE APP" && pnpm dev`
Expected: Electron 窗口打开

- [ ] **Step 3: 验证用户数据持久化**

观察页面内容：
- 页面**直接显示绿色框**（无黄色框、无需点击创建按钮）
- 用户信息与阶段 2 创建的一致（用户名 "测试用户"、货币 "CNY"、中国市场 "是"）

通过标准：绿色框直接出现，用户信息与上次一致

> 如果重启后仍显示黄色框（无用户），DB 文件路径可能不持久。检查终端日志中的 DB 路径是否与上次一致。若不一致，检查 `apps/desktop/src/main/db-manager.ts` 中 `getDataDir()` 是否使用了 `app.getPath('userData')`。

---

## 阶段 4：验证数据库文件创建

**Files:**
- 无新文件，文件系统验证

- [ ] **Step 1: 确认 DB 文件存在**

Run (PowerShell): `Get-ChildItem -Path "$env:APPDATA\@fire-app/desktop\fire-app\data\fire.db"`
Expected: 文件存在，大小 > 0（通常 > 12KB）

通过标准：文件存在

> 如果文件不存在，检查终端日志中的 DB 路径。`app.getPath('userData')` 在 Windows 上返回 `%APPDATA%\<app-name>`，确认 app name 为 `@fire-app/desktop`（由 `apps/desktop/package.json` 的 `name` 字段决定）。

- [ ] **Step 2: 验证 users 表数据**

Run (PowerShell): `sqlite3 "$env:APPDATA\@fire-app/desktop\fire-app\data\fire.db" "SELECT id, display_name, base_currency, is_china_market FROM users;"`
Expected: 输出一行，display_name="测试用户"，base_currency="CNY"，is_china_market=1

通过标准：查询返回 1 行，字段值正确

> 如果 sqlite3 命令未找到，下载 sqlite-tools 或使用 [DB Browser for SQLite](https://sqlitebrowser.org/) 打开 DB 文件手动查看。

- [ ] **Step 3: 验证种子分类数量**

Run (PowerShell): `sqlite3 "$env:APPDATA\@fire-app/desktop\fire-app\data\fire.db" "SELECT COUNT(*) FROM categories;"`
Expected: 输出 `18`

通过标准：计数 = 18（11 个支出 + 7 个收入）

---

## 阶段 5：验证种子分类创建

**Files:**
- 无新文件，运行时验证

- [ ] **Step 1: 打开 DevTools**

在 Electron 窗口中按 `Ctrl+Shift+I`，确认 DevTools 面板打开。

- [ ] **Step 2: 检查 Console 无错误**

查看 Console 标签页：
- 无红色错误条目
- 无未捕获的 Promise rejection

通过标准：Console 无红色条目

> 如果 Console 有 IPC 调用错误，检查 `apps/desktop/src/main/ipc-handlers.ts` 中 `db:category:seed` handler 是否正确注册。

- [ ] **Step 3: 验证页面技术栈清单**

查看页面 "技术栈验证" 区域，确认显示：
- ✓ 数据层 CRUD（用户创建 + 种子分类）

通过标准：条目显示绿色 ✓

> 如果分类数不为 18，检查 `packages/shared/src/models/category.ts` 中 `seedCategories` 函数的 `SEED_CATEGORIES` 数组长度，确认 11 支出 + 7 收入。

---

## 阶段 6：关闭 APP 并验证日志

**Files:**
- 无新文件，日志验证

- [ ] **Step 1: 关闭 Electron 应用**

点击窗口 X 关闭 Electron。

- [ ] **Step 2: 验证启动日志**

滚动终端输出，查找启动期间的日志，确认包含：
```
[DB] 数据库已初始化: <路径>\fire.db
```

通过标准：日志存在，路径正确

- [ ] **Step 3: 验证关闭日志**

查看终端末尾输出，确认包含：
```
[DB] 数据库已关闭
```

通过标准：日志存在

> 如果无 "数据库已关闭" 日志，检查 `apps/desktop/src/main/index.ts` 中 `app.on('window-all-closed', ...)` 是否调用了 `closeAppDatabase()`。

---

## 阶段 7：Commit 最终状态

**Files:**
- 无新文件，版本控制

- [ ] **Step 1: 暂存所有文件**

Run: `cd "d:\Admin\OneDrive\Apps\FIRE APP" && git add -A`
Expected: 无报错

- [ ] **Step 2: 检查暂存区无 DB 文件**

Run: `cd "d:\Admin\OneDrive\Apps\FIRE APP" && git status`
Expected: 确认无 `.db` 文件出现在暂存区（应被 .gitignore 排除）

通过标准：无 DB 文件在暂存区

> 如果 DB 文件被暂存，检查 `.gitignore` 是否包含 `*.db` 规则。运行 `git rm --cached <db文件路径>` 移除后重新提交。

- [ ] **Step 3: 提交**

Run: `cd "d:\Admin\OneDrive\Apps\FIRE APP" && git commit -m "feat: 里程碑1完成 — 架构验证切片端到端验证通过"`
Expected: 提交成功，退出码 0

通过标准：`git log` 可见新提交

---

## 完成标准对照表

| 检查项 | 对应阶段 | 验证方式 | 状态 |
|--------|----------|----------|------|
| Monorepo 结构 | 0.3 | 构建成功即证明结构正确 | ☐ |
| shared 包测试 | 0.2 | Vitest 全部通过 | ☐ |
| Electron 启动 | 1.1-1.2 | 窗口打开 | ☐ |
| DB 初始化 | 1.3 + 4.1 | 日志 + 文件存在 | ☐ |
| IPC 通路 | 2.1-2.2 | 用户数据通过 IPC 返回并显示 | ☐ |
| 首次启动 | 2.1-2.3 | 创建用户 + 种子分类成功 | ☐ |
| 后续启动 | 3.2-3.3 | 用户数据持久化 | ☐ |
| Tailwind CSS | 2.2 | 页面样式正确（蓝色按钮、绿色/黄色框） | ☐ |
| Zustand | 2.1 | 状态正确切换（loading → user） | ☐ |
| DB 数据正确 | 4.2-4.3 | users 表 1 行 + categories 表 18 行 | ☐ |
| Console 无错误 | 5.2 | DevTools Console 无红色条目 | ☐ |
| 日志完整 | 6.2-6.3 | 初始化 + 关闭日志均存在 | ☐ |
| Git 提交 | 7.3 | 提交成功，无 DB 文件入库 | ☐ |

---

## 补充：重置验证状态（可选）

如需重新测试首次启动场景（阶段 2），可删除 DB 文件重置状态：

```powershell
Remove-Item -Path "$env:APPDATA\@fire-app/desktop\fire-app\data\fire.db" -Force
Remove-Item -Path "$env:APPDATA\@fire-app/desktop\fire-app\data\fire.db-wal" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:APPDATA\@fire-app/desktop\fire-app\data\fire.db-shm" -Force -ErrorAction SilentlyContinue
```

删除后重新运行 `pnpm dev`，页面应再次显示黄色"首次启动"提示。

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
