# 环境搭建自动化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将本地环境搭建从"反复踩坑 + 聊天记录贴命令"降为"clone → pnpm setup → dev"三步，配置错误时主动给出可复制的修复命令。

**Architecture:** 配置文件层（`.nvmrc` + `.npmrc` 增强 + engines）+ 环境检查脚本（`scripts/check-env.mjs`）+ 一键安装脚本（`scripts/setup.mjs`）+ preinstall 钩子自动检测 + README/env-setup 文档。脚本用 Node.js ESM 编写，跨 shell 兼容（cmd/PowerShell/bash 通用）。

**Tech Stack:** Node.js 20 LTS + pnpm 9 + nvm + Electron 31 + better-sqlite3

---

## 关键约定

### 验证命令表

| 动作 | 命令 | 预期 |
|---|---|---|
| 跑环境检查 | `node scripts/check-env.mjs` | 输出 5 项检测结果 + 退出码 0 |
| 跑环境检查（静默） | `node scripts/check-env.mjs --quiet` | 仅输出问题项 |
| 跑一键安装 | `node scripts/setup.mjs` | install + rebuild + 验证 + 输出启动命令 |
| 验证 pnpm 钩子 | `pnpm install` | preinstall 静默跑 check-env |
| 验证 desktop rebuild | `pnpm --filter @fire-app/desktop rebuild` | 编译 better-sqlite3 for Electron |

### 与设计文档的偏差说明

1. **`.npmrc` 已存在**：当前只有 electron 镜像，需补充 registry、better-sqlite3 镜像、strict-ssl。不是新建，是追加。

2. **README 已存在且完善**：已有 6 个故障排查项和镜像说明。不是重写，是增强（加 OneDrive 警告 + setup 命令 + 链接到 env-setup.md）。

3. **根 package.json 已有 postinstall**：`pnpm --filter @fire-app/desktop rebuild`。保留不动，不与 preinstall 冲突（preinstall 先跑检测，postinstall 后跑 rebuild）。

4. **apps/desktop package.json rebuild 命令**：当前是 `electron-rebuild -f`，计划改为 `electron-rebuild -f -w better-sqlite3`（限定模块，更快）。

5. **ESM 脚本**：根 package.json 已有 `"type": "module"`，脚本用 `.mjs` 后缀确保 ESM 解析。

### 文件结构总览

| 文件 | 类型 | 职责 |
|---|---|---|
| `.nvmrc` | 新增 | Node 版本固定 |
| `.npmrc` | 修改 | 补充 registry + better-sqlite3 镜像 + strict-ssl |
| `package.json`（根） | 修改 | engines + packageManager + scripts + preinstall |
| `apps/desktop/package.json` | 修改 | rebuild 加 -w better-sqlite3 |
| `scripts/check-env.mjs` | 新增 | 环境检测 + 修复命令输出 |
| `scripts/setup.mjs` | 新增 | 一键安装流程 |
| `README.md` | 修改 | 补充 OneDrive 警告 + setup 命令 + env-setup 链接 |
| `docs/env-setup.md` | 新增 | 详细手动安装 fallback |

---

## Task 1: 配置文件层（.nvmrc + .npmrc + package.json）

**Files:**
- Create: `.nvmrc`
- Modify: `.npmrc`
- Modify: `package.json`
- Modify: `apps/desktop/package.json`

- [ ] **Step 1: 创建 .nvmrc**

写入内容：

```
20.18.0
```

固定到 Electron 31 内置的 Node 版本，避免 Node 22/24 导致的 ABI 不匹配。

- [ ] **Step 2: 增强 .npmrc**

当前内容：
```ini
electron_mirror=https://npmmirror.com/mirrors/electron/
electron_builder_binaries_mirror=https://npmmirror.com/mirrors/electron-builder-binaries/
```

修改为（补充 registry、better-sqlite3 镜像、strict-ssl）：
```ini
# 国内镜像加速 / Mirror for China network
registry=https://registry.npmmirror.com
electron_mirror=https://npmmirror.com/mirrors/electron/
electron_builder_binaries_mirror=https://npmmirror.com/mirrors/electron-builder-binaries/
better_sqlite3_binary_host_mirror=https://npmmirror.com/mirrors/better-sqlite3

# 绕过镜像 SSL 证书问题 / Bypass mirror SSL cert issue
strict-ssl=false
```

- [ ] **Step 3: 增强根 package.json**

