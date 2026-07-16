# 里程碑 3 验证计划 / Milestone 3 Verification Plan

> **状态**：已批准，待执行
> **日期**：2026-07-15
> **关联**：[M3 设计文档](./2026-07-15-fire-app-milestone3-design.md) · [M3 实施计划](../plans/2026-07-15-fire-app-milestone3-implementation.md)
> **前置**：M3 五个 Task 已全部实施并提交（commit `ddf5b7c` → `eb364ea`），自动化验证全绿（106 测试 + 双 tsc + 构建通过）

---

## §1 验证范围与方法

### 1.1 背景

M3 自动化验证（单元测试 106/106 + 双 tsc 零错误 + 构建成功）已覆盖类型安全与 model 层逻辑，但以下两类风险是自动化测试盲区：

1. **运行时状态管理**：store 的 error/loading 状态在多操作序列下的残留与传递
2. **数据精度与 UX**：金额浮点表示、边界值、空状态展示

本验证计划以"按风险维度"组织，对 M3 全部 10 个产出文件进行静态代码审查 + 纯函数 TDD 单测补强，发现问题逐个修复。

### 1.2 验证范围（10 个文件）

| 层 | 文件 | 职责 |
|---|---|---|
| 数据层 | `packages/shared/src/models/account.ts` | updateAccount model |
| IPC handler | `apps/desktop/src/main/ipc/account-handlers.ts` | db:account:update handler |
| Preload | `apps/desktop/src/preload/index.ts` | account.update 暴露 |
| 类型声明 | `apps/desktop/src/renderer/src/types/ipc.d.ts` | DataAccessAPI.account.update |
| 数据端口 | `apps/desktop/src/renderer/src/data/data-access-port.ts` | updateAccount 接口 |
| IPC 实现 | `apps/desktop/src/renderer/src/data/ipc-data-access.ts` | updateAccount 实现 |
| Store | `apps/desktop/src/renderer/src/stores/account-store.ts` | updateAccount 方法 |
| UI 常量 | `apps/desktop/src/renderer/src/components/accounts/account-constants.ts` | formatBalance/computeOverview |
| UI 组件 | `AccountOverviewCards.tsx` / `AccountListTable.tsx` / `AccountFormModal.tsx` | 展示与交互 |
| 页面 | `apps/desktop/src/renderer/src/pages/AccountsPage.tsx` | 整合 |

### 1.3 验证方法

| 方法 | 适用 | 沙箱可行性 |
|---|---|---|
| 静态代码审查 | 全部文件 | ✓ |
| TDD 单测补强 | 纯函数（formatBalance/computeOverview/yuanToCents） | ✓ |
| 回归验证 | 每次修复后 | ✓（pnpm test + tsc + build） |
| Electron GUI 交互 | 渲染/点击/IPC 实调 | ✗（沙箱无法启动 GUI） |

### 1.4 修复流程

发现 → 定位根因 → 修复 → 回归验证 → 独立 commit（消息前缀 `fix(accounts):`）。每个修复点独立提交，保留完整修复历史。

### 1.5 不覆盖范围

Electron GUI 实际渲染、鼠标点击交互、IPC 跨进程实调。验证清单末尾附"本地手动验证清单"供用户在本地环境执行。

---

## §2 风险点 R1 — error/loading 状态机

### 2.1 预审结论

account-store 在每个操作开头都 `set({ loading: true, error: null })`，成功路径不设置 error，失败路径 catch 设置 error。此设计比我初判更稳健。

### 2.2 检查项

| # | 检查项 | 预期 | 验证方法 | 预判 |
|---|---|---|---|---|
| R1-1 | 操作成功后 error 是否为 null | 是（开头清空，成功不设置） | 审查 store 4 方法 try/catch | ✓ |
| R1-2 | AccountsPage `if (!getState().error)` 判定可靠性 | 可靠 | 追踪 handleSubmit/handleDelete 时序 | ✓ |
| R1-3 | loading 是否覆盖 CRUD 提交防重复 | 是 | 追踪 loading 传递链 | ✓ |
| R1-4 | error 残留导致重复 toast | 否（useEffect 依赖引用变化） | 审查 useEffect 依赖 | ✓ |
| R1-5 | 连续相同错误值时第二次 toast 丢失 | **可能丢失** | 边界分析 | 次要，低优先级 |
| R1-6 | currentUser null 时点提交无反馈 | **无反馈** | 审查 handleSubmit 首行 | 次要，依赖路由守卫 |
| R1-7 | fetchAccounts useEffect 重复请求 | 否（zustand 方法引用稳定） | 审查依赖数组 | ✓ |

