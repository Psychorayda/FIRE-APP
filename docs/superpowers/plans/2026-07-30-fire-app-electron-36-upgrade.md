# FIRE-APP Electron 31→36 升级 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Electron 从 31.7.7（已 EOL）升级到 36.x，同步升级宿主 Node 20→22 LTS、better-sqlite3、@electron/rebuild、@types/node，以及构建工具链（electron-vite / electron-builder / vite / vitest），分 3 个串行 Phase 推进，每个 Phase 独立可验证、可回滚。

**Architecture:** 分层渐进升级（方案 B）。Phase 1 升宿主 Node 22 + check-env.mjs 动态化；Phase 2 升 Electron 36 + 原生模块（better-sqlite3 + @electron/rebuild）+ Electron breaking 审计；Phase 3 构建工具联动升级，内部分 3 子步（vite+electron-vite → vitest → electron-builder）。整个升级在独立分支 `chore/electron-36-upgrade` 上进行，任一 Phase 失败可独立 revert。

**Tech Stack:** Electron 36 / Node 22.14 / better-sqlite3 11.x / electron-vite 3 / electron-builder 26 / vite 6 / vitest 3 / React 19 / TypeScript 5.5

**Spec 输入**: [docs/superpowers/specs/2026-07-30-fire-app-electron-36-upgrade-design.md](file:///workspace/docs/superpowers/specs/2026-07-30-fire-app-electron-36-upgrade-design.md)

**关键约束**:
- better-sqlite3 仅升 11.x，不引入 12.x API breaking
- main/preload 代码零改动或仅必要适配
- 所有 M1-M9 单测必须全绿，不允许 skip
- 不做 Wiki 同步（升级合并后单独开 task）

---

## 文件结构

### 将要修改的文件

| 文件 | 责任 | 改动 Phase |
|---|---|---|
| [package.json](file:///workspace/package.json) | monorepo 根，engines.node + postinstall | P1 |
| [scripts/check-env.mjs](file:///workspace/scripts/check-env.mjs) | 环境检查脚本，硬编码版本号动态化 | P1 |
| [.github/workflows/build-release.yml](file:///workspace/.github/workflows/build-release.yml) | CI 配置，setup-node 版本 | P1 |
| `.nvmrc`（新建） | Node 版本声明，供 nvm/fnm 自动切换 | P1 |
| [apps/desktop/package.json](file:///workspace/apps/desktop/package.json) | desktop 依赖：electron / better-sqlite3 / @electron/rebuild / @types/node / 构建工具 | P2 + P3 |
| [packages/shared/package.json](file:///workspace/packages/shared/package.json) | shared 依赖：better-sqlite3 / @types/node / vitest | P2 + P3 |

### 不修改的文件（除非 breaking 强制）

- [apps/desktop/src/main/index.ts](file:///workspace/apps/desktop/src/main/index.ts) — main 进程入口
- [apps/desktop/src/preload/index.ts](file:///workspace/apps/desktop/src/preload/index.ts) — preload 脚本
- [apps/desktop/electron.vite.config.ts](file:///workspace/apps/desktop/electron.vite.config.ts) — 除非 electron-vite 3 API 变化
- [apps/desktop/vitest.config.ts](file:///workspace/apps/desktop/vitest.config.ts) — 除非 vitest 3 API 变化
- [apps/desktop/electron-builder.yml](file:///workspace/apps/desktop/electron-builder.yml) — 除非 electron-builder 26 配置变化

---

## Phase 1: 宿主 Node 22 LTS

### Task 1: 创建升级分支 + .nvmrc + 根 package.json engines bump

**Files:**
- Create: `.nvmrc`
- Modify: [package.json](file:///workspace/package.json) `engines.node` 字段

- [ ] **Step 1: 创建升级分支**

Run:
```bash
git checkout -b chore/electron-36-upgrade
git status
```
Expected: `On branch chore/electron-36-upgrade` / `nothing to commit, working tree clean`

- [ ] **Step 2: 创建 .nvmrc**

Create file `/workspace/.nvmrc` with content:
```
22.14.0
```

- [ ] **Step 3: 修改根 package.json engines.node**

Edit [package.json:7](file:///workspace/package.json#L7):
```json
"engines": {
  "node": ">=22.0.0 <24.0.0",
  "pnpm": ">=9.0.0"
},
```

- [ ] **Step 4: 切换到 Node 22.14 验证 engines 生效**

Run:
```bash
nvm use 22.14.0
node --version
```
Expected: `v22.14.0`

如果本地无 Node 22.14，先安装：`nvm install 22.14.0`

- [ ] **Step 5: 验证 pnpm 在 Node 22 下可用**

Run:
```bash
pnpm --version
```
Expected: `9.15.0`（或更高 9.x）

- [ ] **Step 6: Commit**

```bash
git add .nvmrc package.json
git commit -m "chore(upgrade): bump host Node engine to 22 LTS

- engines.node: >=20.0.0 <22.0.0 → >=22.0.0 <24.0.0
- 新增 .nvmrc (22.14.0) 供 nvm/fnm 自动切换"
```

---

### Task 2: check-env.mjs 动态化（消除硬编码版本号）

**Files:**
- Modify: [scripts/check-env.mjs](file:///workspace/scripts/check-env.mjs) — `checkNodeVersion()`、`checkNativeModule()`、`checkElectronBinary()` 三处

**Why:** 当前 [check-env.mjs:100](file:///workspace/scripts/check-env.mjs#L100) 硬编码 `electron@31.7.7`，[check-env.mjs:76](file:///workspace/scripts/check-env.mjs#L76) 硬编码 `better-sqlite3@11.10.0`，每次升级都要手改。改为运行时读取 `node_modules/<pkg>/package.json` 的 `version` 字段构造路径。

- [ ] **Step 1: 在 check-env.mjs 顶部新增 readPkgVersion 辅助函数**

Edit [scripts/check-env.mjs](file:///workspace/scripts/check-env.mjs)，在 `import` 块之后、`const __filename = ...` 之前插入：

```javascript
import { readFileSync } from 'node:fs';

/**
 * 读取 node_modules 下某包的 version 字段
 * Read version field from a package's package.json in node_modules
 * @param {string} pkgName 包名 / package name
 * @returns {string|null} 版本号；包不存在返回 null / version string; null if not installed
 */
function readPkgVersion(pkgName) {
  try {
    const pkgJson = JSON.parse(
      readFileSync(join(projectRoot, 'node_modules', pkgName, 'package.json'), 'utf-8')
    );
    return pkgJson.version ?? null;
  } catch {
    return null;
  }
}
```

注意：`join` 已在文件顶部 `import { join, resolve } from 'node:path'` 中导入，`projectRoot` 已在文件中定义。需要把 `readFileSync` 加到现有 `import { existsSync, statSync } from 'node:fs'` 行：

修改 [check-env.mjs:6](file:///workspace/scripts/check-env.mjs#L6)：
```javascript
import { existsSync, statSync, readFileSync } from 'node:fs';
```

- [ ] **Step 2: 重写 checkNodeVersion() 判定区间**

Edit [check-env.mjs:40-47](file:///workspace/scripts/check-env.mjs#L40) `checkNodeVersion` 函数：

```javascript
// 检测 1: Node 版本 / Check Node version
function checkNodeVersion() {
  const version = process.version;
  const major = parseInt(version.slice(1));
  const passed = major >= 22 && major < 24;
  const detail = `${version} (要求 >=22 <24)`;
  const fix = passed ? null : '安装 Node 22 LTS:\n  nvm install 22.14.0\n  nvm use 22.14.0\n或手动下载: https://npmmirror.com/mirrors/node/v22.14.0/';
  addResult('Node 版本', passed, detail, fix);
}
```

- [ ] **Step 3: 重写 checkNativeModule() 用动态版本号**

Edit [check-env.mjs:73-95](file:///workspace/scripts/check-env.mjs#L73) `checkNativeModule` 函数：

```javascript
// 检测 4: 原生模块状态 / Check native module
function checkNativeModule() {
  // 动态读取 better-sqlite3 版本，避免硬编码 / Read version dynamically to avoid hardcoding
  const sqliteVersion = readPkgVersion('better-sqlite3');
  if (!sqliteVersion) {
    addResult('原生模块', false, 'better-sqlite3 未安装', '安装依赖:\n  pnpm install');
    return;
  }

  // 查找 better-sqlite3 的 .node 文件
  const possiblePaths = [
    join(projectRoot, 'node_modules', '.pnpm', `better-sqlite3@${sqliteVersion}`, 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node'),
    join(projectRoot, 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node'),
  ];

  const foundPath = possiblePaths.find(p => existsSync(p));
  if (!foundPath) {
    addResult('原生模块', false, 'better_sqlite3.node 未找到', '为 Electron 编译原生模块:\n  pnpm --filter @fire-app/desktop rebuild');
    return;
  }

  // 检查文件修改时间是否新于 package.json（确保 rebuild 过）
  const nodeMtime = statSync(foundPath).mtime;
  const pkgJsonPath = join(projectRoot, 'package.json');
  const pkgMtime = existsSync(pkgJsonPath) ? statSync(pkgJsonPath).mtime : new Date(0);
  const fresh = nodeMtime > pkgMtime || nodeMtime.getTime() > Date.now() - 86400000 * 7; // 7 天内编译过

  const detail = fresh ? `已编译 v${sqliteVersion} (${foundPath.split(/[\\/]/).slice(-3).join('/')})` : `已编译 v${sqliteVersion} 但可能过期`;
  const fix = fresh ? null : '重新编译原生模块:\n  pnpm --filter @fire-app/desktop rebuild';
  addResult('原生模块', fresh, detail, fix);
}
```

- [ ] **Step 4: 重写 checkElectronBinary() 用动态版本号**

Edit [check-env.mjs:98-114](file:///workspace/scripts/check-env.mjs#L98) `checkElectronBinary` 函数：

```javascript
// 检测 5: electron 二进制 / Check electron binary
function checkElectronBinary() {
  // 动态读取 electron 版本 / Read electron version dynamically
  const electronVersion = readPkgVersion('electron');
  if (!electronVersion) {
    addResult('Electron 二进制', false, 'electron 包未安装', '安装依赖:\n  pnpm install');
    return;
  }

  // electron 包路径
  const electronPkgPath = join(
    projectRoot, 'node_modules', '.pnpm',
    `electron@${electronVersion}`, 'node_modules', 'electron'
  );
  const electronPathTxt = join(electronPkgPath, 'path.txt');

  if (!existsSync(electronPkgPath)) {
    addResult('Electron 二进制', false, `electron@${electronVersion} 包目录未找到`, '重新安装依赖:\n  pnpm install');
    return;
  }

  // path.txt 是 electron install 后生成的，存在说明二进制已下载
  if (existsSync(electronPathTxt)) {
    addResult('Electron 二进制', true, `已下载 v${electronVersion}`, null);
  } else {
    addResult('Electron 二进制', false, `path.txt 不存在，v${electronVersion} 二进制可能未下载`, `下载 electron 二进制:\n  cd node_modules/.pnpm/electron@${electronVersion}/node_modules/electron\n  node install.js`);
  }
}
```

- [ ] **Step 5: 运行 check-env.mjs 验证输出**

Run:
```bash
node scripts/check-env.mjs
```
Expected: 输出包含
```
[✓] Node 版本: v22.14.0 (要求 >=22 <24)
[✓] 原生模块: 已编译 v11.10.0 (Release/better_sqlite3.node)   # 或 [✗] 若未编译
[✓] Electron 二进制: 已下载 v31.7.7                            # 当前仍是 31，P2 后变 36
```

注意：此时 Node 版本必须显示 v22.14.0（已切到 Node 22）；Electron 仍是 31.7.7（P2 才升）；better-sqlite3 仍是 11.10.0（P2 才升）。**关键验证点是版本号从 `node_modules/<pkg>/package.json` 动态读取，不再硬编码。**

- [ ] **Step 6: 验证 quiet 模式仍正常**

Run:
```bash
node scripts/check-env.mjs --quiet
```
Expected: 只输出未通过项（此时应全部通过，无输出或仅 OneDrive 警告）

- [ ] **Step 7: Commit**

```bash
git add scripts/check-env.mjs
git commit -m "refactor(check-env): read electron/better-sqlite3 versions dynamically

- 新增 readPkgVersion() 辅助函数读取 node_modules/<pkg>/package.json
- checkNativeModule/checkElectronBinary 不再硬编码版本号
- checkNodeVersion 判定区间改为 >=22 <24
- 避免每次升级都要手改两处硬编码路径"
```

---

### Task 3: CI workflow Node 版本升级 + P1 集成验证

**Files:**
- Modify: [.github/workflows/build-release.yml](file:///workspace/.github/workflows/build-release.yml) `setup-node` 步骤

- [ ] **Step 1: 修改 CI workflow 的 Node 版本**

Edit [.github/workflows/build-release.yml:15-18](file:///workspace/.github/workflows/build-release.yml#L15)：

```yaml
      - name: Setup Node 22.14.0
        uses: actions/setup-node@v4
        with:
          node-version: '22.14.0'
```

- [ ] **Step 2: 在 Node 22 下重新安装依赖**

Run:
```bash
nvm use 22.14.0
pnpm install
```
Expected: 安装成功。**关键观察点**：better-sqlite3 是否触发源码编译。

- 如果安装成功且无 better-sqlite3 编译错误 → 继续 Step 3
- 如果 better-sqlite3 编译失败（prebuilt 缺失） → 触发 spec §3.5 前移条件，立即跳到 Task 5 先升 better-sqlite3，再回 P1 验证

- [ ] **Step 3: 运行 check-env.mjs 确认全绿**

Run:
```bash
node scripts/check-env.mjs
```
Expected: 所有检查项通过（Node 22.14 + 动态版本号 + 原生模块已编译 + Electron 二进制已下载）

- [ ] **Step 4: 运行全部单测**

Run:
```bash
pnpm test:all
```
Expected: shared + desktop 所有测试全绿，无 skip。

如果有测试因 Node 22 行为差异失败，**必须修复**，不允许 skip。记录失败用例与根因到 commit message。

- [ ] **Step 5: 验证 dev 启动（确保 Node 22 下 Electron 31 仍能跑）**

Run:
```bash
pnpm --filter @fire-app/desktop dev &
sleep 15
# 观察窗口是否正常显示，DB 是否初始化
kill %1
```
Expected: Electron 窗口正常启动，控制台无 fatal error。

注意：CI=true 沙箱环境可能无法启动 GUI，需在本地手动验证。本步骤在 CI 上可跳过，但合并前必须本地通过。

- [ ] **Step 6: Commit CI 配置改动**

```bash
git add .github/workflows/build-release.yml
git commit -m "ci: bump setup-node to 22.14.0 for Electron 36 upgrade

Phase 1 完成：宿主 Node 20.18 → 22.14 LTS"
```

- [ ] **Step 7: Push 分支触发 CI 验证**

```bash
git push -u origin chore/electron-36-upgrade
```
Expected: CI 在 Node 22.14 上跑 install + test + build + dist 全绿。

**Phase 1 出口检查**：CI 全绿后才允许进入 Phase 2。若 CI 失败，必须修复后重跑，不得绕过。

---

## Phase 2: Electron 36 + 原生模块

### Task 4: 升级 electron + @types/node 到 36/22

**Files:**
- Modify: [apps/desktop/package.json](file:///workspace/apps/desktop/package.json) `devDependencies.electron` + `devDependencies.@types/node`
- Modify: [packages/shared/package.json](file:///workspace/packages/shared/package.json) `devDependencies.@types/node`

- [ ] **Step 1: 查询 electron 36.x 最新稳定版**

Run:
```bash
npm view electron@^36 version | tail -5
```
Expected: 列出 36.x 系列版本，取最新（如 `36.0.0` 或更高 patch）

- [ ] **Step 2: 查询 @types/node 22.x 最新版**

Run:
```bash
npm view @types/node@^22 version | tail -5
```
Expected: 列出 22.x 系列，取最新

- [ ] **Step 3: 修改 apps/desktop/package.json 的 electron 和 @types/node**

Edit [apps/desktop/package.json:41](file:///workspace/apps/desktop/package.json#L41) 和 [apps/desktop/package.json:36](file:///workspace/apps/desktop/package.json#L36)：

```json
"@types/node": "^22.14.0",
...
"electron": "^36.0.0",
```

- [ ] **Step 4: 修改 packages/shared/package.json 的 @types/node**

Edit [packages/shared/package.json:18](file:///workspace/packages/shared/package.json#L18)：

```json
"@types/node": "^22.14.0",
```

- [ ] **Step 5: 安装新版本**

Run:
```bash
pnpm install
```
Expected: electron 36.x 下载 + 安装成功。**注意**：electron 二进制下载可能较慢，若失败可设置 `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/`。

- [ ] **Step 6: 验证 electron 版本**

Run:
```bash
npx electron --version
```
Expected: `v36.x.x`

- [ ] **Step 7: 运行 check-env.mjs 验证动态读取生效**

Run:
```bash
node scripts/check-env.mjs
```
Expected: `[✓] Electron 二进制: 已下载 v36.x.x`（版本号从 31.7.7 变为 36.x）

- [ ] **Step 8: Commit**

```bash
git add apps/desktop/package.json packages/shared/package.json pnpm-lock.yaml
git commit -m "chore(upgrade): bump electron 31→36 and @types/node 20→22

- electron: ^31.0.0 → ^36.0.0 (Chromium 136, Node 22.14)
- @types/node: ^20.14.0 → ^22.14.0 (对齐宿主 + Electron 捆绑 Node)"
```

---

### Task 5: 升级 better-sqlite3 + @electron/rebuild + rebuild

**Files:**
- Modify: [apps/desktop/package.json](file:///workspace/apps/desktop/package.json) `dependencies.better-sqlite3` + `devDependencies.@electron/rebuild` + `devDependencies.@types/better-sqlite3`
- Modify: [packages/shared/package.json](file:///workspace/packages/shared/package.json) `dependencies.better-sqlite3` + `devDependencies.@types/better-sqlite3`

- [ ] **Step 1: 查询 better-sqlite3 11.x 最新版**

Run:
```bash
npm view better-sqlite3@^11 version | tail -5
```
Expected: 列出 11.x 系列，取最新（如 `11.18.0` 或更高）

- [ ] **Step 2: 查询 @electron/rebuild 3.x 最新版**

Run:
```bash
npm view @electron/rebuild@^3 version | tail -5
```
Expected: 列出 3.x 系列，取最新

- [ ] **Step 3: 查询 @types/better-sqlite3 最新 7.x**

Run:
```bash
npm view @types/better-sqlite3@^7 version | tail -5
```
Expected: 列出 7.x 系列，取最新

- [ ] **Step 4: 修改 apps/desktop/package.json**

Edit [apps/desktop/package.json](file:///workspace/apps/desktop/package.json) 三处：

```json
"better-sqlite3": "^11.18.0",
...
"@types/better-sqlite3": "^7.6.13",
...
"@electron/rebuild": "^3.7.0",
```

实际版本号以 Step 1-3 查询结果为准（`^11.18.0` / `^3.7.0` / `^7.6.13` 是写作时的预期值，实施时用查询到的最新版替换）。

- [ ] **Step 5: 修改 packages/shared/package.json**

Edit [packages/shared/package.json:13](file:///workspace/packages/shared/package.json#L13) 和 [packages/shared/package.json:17](file:///workspace/packages/shared/package.json#L17)：

```json
"better-sqlite3": "^11.18.0",
...
"@types/better-sqlite3": "^7.6.13",
```

- [ ] **Step 6: 安装新版本**

Run:
```bash
pnpm install
```
Expected: better-sqlite3 11.x 最新版安装成功。**关键观察**：是否提供 Node 22 + Electron 36 ABI 的 prebuilt。若触发源码编译且失败，需确保系统有 `python` + 编译工具链（Windows: MSVC；CI windows-latest 自带）。

- [ ] **Step 7: 为 Electron 36 ABI 重编译 better-sqlite3**

Run:
```bash
pnpm --filter @fire-app/desktop rebuild
```
Expected: `@electron/rebuild` 成功为 Electron 36 的 ABI 编译 better-sqlite3 的 `.node` 文件，无错误。

如果失败：
1. 检查 `python --version` 是否可用（better-sqlite3 源码编译需要 python）
2. 检查 MSVC / clang 是否可用
3. 若 better-sqlite3 11.x 确认不兼容 Electron 36 ABI → 触发 spec §4.5 风险缓解，评估升 12.x（破保守约束，需用户确认）

- [ ] **Step 8: 验证 check-env.mjs 显示新版本**

Run:
```bash
node scripts/check-env.mjs
```
Expected:
```
[✓] 原生模块: 已编译 v11.18.0 (Release/better_sqlite3.node)
[✓] Electron 二进制: 已下载 v36.x.x
```

- [ ] **Step 9: 运行全部单测**

Run:
```bash
pnpm test:all
```
Expected: 全绿。better-sqlite3 11.x 内部升级不应有 API breaking，所有 DB 相关测试应通过。

- [ ] **Step 10: Commit**

```bash
git add apps/desktop/package.json packages/shared/package.json pnpm-lock.yaml
git commit -m "chore(upgrade): bump better-sqlite3 + @electron/rebuild for Electron 36 ABI

- better-sqlite3: ^11.0.0 → ^11.18.0 (保守升小版本，11.x 已支持 Node 22 ABI)
- @electron/rebuild: ^3.6.0 → ^3.7.0 (支持 Electron 36 ABI)
- @types/better-sqlite3: 跟随升级
- 已为 Electron 36 重编译 .node 文件"
```

---

### Task 6: Electron 36 breaking 审计 + P2 集成验证

**Files:**
- 可能修改: [apps/desktop/src/main/index.ts](file:///workspace/apps/desktop/src/main/index.ts) — 仅当审计发现 breaking 时
- 可能修改: [apps/desktop/src/preload/index.ts](file:///workspace/apps/desktop/src/preload/index.ts) — 仅当审计发现 breaking 时

**Why:** spec §4.2 预期 main/preload 零改动，但必须实测验证，不能假设。本 Task 是审计 + 验证步骤，无代码改动除非 breaking 强制。

- [ ] **Step 1: 启动 dev server 验证 Electron 36 运行**

Run:
```bash
pnpm --filter @fire-app/desktop dev &
sleep 20
# 观察窗口是否正常显示，控制台是否有 deprecation warning
kill %1
```
Expected: Electron 36 窗口正常启动，控制台无 fatal error。

**关键观察点**：
- 窗口是否正常显示（Chromium 136 渲染）
- DB 是否初始化成功（better-sqlite3 + Electron 36 ABI）
- IPC 通信是否正常（sandbox:true + contextIsolation:true）
- 是否有 deprecation warning（记录但不一定需修复）

注意：CI=true 沙箱环境可能无法启动 GUI，需在本地手动验证。

- [ ] **Step 2: 审计 main/index.ts 对照 Electron 32-36 breaking 清单**

逐条核查 [apps/desktop/src/main/index.ts](file:///workspace/apps/desktop/src/main/index.ts)：

1. **Electron 32 — `webContents.setWindowOpenHandler`**：[index.ts:63-68](file:///workspace/apps/desktop/src/main/index.ts#L63) 实现返回 `{ action: 'deny' }` 并调用 `shell.openExternal`。Electron 32 行为微调不影响此实现。✅ 无需改
2. **Electron 33 — `webRequest.onHeadersReceived`**：[index.ts:105-113](file:///workspace/apps/desktop/src/main/index.ts#L105) CSP 注入。API 签名不变。✅ 无需改
3. **Electron 34 — 默认 `sandbox: true`**：[index.ts:53](file:///workspace/apps/desktop/src/main/index.ts#L53) 已显式 `sandbox: true`。✅ 无需改
4. **Electron 35 — `contextIsolation: true` 唯一支持**：[index.ts:52](file:///workspace/apps/desktop/src/main/index.ts#L52) 已显式启用。✅ 无需改
5. **Electron 36 — Node 22.14 / Chromium 136**：原生模块 ABI 已在 Task 5 rebuild 解决。✅ 无需改

如果审计发现实际 breaking（dev 启动报错或控制台 warning 指向某 API），在此 Step 修复并记录到 commit message。

- [ ] **Step 3: 审计 preload/index.ts**

[preload/index.ts](file:///workspace/apps/desktop/src/preload/index.ts) 仅用 `contextBridge.exposeInMainWorld` + `ipcRenderer.invoke`，这两个 API 在 Electron 32-36 均稳定。✅ 预期无需改

- [ ] **Step 4: 运行 electron-vite build 验证生产构建**

Run:
```bash
pnpm --filter @fire-app/desktop build
```
Expected: `out/main/index.js` + `out/preload/index.mjs` + `out/renderer/` 产物生成，无错误。

- [ ] **Step 5: 运行 electron-builder 打包验证**

Run:
```bash
pnpm --filter @fire-app/desktop dist
```
Expected: `release/` 下生成 `.exe` 安装包，无错误。

**注意**：此时 electron-builder 仍是 25（P3.3 才升）。如果 electron-builder 25 不支持 Electron 36 打包导致失败，spec §4.5 缓解方案：暂用 `--dir` 产出未打包目录验证：

```bash
pnpm --filter @fire-app/desktop exec electron-builder --config electron-builder.yml --dir
```

如果 `--dir` 也失败，需把 P3.3 (electron-builder 升级) 前移到 P2 之前。记录决策到 commit message。

- [ ] **Step 6: 手动 E2E 验证 dist 产物（本地必做）**

安装/运行 `release/` 下的 `.exe`（或 `--dir` 产出的目录），执行 spec §4.4 的 6 步：

1. 首次启动 onboarding 向导
2. 创建账户 + 增删交易 + 余额联动
3. CSV 导入（7 模板之一）+ JSON 导出/导入
4. 净资产趋势图 + FIRE 计算器渲染
5. 重启应用 → 数据持久验证
6. CSP 拦截 + 外链打开系统浏览器

Expected: 6 步全过。

注意：本步骤在 CI 上无法执行，必须本地手动验证。验证通过后才算 P2 完成。

- [ ] **Step 7: Commit（仅当有 breaking 适配改动时）**

如果 Step 2-3 审计发现需要改动 main/preload 代码：

```bash
git add apps/desktop/src/main/index.ts apps/desktop/src/preload/index.ts
git commit -m "fix(electron-36): adapt to breaking changes

<列出具体 breaking 与适配>"
```

如果零改动（预期情况），跳过本 Step，P2 出口检查后直接进入 P3。

- [ ] **Step 8: Push 触发 CI 验证 P2**

```bash
git push
```
Expected: CI 全绿（Node 22.14 + Electron 36 + better-sqlite3 11.x + electron-builder 25）。

**Phase 2 出口检查**：
- ✅ dev 启动正常
- ✅ `pnpm test:all` 全绿
- ✅ `pnpm dist` 产出可用 .exe
- ✅ 手动 E2E 6 步全过
- ✅ CI 全绿

任一不满足必须修复后重跑，不得绕过。

---

## Phase 3: 构建工具联动

### Task 7 (P3.1): 升级 vite + @vitejs/plugin-react + electron-vite

**Files:**
- Modify: [apps/desktop/package.json](file:///workspace/apps/desktop/package.json) `devDependencies.vite` + `devDependencies.@vitejs/plugin-react` + `devDependencies.electron-vite`
- 可能修改: [apps/desktop/electron.vite.config.ts](file:///workspace/apps/desktop/electron.vite.config.ts) — 仅当 electron-vite 3 API 变化

- [ ] **Step 1: 查询目标版本**

Run:
```bash
npm view electron-vite@^3 version | tail -3
npm view vite@^6 version | tail -3
npm view @vitejs/plugin-react@^4 version | tail -3
```
Expected: 列出 3.x / 6.x / 4.x 最新版

- [ ] **Step 2: 修改 apps/desktop/package.json 三处版本**

Edit [apps/desktop/package.json](file:///workspace/apps/desktop/package.json)：

```json
"@vitejs/plugin-react": "^4.5.0",
...
"electron": "^36.0.0",
"electron-builder": "^25",
"electron-vite": "^3.0.0",
...
"vite": "^6.0.0",
```

实际版本号以 Step 1 查询为准。

- [ ] **Step 3: 安装新版本**

Run:
```bash
pnpm install
```
Expected: 安装成功，无 peer dep 冲突。

如果出现 peer dep 警告（如 vitest 2.x 不兼容 vite 6），记录但暂不处理——P3.2 会升 vitest。如果出现 peer dep **错误**（安装中断），需把 vitest 升级前移到本 Task 一起处理。

- [ ] **Step 4: 验证 electron-vite 3 API 兼容性**

Read [apps/desktop/electron.vite.config.ts](file:///workspace/apps/desktop/electron.vite.config.ts)，核查 `externalizeDepsPlugin` 和 `defineConfig` 签名。

查阅 electron-vite 3 migration guide（https://electron-vite.org/guide/migration）确认无 breaking。

如果 API 变化，适配 [electron.vite.config.ts](file:///workspace/apps/desktop/electron.vite.config.ts)。

- [ ] **Step 5: 运行 dev 验证**

Run:
```bash
pnpm --filter @fire-app/desktop dev &
sleep 15
kill %1
```
Expected: Vite 6 + electron-vite 3 下 dev 启动正常，HMR 工作。

- [ ] **Step 6: 运行 build 验证生产构建**

Run:
```bash
pnpm --filter @fire-app/desktop build
```
Expected: `out/` 产物生成，无错误。Vite 6 的 rollup 升级可能影响 `manualChunks`，[electron.vite.config.ts:38-42](file:///workspace/apps/desktop/electron.vite.config.ts#L38) 的配置需保留有效。

- [ ] **Step 7: 运行单测（此时 vitest 仍是 2.x，验证 vite 6 不破坏）**

Run:
```bash
pnpm test:all
```
Expected: 全绿。如果 vitest 2.x 与 vite 6 不兼容导致测试失败，需把 P3.2 前移合并到本 Task。

- [ ] **Step 8: Commit**

```bash
git add apps/desktop/package.json pnpm-lock.yaml
git commit -m "chore(upgrade): bump vite 5→6 + electron-vite 2→3 + @vitejs/plugin-react

P3.1 完成：构建工具联动升级第一步
- vite: ^5.4.0 → ^6.0.0
- electron-vite: ^2.0.0 → ^3.0.0 (支持 Vite 6 + Electron 36)
- @vitejs/plugin-react: 跟随升级
- 验证 dev + build 通过"
```

---

### Task 8 (P3.2): 升级 vitest + jsdom

**Files:**
- Modify: [apps/desktop/package.json](file:///workspace/apps/desktop/package.json) `devDependencies.vitest` + `devDependencies.jsdom`
- Modify: [packages/shared/package.json](file:///workspace/packages/shared/package.json) `devDependencies.vitest`
- 可能修改: [apps/desktop/vitest.config.ts](file:///workspace/apps/desktop/vitest.config.ts) — 仅当 vitest 3 API 变化
- 可能修改: [packages/shared/vitest.config.ts](file:///workspace/packages/shared/vitest.config.ts) — 同上

- [ ] **Step 1: 查询目标版本**

Run:
```bash
npm view vitest@^3 version | tail -3
npm view jsdom@^26 version | tail -3
```
Expected: 列出 3.x / 26.x 最新版

- [ ] **Step 2: 修改 apps/desktop/package.json**

Edit [apps/desktop/package.json](file:///workspace/apps/desktop/package.json)：

```json
"jsdom": "^26.0.0",
...
"vitest": "^3.0.0",
```

- [ ] **Step 3: 修改 packages/shared/package.json**

Edit [packages/shared/package.json:21](file:///workspace/packages/shared/package.json#L21)：

```json
"vitest": "^3.0.0",
```

- [ ] **Step 4: 安装新版本**

Run:
```bash
pnpm install
```
Expected: 安装成功，无 peer dep 冲突（vite 6 已在 Task 7 升级，vitest 3 兼容）。

- [ ] **Step 5: 核查 vitest 3 API 兼容性**

查阅 vitest 3 migration guide（https://vitest.dev/guide/migration）。

重点核查 [apps/desktop/vitest.config.ts](file:///workspace/apps/desktop/vitest.config.ts)：
- `pool: 'threads'` — vitest 3 仍支持，但默认值可能变化。当前已显式指定，无影响。
- `poolOptions.threads.singleThread` — vitest 3 仍支持。
- `globals: true` — 仍支持。
- `environment: 'jsdom'` — 仍支持。
- `setupFiles` — 仍支持。

如果 API 变化，适配 [vitest.config.ts](file:///workspace/apps/desktop/vitest.config.ts)。

- [ ] **Step 6: 运行 desktop 单测**

Run:
```bash
pnpm --filter @fire-app/desktop test
```
Expected: 全绿。vitest 3 主要 breaking 在 pool 默认值，当前已显式 `threads`，预期无影响。

如果失败，逐条分析：
- 测试 API（`describe`/`it`/`expect`/`vi`）签名变化 → 适配测试代码
- `@testing-library/react` 16 与 vitest 3 兼容性 → 预期兼容
- jsdom 26 行为差异 → 适配测试

**不允许 skip 或删除测试**，必须修复。

- [ ] **Step 7: 运行 shared 单测**

Run:
```bash
pnpm --filter @fire-app/shared test
```
Expected: 全绿。

- [ ] **Step 8: 运行全部单测确认**

Run:
```bash
pnpm test:all
```
Expected: 全绿。

- [ ] **Step 9: Commit**

```bash
git add apps/desktop/package.json packages/shared/package.json pnpm-lock.yaml
git commit -m "chore(upgrade): bump vitest 2→3 + jsdom 25→26

P3.2 完成：构建工具联动升级第二步
- vitest: ^2.0.0 → ^3.0.0 (兼容 Vite 6)
- jsdom: ^25.0.0 → ^26.0.0 (跟随 vitest 3 peer dep)
- 所有 M1-M9 单测全绿，无 skip"
```

---

### Task 9 (P3.3): 升级 electron-builder + P3 出口验证

**Files:**
- Modify: [apps/desktop/package.json](file:///workspace/apps/desktop/package.json) `devDependencies.electron-builder`
- 可能修改: [apps/desktop/electron-builder.yml](file:///workspace/apps/desktop/electron-builder.yml) — 仅当 electron-builder 26 配置变化

- [ ] **Step 1: 查询目标版本**

Run:
```bash
npm view electron-builder@^26 version | tail -3
```
Expected: 列出 26.x 最新版

- [ ] **Step 2: 修改 apps/desktop/package.json**

Edit [apps/desktop/package.json:42](file:///workspace/apps/desktop/package.json#L42)：

```json
"electron-builder": "^26",
```

- [ ] **Step 3: 安装新版本**

Run:
```bash
pnpm install
```
Expected: 安装成功。

- [ ] **Step 4: 核查 electron-builder 26 配置兼容性**

查阅 electron-builder 26 release notes / migration guide。

Read [apps/desktop/electron-builder.yml](file:///workspace/apps/desktop/electron-builder.yml)，逐项核查：
- `appId` / `productName` / `directories` / `files` — 不变
- `asar` / `asarUnpack` — 不变
- `win.target` (nsis / portable) — 不变
- `nsis.*` — 不变

如果配置项变化（如某字段重命名或废弃），适配 [electron-builder.yml](file:///workspace/apps/desktop/electron-builder.yml)。

- [ ] **Step 5: 运行 dist 验证打包**

Run:
```bash
pnpm --filter @fire-app/desktop dist
```
Expected: `release/` 下生成 `.exe` 安装包 + portable 版，无错误。

- [ ] **Step 6: 运行全部单测最终确认**

Run:
```bash
pnpm test:all
```
Expected: 全绿。

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/package.json pnpm-lock.yaml
git commit -m "chore(upgrade): bump electron-builder 25→26

P3.3 完成：构建工具联动升级收尾
- electron-builder: ^25 → ^26 (支持 Electron 36 打包)
- 验证 dist 产出可用 .exe"
```

- [ ] **Step 8: Push 触发 CI 验证 P3**

```bash
git push
```
Expected: CI 全绿（Node 22.14 + Electron 36 + 全套构建工具最新版）。

**Phase 3 出口检查**：
- ✅ `pnpm test:all` 全绿
- ✅ `pnpm --filter @fire-app/desktop build` 成功
- ✅ `pnpm --filter @fire-app/desktop dist` 成功
- ✅ CI 全绿

---

### Task 10: 完整 E2E 验证 + PR 准备

**Files:**
- 无代码改动，纯验证 + PR 准备

- [ ] **Step 1: 本地完整 E2E 验证（dist 产物）**

运行 `release/` 下的最新 `.exe`，执行 spec §6.2 的完整 6 步：

1. 安装 .exe → 首次启动 onboarding 向导 → 通过
2. 创建账户 + 增删交易 + 余额联动 → 通过
3. CSV 导入（7 模板之一）+ JSON 导出/导入 → 通过
4. 净资产趋势图 + FIRE 计算器渲染 → 通过
5. 重启应用 → 数据持久验证 → 通过
6. CSP 拦截 + 外链打开系统浏览器 → 通过

Expected: 6 步全过。

- [ ] **Step 2: 验证 check-env.mjs 最终输出**

Run:
```bash
node scripts/check-env.mjs
```
Expected:
```
[✓] Node 版本: v22.14.0 (要求 >=22 <24)
[✓] pnpm 版本: 9.15.0 (要求 >=9)
[✓] OneDrive 路径: <cwd>
[✓] 原生模块: 已编译 v11.18.0 (Release/better_sqlite3.node)
[✓] Electron 二进制: 已下载 v36.x.x
```

- [ ] **Step 3: 验证 spec §8 验收标准逐条**

逐条核对 spec §8：
1. ✅ Electron 36.x 运行，CI 全绿
2. ✅ 所有 M1-M9 单测全绿（无 skip）
3. ✅ `pnpm dist` 产出可用的 Windows .exe
4. ✅ 手动 E2E 6 步全过
5. ✅ check-env.mjs 输出 Node 22.14 + 动态版本号
6. ✅ main 进程代码零改动或仅必要适配改动
7. ✅ 本 spec 不在范围内的事项（Wiki 同步等）未越界执行

- [ ] **Step 4: 推送最终状态**

Run:
```bash
git push
```
Expected: CI 全绿。

- [ ] **Step 5: 创建 PR**

Run:
```bash
gh pr create --title "chore: Electron 31→36 upgrade (Node 22 + 全栈工具链联动)" --body "$(cat <<'EOF'
## Summary

分层渐进升级 Electron 31→36，同步升级宿主 Node、原生模块、构建工具链。

## Phases

- **Phase 1**: 宿主 Node 20→22 LTS + check-env.mjs 动态化
- **Phase 2**: Electron 31→36 + better-sqlite3 11.x + @electron/rebuild
- **Phase 3**: electron-vite 2→3 / vite 5→6 / vitest 2→3 / electron-builder 25→26

## 保守约束

- better-sqlite3 仅升 11.x，不引入 12.x API breaking
- main/preload 代码零改动或仅必要适配

## Verification

- ✅ 所有 M1-M9 单测全绿（无 skip）
- ✅ \`pnpm dist\` 产出可用 .exe
- ✅ 手动 E2E 6 步全过（onboarding / 交易 CRUD / CSV 导入 / 图表渲染 / 数据持久 / CSP）
- ✅ CI 全绿

## Spec

[docs/superpowers/specs/2026-07-30-fire-app-electron-36-upgrade-design.md](file:///workspace/docs/superpowers/specs/2026-07-30-fire-app-electron-36-upgrade-design.md)

## Out of scope

- Wiki 同步（合并后单独开 task）
- Electron 36 新功能采用
- better-sqlite3 12.x 评估
EOF
)"
```
Expected: PR 创建成功。

- [ ] **Step 6: 通知用户审核 PR**

输出 PR 链接给用户，等待用户审核合并。

**不主动合并到 main**——等用户确认后再合并。合并后 main 即完成 Electron 36 升级。

---

## 完成后后续工作（不在本计划范围）

1. **Wiki 同步**：单独开 task，更新 [08-design-index.md](file:///workspace/docs/wiki/08-design-index.md) 第 5 节"尚未实现的规划"中的"Electron 31→36 升级"条目，标记为已完成
2. **删除升级分支**：PR 合并后 `git branch -d chore/electron-36-upgrade`
