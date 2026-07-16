# 环境搭建自动化设计文档

> **背景**：M3 验证阶段，本地环境搭建耗时占 80% 验证时间，暴露 9 类环境问题（OneDrive 同步、Node 版本、SSL 证书、electron 下载、ABI 不匹配、文件锁定等）。本设计将这些配置与检测固化到仓库，降低后续每个新环境的人工操作成本。

**目标**：将本地环境搭建从"反复踩坑 + 聊天记录贴命令"降为"clone → pnpm setup → dev"三步，配置错误时主动给出可复制的修复命令。

**架构**：配置文件层（`.nvmrc` + `.npmrc` + engines）+ 环境检查脚本（`check-env.mjs`）+ 一键安装脚本（`setup.mjs`）+ preinstall 钩子自动检测 + README 文档。

**技术栈**：Node.js 20 LTS + pnpm 9 + nvm + Electron 31 + better-sqlite3

---

## §1 问题分析

### 1.1 M3 环境搭建问题复盘

| # | 问题 | 根因 | 影响 |
|---|---|---|---|
| 1 | pnpm install 慢 | electron + better-sqlite3 postinstall 从 GitHub 下载 | install 卡住 10+ 分钟 |
| 2 | cmd 报错语法错误 | `$env:` 是 PowerShell 语法，cmd 用 `set` | 用户不知道用哪个 shell |
| 3 | better-sqlite3 编译失败 | Node v24 太新，无预编译包，回退源码编译缺 VS | install 直接失败 |
| 4 | nvm install 下载失败 | nodejs.org 国内访问慢 | 无法切换 Node 版本 |
| 5 | prebuild-install SSL 错误 | npmmirror 证书链问题 | 二进制下载失败回退编译 |
| 6 | electron postinstall 卡住 | ~100MB 二进制下载慢 | install 长时间无响应 |
| 7 | ABI 不匹配（115 vs 125） | better-sqlite3 为 Node 20 编译，Electron 31 要求 ABI 125 | 启动报错，应用打不开 |
| 8 | electron-rebuild EPERM | pnpm `.ignored_shared` 符号链接 + 文件锁定 | rebuild 失败 |
| 9 | OneDrive 同步干扰 | 项目在 OneDrive 目录，同步锁定 node_modules | 文件锁定、install 慢 |

### 1.2 根因归类

- **配置散落**：镜像、SSL、Node 版本都靠人记忆或聊天记录，未固化到仓库（问题 1/4/5/6）
- **版本不匹配**：Node 24 vs Electron 31 内置 Node 20，ABI 不一致（问题 3/7）
- **环境未检测**：OneDrive 路径、原生模块状态无主动检测（问题 8/9）
- **shell 差异**：cmd vs PowerShell 语法不同，命令不可复用（问题 2）

### 1.3 自动化目标

| 目标 | 对应问题 | 自动化手段 |
|---|---|---|
| Node 版本固定 | 3, 7 | `.nvmrc` + engines |
| 镜像配置固化 | 1, 4, 5, 6 | `.npmrc` |
| 原生模块编译 | 7, 8 | setup.mjs 自动 rebuild |
| 环境检测 | 2, 8, 9 | check-env.mjs |
| OneDrive 警告 | 9 | check-env.mjs 路径检测 |
| shell 无关 | 2 | Node 脚本跨 shell |

---

## §2 方案选择

### 2.1 候选方案

| 方案 | 做法 | 优点 | 缺点 |
|---|---|---|---|
| A 纯配置 | `.nvmrc` + `.npmrc` + engines + 文档 | 零依赖，标准化 | 不主动检测，nvm-windows 不自动读 .nvmrc |
| **B 配置 + 检查脚本** | A + check-env.mjs + setup.mjs + preinstall | 主动检测，给修复命令，跨平台 | 多一个脚本维护 |
| C 配置 + Volta | 用 Volta 替代 nvm 自动切版本 | 完全自动 | 引入新工具，侵入性大 |

### 2.2 选择方案 B

**理由**：
1. 平衡自动化与侵入性——不强制换工具，但主动检测
2. 解决 M3 全部 9 类问题
3. 跨平台 Node 脚本，消除 cmd vs PowerShell 混乱
4. 渐进式——检测失败只警告不阻断
5. 可扩展——后续可加更多检查项

