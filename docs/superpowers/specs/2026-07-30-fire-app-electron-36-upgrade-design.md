# FIRE-APP Electron 31→36 升级设计

> **日期**：2026-07-30
> **状态**：已批准，待写实施计划
> **前置**：M9 收尾已完成（21 commits 已推送，CI 全绿）
> **范围约束**：仅版本升级 + 必要的适配改动，无新功能、无 schema 变更、无破坏性业务逻辑改动
> **分支**：`chore/electron-36-upgrade`（独立分支，单 PR，保留 revert 能力）
> **Spec 输入**：本文件

---

## 1. 背景与动机

### 1.1 当前状态

| 项 | 当前版本 | 状态 |
|---|---|---|
| Electron | 31.7.7 | **已 EOL**（不再接收安全补丁） |
| better-sqlite3 | 11.10.0 | 维护中 |
| 宿主 Node | 20.18.0 | **已 EOL**（2026-04 进入 EOL） |
| electron-vite | 2.x | 维护中 |
| electron-builder | 25 | 维护中 |
| vite | 5.4 | 维护中 |
| vitest | 2.x | 维护中 |

### 1.2 升级动机

1. **安全**：Electron 31 已 EOL，Chromium 124 不再接收安全补丁；Node 20 已于 2026-04 EOL
2. **合规**：M9 安全加固里程碑已完成，但运行时本身的安全债必须清掉
3. **生态对齐**：Electron 36 捆绑 Chromium 136 + Node 22.14，对齐现代 Web API 与 ESM 支持
4. **技术债清理**：electron-vite / electron-builder / vite / vitest 均有累积的跨大版本技术债

### 1.3 目标版本

| 项 | 目标版本 | 备注 |
|---|---|---|
| Electron | `^36.0.0` | 主升级目标 |
| better-sqlite3 | `^11.18.0`（11.x 最新稳定） | 保守升小版本，避免 12.x API breaking |
| 宿主 Node | 22.14.0 LTS | 与 Electron 36 捆绑 Node 对齐 |
| `@electron/rebuild` | `^3.7.0`（最新 3.x） | 支持 Electron 36 ABI |
| `@types/node` | `^22.14.0` | 与宿主 + Electron 捆绑 Node 对齐 |
| `electron-vite` | `^3.0.0` | 支持 Vite 6 + Electron 36 |
| `electron-builder` | `^26` | 支持 Electron 36 打包 |
| `vite` | `^6.0.0` | 跟随 electron-vite 3 |
| `vitest` | `^3.0.0` | 兼容 Vite 6 |
| `@vitejs/plugin-react` | `^4.5.0` | 4.x 已支持 Vite 6，不跨大版本 |
| `jsdom` | `^26.0.0` | 跟随 vitest 3 的 peer dep 要求 |

### 1.4 不在范围内（YAGNI）

- **Electron 36 新功能采用**：本升级只保证"行为等价"，不引入 utility process / net 模块新特性等新 API
- **better-sqlite3 升到 12.x**：11.x 最新稳定版已支持 Node 22 ABI，避免 12.x 的 API breaking change 风险
- **TypeScript 5.x 升级**：已 `^5.5.0`，5.x 内部升级非本任务目标
- **移动端（React Native）相关**：本仓库目前无 RN 代码
- **Wiki 同步**：升级完成后单独开 task 做（参照 M9 收尾模式）

---

## 2. 整体策略：分层渐进升级（方案 B）

### 2.1 三 Phase 串行依赖

```
Phase 1 (宿主 Node 22)  ──→  Phase 2 (Electron 36 + 原生模块)  ──→  Phase 3 (构建工具联动)
   必须先就位                  依赖 Node 22 编译原生模块               依赖稳定 Electron 36 跑回归
```

三个 Phase 严格串行，不能并行：

- **P1 必须先就位**：P2 的 `@electron/rebuild` 需要 Node 22 工具链
- **P2 必须先稳定**：P3 的构建工具升级回归依赖稳定 Electron 36 作为基线

### 2.2 Phase 边界