当前内容：
```json
{
  "name": "fire-app-monorepo",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "pnpm --filter @fire-app/desktop dev",
    "build": "pnpm --filter @fire-app/desktop build",
    "test:shared": "pnpm --filter @fire-app/shared test",
    "postinstall": "pnpm --filter @fire-app/desktop rebuild"
  },
  "devDependencies": {
    "typescript": "^5.5.0"
  }
}
```

修改为（加 engines + packageManager + scripts + preinstall，保留 postinstall 不动）：
```json
{
  "name": "fire-app-monorepo",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=20.0.0 <22.0.0",
    "pnpm": ">=9.0.0"
  },
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "dev": "pnpm --filter @fire-app/desktop dev",
    "build": "pnpm --filter @fire-app/desktop build",
    "test:shared": "pnpm --filter @fire-app/shared test",
    "check-env": "node scripts/check-env.mjs",
    "setup": "node scripts/setup.mjs",
    "preinstall": "node scripts/check-env.mjs --quiet || true",
    "postinstall": "pnpm --filter @fire-app/desktop rebuild"
  },
  "devDependencies": {
    "typescript": "^5.5.0"
  }
}
```

**关键点**：
- `preinstall` 用 `|| true` 容错，首次 install 时 check-env.mjs 可能尚未存在，不阻断 install
- `postinstall` 保留不动，与 preinstall 不冲突（preinstall 先检测，postinstall 后 rebuild）

- [ ] **Step 4: 修改 apps/desktop/package.json 的 rebuild 命令**

当前：
```json
"rebuild": "electron-rebuild -f"
```

修改为（加 `-w better-sqlite3` 限定模块，更快）：
```json
"rebuild": "electron-rebuild -f -w better-sqlite3"
```

- [ ] **Step 5: 验证配置文件正确性**

Run: `cd "/workspace/FIRE APP" && cat .nvmrc && echo "---" && cat .npmrc && echo "---" && node -e "console.log(JSON.stringify(require('./package.json').engines))"`
Expected:
```
20.18.0
---
# 国内镜像加速 / Mirror for China network
registry=https://registry.npmmirror.com
electron_mirror=https://npmmirror.com/mirrors/electron/
electron_builder_binaries_mirror=https://npmmirror.com/mirrors/electron-builder-binaries/
better_sqlite3_binary_host_mirror=https://npmmirror.com/mirrors/better-sqlite3

# 绕过镜像 SSL 证书问题 / Bypass mirror SSL cert issue
strict-ssl=false
---
{"node":">=20.0.0 <22.0.0","pnpm":">=9.0.0"}
```

- [ ] **Step 6: 提交**

```bash
cd "/workspace/FIRE APP"
git add .nvmrc .npmrc package.json apps/desktop/package.json
git commit -m "chore: 添加 Node 版本固定与镜像配置（环境搭建自动化 Task 1）"
```

---

## Task 2: 环境检查脚本 scripts/check-env.mjs

**Files:**
- Create: `scripts/check-env.mjs`

- [ ] **Step 1: 创建 scripts 目录与 check-env.mjs**

写入完整内容：

