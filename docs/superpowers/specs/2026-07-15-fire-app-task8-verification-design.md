# Task 8 端到端验证 — 操作步骤设计

> **关联计划：** `docs/superpowers/plans/2026-07-15-@fire-app/desktop-mvp-milestone1.md` — Task 8: 端到端验证
> **运行环境：** Windows（PowerShell）
> **目的：** 为计划的 Task 8 提供具体、可操作的验证步骤，每步含操作命令、预期结果、通过标准和故障排查

---

## 验证流程概览

共 8 个阶段，按顺序执行：

| 阶段 | 名称 | 对应计划步骤 |
|------|------|-------------|
| 0 | 前置准备 | 计划中未包含（补充） |
| 1 | 启动开发模式 | Step 1 |
| 2 | 首次启动验证（无用户场景） | Step 2 |
| 3 | 后续启动验证（有用户场景） | Step 3 |
| 4 | 数据库文件验证 | Step 4 |
| 5 | 种子分类验证 | Step 5 |
| 6 | 日志验证 | Step 6 |
| 7 | 提交最终状态 | Step 7 |

---

## 阶段 0：前置准备

在开始 Task 8 验证前，需确保代码已构建、依赖已安装。

| 步骤 | 命令 | 预期结果 | 通过标准 |
|------|------|----------|----------|
| 0.1 安装依赖 | `cd "d:\Admin\OneDrive\Apps\FIRE APP" && pnpm install` | 依赖安装成功，无报错 | 退出码 0，`node_modules` 存在 |
| 0.2 验证 shared 包测试 | `pnpm --filter @fire-app/shared test` | 所有现有测试通过 | Vitest 输出全部 PASS |
| 0.3 构建桌面应用 | `pnpm --filter @fire-app/desktop build` | electron-vite 构建成功 | `apps/desktop/dist/main/index.js`、`dist/preload/index.js`、`dist/renderer/` 均生成 |

**故障排查：**
- better-sqlite3 编译失败 → 确认已安装 Visual Studio Build Tools 或运行 `npm install -g windows-build-tools`
- pnpm install 报错 → 检查 `pnpm-workspace.yaml` 配置，确认 `packages/*` 和 `apps/*` 路径正确

---

### 实际遇到的问题（验证记录）

在 Windows 环境实际执行阶段 0 时，遇到了以下 6 个问题：

1. **pnpm 未安装** — 系统只有 npm，需先 `npm install -g pnpm`
2. **pnpm.onlyBuiltDependencies 弃用** — pnpm 11 不再读取 package.json 中的 `pnpm` 字段，需迁移到 `pnpm-workspace.yaml`
3. **minimumReleaseAge 拦截** — pnpm 11 供应链安全策略拒绝最近发布的包，需添加 `minimumReleaseAge: 0`
4. **Electron 二进制未下载** — install scripts 被拦截导致 Electron postinstall 未执行，需手动设置镜像源并运行 `node node_modules/electron/install.js`
5. **better-sqlite3 ABI 不匹配** — 原生模块针对系统 Node.js 编译，需 `npx @electron/rebuild -f` 重新编译
6. **preload 脚本未加载** — Electron 31 默认 `sandbox: true`，需设置 `sandbox: false`

这些问题已通过项目配置修复（.npmrc 镜像源、postinstall 自动 rebuild、pnpm-workspace.yaml 配置、sandbox: false），详见 README 故障排查章节。

## 阶段 1：启动开发模式

| 步骤 | 操作 | 预期结果 | 通过标准 |
|------|------|----------|----------|
| 1.1 启动应用 | `cd "d:\Admin\OneDrive\Apps\FIRE APP" && pnpm dev` | 终端输出 electron-vite 启动日志，约 5-10 秒后 Electron 窗口打开 | 窗口可见，标题栏显示 "FIRE 计算APP" |
| 1.2 观察初始页面 | 查看窗口内容 | 页面显示标题 "FIRE 计算APP — 架构验证"，下方 "数据通路验证" 区域显示黄色提示框："无用户记录（首次启动）" | 黄色框可见，"创建测试用户 + 种子分类" 按钮可点击 |
| 1.3 检查终端日志 | 查看终端输出 | 包含 `[DB] 数据库已初始化: ...fire.db` | 日志中可见 DB 初始化路径 |

