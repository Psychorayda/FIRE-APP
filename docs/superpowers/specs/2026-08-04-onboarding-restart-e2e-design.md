# Onboarding 与重启持久化 E2E 测试设计

## 目标

为 v0.1.1-dev.71（及后续版本）编写 Playwright Electron E2E 测试，覆盖：
1. Onboarding 5 步完整流程
2. 重启后账户持久化验证（T0 BUG 核心验证，含正常关闭重启 + 强杀重启）

## 运行环境

- **OS**：Windows（exe 是 Windows 打包产物）
- **目标**：打包 exe（dev.71 产物），从 GitHub Releases 下载或本地指定路径
- **userData 隔离**：测试前直接清理 `%APPDATA%\fire-app`（data 子目录 + 日志），仅在干净测试环境运行

## 架构

```
apps/desktop/
├── e2e/
│   ├── helpers.ts              # exe 下载/启动/清理工具
│   ├── onboarding.spec.ts      # Onboarding 5 步完整流程
│   └── persistence.spec.ts     # 重启持久化验证（正常关闭 + 强杀）
├── playwright.config.ts        # Electron E2E 配置（无 webServer，直接 launch exe）
```

**不改动任何现有代码**（主进程/preload/renderer 零改动）。纯新增测试设施。

## 组件

### helpers.ts

提供三个工具函数：

1. **`ensureExePath()`**：获取 exe 路径
   - 优先读环境变量 `FIRE_APP_EXE_PATH`（本地指定）
   - 否则从 GitHub Releases 下载 dev.71 的 portable exe 到 `e2e/.cache/`
   - 返回 exe 绝对路径

2. **`cleanUserData()`**：清理测试 userData
   - 删除 `%APPDATA%\fire-app\data` 目录（DB 文件 + WAL/SHM）
   - 删除 `%APPDATA%\fire-app\fire-app-debug.log`
   - 仅清理 data 和日志，不删整个 fire-app 目录（保留其他可能的配置）
   - 在 beforeAll/beforeEach 调用

3. **`launchApp(exePath)`**：启动 Electron 并返回 `{ electronApp, page }`
   - `_electron.launch({ executablePath: exePath })`
   - 等待首个窗口 ready
   - 返回 `electronApp`（ElectronApplication）和 `page`（首个 Page）
   - 设置合理的启动超时（30s）

### onboarding.spec.ts

**用例：完成 Onboarding 5 步并进入主页**

```
1. cleanUserData()
2. launchApp(exePath)
3. 等待 URL 含 #/onboarding
4. Step 1: 点击"开始使用"
5. Step 2: getByPlaceholder('例如：张三').fill('E2E测试用户') → 点击"下一步"
6. Step 3: getByText('中国市场').click() → 点击"下一步"
7. Step 4: 保持默认利率 → 点击"下一步"
8. Step 5: 点击"完成创建"
9. 等待 URL 变为 #/（主页）
10. 断言：页面可见"E2E测试用户"或主页特征元素
11. electronApp.close()
```

**定位策略**（无 data-testid，靠文本/placeholder）：
- 按钮：`page.getByText('开始使用')` / `getByText('下一步')` / `getByText('完成创建')`
- 输入框：`page.getByPlaceholder('例如：张三')`
- 单选：`page.getByText('中国市场')`（点击 label 包裹区域）

### persistence.spec.ts

**用例 1：正常关闭后重启，账户仍在**

```
1. cleanUserData()
2. launchApp → 完成 Onboarding（复用 onboarding 流程或直接调 helpers.completeOnboarding）
3. electronApp.close()  // 正常关闭（触发 before-quit → closeAppDatabase → WAL checkpoint）
4. launchApp(exePath)   // 重新启动
5. 断言：URL 不含 #/onboarding（直接进主页）
6. 断言：页面可见账户名"E2E测试用户"
7. electronApp.close()
```

**用例 2：强杀进程后重启，账户仍在（验证 WAL replay）**

```
1. cleanUserData()
2. launchApp → 完成 Onboarding
3. process.kill(electronApp.process().pid)  // 强杀（模拟任务管理器结束进程，不触发 before-quit）
4. 等待进程退出
5. launchApp(exePath)   // 重新启动
6. 断言：URL 不含 #/onboarding
7. 断言：页面可见账户名"E2E测试用户"
8. electronApp.close()
```

**用例 3：多次重启数据不丢（回归验证）**

```
1. cleanUserData()
2. launchApp → 完成 Onboarding
3. 循环 3 次：close → launch → 断言账户仍在
4. electronApp.close()
```

## 数据流

```
测试脚本
  → cleanUserData()           清理 %APPDATA%\fire-app\data
  → _electron.launch(exe)     启动打包 exe
  → Playwright Page 驱动       通过 CDP 操控渲染进程
  → Onboarding 表单交互        createUser IPC → 主进程 → DB 写入
  → electronApp.close()       触发 before-quit → closeAppDatabase（WAL checkpoint）
  → _electron.launch(exe)     再次启动
  → getFirstUser IPC          读 DB → 有用户 → initialized:true → 进主页
  → 断言主页可见               验证持久化成功
```

## 错误处理

- **exe 下载失败**：helpers.ts 抛错并提示手动设置 `FIRE_APP_EXE_PATH`
- **启动超时**（30s）：失败并截图
- **Onboarding 某步元素未找到**：Playwright 默认 5s 超时，失败时自动截图 + trace
- **强杀后进程未退出**：等待 5s 后强制 kill

## 测试运行

```bash
# 首次安装 Playwright 浏览器（Electron 模式实际不需要浏览器二进制，但 CLI 需要）
npx playwright install

# 运行全部 E2E
pnpm --filter @fire-app/desktop exec playwright test

# 仅运行持久化测试
pnpm --filter @fire-app/desktop exec playwright test e2e/persistence.spec.ts

# 查看测试报告
pnpm --filter @fire-app/desktop exec playwright show-report
```

**环境变量**：
- `FIRE_APP_EXE_PATH`：指定本地 exe 路径，跳过下载（推荐本地开发时用）
- 不设则自动从 GitHub Releases 下载 dev.71

## 依赖

新增 devDependencies（apps/desktop/package.json）：
- `@playwright/test`：测试框架 + 断言 + runner
- `playwright`：包含 `_electron` 模块（启动 Electron 应用）

不引入其他依赖。Playwright 自带 trace viewer、截图、HTML 报告。

## playwright.config.ts

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,           // 单测 60s（含 exe 启动）
  expect: { timeout: 10_000 },
  fullyParallel: false,      // 串行：共享 userData，不能并行
  retries: 0,                // E2E 不重试，避免假绿
  reporter: [['html'], ['list']],
  use: {
    trace: 'on-first-retry', // 首次重试时录 trace（虽然 retries=0，保留配置）
    screenshot: 'only-on-failure',
  },
});
```

## 局限性

1. **仅 Windows**：exe 是 Windows 产物，测试需在 Windows 运行
2. **直接清理 userData**：会删除 `%APPDATA%\fire-app\data`，仅适合干净测试机，不可在生产用户机器运行
3. **不测自动更新**：更新流程涉及网络下载，不在本测试范围
4. **不进 CI**：CI 是 Linux runner，无法运行 Windows exe E2E。本测试为本地/手动验证用
5. **exe 下载依赖网络**：首次运行需从 GitHub Releases 下载 ~90MB exe