```javascript
#!/usr/bin/env node
// 环境检查脚本 / Environment check script
// 检测 Node 版本、pnpm、OneDrive 路径、原生模块、electron 二进制
// 检测到问题时输出可复制的修复命令

import { existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

// 解析参数 / Parse args
const quiet = process.argv.includes('--quiet');

// 结果收集 / Collect results
const results = [];
let hasFatal = false;

function addResult(name, passed, detail, fix) {
  results.push({ name, passed, detail, fix });
  if (!passed && name === 'Node 版本') hasFatal = true;
}

// 颜色 / Colors（Windows cmd 也支持 ANSI）
const green = '\x1b[32m';
const red = '\x1b[31m';
const yellow = '\x1b[33m';
const reset = '\x1b[0m';
const dim = '\x1b[2m';

// 检测 1: Node 版本 / Check Node version
function checkNodeVersion() {
  const version = process.version;
  const major = parseInt(version.slice(1));
  const passed = major >= 20 && major < 22;
  const detail = `${version} (要求 >=20 <22)`;
  const fix = passed ? null : '安装 Node 20 LTS:\n  nvm install 20.18.0\n  nvm use 20.18.0\n或手动下载: https://npmmirror.com/mirrors/node/v20.18.0/';
  addResult('Node 版本', passed, detail, fix);
}

// 检测 2: pnpm 版本 / Check pnpm version
function checkPnpmVersion() {
  try {
    const output = execSync('pnpm -v', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    const major = parseInt(output.split('.')[0]);
    const passed = major >= 9;
    const detail = `${output} (要求 >=9)`;
    const fix = passed ? null : '安装 pnpm 9:\n  npm install -g pnpm@9';
    addResult('pnpm 版本', passed, detail, fix);
  } catch {
    addResult('pnpm 版本', false, '未安装', '安装 pnpm:\n  npm install -g pnpm@9');
  }
}

// 检测 3: OneDrive 路径 / Check OneDrive path
function checkOneDrivePath() {
  const cwd = process.cwd();
  const passed = !cwd.includes('OneDrive') && !cwd.includes('onedrive');
  const detail = passed ? cwd : `${cwd} (位于 OneDrive 同步目录)`;
  const fix = passed ? null : '移动项目到非 OneDrive 目录:\n  建议移动到 D:\\Projects\\FIRE-APP\n  或暂停 OneDrive 同步后操作';
  addResult('OneDrive 路径', passed, detail, fix);
}

// 检测 4: 原生模块状态 / Check native module
function checkNativeModule() {
  // 查找 better-sqlite3 的 .node 文件
  const possiblePaths = [
    join(projectRoot, 'node_modules', '.pnpm', 'better-sqlite3@11.10.0', 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node'),
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

  const detail = fresh ? `已编译 (${foundPath.split(/[\\/]/).slice(-3).join('/')})` : '已编译但可能过期';
  const fix = fresh ? null : '重新编译原生模块:\n  pnpm --filter @fire-app/desktop rebuild';
  addResult('原生模块', fresh, detail, fix);
}

// 检测 5: electron 二进制 / Check electron binary
function checkElectronBinary() {
  // electron 包路径
  const electronPkgPath = join(projectRoot, 'node_modules', '.pnpm', 'electron@31.7.7', 'node_modules', 'electron');
  const electronPathTxt = join(electronPkgPath, 'path.txt');

  if (!existsSync(electronPkgPath)) {
    addResult('Electron 二进制', false, 'electron 包未安装', '安装依赖:\n  pnpm install');
    return;
  }

  // path.txt 是 electron install 后生成的，存在说明二进制已下载
  if (existsSync(electronPathTxt)) {
    addResult('Electron 二进制', true, '已下载 (31.7.7)', null);
  } else {
    addResult('Electron 二进制', false, 'path.txt 不存在，二进制可能未下载', '下载 electron 二进制:\n  cd node_modules/.pnpm/electron@31.7.7/node_modules/electron\n  node install.js');
  }
}

// 输出结果 / Output results
function outputResults() {
  if (!quiet) {
    console.log('[check-env] 环境检查开始...\n');
  }

  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.length - passedCount;

  for (const r of results) {
    if (quiet && r.passed) continue; // quiet 模式只输出问题项

    const icon = r.passed ? `${green}[✓]${reset}` : `${red}[✗]${reset}`;
    console.log(`${icon} ${r.name}: ${r.passed ? r.detail : `${red}${r.detail}${reset}`}`);

    if (!r.passed && r.fix) {
      const fixLines = r.fix.split('\n');
      console.log(`    ${dim}└─ 问题: ${red}${r.name === 'OneDrive 路径' ? '文件同步会导致原生模块编译失败' : r.detail}${reset}`);
      console.log(`    ${dim}└─ 修复:${reset}`);
      for (const line of fixLines) {
        console.log(`       ${line}`);
      }
    }
  }

  if (!quiet) {
    console.log(`\n[check-env] 检查完成: ${green}${passedCount} 通过${reset}, ${failedCount > 0 ? `${red}${failedCount} 警告${reset}` : '0 警告'}`);
  }

  // 退出码：致命错误（Node 版本）才阻断，其他只警告
  process.exit(hasFatal ? 1 : 0);
}

// 执行所有检测 / Run all checks
checkNodeVersion();
checkPnpmVersion();
checkOneDrivePath();
checkNativeModule();
checkElectronBinary();
outputResults();
```

- [ ] **Step 2: 验证脚本语法正确**

Run: `cd "/workspace/FIRE APP" && node --check scripts/check-env.mjs`
Expected: 无输出（语法正确），退出码 0

- [ ] **Step 3: 运行脚本看实际输出**

