# Dashboard 升级验证实施计划 / Dashboard Upgrade Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 对 dashboard 升级 + M4 回归进行打包 exe 真实环境验证，通过选项式对话逐项收集结果，发现 bug 则实时修复。

**Architecture:** 5 个验证项 H-1~H-5 顺序执行，每项含用户操作 + AI 选项式对话收集 + 失败修复流程。验证无代码产出（除非发现 bug），产出为验证结果汇总表。

**Tech Stack:** GitHub Actions artifact（fire-app-windows）+ Electron 打包版 + AskUserQuestion 选项式对话

**Spec:** `docs/superpowers/specs/2026-07-28-fire-app-dashboard-upgrade-verification.md`

---

## 文件结构

### 修改文件（1 个，仅验证完成时）

| 文件 | 修改 |
|------|------|
| `docs/superpowers/specs/2026-07-28-fire-app-dashboard-upgrade-verification.md` | 填写 §7 验证结果汇总（结果表、问题修复、验收对照、经验归纳） |

### 可能新增的文件（仅发现 bug 时）

- 代码修复文件（具体路径取决于 bug 位置）
- 修复 commit（前缀 `fix(dashboard):`）

### 不修改的文件

- dashboard 组件代码（除非验证发现 bug）
- M4 交易管理代码（除非回归发现 bug）
- CI 配置（已验证通过）

---

## 验证执行原则

1. **顺序执行**：H-1 → H-2 → H-3 → H-4 → H-5，前一项通过后再执行下一项
2. **选项式对话**：每项验证后，AI 用 AskUserQuestion 逐项收集检查点结果
3. **失败处理**：发现失败时，AI 定位根因 → 修复 → 回归验证（pnpm test + build）→ 推送 → 用户重新下载验证
4. **数据累积**：H-1 创建用户，H-2 创建账户，H-3 创建交易，数据在验证项间累积
5. **用户为主**：所有 GUI 操作由用户在本地 exe 执行，AI 不直接操作应用

---

## Task 1: 下载 artifact + 环境准备

**Files:** 无修改

- [ ] **Step 1: 确认 CI 构建状态**

Run:
```bash
gh run view 30365075718 --repo Psychorayda/FIRE-APP --json status,conclusion 2>&1
```

Expected: `"status":"completed","conclusion":"success"`

- [ ] **Step 2: 引导用户下载 artifact**

AI 向用户发送下载指引：

> 请从 GitHub Actions 下载 `fire-app-windows` artifact：
> 1. 访问 https://github.com/Psychorayda/FIRE-APP/actions/runs/30365075718
> 2. 拉到页面底部 "Artifacts" 区域
> 3. 点击 `fire-app-windows` 下载（zip 文件）
> 4. 解压，运行其中的 exe（nsis 安装包或 portable 免安装版）
>
> 下载完成后告诉我。

- [ ] **Step 3: 确认用户已准备好**

AI 用 AskUserQuestion 确认：
> 问题："exe 是否已下载并准备运行？"
> 选项：是，已准备好 / 下载遇到问题

Expected: 用户确认"已准备好"

- [ ] **Step 4: 记录验证开始**

AI 在内部记录验证开始时间，准备进入 H-1。

---

## Task 2: H-1 启动 + onboarding + 空状态

**Files:** 无修改（除非发现 bug）

**Spec 引用:** §2 H-1

- [ ] **Step 1: 向用户说明操作步骤**

AI 向用户发送 H-1 操作指引：

> ## H-1 启动 + onboarding + 空状态
>
> **操作步骤：**
> 1. 运行下载的 exe
> 2. 完成 onboarding 创建用户（如"测试用户"）
> 3. 进入仪表盘页
>
> **完成后告诉我结果。**

- [ ] **Step 2: 选项式对话收集结果**

AI 用 AskUserQuestion 逐项收集（合并为 2 个问题减少打扰）：

问题 1："H-1 检查点 a-b：应用启动是否正常？onboarding 是否完成？"
- 选项：全部正常 / 启动有问题 / onboarding 有问题

问题 2："H-1 检查点 c-d-e：6 张卡是否显示 ¥0.00？空状态文案是否正确？控制台是否有报错？"
- 选项：全部正常 / 卡片显示异常 / 空状态文案错误 / 控制台有报错

Expected: 全部正常

- [ ] **Step 3: 判定结果**

- 如果全部正常：标记 H-1 通过，进入 Task 3
- 如果有异常：执行 Step 4 修复流程

- [ ] **Step 4: 修复流程（仅失败时执行）**