| Phase | 改动范围 | 不改的东西 | 验证标准 |
|---|---|---|---|
| **P1: 宿主 Node 22** | `package.json` engines、`scripts/check-env.mjs` 版本号动态化、`.github/workflows/build-release.yml` setup-node、`.nvmrc` | 所有运行时代码、所有 npm 依赖版本 | `pnpm install` + `pnpm test:all` 全绿；check-env 输出 Node 22.14 |
| **P2: Electron 36 + 原生模块** | `apps/desktop/package.json` 的 `electron` / `better-sqlite3` / `@electron/rebuild` / `@types/node` / `@types/better-sqlite3`；可能涉及的 main 进程 breaking fix | 不动 electron-vite / electron-builder / vite / vitest | dev 启动正常 + 单测全绿 + `pnpm dist` 产出可用 .exe |
| **P3: 构建工具联动** | `electron-vite` / `electron-builder` / `vite` / `vitest` / `@vitejs/plugin-react` / `jsdom` | Electron 本身、原生模块 | dev + build + dist + test 全链路回归 |

### 2.3 关键约束

1. **每个 Phase 内部允许一个或多个 commit**，但整个 Phase 完成时必须通过 CI 才能开始下一个 Phase
2. **Phase 2 是风险最高的 Phase**——Electron 36 涉及 Chromium 136 / Node 22.14 双升级，需逐条审计 breaking changes
3. **回滚单元 = Phase**：若 P3 构建工具升级出现不可解的回归，可回滚 P3 而保留 P1+P2 成果
4. **Wiki 不在本 spec 范围内**——升级完成后单独开 task 做

---

## 3. Phase 1 — 宿主 Node 22 LTS

### 3.1 改动清单