Run: `cd "/workspace/FIRE APP" && node scripts/check-env.mjs`
Expected: 输出 5 项检测结果（沙箱环境可能部分项失败，这是正常的——验证脚本能跑、能输出、能给出修复命令即可）

- [ ] **Step 4: 验证 --quiet 模式**

Run: `cd "/workspace/FIRE APP" && node scripts/check-env.mjs --quiet`
Expected: 仅输出失败项，不输出通过项

- [ ] **Step 5: 验证 preinstall 容错（脚本不存在时不阻断）**

模拟首次 install 场景，验证 `|| true` 生效：

Run: `cd "/workspace/FIRE APP" && node scripts/nonexistent.mjs --quiet || true && echo "OK: 容错生效"`
Expected: 输出 "OK: 容错生效"（即使脚本不存在也不阻断）

- [ ] **Step 6: 提交**

```bash
cd "/workspace/FIRE APP"
git add scripts/check-env.mjs
git commit -m "feat: 添加环境检查脚本 check-env.mjs（环境搭建自动化 Task 2）"
```

---

## Task 3: 一键安装脚本 scripts/setup.mjs

**Files:**
- Create: `scripts/setup.mjs`

- [ ] **Step 1: 创建 setup.mjs**

写入完整内容：

```javascript
#!/usr/bin/env node
// 一键安装脚本 / One-click setup script
// 封装 install + rebuild + 验证流程，每步失败给出可复制的修复命令

import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

const green = '\x1b[32m';
const red = '\x1b[31m';
const yellow = '\x1b[33m';
const cyan = '\x1b[36m';
const reset = '\x1b[0m';
const dim = '\x1b[2m';
const bold = '\x1b[1m';

function log(icon, msg) {
  console.log(`${icon} ${msg}`);
}

function logStep(n, msg) {
  console.log(`\n${bold}${cyan}[步骤 ${n}]${reset} ${msg}`);
}

function runCommand(cmd, { ignoreError = false } = {}) {
  try {
    execSync(cmd, { cwd: projectRoot, stdio: 'inherit' });
    return true;
  } catch (err) {
    if (!ignoreError) {
      log(`${red}[错误]${reset}`, `命令失败: ${cmd}`);
      log(`${dim}└─${reset}`, `${red}${err.message.split('\n')[0]}${reset}`);
    }
    return false;
  }
}

// 步骤 1: 检测现状 / Step 1: Check current state
function step1Check() {
  logStep(1, '检测环境现状...');
  const passed = runCommand('node scripts/check-env.mjs', { ignoreError: true });
  return passed;
}

// 步骤 2: 安装依赖 / Step 2: Install dependencies
function step2Install() {
  logStep(2, '安装依赖（读取 .npmrc 镜像配置）...');
  console.log(`${dim}  如果卡住，检查网络或镜像配置${reset}`);

  const passed = runCommand('pnpm install');

  if (!passed) {
    console.log(`\n${yellow}[提示]${reset} pnpm install 失败，常见原因：`);
    console.log(`  ${dim}1.${reset} better-sqlite3 编译失败 → 继续 Step 3 rebuild`);
    console.log(`  ${dim}2.${reset}$ ELECTRON_MIRROR 未生效 → 检查 .npmrc`);
    console.log(`  ${dim}3.${reset} OneDrive 锁定 → 移动项目到非 OneDrive 目录`);
    console.log(`  ${dim}4.${reset} Node 版本不对 → nvm use 20.18.0\n`);
  }

  return passed;
}

// 步骤 3: 编译原生模块 / Step 3: Rebuild native module for Electron
function step3Rebuild() {
  logStep(3, '为 Electron 编译原生模块（better-sqlite3）...');

  const passed = runCommand('pnpm --filter @fire-app/desktop rebuild');

  if (!passed) {
    console.log(`\n${red}[修复]${reset} electron-rebuild 失败，尝试以下步骤：`);
    console.log(`  ${dim}1.${reset} 杀掉残留进程:`);
    console.log(`     ${cyan}taskkill /F /IM electron.exe${reset} (Windows)`);
    console.log(`     ${cyan}pkill -f electron${reset} (macOS/Linux)`);
    console.log(`  ${dim}2.${reset} 清理 node_modules 重装:`);
    console.log(`     ${cyan}rmdir /s /q node_modules${reset} (Windows cmd)`);
    console.log(`     ${cyan}rm -rf node_modules${reset} (macOS/Linux)`);
    console.log(`     ${cyan}pnpm install${reset}`);
    console.log(`  ${dim}3.${reset} 手动跑 electron-rebuild:`);
    console.log(`     ${cyan}cd apps/desktop && npx electron-rebuild -f -w better-sqlite3${reset}\n`);
  }

  return passed;
}

// 步骤 4: 验证 / Step 4: Verify
function step4Verify() {
  logStep(4, '验证环境...');
  const passed = runCommand('node scripts/check-env.mjs');

  if (passed) {
    console.log(`\n${green}${bold}✓ 环境就绪！${reset}\n`);
    console.log(`${bold}启动开发模式：${reset}`);
    console.log(`  ${cyan}pnpm --filter @fire-app/desktop dev${reset}\n`);
  } else {
    console.log(`\n${yellow}[警告]${reset} 环境仍有问题，请按上方提示修复后重跑 ${cyan}pnpm setup${reset}\n`);
  }

  return passed;
}

// 主流程 / Main flow
function main() {
  console.log(`${bold}${cyan}╔══════════════════════════════════════════╗${reset}`);
  console.log(`${bold}${cyan}║   FIRE APP 一键安装 / One-click Setup    ║${reset}`);
  console.log(`${bold}${cyan}╚══════════════════════════════════════════╝${reset}`);

  // 步骤 1: 检测
  const step1Passed = step1Check();

  if (step1Passed) {
    console.log(`\n${green}✓ 环境已就绪，无需安装${reset}`);
    console.log(`${bold}启动开发模式：${reset}`);
    console.log(`  ${cyan}pnpm --filter @fire-app/desktop dev${reset}\n`);
    return;
  }

  // 步骤 2: 安装
  step2Install();

  // 步骤 3: Rebuild（无论 install 是否成功都尝试，因为 install 可能部分成功）
  step3Rebuild();

  // 步骤 4: 验证
  step4Verify();
}

main();
```