---

## §3 设计详情

### 3.1 配置文件层

#### `.nvmrc`（新增，根目录）

```
20.18.0
```

固定到 Electron 31 内置的 Node 版本，避免 Node 22/24 导致的 ABI 不匹配。`nvm use` 自动读取。

#### `.npmrc`（新增，根目录）

```ini
# 国内镜像加速 / Mirror for China network
registry=https://registry.npmmirror.com
electron_mirror=https://npmmirror.com/mirrors/electron/
better_sqlite3_binary_host_mirror=https://npmmirror.com/mirrors/better-sqlite3

# 绕过镜像 SSL 证书问题 / Bypass mirror SSL cert issue
strict-ssl=false
```

**决策**：
- 提交到仓库，国内用户零配置
- `strict-ssl=false` 是 M3 验证确认需要的（npmmirror 证书链问题）
- 国外用户可用 `npm_config_registry` 环境变量覆盖

#### `package.json`（根目录，修改）

新增字段：

```json
{
  "engines": {
    "node": ">=20.0.0 <22.0.0",
    "pnpm": ">=9.0.0"
  },
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "check-env": "node scripts/check-env.mjs",
    "setup": "node scripts/setup.mjs",
    "preinstall": "node scripts/check-env.mjs --quiet"
  }
}
```

- `engines.node` 限制 20.x LTS，pnpm 默认警告不阻断
- `packageManager` 启用 Corepack 自动切换 pnpm 版本
- `preinstall` 静默检测，仅问题时输出

**首次 install 边界处理**：git clone 后首次 `pnpm install` 时 `scripts/check-env.mjs` 可能尚未存在。preinstall 命令使用容错形式：`node scripts/check-env.mjs --quiet || true`（脚本不存在时静默跳过，不阻断 install）。check-env.mjs 内部也做自身存在性检测。

#### `apps/desktop/package.json`（修改）

明确 rebuild 命令：

```json
{
  "scripts": {
    "rebuild": "electron-rebuild -f -w better-sqlite3"
  }
}
```

### 3.2 环境检查脚本 `scripts/check-env.mjs`

#### 检测项

| # | 检测项 | 检测逻辑 | 失败时修复命令 |
|---|---|---|---|
| 1 | Node 版本 | `process.version` 匹配 `>=20 <22` | `nvm install 20.18.0 && nvm use 20.18.0` |
| 2 | pnpm 版本 | `pnpm -v` ≥9 | `npm install -g pnpm@9` |
| 3 | OneDrive 路径 | `process.cwd()` 不含 `OneDrive` | `移动项目到非 OneDrive 目录，如 D:\Projects\FIRE-APP` |
| 4 | 原生模块状态 | `better_sqlite3.node` 存在 + ABI 匹配 | `pnpm --filter @fire-app/desktop rebuild` |
| 5 | electron 二进制 | electron 缓存路径存在 | `node node_modules/electron/install.js` |

#### ABI 检测逻辑

```javascript
// 读取 better-sqlite3 的 .node 文件路径
// 检查文件是否存在
// 用 require('module')._nodeModulePaths 探测
// 简化版：检测 build/Release/better_sqlite3.node 是否存在
// 精确版：读取 .node 文件的 NODE_MODULE_VERSION 与 Electron 期望值对比
```

实现采用简化版（检测文件存在 + 时间戳新于 install），避免读取二进制 ABI 的复杂性。

#### 输出格式

```
[check-env] 环境检查开始...

[✓] Node 版本: v20.18.0 (符合 >=20 <22)
[✓] pnpm 版本: 9.15.0
[✗] OneDrive 路径: D:\Admin\OneDrive\...\FIRE APP
    └─ 问题: 项目位于 OneDrive 同步目录，会导致文件锁定
    └─ 修复: 移动到 D:\Projects\FIRE-APP
[✓] better-sqlite3 原生模块: 已编译
[✓] Electron 二进制: 已下载 (31.7.7)

[check-env] 检查完成: 4 通过, 1 警告
```

#### 参数

- `--quiet`：仅输出问题项，通过的项不显示（preinstall 用）
- 无参数：完整输出（手动检查用）

#### 退出码

- 全部通过 = 0
- 有警告 = 0（不阻断，让 install 继续）
- 致命错误（Node 版本完全不支持）= 1（阻断）