**故障排查：**
- 窗口白屏 → 按 Ctrl+Shift+I 打开 DevTools，检查 Console 红色错误；常见原因：preload 脚本路径错误、`@shared` 别名未解析
- 终端报 `Cannot find module 'better-sqlite3'` → 运行 `pnpm install` 重新安装依赖

---

## 阶段 2：验证首次启动（无用户场景）

| 步骤 | 操作 | 预期结果 | 通过标准 |
|------|------|----------|----------|
| 2.1 点击创建按钮 | 点击 "创建测试用户 + 种子分类" 按钮 | 页面从黄色框变为绿色框，显示 "✓ IPC 桥验证通过" | 绿色框出现，无红色错误提示 |
| 2.2 验证用户信息 | 查看绿色框内容 | 显示：用户名 "测试用户"、货币 "CNY"、中国市场 "是"、用户 ID（UUID 格式） | 四项信息全部正确显示 |
| 2.3 验证技术栈清单 | 查看页面下方 "技术栈验证" 区域 | 清单末尾新增 "✓ 数据层 CRUD（用户创建 + 种子分类）" | 该条目出现且为绿色 ✓ |

**故障排查：**
- 点击后显示红色错误框 → 检查终端是否有 IPC handler 报错；常见原因：DB schema 未初始化、`createUser` 函数参数不匹配
- 点击后页面无反应 → 打开 DevTools Console 检查 `window.dataAccess` 是否定义；若 undefined 说明 preload 脚本未加载

---

## 阶段 3：验证后续启动（有用户场景）

| 步骤 | 操作 | 预期结果 | 通过标准 |
|------|------|----------|----------|
| 3.1 关闭应用 | 点击窗口右上角 X 关闭 Electron 窗口 | 窗口关闭，终端显示 `[DB] 数据库已关闭` | 窗口关闭，DB 关闭日志出现 |
| 3.2 重新启动 | 再次运行 `pnpm dev` | Electron 窗口打开，页面直接显示绿色框（无黄色框、无需点击创建按钮） | 绿色框直接出现，用户信息与上次一致 |

**故障排查：**
- 重启后仍显示黄色框（无用户） → DB 文件路径可能不持久。检查终端日志中的 DB 路径是否与上次一致；若不一致，检查 `db-manager.ts` 中 `getDataDir()` 是否使用了 `app.getPath('userData')`
- 用户信息不一致 → 检查是否误删了 DB 文件，或 `userData` 路径被清理

---

## 阶段 4：验证数据库文件创建

| 步骤 | 操作 | 预期结果 | 通过标准 |
|------|------|----------|----------|
| 4.1 定位 DB 文件 | PowerShell 运行：`Get-ChildItem -Path "$env:APPDATA\@fire-app/desktop\fire-app\data\fire.db"` | 文件存在 | 文件存在，大小 > 0（通常 > 12KB） |
| 4.2 验证用户表数据 | `sqlite3 "$env:APPDATA\@fire-app/desktop\fire-app\data\fire.db" "SELECT id, display_name, base_currency, is_china_market FROM users;"` | 输出一行：测试用户记录，display_name="测试用户"，base_currency="CNY"，is_china_market=1 | 查询返回 1 行，字段值正确 |
| 4.3 验证种子分类数 | `sqlite3 "$env:APPDATA\@fire-app/desktop\fire-app\data\fire.db" "SELECT COUNT(*) FROM categories;"` | 输出 `18` | 计数 = 18 |