- [ ] **Step 2: 验证脚本语法正确**

Run: `cd "/workspace/FIRE APP" && node --check scripts/setup.mjs`
Expected: 无输出（语法正确），退出码 0

- [ ] **Step 3: 运行 setup.mjs 看实际输出**

Run: `cd "/workspace/FIRE APP" && node scripts/setup.mjs`
Expected: 输出步骤 1-4 的流程（沙箱环境可能部分步骤失败，验证脚本能跑、能给出修复命令即可）

- [ ] **Step 4: 提交**

```bash
cd "/workspace/FIRE APP"
git add scripts/setup.mjs
git commit -m "feat: 添加一键安装脚本 setup.mjs（环境搭建自动化 Task 3）"
```

---

## Task 4: 文档（README 增强 + env-setup.md）

**Files:**
- Modify: `README.md`
- Create: `docs/env-setup.md`

- [ ] **Step 1: 增强 README 的环境要求章节**

当前 README 第 17-23 行"环境要求"章节：
```markdown
## 环境要求

- **Node.js** ≥ 20
- **pnpm** ≥ 9（安装：`npm install -g pnpm`）
- **Windows**: Visual Studio Build Tools（C++ 原生模块编译）
- **macOS**: Xcode Command Line Tools
- **Linux**: build-essential
```

修改为（固定 Node 20 + 加 OneDrive 警告 + 加 nvm 说明）：
```markdown
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
```

- [ ] **Step 2: 增强 README 的快速开始章节**

当前 README 第 25-30 行"快速开始"章节：
```markdown
## 快速开始

```bash
pnpm install    # 安装依赖（含自动 rebuild 原生模块）
pnpm dev        # 启动开发模式
```
```

修改为（加 setup 一键命令 + 环境检测）：
```markdown
## 快速开始

```bash
pnpm setup      # 一键安装（自动检测环境 + 镜像 + 原生模块编译）
pnpm dev        # 启动开发模式
```

> 首次 clone 后推荐用 `pnpm setup`，它会自动检测环境问题并给出修复命令。
> 若已安装过依赖，直接 `pnpm dev` 即可。
> 遇到环境问题可随时跑 `pnpm check-env` 诊断。
```

- [ ] **Step 3: 在 README 镜像配置说明章节补充链接**

当前 README 第 115-122 行"镜像配置说明"章节末尾：
```markdown
海外开发者如需使用官方源，删除 `.npmrc` 中对应行即可，不影响 npm registry。
```