### 2.3 预判

R1 无严重 bug。R1-5/R1-6 为次要 UX 问题，执行阶段决定是否修复。

---

## §3 风险点 R2 — 金额精度与格式化

### 3.1 预审结论

- `yuanToCents` 两阶段取整（先到毫再到分）规避 `1.005*100=100.4999...` 陷阱，正确。
- `formatBalance` 用 `Intl.NumberFormat` 自动四舍五入到 2 位，即使 `centsToYuan` 返回近似值也能正确显示，安全。
- 风险集中在 `AccountFormModal` 编辑回填 `String(centsToYuan(...))`。

### 3.2 检查项

| # | 检查项 | 预期 | 验证方法 | 预判 |
|---|---|---|---|---|
| R2-1 | formatBalance(0)/(-1)/(12345) | "¥0.00"/"-¥0.01"/"¥123.45" | TDD 单测 | ✓ |
| R2-2 | yuanToCents(1.005) | 101（非 100） | TDD 单测 | ✓ |
| R2-3 | yuanToCents(-100) | -10000 | TDD 单测 | ✓ |
| R2-4 | 编辑回填 String(centsToYuan(110)) | 显示 "1.1"（非 "1.10"） | 代码审查 + 单测复现 | **UX 瑕疵，修复** |
| R2-5 | 极大金额浮点失真 | >9e13 元才失真 | 边界分析 | 不修（FIRE 场景不会到） |
| R2-6 | create 输入 "0" | 允许（0 元账户合法） | 审查校验 | ✓ |
| R2-7 | create 输入负数 | 允许（liability 初始为负） | 审查校验 | ✓ |

### 3.3 修复计划

**R2-4 修复**：`AccountFormModal.tsx` 第 39 行 `setInitialBalance(String(centsToYuan(account.current_balance)))` 改为 `setInitialBalance(centsToYuan(account.current_balance).toFixed(2))`，保证编辑回填始终显示 2 位小数。

### 3.4 TDD 单测计划

在 `packages/shared/tests/utils/money.test.ts` 补充：
- `yuanToCents(1.005) === 101`
- `yuanToCents(-100) === -10000`
- `yuanToCents(0) === 0`

在 M3 新建的 `account-constants.ts` 纯函数测试（新建 `packages/shared/tests/utils/account-constants.test.ts` 或在 renderer 测试目录）：
- `formatBalance(0) === '¥0.00'`
- `formatBalance(-1) === '-¥0.01'`（具体符号依 Intl 实现）
- `formatBalance(12345) === '¥123.45'`
- `computeOverview([])` 返回全 0
- `computeOverview([...含负债])` net_worth 正确

> 注：account-constants.ts 位于 renderer 包，import `@shared/*`。测试文件需放在能解析此路径的位置。若 shared 包测试目录无法 import renderer 文件，则在 `apps/desktop` 下新建测试配置。执行阶段确认 vitest 配置。

---

## §4 风险点 R3 — 排序逻辑与边界

### 4.1 预审结论

`getAccounts` model 已 `ORDER BY display_order, name`，AccountListTable default case 直接用 store 顺序即可，第 39 行注释准确。

### 4.2 检查项

| # | 检查项 | 预期 | 验证方法 | 预判 |
|---|---|---|---|---|
| R3-1 | default 排序依赖 store 顺序 | 是（store 已 ORDER BY） | 审查 getAccounts SQL | ✓ |
| R3-2 | name-asc/desc 中文排序 | 正确（localeCompare） | 代码审查 | ✓ |
| R3-3 | balance-asc/desc 负数排序 | 正确（数值减法） | 代码审查 | ✓ |
| R3-4 | 空数组排序安全 | 安全 | 代码审查 | ✓ |
| R3-5 | useMemo 不修改原数组 | 否（浅拷贝） | 代码审查 | ✓ |
| R3-6 | computeOverview 空数组 | 全 0 | TDD 单测 | ✓ |
| R3-7 | computeOverview 含负数 | net_worth 正确减负债 | TDD 单测 | ✓ |
| R3-8 | updateAccount 空输入 | 返回原账户不报错 | 已有测试覆盖 | ✓ |
| R3-9 | softDeleteAccount 有交易抛错 | 抛错，toast 提示 | 链路审查 | ✓ |
| R3-10 | edit 模式不覆盖余额 | EditAccountInput 无 current_balance | 审查接口 | ✓ |