1. AI 请用户提供异常详情（截图、错误信息）
2. AI 定位根因（查看对应组件代码）
3. AI 修复代码
4. Run: `cd /workspace/apps/desktop && pnpm test 2>&1 | tail -20`
   Expected: 所有测试通过
5. Run: `cd /workspace/apps/desktop && pnpm build 2>&1 | tail -10`
   Expected: 构建成功
6. AI 提交修复：`git -C /workspace commit -am "fix(dashboard): H-1 [具体问题]"`
7. AI 推送：`git -C /workspace push origin main`
8. 等待新 CI 构建（约 3 分钟）
9. 引导用户重新下载 artifact 并重验 H-1

---

## Task 3: H-2 创建账户后净资产卡

**Files:** 无修改（除非发现 bug）

**Spec 引用:** §3 H-2

- [ ] **Step 1: 向用户说明操作步骤**

AI 向用户发送 H-2 操作指引：

> ## H-2 创建账户后净资产卡
>
> **操作步骤：**
> 1. 切到"账户管理"页
> 2. 创建 3 个账户：
>    - 招商银行（流动资产 / checking / 初始余额 10000 元）
>    - 支付宝（流动资产 / checking / 初始余额 5000 元）
>    - 房贷（负债 / liability / 初始余额 -200000 元）
> 3. 切回仪表盘页
>
> **预期：**
> - 总资产 ¥15,000.00
> - 总负债 -¥200,000.00
> - 净资产 -¥185,000.00（红色文字）
>
> **完成后告诉我结果。**

- [ ] **Step 2: 选项式对话收集结果**

问题 1："H-2 检查点 a-b-c：总资产 ¥15,000.00？总负债 -¥200,000.00？净资产 -¥185,000.00？"
- 选项：数值全部正确 / 总资产错误 / 总负债错误 / 净资产错误

问题 2："H-2 检查点 d-e：净资产负数是否红色？切回仪表盘是否自动刷新？"
- 选项：全部正常 / 颜色未变红 / 需手动刷新

Expected: 全部正常

- [ ] **Step 3: 判定结果**

- 如果全部正常：标记 H-2 通过，进入 Task 4
- 如果有异常：执行修复流程（同 Task 2 Step 4，commit 消息改为 `fix(dashboard): H-2 [问题]`）

---

## Task 4: H-3 创建交易后收支卡 + 近期交易

**Files:** 无修改（除非发现 bug）

**Spec 引用:** §4 H-3

- [ ] **Step 1: 向用户说明操作步骤**

AI 向用户发送 H-3 操作指引：

> ## H-3 创建交易后收支卡 + 近期交易
>
> **操作步骤：**
> 1. 切到"交易记录"页
> 2. 新增 2 笔交易：
>    - 收入：工资，招商银行，1000 元，今天
>    - 支出：餐饮，招商银行，200 元，今天
> 3. 切回仪表盘页
>
> **预期：**
> - 本月收入 ¥1,000.00
> - 本月支出 ¥200.00
> - 本月结余 ¥800.00（正数，非红色）
> - 近期交易列表显示最近交易（含 initial_balance + income/expense）
> - 交易行：类型色点+标签、日期、账户名、金额（收入绿/支出红）
>
> **完成后告诉我结果。**

- [ ] **Step 2: 选项式对话收集结果**

问题 1："H-3 检查点 a-b-c：本月收入 ¥1,000.00？支出 ¥200.00？结余 ¥800.00？"
- 选项：数值全部正确 / 收入错误 / 支出错误 / 结余错误

问题 2："H-3 检查点 d-e-f：近期交易列表是否显示？格式是否正确（色点/标签/金额颜色）？最多 10 笔？"
- 选项：全部正常 / 列表为空 / 格式异常 / 数量超限

Expected: 全部正常

- [ ] **Step 3: 判定结果**

- 如果全部正常：标记 H-3 通过，进入 Task 5
- 如果有异常：执行修复流程（同 Task 2 Step 4，commit 消息改为 `fix(dashboard): H-3 [问题]`）

---

## Task 5: H-4 趋势图 + 视觉检查

**Files:** 无修改（除非发现 bug）

**Spec 引用:** §5 H-4

- [ ] **Step 1: 向用户说明操作步骤**

AI 向用户发送 H-4 操作指引：

> ## H-4 趋势图 + 视觉检查
>
> **操作步骤：**
> 1. 在仪表盘页查看趋势图区域
> 2. 全页面视觉检查
>
> **预期：**
> - 趋势图显示"仅 1 个月数据"空状态（新数据库只有当月 snapshot）
> - 趋势图标题"净资产趋势（近 6 个月）"
> - 净资产卡 3 张 grid-cols-3，间距均匀
> - 收支卡 3 张 grid-cols-3
> - 近期交易表 4 列对齐
> - 页面整体垂直排列，间距一致
>
> **完成后告诉我结果。**