修改为（补充 strict-ssl 说明）：
```markdown
海外开发者如需使用官方源，删除 `.npmrc` 中对应行即可，不影响 npm registry。

> `.npmrc` 中的 `strict-ssl=false` 是为绕过 npmmirror 证书链问题，对官方源无影响。
> `better_sqlite3_binary_host_mirror` 用于加速 better-sqlite3 预编译二进制下载。
> 详细的镜像配置与故障排查见 [手动安装文档](docs/env-setup.md)。
```

- [ ] **Step 4: 在 README 故障排查章节前加 env-setup 链接**

当前 README 第 57 行"故障排查"章节前插入：
```markdown
## 手动安装 / 故障排查

如果 `pnpm setup` 失败，或遇到环境问题，详见 [手动安装文档](docs/env-setup.md)（含 OneDrive、Node 版本、SSL、ABI、文件锁定等 9 类问题的完整解决方案）。

## 故障排查
```

- [ ] **Step 5: 创建 docs/env-setup.md**

写入完整内容（M3 验证时的所有环境问题与解决方案）：

```markdown
# 手动安装与环境问题排查

> 当 `pnpm setup` 失败时的 fallback 文档。记录 M3 验证时的 9 类环境问题与完整解决方案。

## 目录

1. [OneDrive 问题](#onedrive-问题)
2. [Node 版本不匹配（ABI 错误）](#node-版本不匹配abi-错误)
3. [pnpm install 慢](#pnpm-install-慢)
4. [better-sqlite3 编译失败](#better-sqlite3-编译失败)
5. [nvm install 下载失败](#nvm-install-下载失败)
6. [SSL 证书错误](#ssl-证书错误)
7. [electron 下载卡住](#electron-下载卡住)
8. [electron-rebuild EPERM 失败](#electron-rebuild-eperm-失败)
9. [cmd vs PowerShell 语法错误](#cmd-vs-powershell-语法错误)

---

## OneDrive 问题

**症状**：项目在 OneDrive 目录下，`pnpm install` 慢、文件锁定、electron-rebuild 报 EPERM。

**根因**：OneDrive 同步 node_modules 的几万个小文件，导致文件锁定和同步延迟。

**解决方案**：移动项目到非 OneDrive 目录：

```cmd
:: Windows cmd
robocopy "D:\Admin\OneDrive\...\FIRE APP" "D:\Projects\FIRE-APP" /E /MT:8 /R:1 /W:1
cd /d D:\Projects\FIRE-APP
rmdir /s /q node_modules
pnpm install
```

或暂停 OneDrive 同步：任务栏右键 OneDrive → 暂停同步 → 2 小时。

---

## Node 版本不匹配（ABI 错误）

**症状**：启动报错 `NODE_MODULE_VERSION 115 vs 125` 或 `different Node.js version`。

**根因**：better-sqlite3 为系统 Node 编译，但 Electron 31 内置不同的 Node ABI。

**解决方案**：

1. 确认用 Node 20 LTS（项目 `.nvmrc` 已指定）：
```cmd
nvm use 20.18.0
node -v
:: 应显示 v20.18.0
```

2. 为 Electron 重新编译原生模块：
```cmd
pnpm --filter @fire-app/desktop rebuild
```

3. 如果还报错，清理重装：
```cmd
rmdir /s /q node_modules
del pnpm-lock.yaml
pnpm install
pnpm --filter @fire-app/desktop rebuild
```

---

## pnpm install 慢

**症状**：`pnpm install` 卡住 10+ 分钟，或 electron/better-sqlite3 postinstall 不动。

**根因**：electron + better-sqlite3 从 GitHub 下载二进制，国内网络慢。

**解决方案**：项目 `.npmrc` 已配置 npmmirror 镜像。若仍慢，手动设置环境变量：

```cmd
:: Windows cmd
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
set npm_config_better_sqlite3_binary_host_mirror=https://npmmirror.com/mirrors/better-sqlite3
pnpm install
```

```powershell
# PowerShell
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
pnpm install
```

---

## better-sqlite3 编译失败

**症状**：`gyp ERR! not ok` 或 `Could not find any Visual Studio installation`。

**根因**：Node 22/24 无 better-sqlite3 预编译包，回退源码编译但缺 VS C++ 工具链。

**解决方案 A（推荐）**：降级到 Node 20 LTS（有预编译包，无需编译）：
```cmd
nvm install 20.18.0
nvm use 20.18.0
rmdir /s /q node_modules
pnpm install
```

**解决方案 B**：安装 VS Build Tools（管理员 PowerShell）：
```powershell
curl -o vs-buildtools.exe https://aka.ms/vs/17/release/vs_BuildTools.exe
vs-buildtools.exe --quiet --wait --norestart --nocache `
  --add Microsoft.VisualStudio.Workload.VCTools
```

