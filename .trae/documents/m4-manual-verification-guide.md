# M4 手动验证操作指南生成计划 / M4 Manual Verification Guide Plan

> **目标**：生成 M4 交易管理的详细手动验证操作指南，审核通过后用选项式对话逐项验证 H-1 ~ H-5。

---

## 1. 摘要 / Summary

M4 交易管理代码实现 + 自动化测试已完成（8 个 Task，72 个测试全部通过）。剩余 5 项手动验证（H-1 ~ H-5）需在本地真实环境执行，确认 mock 未掩盖真实 IPC 集成问题 + 视觉检查 + 真实交互流畅性。

本计划：
1. 编写详细手动验证操作指南文档（保存到 `docs/superpowers/specs/2026-07-16-fire-app-milestone4-verification.md`）
2. 审核通过后，用 AskUserQuestion 选项式对话逐项验证 H-1 ~ H-5，发现问题实时解决
3. 验证完成后更新验证文档并提交

---

## 2. 当前状态分析 / Current State Analysis

### 2.1 M4 实现状态（已完成）

| Task | Commit | 测试数 | 内容 |
|------|--------|-------|------|
| 1 | `09ccc27` | 3 | 测试基础设施（vitest + jsdom + RTL） |
| 2 | `9a4c4af` | 33 | transaction-constants 纯函数 |
| 3 | `200a06e` | 5 | category-store + 自动 seed |
| 4 | `6a0468a` | 4 | TransactionOverviewCards |
| 5 | `5af3cdb` | 6 | TransactionFilters |
| 6 | `a7e3aab` | 8 | TransactionListTable |
| 7 | `b64288d` | 8 | TransactionFormModal |
| 8 | `7bb844a` | 5 | TransactionsPage 集成 |

**自动化验证全绿**：8 文件 / 72 测试通过，无回归。

### 2.2 待验证的 5 项（来自 spec §11.2）

| # | 验证项 | 目的 |
|---|--------|------|
| H-1 | 启动 app，交易页正常加载 | 真实 sqlite + IPC 集成，确认 mock 未掩盖问题 |
| H-2 | 真实新增 1 笔 income + 1 笔 transfer | 数据库真实写入 + 余额真实联动 |
| H-3 | 真实编辑 + 删除各 1 笔 | 软删除 + 余额回滚真实生效 |
| H-4 | 视觉检查：概览卡颜色/布局、筛选区、列表、表单弹窗 | 自动化测试不覆盖视觉 |
| H-5 | 真实筛选 + 排序交互 | UI 响应真实流畅 |

### 2.3 关键实现细节（影响验证步骤）