> **注意：** 若系统未安装 sqlite3 命令行工具，可使用 [DB Browser for SQLite](https://sqlitebrowser.org/) 打开 DB 文件手动查看，或在 DevTools Console 中通过 `window.dataAccess` API 验证。

**故障排查：**
- 文件不存在 → 检查终端日志中的 DB 路径；`app.getPath('userData')` 在 Windows 上返回 `%APPDATA%\<app-name>`，确认 app name 为 `@fire-app/desktop`（由 package.json `name` 字段决定）
- sqlite3 命令未找到 → 下载 sqlite-tools 或使用 DB Browser for SQLite

---

## 阶段 5：验证种子分类创建

| 步骤 | 操作 | 预期结果 | 通过标准 |
|------|------|----------|----------|
| 5.1 打开 DevTools | 在 Electron 窗口按 `Ctrl+Shift+I` | DevTools 面板打开 | 面板可见 |
| 5.2 检查 Console | 查看 Console 标签页 | 无红色错误，无未捕获的 Promise rejection | Console 无红色条目 |
| 5.3 验证分类数据 | 在 PowerShell 中运行阶段 4.3 的 sqlite3 命令，确认返回 18 | 分类数 = 18 | 11 个支出 + 7 个收入 = 18 |
| 5.4 验证页面清单 | 查看页面 "技术栈验证" 区域 | 显示 "✓ 数据层 CRUD（用户创建 + 种子分类）" | 条目显示绿色 ✓ |

**故障排查：**
- Console 有 IPC 调用错误 → 检查 `ipc-handlers.ts` 中 `db:category:seed` handler 是否正确注册
- 分类数不为 18 → 检查 `seedCategories` 函数的 `SEED_CATEGORIES` 数组长度，确认 11 支出 + 7 收入

---

## 阶段 6：关闭 APP 并验证日志

| 步骤 | 操作 | 预期结果 | 通过标准 |
|------|------|----------|----------|
| 6.1 关闭应用 | 点击窗口 X 关闭 Electron | 窗口关闭 | 窗口消失 |
| 6.2 检查启动日志 | 滚动终端输出，查找启动期间日志 | 包含 `[DB] 数据库已初始化: <路径>\fire.db` | 日志存在，路径正确 |
| 6.3 检查关闭日志 | 查看终端末尾输出 | 包含 `[DB] 数据库已关闭` | 日志存在 |

**故障排查：**
- 无 "数据库已关闭" 日志 → 检查 `index.ts` 中 `app.on('window-all-closed', ...)` 是否调用了 `closeAppDatabase()`
- 日志中有其他错误 → 记录错误内容，对照相关代码排查

---

## 阶段 7：Commit 最终状态

| 步骤 | 操作 | 预期结果 | 通过标准 |
|------|------|----------|----------|
| 7.1 暂存文件 | `cd "d:\Admin\OneDrive\Apps\FIRE APP" && git add -A` | 文件被暂存 | 无报错 |
| 7.2 检查暂存内容 | `git status` | 确认无 `.db` 文件被暂存（应被 .gitignore 排除） | 无 DB 文件出现在暂存区 |
| 7.3 提交 | `git commit -m "feat: 里程碑1完成 — 架构验证切片端到端验证通过"` | 提交成功 | 退出码 0，`git log` 可见新提交 |

**故障排查：**
- DB 文件被暂存 → 检查 `.gitignore` 是否包含 `*.db` 规则；运行 `git rm --cached <db文件路径>` 移除后重新提交

---

## 完成标准对照表

| 检查项 | 对应阶段 | 验证方式 |
|--------|----------|----------|
| Monorepo 结构 | 0.3 | 构建成功即证明结构正确 |
| shared 包测试 | 0.2 | Vitest 全部通过 |
| Electron 启动 | 1.1 | 窗口打开 |
| DB 初始化 | 1.3 + 4.1 | 日志 + 文件存在 |
| IPC 通路 | 2.1-2.2 | 用户数据通过 IPC 返回并显示 |
| 首次启动 | 2.1-2.3 | 创建用户 + 种子分类成功 |
| 后续启动 | 3.2 | 用户数据持久化 |
| Tailwind CSS | 2.2 | 页面样式正确（蓝色按钮、绿色/黄色框） |
| Zustand | 2.1 | 状态正确切换（loading → user） |

---

## 补充：重置验证状态（可选）

如需重新测试首次启动场景（阶段 2），可删除 DB 文件重置状态：

```powershell
Remove-Item -Path "$env:APPDATA\@fire-app/desktop\fire-app\data\fire.db" -Force
Remove-Item -Path "$env:APPDATA\@fire-app/desktop\fire-app\data\fire.db-wal" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:APPDATA\@fire-app/desktop\fire-app\data\fire.db-shm" -Force -ErrorAction SilentlyContinue
```

删除后重新运行 `pnpm dev`，页面应再次显示黄色"首次启动"提示。