---

## nvm install 下载失败

**症状**：`nvm install 20.18.0` 报 `connection attempt failed` 或下载超时。

**根因**：nodejs.org 国内访问慢。

**解决方案**：配置 nvm 镜像源：
```cmd
nvm node_mirror https://npmmirror.com/mirrors/node/
nvm npm_mirror https://npmmirror.com/mirrors/npm/
nvm install 20.18.0
nvm use 20.18.0
```

或手动下载：访问 https://npmmirror.com/mirrors/node/v20.18.0/，下载 `node-v20.18.0-win-x64.zip`，解压到 nvm 的 node 目录（如 `C:\Users\<用户>\AppData\Roaming\nvm\v20.18.0`），然后 `nvm use 20.18.0`。

---

## SSL 证书错误

**症状**：`prebuild-install warn install unable to verify the first certificate`。

**根因**：npmmirror 证书链问题。

**解决方案**：项目 `.npmrc` 已配置 `strict-ssl=false`。若仍报错，手动设置：
```cmd
set npm_config_strict_ssl=false
pnpm install
```

---

## electron 下载卡住

**症状**：`pnpm install` 卡在 `electron postinstall` 长时间无响应。

**根因**：electron 二进制 ~100MB，下载慢。

**解决方案 A**：确认 ELECTRON_MIRROR 生效（项目 `.npmrc` 已配置）：
```cmd
echo %ELECTRON_MIRROR%
:: 若为空，手动设置
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
```

**解决方案 B**：手动下载 electron 二进制放到缓存：
1. 浏览器访问 https://npmmirror.com/mirrors/electron/31.7.7/
2. 下载 `electron-v31.7.7-win32-x64.zip`
3. 放到缓存目录：
```cmd
mkdir "%LOCALAPPDATA%\electron\Cache\31.7.7" 2>nul
move "%USERPROFILE%\Downloads\electron-v31.7.7-win32-x64.zip" "%LOCALAPPDATA%\electron\Cache\31.7.7\"
```
4. 重新跑 electron install：
```cmd
cd node_modules\.pnpm\electron@31.7.7\node_modules\electron
node install.js
```

---

## electron-rebuild EPERM 失败

**症状**：`EPERM: operation not permitted, rmdir '...build'`。

**根因**：文件被进程锁定，或 pnpm 的 `.ignored_shared` 符号链接结构。

**解决方案**：

1. 杀掉所有 electron 进程：
```cmd
taskkill /F /IM electron.exe 2>nul
taskkill /F /IM node.exe 2>nul
```

2. 删除被锁定的 build 目录：
```cmd
rd /s /q "\\?\D:\Projects\FIRE-APP\apps\desktop\node_modules\@fire-app\.ignored_shared\node_modules\better-sqlite3\build" 2>nul
```

3. 清理重装：
```cmd
rmdir /s /q node_modules
del pnpm-lock.yaml
pnpm install
pnpm --filter @fire-app/desktop rebuild
```

---

## cmd vs PowerShell 语法错误

**症状**：`$env:ELECTRON_MIRROR=...` 报"文件名、目录名或卷标语法不正确"。

**根因**：`$env:` 是 PowerShell 语法，cmd 用 `set`。

**解决方案**：确认你的 shell：

| Shell | 设置环境变量 |
|---|---|
| cmd | `set ELECTRON_MIRROR=https://...` |
| PowerShell | `$env:ELECTRON_MIRROR="https://..."` |
| bash/zsh | `export ELECTRON_MIRROR="https://..."` |

判断当前 shell：在窗口输入 `echo %COMSPEC%`，显示路径是 cmd，报错是 PowerShell。

---

## 仍无法解决？

运行环境诊断：
```cmd
pnpm check-env
```