**TransactionsPage**（[TransactionsPage.tsx](file:///workspace/FIRE%20APP/apps/desktop/src/renderer/src/pages/TransactionsPage.tsx)）：
- mount 时同时 fetch transactions + accounts + categories
- 概览卡条件渲染：`filtered.length > 0` 时显示
- PageHeader 右上角 "+ 新增交易" 按钮

**TransactionFormModal**（[TransactionFormModal.tsx](file:///workspace/FIRE%20APP/apps/desktop/src/renderer/src/components/transactions/TransactionFormModal.tsx)）：
- 表单字段：交易类型 / 账户 / 目标账户(transfer) / 分类 / 金额 / 日期 / 描述
- 类型选项：收入 / 支出 / 转账 / 初始余额
- 校验：账户必填、金额 > 0、transfer 时目标账户必填且 ≠ 源账户、日期必填
- 金额输入元，存储分（yuanToCents 转换）

**TransactionListTable**（[TransactionListTable.tsx](file:///workspace/FIRE%20APP/apps/desktop/src/renderer/src/components/transactions/TransactionListTable.tsx)）：
- 6 列：类型(色点+标签) / 日期(含描述副标题) / 账户(transfer 显示 source→target) / 分类 / 金额(按类型着色) / 操作(编辑/删除)
- 排序 Select：日期降序(默认) / 日期升序 / 金额降序 / 金额升序
- 空状态：无筛选"暂无交易记录" / 有筛选"无匹配交易"

**TransactionOverviewCards**（[TransactionOverviewCards.tsx](file:///workspace/FIRE%20APP/apps/desktop/src/renderer/src/components/transactions/TransactionOverviewCards.tsx)）：
- 3 张卡：收入(绿点) / 支出(红点) / 结余(蓝点)
- 结余负数显示红色
- 收入含 income + initial_balance；transfer 不计入结余

**TransactionFilters**（5 个筛选项）：
- 类型 / 账户 / 分类 / 起始日期 / 结束日期 + 重置按钮

**Category 自动 seed**：categories 为空时自动 seed 18 个内置分类

### 2.4 验证环境

- 用户本地项目路径：`D:\Projects\Fire-APP`（从 M3 验证已知）
- Node 20 LTS + pnpm 9
- 启动命令：`pnpm dev`
- 数据库：本地 sqlite，首次运行自动初始化

---

## 3. 提议变更 / Proposed Changes

### 3.1 创建验证指南文档

**文件**：`docs/superpowers/specs/2026-07-16-fire-app-milestone4-verification.md`

**内容结构**：

```
# M4 交易管理验证计划 / Milestone 4 Verification Plan
> 状态/日期/关联/前置

## §1 验证范围与方法
  - 1.1 背景（M4 自动化 72 测试全绿，手动验证聚焦真实环境 + 视觉）
  - 1.2 验证范围（5 项 H-1 ~ H-5）
  - 1.3 验证方法（真实 GUI 交互）
  - 1.4 修复流程（发现→定位→修复→回归→commit，前缀 fix(transactions):）
  - 1.5 环境前置（Node 20 + pnpm dev + 首次需 pnpm bootstrap）

## §2 验证前准备
  - 2.1 环境检查（pnpm check-env）
  - 2.2 拉取最新代码
  - 2.3 启动应用（pnpm dev）
  - 2.4 数据准备（需至少 2 个账户用于 transfer 验证；若无账户先在账户页创建）

## §3 H-1 启动加载验证
  - 目的：真实 sqlite + IPC 集成
  - 操作步骤：
    1. 启动 pnpm dev
    2. 等待 Electron 窗口打开
    3. 点击左侧导航"交易记录"
  - 预期结果（6 项检查点）：
    a. 页面标题"交易记录"显示
    b. 右上角"+ 新增交易"按钮显示
    c. 无交易时列表显示"暂无交易记录，点击右上角「新增交易」开始记录"
    d. 概览卡不渲染（无数据时隐藏）
    e. 筛选区 5 个控件显示（类型/账户/分类/日期×2 + 重置）
    f. 控制台无报错
  - 通过标准：6 项全部符合

## §4 H-2 新增交易验证
  - 目的：数据库真实写入 + 余额联动
  - 前置：已创建至少 2 个账户（如"招商银行"、"支付宝"）
  - 操作步骤 A（新增 income）：
    1. 点"+ 新增交易"
    2. 交易类型选"收入"
    3. 账户选"招商银行"
    4. 金额输入 1000
    5. 日期选今天
    6. 描述输入"工资"
    7. 点"确定"
  - 预期 A（5 项检查点）：
    a. 弹窗关闭
    b. toast "交易创建成功"
    c. 列表出现新交易行（绿色收入标签 + ¥1,000.00）
    d. 概览卡显示（收入 ¥1,000.00 / 支出 ¥0.00 / 结余 ¥1,000.00）
    e. 切到账户页，招商银行余额 +1000
  - 操作步骤 B（新增 transfer）：
    1. 点"+ 新增交易"
    2. 交易类型选"转账"
    3. 账户选"招商银行"
    4. 目标账户选"支付宝"（出现目标账户下拉）
    5. 金额输入 500
    6. 点"确定"
  - 预期 B（5 项检查点）：
    a. 弹窗关闭 + toast 成功
    b. 列表出现转账行（蓝色转账标签 + 账户显示"招商银行 → 支付宝"）
    c. 金额显示 ¥500.00（灰色，无 +/- 符号）
    d. 概览卡结余不变（transfer 不计入结余）
    e. 账户页：招商银行 -500，支付宝 +500
  - 通过标准：A + B 全部符合

## §5 H-3 编辑 + 删除验证
  - 目的：软删除 + 余额回滚
  - 操作步骤 A（编辑）：
    1. 点击 income 交易行的"编辑"
    2. 金额从 1000 改为 2000
    3. 点"确定"
  - 预期 A：
    a. 弹窗关闭 + toast "交易更新成功"
    b. 列表金额变为 ¥2,000.00
    c. 概览卡收入变为 ¥2,000.00
    d. 账户页招商银行余额变为 +2000
  - 操作步骤 B（删除）：
    1. 点击某交易行的"删除"
    2. 确认弹窗显示"确定删除此交易记录吗？此操作不可撤销。"
    3. 点"确认"
  - 预期 B：
    a. 确认弹窗关闭 + toast "交易已删除"
    b. 列表中该交易行消失
    c. 概览卡数值相应减少
    d. 账户页余额回滚
  - 通过标准：A + B 全部符合

## §6 H-4 视觉检查
  - 目的：自动化测试不覆盖的视觉验证
  - 检查项（8 项）：
    1. 概览卡：3 张卡 grid-cols-3 布局，间距均匀
    2. 收入卡：绿点 + "收入"标签 + 金额
    3. 支出卡：红点 + "支出"标签 + 金额
    4. 结余卡：蓝点 + "结余"标签 + 金额（负数时红色文字）
    5. 筛选区：5 个控件一行排列 + 重置按钮右对齐
    6. 列表表头：6 列对齐（类型/日期/账户/分类/金额/操作）
    7. 类型标签：4 种颜色区分（绿/红/蓝/紫）
    8. 表单弹窗：字段排列整齐，transfer 时目标账户下拉出现
  - 通过标准：8 项全部符合

## §7 H-5 筛选 + 排序交互
  - 目的：UI 响应真实流畅
  - 操作步骤 A（类型筛选）：
    1. 类型下拉选"收入"
    2. 观察列表 + 概览卡
  - 预期 A：列表只显示收入交易，概览卡数值随筛选变化
  - 操作步骤 B（账户筛选 + transfer 双向匹配）：
    1. 账户下拉选"招商银行"
    2. 观察列表
  - 预期 B：显示招商银行作为 source 或 target 的所有交易（含 transfer 转入转出）
  - 操作步骤 C（日期筛选）：
    1. 起始日期选今天
    2. 结束日期选今天
  - 预期 C：只显示今天的交易
  - 操作步骤 D（重置）：
    1. 点"重置"按钮
  - 预期 D：5 个筛选全部清空，列表恢复全量
  - 操作步骤 E（排序）：
    1. 排序下拉切"金额降序"
    2. 观察列表
  - 预期 E：列表按金额从大到小重排
  - 操作步骤 F（无匹配空状态）：
    1. 起始日期选未来日期
    2. 观察列表
  - 预期 F：列表显示"无匹配交易，试试调整筛选条件"
  - 通过标准：A-F 全部符合

## §8 验证结果汇总（验证后填写）
  - 5 项验证结果表
  - 发现的问题及修复
  - 经验归纳
```

### 3.2 选项式对话验证流程

审核通过后，按以下流程逐项验证：

**每项验证使用 AskUserQuestion**，提供 3 个选项：
- `符合预期` — 该项通过
- `不符合预期` — 该项失败（追问具体现象）
- `其他问题` — 用户描述未预期的问题

**验证顺序**：H-1 → H-2 → H-3 → H-4 → H-5（按依赖顺序，H-2 依赖 H-1，H-3 依赖 H-2 的数据）

**发现问题处理**：
- 实时分析根因
- 修复代码 bug（commit 前缀 `fix(transactions):`）
- 回归验证（pnpm test:desktop + pnpm --filter @fire-app/desktop build）
- 重新验证该项

**验证完成后**：
- 更新验证文档 §8 验证结果汇总
- git commit 验证文档

---

## 4. 假设与决策 / Assumptions & Decisions

### 4.1 假设
- 用户本地环境已配置好（Node 20 + pnpm，M3 验证时已确认）
- 用户本地项目路径 `D:\Projects\Fire-APP` 保留 M3 数据（含账户）
- 若账户不足 2 个，验证指南中会提示先创建

### 4.2 决策
- **验证指南保存位置**：`docs/superpowers/specs/2026-07-16-fire-app-milestone4-verification.md`（与 M3 验证文档同目录，遵循命名规范）
- **验证方式**：选项式对话逐项确认（与 M3 验证一致）
- **不预先运行应用**：验证指南生成后，由用户在本地启动应用执行验证，我通过选项对话收集结果
- **每个检查点独立判定**：每项 H-x 内的多个检查点都需符合才算通过

---

## 5. 验证步骤 / Verification Steps

### 5.1 生成验证指南
1. 将上述 §1-§8 内容写入 `docs/superpowers/specs/2026-07-16-fire-app-milestone4-verification.md`
2. git commit（消息：`docs: add M4 transaction management verification plan`）

### 5.2 选项式对话验证
1. 提示用户在本地启动应用（`pnpm dev`）并完成数据准备（至少 2 个账户）
2. 逐项 AskUserQuestion 验证 H-1 ~ H-5
3. 发现问题实时修复 + 回归
4. 全部验证完成后更新文档 §8

### 5.3 完成标准
- 5 项手动验证全部通过（或发现问题已修复并重新验证通过）
- 验证文档 §8 已填写并 commit