- [ ] **Step 2: 选项式对话收集结果**

问题 1："H-4 检查点 a-b：趋势图是否显示'仅 1 个月数据'空状态？标题是否正确？"
- 选项：全部正常 / 空状态文案错误 / 标题错误 / 趋势图渲染异常

问题 2："H-4 检查点 c-d-e-f：净资产卡布局？收支卡布局？交易表对齐？页面整体间距？"
- 选项：全部正常 / 卡片布局错乱 / 交易表未对齐 / 页面间距异常

Expected: 全部正常

- [ ] **Step 3: 判定结果**

- 如果全部正常：标记 H-4 通过，进入 Task 6
- 如果有异常：执行修复流程（同 Task 2 Step 4，commit 消息改为 `fix(dashboard): H-4 [问题]`）

---

## Task 6: H-5 M4 交易页回归

**Files:** 无修改（除非发现 bug）

**Spec 引用:** §6 H-5

- [ ] **Step 1: 向用户说明操作步骤**

AI 向用户发送 H-5 操作指引：

> ## H-5 M4 交易页回归
>
> **操作步骤：**
> 1. 在"交易记录"页执行：
>    - 新增 1 笔 transfer（招商银行 → 支付宝，300 元）
>    - 编辑 1 笔交易（改金额）
>    - 删除 1 笔交易
> 2. 检查功能完整性
>
> **预期：**
> - 交易列表正常加载
> - transfer 创建成功，显示"招商银行 → 支付宝"，金额蓝色
> - 编辑后列表更新，toast 成功
> - 删除后行消失，toast 提示
> - 概览卡数值正确联动
> - 账户余额正确反映交易变动
>
> **完成后告诉我结果。**

- [ ] **Step 2: 选项式对话收集结果**

问题 1："H-5 检查点 a-b-c-d：列表加载？transfer 新增？编辑？删除？"
- 选项：全部正常 / 列表加载失败 / transfer 异常 / 编辑异常 / 删除异常

问题 2："H-5 检查点 e-f：概览卡联动？账户余额联动？"
- 选项：全部正常 / 概览卡未联动 / 账户余额未联动

Expected: 全部正常

- [ ] **Step 3: 判定结果**

- 如果全部正常：标记 H-5 通过，进入 Task 7
- 如果有异常：执行修复流程（commit 消息前缀改为 `fix(transactions):`，因涉及 M4 代码）

---

## Task 7: 填写验证结果汇总 + 提交

**Files:**
- Modify: `docs/superpowers/specs/2026-07-28-fire-app-dashboard-upgrade-verification.md`（§7 验证结果汇总）

- [ ] **Step 1: 汇总各项结果**

AI 根据Task 2-6 收集的结果，汇总 H-1~H-5 的通过/失败状态。

- [ ] **Step 2: 填写 §7.1 验证结果表**

用 Edit 工具修改 `docs/superpowers/specs/2026-07-28-fire-app-dashboard-upgrade-verification.md` 的 §7.1：

```markdown
| # | 验证项 | 结果 | 备注 |
|---|--------|------|------|
| H-1 | 启动 + onboarding + 空状态 | ✅ 通过 / ❌ 失败 | [备注] |
| H-2 | 净资产卡 | ✅ 通过 / ❌ 失败 | [备注] |
| H-3 | 收支卡 + 近期交易 | ✅ 通过 / ❌ 失败 | [备注] |
| H-4 | 趋势图 + 视觉检查 | ✅ 通过 / ❌ 失败 | [备注] |
| H-5 | M4 交易页回归 | ✅ 通过 / ❌ 失败 | [备注] |
```

根据实际结果填写 ✅/❌ 和备注。

- [ ] **Step 3: 填写 §7.2 发现的问题及修复**

如果验证过程中有修复，记录每个问题的：
- 问题描述
- 根因
- 修复 commit hash
- 修复后验证结果

如果无问题，填写"验证过程未发现 bug，无需修复。"

- [ ] **Step 4: 填写 §7.3 验收标准对照**

根据验证结果更新：