把输出贴给开发者，或查阅 [M3 验证文档](docs/superpowers/specs/2026-07-15-fire-app-milestone3-verification.md#111-环境搭建过程关键经验) 的 §11.1 环境搭建过程记录。
```

- [ ] **Step 6: 验证文档链接正确**

Run: `cd "/workspace/FIRE APP" && ls docs/env-setup.md && grep -c "env-setup.md" README.md`
Expected:
```
docs/env-setup.md
3
```
（env-setup.md 存在，README 中有 3 处链接到它）

- [ ] **Step 7: 提交**

```bash
cd "/workspace/FIRE APP"
git add README.md docs/env-setup.md
git commit -m "docs: 增强 README 环境章节 + 添加手动安装文档（环境搭建自动化 Task 4）"
```

---

## Task 5: 端到端验证

**Files:** 无修改，仅验证

- [ ] **Step 1: 验证 check-env 脚本在干净环境能跑**

Run: `cd "/workspace/FIRE APP" && node scripts/check-env.mjs`
Expected: 输出 5 项检测结果，每项有 `[✓]` 或 `[✗]` 标记，退出码 0（沙箱环境 Node 22 会报警告但 exit 0）

- [ ] **Step 2: 验证 check-env --quiet 只输出问题项**

Run: `cd "/workspace/FIRE APP" && node scripts/check-env.mjs --quiet`
Expected: 只输出失败项，不输出通过项

- [ ] **Step 3: 验证 setup 脚本能跑完整流程**

Run: `cd "/workspace/FIRE APP" && node scripts/setup.mjs`
Expected: 输出步骤 1-4 的完整流程，每步有 `[步骤 N]` 标记，最后输出启动命令或修复建议

- [ ] **Step 4: 验证 preinstall 钩子容错**

模拟脚本不存在场景：
Run: `cd "/workspace/FIRE APP" && node scripts/nonexistent.mjs --quiet || true && echo "preinstall 容错 OK"`
Expected: 输出 "preinstall 容错 OK"（`|| true` 生效）

- [ ] **Step 5: 验证 pnpm check-env 命令注册正确**

Run: `cd "/workspace/FIRE APP" && pnpm check-env 2>&1 | head -5`
Expected: 输出 check-env 脚本的前几行（如 "[check-env] 环境检查开始..."）

- [ ] **Step 6: 验证 pnpm setup 命令注册正确**

Run: `cd "/workspace/FIRE APP" && pnpm setup 2>&1 | head -10`
Expected: 输出 setup 脚本的标题与前几步

- [ ] **Step 7: 验证 .nvmrc 内容正确**

Run: `cd "/workspace/FIRE APP" && cat .nvmrc`
Expected: `20.18.0`

- [ ] **Step 8: 验证 .npmrc 内容完整**

Run: `cd "/workspace/FIRE APP" && cat .npmrc`
Expected: 包含 registry、electron_mirror、better_sqlite3_binary_host_mirror、strict-ssl=false

- [ ] **Step 9: 验证 package.json engines 字段**

Run: `cd "/workspace/FIRE APP" && node -e "const p=require('./package.json'); console.log(JSON.stringify(p.engines)); console.log('preinstall:', p.scripts.preinstall); console.log('check-env:', p.scripts['check-env']); console.log('setup:', p.scripts.setup)"`
Expected:
```
{"node":">=20.0.0 <22.0.0","pnpm":">=9.0.0"}
preinstall: node scripts/check-env.mjs --quiet || true
check-env: node scripts/check-env.mjs
setup: node scripts/setup.mjs
```

- [ ] **Step 10: 提交验证记录（如果有改动）**

如果验证过程发现并修复了问题，提交修复。否则跳过。

```bash
cd "/workspace/FIRE APP"
git status
# 如果有改动：
# git add -A
# git commit -m "fix: 环境搭建自动化端到端验证修复"
```

---

## 完成验证清单

- [ ] `.nvmrc` 存在，内容为 `20.18.0`
- [ ] `.npmrc` 包含 registry + electron_mirror + better_sqlite3_binary_host_mirror + strict-ssl=false
- [ ] 根 `package.json` 有 engines + packageManager + check-env/setup/preinstall scripts
- [ ] `apps/desktop/package.json` 的 rebuild 命令含 `-w better-sqlite3`
- [ ] `scripts/check-env.mjs` 存在，能跑，输出 5 项检测结果
- [ ] `scripts/check-env.mjs --quiet` 只输出问题项
- [ ] `scripts/setup.mjs` 存在，能跑，输出步骤 1-4 流程
- [ ] `README.md` 含 OneDrive 警告 + setup 命令 + env-setup 链接
- [ ] `docs/env-setup.md` 存在，含 9 类问题解决方案
- [ ] `pnpm check-env` 命令可执行
- [ ] `pnpm setup` 命令可执行
- [ ] preinstall 容错（脚本不存在时不阻断 install）