| 文件 | 改动 |
|---|---|
| [package.json](file:///workspace/package.json) | `engines.node` 从 `>=20.0.0 <22.0.0` → `>=22.0.0 <24.0.0` |
| [scripts/check-env.mjs](file:///workspace/scripts/check-env.mjs) | `checkNodeVersion()` 判定区间改 `>=22 && <24`；`checkNativeModule()` / `checkElectronBinary()` 中硬编码的 `electron@31.7.7` / `better-sqlite3@11.10.0` 路径占位改为运行时读取 `node_modules/<pkg>/package.json` 的 `version` 字段构造路径 |
| [.github/workflows/build-release.yml](file:///workspace/.github/workflows/build-release.yml) | `setup-node` `node-version: '20.18.0'` → `'22.14.0'` |
| `.nvmrc`（新建） | 内容 `22.14.0`，供 nvm/fnm 用户自动切换 |

### 3.2 check-env.mjs 健壮性改进

当前 [check-env.mjs:100](file:///workspace/scripts/check-env.mjs#L100) 硬编码 `electron@31.7.7`，[check-env.mjs:76](file:///workspace/scripts/check-env.mjs#L76) 硬编码 `better-sqlite3@11.10.0`——每次升级都要手改两处。P1 顺手改为动态读取：

```javascript
// 改进后的 checkElectronBinary 示例
import { readFileSync } from 'node:fs';

function readPkgVersion(pkgName) {
  try {
    const pkgJson = JSON.parse(
      readFileSync(join(projectRoot, 'node_modules', pkgName, 'package.json'), 'utf-8')
    );
    return pkgJson.version;
  } catch {
    return null;
  }
}

function checkElectronBinary() {
  const electronVersion = readPkgVersion('electron');
  if (!electronVersion) {
    addResult('Electron 二进制', false, 'electron 包未安装', '安装依赖:\n  pnpm install');
    return;
  }
  // 用 electronVersion 动态构造 .pnpm 路径
  const electronPkgPath = join(
    projectRoot, 'node_modules', '.pnpm',
    `electron@${electronVersion}`, 'node_modules', 'electron'
  );
  // ... 其余逻辑不变
}
```

同样的模式应用到 `checkNativeModule()`。

### 3.3 验证步骤

```bash
nvm use 22.14.0
pnpm install                    # 确保依赖在 Node 22 下安装正常
node scripts/check-env.mjs      # 输出 Node 22.14 + 动态版本号
pnpm test:all                   # 全绿
```

CI 验证：push 后 GitHub Actions 在 Node 22.14 上跑 install + test + build + dist，全绿才进入 P2。

### 3.4 风险与缓解

| 风险 | 概率 | 缓解 |
|---|---|---|
| better-sqlite3 11.10.0 无 Node 22 prebuilt binary，触发源码编译失败 | 中 | 本地需 `python` + `vc-build-tools`（Windows）；CI `windows-latest` 自带 MSVC。若本地编译失败，可临时在 `.npmrc` 加 `build_from_source=true` 或前移 better-sqlite3 升级到 P1 |
| pnpm 9 与 Node 22 兼容性 | 低 | pnpm 9.15+ 已支持 Node 22 |

### 3.5 better-sqlite3 升级前移触发条件

若 P1 验证时 `pnpm install` 因 better-sqlite3 prebuilt 缺失失败，则把 better-sqlite3 升级前移到 P1（与 Node 22 一起处理），因为二者强耦合。前移时 P1 改动清单追加：

- `apps/desktop/package.json` 的 `better-sqlite3` 从 `^11.0.0` → `^11.18.0`
- `@types/better-sqlite3` 升到最新 7.x

---

## 4. Phase 2 — Electron 36 + 原生模块

### 4.1 改动清单

| 包 | 旧版本 | 目标版本 | 备注 |
|---|---|---|---|
| `electron` | `^31.0.0` (31.7.7) | `^36.0.0` | 主升级目标 |
| `better-sqlite3` | `^11.0.0` (11.10.0) | `^11.18.0` 或最新 11.x | 保守升小版本，确保 Node 22 prebuilt（若 P1 已前移则跳过） |
| `@electron/rebuild` | `^3.6.0` | `^3.7.0` 或最新 3.x | 支持 Electron 36 ABI |
| `@types/node` | `^20.14.0` | `^22.14.0` | 与宿主 + Electron 捆绑 Node 对齐 |
| `@types/better-sqlite3` | `^7.6.10` | 最新 7.x | 跟随 better-sqlite3 |

### 4.2 Electron 32-36 Breaking Changes 审计清单

需逐条对照 [main/index.ts](file:///workspace/apps/desktop/src/main/index.ts) 和 [preload/index.ts](file:///workspace/apps/desktop/src/preload/index.ts) 代码核查。基于 Electron 32-36 公开 release notes 的已知 breaking：

| 版本 | Breaking | 当前代码影响 | 需改动 |
|---|---|---|---|
| Electron 32 | `webContents.setWindowOpenHandler` 行为微调 | [index.ts:63](file:///workspace/apps/desktop/src/main/index.ts#L63) 实现已符合新行为 | 否 |
| Electron 33 | `session.defaultSession.webRequest.onHeadersReceived` API 签名不变 | [index.ts:105](file:///workspace/apps/desktop/src/main/index.ts#L105) CSP 注入逻辑保持 | 否 |
| Electron 34 | 默认 `sandbox: true` | [index.ts:53](file:///workspace/apps/desktop/src/main/index.ts#L53) 已显式 `sandbox: true` | 否 |
| Electron 35 | `contextIsolation: true` 成为唯一支持值 | [index.ts:52](file:///workspace/apps/desktop/src/main/index.ts#L52) 已显式启用 | 否 |
| Electron 36 | Node 22.14 / Chromium 136，原生模块 ABI 变化 | better-sqlite3 需 rebuild | 否（rebuild 解决） |

**预期：main/preload 代码零改动或极小改动**。但必须实测验证，不能假设。实施时需对照 Electron 32/33/34/35/36 的完整 release notes 逐条复核。

### 4.3 Rebuild 流程

```bash
pnpm --filter @fire-app/desktop rebuild   # @electron/rebuild 针对 Electron 36 ABI 重编译 better-sqlite3
```

CI 上 `postinstall` 钩子已配置（[package.json:21](file:///workspace/package.json#L21)），自动跑 rebuild。

### 4.4 验证步骤

**自动化**：
```bash
pnpm --filter @fire-app/desktop dev       # dev 启动，窗口正常显示
pnpm test:all                             # 单测全绿
pnpm --filter @fire-app/desktop dist      # 打包 .exe
```

**手动 E2E（dist 产物验证）**：
1. 安装 .exe → 首次启动 onboarding 向导
2. 创建账户 + 增删交易 + 余额联动
3. CSV 导入（7 模板之一）+ JSON 导出/导入
4. 净资产趋势图 + FIRE 计算器渲染
5. 重启应用 → 数据持久验证
6. CSP 拦截 + 外链打开系统浏览器

### 4.5 风险与缓解

| 风险 | 概率 | 缓解 |
|---|---|---|
| better-sqlite3 11.x 不兼容 Electron 36 ABI | 中 | P2 第一步先升 better-sqlite3 + rebuild，失败则评估 12.x（破保守约束） |
| Electron 36 breaking 未识别 | 低 | 逐条审计 + dev 实测 + 完整 E2E 手动验证 |
| sandbox:true 在新 Chromium 下行为变化 | 低 | dev 实测 IPC 通信正常 |
| electron-builder 25 不支持 Electron 36 打包 | 中 | P3 升级 electron-builder，P2 若打包失败可暂用 `electron-builder --dir` 产出未打包目录验证 |

---

## 5. Phase 3 — 构建工具联动

### 5.1 改动清单

| 包 | 旧版本 | 目标版本 | 备注 |
|---|---|---|---|
| `electron-vite` | `^2.0.0` | `^3.0.0` | 支持 Vite 6 + Electron 36 |
| `electron-builder` | `^25` | `^26` 或最新 | 支持 Electron 36 打包 |
| `vite` | `^5.4.0` | `^6.0.0` | 跟随 electron-vite 3 |
| `vitest` | `^2.0.0` | `^3.0.0` | 兼容 Vite 6 |
| `@vitejs/plugin-react` | `^4.3.0` | `^4.5.0` 或 Vite 6 兼容的最新 4.x | 实施时按 Vite 6 peer dep 要求确定（4.x 已支持 Vite 6，优先不跨大版本） |
| `jsdom` | `^25.0.0` | `^26.0.0` | 跟随 vitest 3 的 peer dep 要求 |
| `@testing-library/react` | `^16.0.0` | 保持 16.x | 无需升大版本 |
| `@testing-library/jest-dom` | `^6.0.0` | 保持 6.x | 无需升 |
| `@testing-library/user-event` | `^14.0.0` | 保持 14.x | 无需升 |
| `tailwindcss` / `@tailwindcss/vite` | `^4.0.0` | 保持 4.x | 无需升 |

### 5.2 配置文件影响

- [electron.vite.config.ts](file:///workspace/apps/desktop/electron.vite.config.ts)：electron-vite 3 API 兼容性需核查（`externalizeDepsPlugin` / `defineConfig` 签名预期不变，但实施时需对照 migration guide）
- [vitest.config.ts](file:///workspace/apps/desktop/vitest.config.ts)：vitest 3 API 兼容性需核查（`pool: 'threads'` / `poolOptions` 预期不变）
- [electron-builder.yml](file:///workspace/apps/desktop/electron-builder.yml)：electron-builder 26 配置项预期兼容（`asar` / `asarUnpack` / `nsis` 等不变）

### 5.3 P3 内部子步骤

为降低风险，P3 内部分 3 个子 commit：

1. **P3.1**: `vite` + `@vitejs/plugin-react` + `electron-vite` 升级 → 验证 `dev` + `build`
2. **P3.2**: `vitest` + `jsdom` 升级 → 验证 `test:all`
3. **P3.3**: `electron-builder` 升级 → 验证 `dist`

每个子 commit 必须独立可测、CI 全绿。

### 5.4 风险与缓解

| 风险 | 概率 | 缓解 |
|---|---|---|
| Vite 6 breaking 导致 electron-vite 配置失效 | 中 | 逐条对照 vite 6 migration guide |
| vitest 3 API breaking 导致测试失败 | 中 | vitest 3 主要 breaking 在 pool 默认值，当前已显式 `threads` |
| electron-builder 26 配置项变化 | 低 | `electron-builder.yml` 简单配置，预期兼容 |
| 三工具联动出现交叉不兼容 | 中 | P3 内部分小步：先 vite+electron-vite，再 vitest，最后 electron-builder |

---

## 6. 测试策略

### 6.1 自动化（CI 门禁）

```bash
pnpm test:all                              # shared + desktop 单测全绿
pnpm --filter @fire-app/desktop build      # electron-vite build 成功
pnpm --filter @fire-app/desktop dist       # electron-builder 打包成功
```

### 6.2 手动 E2E（dist 产物验证）

完整 6 步回归（P2 完成后首次执行，P3 完成后再执行一次）：

1. 安装 .exe → 首次启动 onboarding 向导
2. 创建账户 + 增删交易 + 余额联动
3. CSV 导入（7 模板之一）+ JSON 导出/导入
4. 净资产趋势图 + FIRE 计算器渲染
5. 重启应用 → 数据持久验证
6. CSP 拦截 + 外链打开系统浏览器

### 6.3 回归基线

P3 完成后，所有 M1-M9 累积测试用例必须全绿，**不允许跳过或删除测试**。若某测试因升级失败，必须修复测试或修复代码，不允许 `skip`。

---

## 7. 整体风险摘要

| 风险 | 影响 Phase | 概率 | 缓解 |
|---|---|---|---|
| better-sqlite3 ABI 不兼容 | P1/P2 | 中 | 升级前移到 P1 或评估 12.x |
| Electron 36 breaking 未识别 | P2 | 低 | 逐条审计 + 实测 |
| 构建工具联动交叉不兼容 | P3 | 中 | P3 内部分子步控制 |
| CI 因 Node 22 环境差异失败 | P1 | 低 | CI 用 windows-latest 自带 MSVC |

### 7.1 回滚策略

- 整个升级在 `chore/electron-36-upgrade` 分支
- 任一 Phase 失败可 `git revert` 该 Phase commit，不影响其他 Phase
- 若整体不可行，可放弃该分支，main 保持 Electron 31 现状

---

## 8. 验收标准

升级完成且合并到 main 后，必须满足：

1. ✅ Electron 36.x 运行，CI 全绿
2. ✅ 所有 M1-M9 单测全绿（无 skip）
3. ✅ `pnpm dist` 产出可用的 Windows .exe
4. ✅ 手动 E2E 6 步全过
5. ✅ check-env.mjs 输出 Node 22.14 + 动态版本号
6. ✅ main 进程代码零改动或仅必要适配改动
7. ✅ 本 spec 不在范围内的事项（Wiki 同步等）未越界执行

---

## 9. 后续工作（不在本 spec 范围）

1. **Wiki 同步**：升级合并后单独开 task，更新 [08-design-index.md](file:///workspace/docs/wiki/08-design-index.md) 第 5 节"尚未实现的规划"中的"Electron 31→36 升级"条目，标记为已完成
2. **Electron 36 新功能采用**：未来按需评估 utility process / net 模块新特性
3. **better-sqlite3 12.x 评估**：未来单独评估是否升到 12.x

---

## 10. 决策记录

1. **方案 B（分层渐进）而非 Big Bang**：分层让每层可独立验证，故障定位范围窄
2. **better-sqlite3 保守升 11.x 不升 12.x**：避免 API breaking，11.x 最新稳定版已支持 Node 22 ABI
3. **宿主 Node 升到 22.14 而非 24**：与 Electron 36 捆绑 Node 对齐，dev/runtime 一致；Node 24 可能缺 prebuilt
4. **Wiki 同步排除在外**：避免升级 PR 范围膨胀，参照 M9 收尾模式单独处理
5. **check-env.mjs 动态化**：顺手改进，避免下次升级再忘改硬编码版本号
6. **P3 内部分 3 子步**：构建工具联动交叉风险高，子步控制