### 3.3 一键安装脚本 `scripts/setup.mjs`

**命令**：`node scripts/setup.mjs` 或 `pnpm setup`

**执行流程**：

```
步骤 1: 跑 check-env.mjs（检测现状）
  ├─ 全部通过 → 跳到步骤 4
  └─ 有问题 → 继续

步骤 2: pnpm install（读 .npmrc 镜像配置）
  ├─ 成功 → 继续
  └─ better-sqlite3 编译失败 → 提示跑 rebuild，继续

步骤 3: pnpm --filter @fire-app/desktop rebuild（为 Electron 编译原生模块）
  ├─ 成功 → 继续
  └─ EPERM 失败 → 提示杀进程 + 清理 node_modules

步骤 4: 再跑 check-env.mjs（验证修复）
  ├─ 全部通过 → 输出 "环境就绪，运行: pnpm --filter @fire-app/desktop dev"
  └─ 仍有问题 → 输出具体修复命令
```

**设计考量**：
- 不直接启动 dev（避免脚本卡在 dev server）
- 每步失败都给出可复制的修复命令
- 幂等：跑多次不出问题

### 3.4 README 环境章节

`README.md` 新增"环境要求"与"快速开始"章节：

```markdown
## 环境要求 / Prerequisites

- **Node.js 20.x LTS**（Electron 31 内置版本，避免 ABI 不匹配）
- **pnpm 9+**
- ⚠️ **不要放在 OneDrive 目录**（文件同步会导致原生模块编译失败）

## 快速开始 / Quick Start

\`\`\`bash
pnpm setup          # 一键安装（自动检测 + 镜像 + 原生模块编译）
pnpm --filter @fire-app/desktop dev  # 启动开发
\`\`\`

## 手动安装 / Manual Setup

见 docs/env-setup.md
```

### 3.5 详细手动安装文档 `docs/env-setup.md`

当 `pnpm setup` 失败时的 fallback，记录 M3 验证时的完整步骤（含 nvm 镜像、SSL 绕过、electron 手动下载、ABI 修复等），作为查漏补缺参考。

---

## §4 文件变更清单

| 文件 | 类型 | 职责 |
|---|---|---|
| `.nvmrc` | 新增 | Node 版本固定 |
| `.npmrc` | 新增 | 镜像 + SSL 配置 |
| `package.json`（根） | 修改 | engines + packageManager + scripts + preinstall |
| `apps/desktop/package.json` | 修改 | 明确 rebuild script |
| `scripts/check-env.mjs` | 新增 | 环境检测 + 修复命令输出（~150 行） |
| `scripts/setup.mjs` | 新增 | 一键安装流程（~100 行） |
| `README.md` | 修改 | 环境要求 + 快速开始 |
| `docs/env-setup.md` | 新增 | 详细手动安装 fallback |

---

## §5 测试策略

### 5.1 验证场景

| 场景 | 预期 |
|---|---|
| Node 20 环境，项目在普通目录 | check-env 全绿，setup 直接完成 |
| Node 24 环境 | check-env 报 Node 版本错误，给 nvm 命令 |
| 项目在 OneDrive 目录 | check-env 报 OneDrive 警告，给移动建议 |
| 全新 clone，无 node_modules | setup 触发 install + rebuild，完成后验证通过 |
| 已 install 但未 rebuild | check-env 报原生模块未编译，给 rebuild 命令 |
| preinstall 触发 | --quiet 模式仅输出问题项，不刷屏 |

### 5.2 不在范围内

- CI 环境配置（CI 用特定 Node 版本，不在本设计范围）
- macOS/Linux 的原生模块编译（本设计聚焦 Windows，跨平台兼容但未深入测试）
- Docker 化环境（未来可选）
- Volta 迁移（方案 C，未来可选）

---

## §6 对后续里程碑的影响

- **M4 交易管理**：开发者 clone 后 `pnpm setup` 即可，无需重复踩 M3 环境坑
- **新成员加入**：README + setup.mjs 让新人 5 分钟跑起应用
- **环境问题排查**：`pnpm check-env` 一键诊断，不用翻聊天记录
- **经验固化**：M3 的 9 类环境问题全部有对应检测项，不会重复出现