### 4.3 预判

R3 无 bug。补 2 个 computeOverview 单测作为运行时证据。

---

## §5 风险点 R4 — UX 细节与交互完整性

### 5.1 预审结论

核心 CRUD 交互链路完整。次要 UX 问题集中在空状态/loading 展示。

### 5.2 检查项

| # | 检查项 | 预期 | 验证方法 | 严重度 |
|---|---|---|---|---|
| R4-1 | 空状态 EmptyState 文案 | "暂无账户"+引导 | 代码审查 | OK |
| R4-2 | 空状态时概览卡显示全 0 | **是，可能困惑** | 代码审查 | 次要 UX |
| R4-3 | loading 时概览卡显示 0 而非 skeleton | **是** | 代码审查 | 次要 UX |
| R4-4 | 编辑 modal 余额 disabled 视觉 | 依赖 M2 Input disabled 样式 | 审查 M2 Input | 待验证 |
| R4-5 | 未登录时新增按钮可点 | **是**（依赖路由守卫） | 代码审查 | 次要 UX |
| R4-6 | 删除失败后 confirm 已关闭 | error toast 提示 | 代码审查 | OK |
| R4-7 | 编辑成功后 editingAccount 残留 | 不残留 | 代码审查 | OK |
| R4-8 | 排序状态页面级 | 切页重置，可接受 | 代码审查 | OK |
| R4-9 | PageHeader 与内容对齐 | 对齐 | 布局审查 | OK |
| R4-10 | 4 列概览卡窄屏挤压 | 桌面窗口够宽 | 设计权衡 | 可接受 |

### 5.3 修复计划

**R4-2/R4-3 改进**：`AccountsPage.tsx` 在 `accounts.length === 0 && !loading` 时隐藏 `AccountOverviewCards`（或显示空状态占位）。用户已同意此可选改进。

### 5.4 预判

R4 无功能 bug。R4-2/4-3 作为可选改进执行。

---

## §6 风险点 R5 — 类型安全与 IPC 链一致性

### 6.1 预审结论

以 `db:account:update` 为例追踪全链路，通道名、签名、命名均一致。双 tsc 通过是强证据。

### 6.2 检查项

| # | 检查项 | 实际 | 结论 |
|---|---|---|---|
| R5-1 | 通道名一致 | `db:account:update`（handler:13 / preload:25） | ✓ |
| R5-2 | model 签名 | `updateAccount(db, id, input: EditAccountInput): Account` | ✓ |
| R5-3 | handler 签名 | `(db, id, input) → updateAccount` | ✓ |
| R5-4 | preload 签名 | `account.update(id, input: unknown)` — preload 惯例 | ✓ |
| R5-5 | ipc.d.ts 签名 | `update(id, input: EditAccountInput): Promise<Account>` | ✓ |
| R5-6 | data-access-port 签名 | `updateAccount(id, input: EditAccountInput): Promise<Account>` | ✓ |
| R5-7 | store 签名 | `updateAccount(id, input, userId)` — userId 刷新列表 | ✓ |
| R5-8 | 命名差异适配 | account.update vs updateAccount，ipc-data-access 适配 | ✓ |
| R5-9 | EditAccountInput 导入一致 | 4 处导入均正确 | ✓ |
| R5-10 | 双 tsc 覆盖 | tsconfig.json 渲染+preload，tsconfig.node.json main | ✓ |

### 6.3 预判

R5 无 bug。类型安全由双 tsc 强保证。这是 M3 实施最稳的部分。

---

## §7 验证执行流程

### 7.1 执行顺序（按风险优先级）