```markdown
| 验收标准 | 验证项 | 结果 |
|---------|--------|------|
| D-1 DashboardPage 不再是占位页 | H-1 | ✅ 通过 |
| D-2 净资产 3 卡正确显示 | H-2 | ✅ 通过 |
| D-3 本月收支 3 卡正确显示 | H-3 | ✅ 通过 |
| D-4 趋势图显示近 6 个月 | H-4 | ✅ 通过（空状态逻辑） |
| D-5 近期交易显示最近 10 笔 | H-3 | ✅ 通过 |
| D-6 空状态文案正确 | H-1, H-4 | ✅ 通过 |
| D-7 所有 renderer 测试通过 | 自动化 | ✅ 通过（114 测试） |
| D-8 CI 构建成功 | CI | ✅ 通过（run 30365075718） |
```

如有失败项，对应改为 ❌ 并备注。

- [ ] **Step 5: 填写 §7.4 经验归纳**

总结验证过程中的经验：
- 路径迁移是否引入问题
- dashboard 各模块在真实环境的表现
- M4 回归是否通过
- 已知问题（userData 路径不一致）

- [ ] **Step 6: 提交验证结果**

```bash
git -C /workspace add docs/superpowers/specs/2026-07-28-fire-app-dashboard-upgrade-verification.md
git -C /workspace commit -m "docs(verification): dashboard 升级验证全部通过 (H-1~H-5)

- H-1 启动+onboarding+空状态: [结果]
- H-2 净资产卡: [结果]
- H-3 收支卡+近期交易: [结果]
- H-4 趋势图+视觉检查: [结果]
- H-5 M4 交易页回归: [结果]
[如有修复: 修复 N 个 bug, commit hash]"
git -C /workspace push origin main
```

根据实际结果替换 [结果]。

- [ ] **Step 7: 宣布验证完成**

AI 向用户报告：
- 5 项验证的最终结果
- 验收标准 D-1~D-8 的达标情况
- 发现并修复的问题（如有）
- dashboard 升级里程碑状态

---

## 修复流程详细说明（适用于所有 Task 的失败处理）

当任一验证项失败时，执行以下流程：

### 1. 收集异常详情

AI 请用户提供：
- 异常现象描述
- 截图（如有）
- 控制台错误信息（DevTools > Console）

### 2. 定位根因

AI 根据异常现象查看对应代码：
- 净资产卡问题 → `apps/desktop/src/renderer/src/components/dashboard/NetWorthCards.tsx` + `dashboard-constants.ts`
- 收支卡问题 → `MonthlyOverviewCards.tsx` + `transaction-constants.ts`（computeOverview）
- 趋势图问题 → `NetWorthTrendChart.tsx` + `dashboard-constants.ts`（formatTrendData）
- 近期交易问题 → `RecentTransactions.tsx` + `dashboard-constants.ts`（getRecentTransactions）
- 容器问题 → `DashboardPage.tsx`
- M4 回归问题 → `apps/desktop/src/renderer/src/components/transactions/` 或 `pages/TransactionsPage.tsx`

### 3. 修复 + 回归验证

```bash
cd /workspace/apps/desktop && pnpm test 2>&1 | tail -20
cd /workspace/apps/desktop && pnpm build 2>&1 | tail -10
```

Expected: 测试全绿 + 构建成功

### 4. 提交 + 推送 + 等 CI

```bash
git -C /workspace commit -am "fix([scope]): [问题描述]"
git -C /workspace push origin main
```

等待新 CI 构建（用 `gh run list --repo Psychorayda/FIRE-APP --limit 1` 监控）。

### 5. 重新下载 + 重验

引导用户从新 CI run 下载 artifact，重新执行失败的验证项。

---

## Self-Review

### 1. Spec coverage

| Spec 章节 | 对应 Task |
|-----------|----------|
| §1 验证范围与前置 | Task 1（环境准备） |
| §2 H-1 | Task 2 |
| §3 H-2 | Task 3 |
| §4 H-3 | Task 4 |
| §5 H-4 | Task 5 |
| §6 H-5 | Task 6 |
| §7 验证结果汇总 | Task 7 |

覆盖完整，无遗漏。

### 2. Placeholder scan

- Task 7 的 §7.1/§7.2/§7.3/§7.4 填写内容用 `[结果]`/`[备注]` 占位，这是验证文档的固有特性（结果取决于实际验证），非计划缺陷。每项都给出了填写模板和具体示例。
- 修复流程的 commit 消息用 `[问题描述]`/`[scope]` 占位，但流程清晰，执行时根据实际情况替换。
- 无 "TBD"/"TODO"/"implement later" 等红旗。

### 3. Type consistency

- 验证项编号 H-1~H-5 在 spec、计划、Task 间一致
- 检查点编号 a/b/c... 在 spec 和计划间一致
- 验收标准 D-1~D-8 与 dashboard spec §9 一致
- commit 消息前缀按模块区分（dashboard vs transactions）

无类型/命名不一致问题。