1. **R2 金额精度**：补 TDD 单测 → 运行确认通过 → 修复 R2-4（toFixed(2)）→ 回归
2. **R3 排序边界**：补 computeOverview 单测 → 运行确认通过
3. **R1 状态机**：逐项静态审查 → 确认预判
4. **R4 UX**：修复 R4-2/4-3（空状态隐藏概览卡）→ 回归
5. **R5 类型安全**：确认双 tsc 已覆盖，无需额外动作
6. **回归总验证**：全量测试 + 双 tsc + 构建

### 7.2 修复提交规范

每个修复点独立 commit，消息格式：
- `fix(accounts): 编辑回填余额使用 toFixed(2) 保证 2 位小数显示`
- `fix(accounts): 空状态时隐藏概览卡片避免全 0 困惑`
- `test(accounts): 补充 formatBalance/computeOverview/yuanToCents 单元测试`

### 7.3 回归验证命令

```bash
cd "/workspace/FIRE APP"
pnpm --filter @fire-app/shared test
pnpm --filter @fire-app/desktop exec tsc --noEmit -p tsconfig.json
pnpm --filter @fire-app/desktop exec tsc --noEmit -p tsconfig.node.json
pnpm --filter @fire-app/desktop build
```

---

## §8 本地手动验证清单（沙箱无法覆盖）

以下需用户在本地环境启动应用后执行：

```bash
cd "/workspace/FIRE APP"
pnpm --filter @fire-app/desktop dev
```

| # | 场景 | 预期 |
|---|---|---|
| M-1 | 首次进入账户页（无账户） | 显示空状态 + EmptyState，概览卡隐藏（R4-2 修复后） |
| M-2 | 新增账户（create 模式） | 填写名称/分类/类型/余额/备注 → 提交 → 成功 toast → 列表出现新账户 → 概览卡更新 |
| M-3 | 新增账户余额输入 0 | 允许，创建 0 元账户 |
| M-4 | 新增负债账户（负数余额） | 允许，概览卡负债分类显示，净资产减少 |
| M-5 | 编辑账户（edit 模式） | 余额字段 disabled 且显示 2 位小数（R2-4 修复后），修改名称/分类 → 提交 → 成功 toast → 列表更新 |
| M-6 | 编辑后余额不变 | 余额保持原值（EditAccountInput 不含 current_balance） |
| M-7 | 删除无交易账户 | 确认框 → 确认 → 成功 toast → 列表移除 |
| M-8 | 删除有交易账户 | 确认框 → 确认 → 错误 toast"该账户下有关联交易" → 账户保留 |
| M-9 | 排序切换 | Select 切换 5 种排序，列表实时重排 |
| M-10 | 排序后删除最后一个账户 | 列表空 → EmptyState 显示 → 排序 Select 隐藏 |
| M-11 | 表单校验：名称为空 | 提交报错"请输入账户名称"，不关闭 modal |
| M-12 | 表单校验：余额非数字 | 提交报错"请输入有效金额"，不关闭 modal |
| M-13 | 取消按钮/关闭 modal | modal 关闭，表单状态清空（下次打开为初始值） |
| M-14 | 连续两次相同错误操作 | 第二次错误 toast 是否显示（R1-5 验证） |

---

## §9 验证产出预期

执行完成后产出：
1. 本文档更新：每个检查项标注实际结论（✓/✗/已修复）
2. 若干 `fix(accounts):` 和 `test(accounts):` commit
3. 最终回归验证全绿
4. 问题总结报告（问题原因 / 解决方案 / 经验归纳）

---

## §10 预判汇总

| 风险点 | 预判 | 待修复 | 补单测 |
|---|---|---|---|
| R1 状态机 | 无严重 bug | R1-5/R1-6 待定（低优先级） | 无 |
| R2 金额精度 | R2-4 UX 瑕疵 | **R2-4 确定** | **3+5 个** |
| R3 排序边界 | 无 bug | 无 | **2 个** |
| R4 UX | R4-2/4-3 可选改进 | **R4-2/4-3 确定** | 无 |
| R5 类型安全 | 无 bug | 无 | 无 |

**确定修复**：R2-4（toFixed）、R4-2/4-3（空状态隐藏概览卡）
**确定补测**：yuanToCents 3 个、formatBalance 3 个、computeOverview 2 个
