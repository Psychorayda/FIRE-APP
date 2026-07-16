# FIRE 计算APP 桌面 MVP — 里程碑 3：账户管理页设计

> **版本**: 1.0
> **日期**: 2026-07-15
> **状态**: 待审核
> **前置文档**:
> - [前端架构设计 v1.0](./2026-07-15-fire-app-frontend-architecture-design.md)
> - [UI/UX 设计 v1.0](./2026-07-15-fire-app-ui-ux-design.md)（第 3.1 节）
> - [里程碑 2 设计 v1.0](./2026-07-15-fire-app-milestone2-design.md)

---

## 1. 设计概述

### 1.1 目标

里程碑 2 已交付完整核心基础设施（36 个 IPC 通道 + 5 个 Zustand Store + 路由 + 14 个组件 + Onboarding 向导）。里程碑 3 在此基础上实现**账户管理页**，达成以下目标：

1. **完整 CRUD**：实现账户的新增、编辑、删除、查看，覆盖 UI/UX 设计 3.1 节全部交互。
2. **资产概览**：5 张概览卡片（流动资产、投资资产、使用资产、负债、净资产），前端从 accounts 数组实时计算。
3. **补齐编辑缺口**：新增 `db:account:update` IPC 通道（第 37 个），支持编辑账户名称、资产分类、账户类型、备注、排列顺序。
4. **复用 M2 组件**：Table、Card、Modal、Button、Input、Select、Tag、ConfirmDialog、PageHeader、EmptyState、Toast 全部复用，不新建基础组件。

### 1.2 范围边界

**包含**：
- 新增 `updateAccount` model 函数 + `EditAccountInput` 接口
- 新增 `db:account:update` IPC 通道（handler + preload + ipc.d.ts + DataAccessPort + IpcDataAccess）
- `account-store` 新增 `updateAccount` 方法
- `AccountsPage` 完整实现（替换 M2 占位页）
- 4 个新文件：`AccountOverviewCards`、`AccountListTable`、`AccountFormModal`、`account-constants.ts`
- 概览卡片前端聚合计算
- 表格排序（名称、余额、默认 display_order）
- 空状态处理
- Toast 成功/错误反馈

**不含**：
- DashboardPage 增强（保持 M2 占位）
- 账户余额手动调整（余额由交易自动维护，编辑模式余额只读）
- 批量操作
- 拖拽排序

---

## 2. 数据层变更

### 2.1 新增 Model 函数

**文件**: `packages/shared/src/models/account.ts`

新增 `EditAccountInput` 接口和 `updateAccount` 函数：

```typescript
export interface EditAccountInput {
  name?: string;
  asset_class?: AssetClass;
  account_type?: AccountType;
  note?: string | null;
  display_order?: number;
}

export function updateAccount(db: DatabaseType, id: string, input: EditAccountInput): Account {
  const current = getAccount(db, id);
  if (!current) { throw new Error(`Account not found: ${id}`); }

  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (input.name !== undefined) { fields.push('name = ?'); values.push(input.name); }
  if (input.asset_class !== undefined) { fields.push('asset_class = ?'); values.push(input.asset_class); }
  if (input.account_type !== undefined) { fields.push('account_type = ?'); values.push(input.account_type); }
  if (input.note !== undefined) { fields.push('note = ?'); values.push(input.note); }
  if (input.display_order !== undefined) { fields.push('display_order = ?'); values.push(input.display_order); }

  if (fields.length === 0) { return current; }

  fields.push('sync_version = ?'); values.push(current.sync_version + 1);
  fields.push('updated_at = ?'); values.push(nowMs());
  values.push(id);

  db.prepare(`UPDATE accounts SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  return getAccount(db, id)!;
}
```

**设计说明**：
- 余额（`current_balance`）不在 `EditAccountInput` 中——余额由交易创建/编辑/删除自动维护，用户不可直接编辑。
- 仅更新提供的字段（partial update），未提供的字段保持不变。
- 每次更新递增 `sync_version`，为后续同步层预留。

### 2.2 新增 IPC 通道

**通道名**: `db:account:update`
**参数**: `(id: string, input: EditAccountInput)`
**返回**: `Account`

**涉及文件变更**：

| 文件 | 变更 |
|------|------|
| `packages/shared/src/models/account.ts` | 新增 `EditAccountInput` + `updateAccount` |
| `packages/shared/src/index.ts` | barrel 自动导出（`export *` 已覆盖） |
| `apps/desktop/src/main/ipc/account-handlers.ts` | 新增 `db:account:update` handler |
| `apps/desktop/src/preload/index.ts` | account 组新增 `update(id, input)` 方法 |
| `apps/desktop/src/renderer/src/types/ipc.d.ts` | DataAccessAPI.account 新增 `update` 声明 |
| `apps/desktop/src/renderer/src/data/data-access-port.ts` | 新增 `updateAccount(id, input): Promise<Account>` |
| `apps/desktop/src/renderer/src/data/ipc-data-access.ts` | 新增 `updateAccount` 实现 |

### 2.3 Store 层变更

**文件**: `apps/desktop/src/renderer/src/stores/account-store.ts`

新增 `updateAccount` 方法：

```typescript
interface AccountStore {
  // ... 现有字段 ...
  updateAccount: (id: string, input: EditAccountInput, userId: string) => Promise<void>;
}

updateAccount: async (id, input, userId) => {
  set({ loading: true, error: null });
  try {
    await dataAccess.updateAccount(id, input);
    const accounts = await dataAccess.getAccounts(userId);
    set({ accounts, loading: false });
  } catch (err) {
    set({ error: (err as Error).message, loading: false });
  }
},
```

**模式**：与现有 `createAccount`、`softDeleteAccount` 一致——调用 dataAccess → 重新 `fetchAccounts` → 更新 state。

### 2.4 概览卡片计算

**不新增 IPC**。概览卡片数据从 `accounts` 数组前端计算：

```typescript
function computeOverview(accounts: Account[]) {
  const summary = { liquid: 0, invested: 0, use_asset: 0, liability: 0, net_worth: 0, counts: { liquid: 0, invested: 0, use_asset: 0, liability: 0 } };
  for (const acc of accounts) {
    summary[acc.asset_class] += acc.current_balance;
    summary.counts[acc.asset_class]++;
    summary.net_worth += acc.current_balance;
  }
  return summary;
}
```

**理由**：accounts 数组已由 `fetchAccounts` 加载，前端计算零延迟、无需额外 IPC 往返。`getInvestableBalance` 和 `getNetWorth` model 函数保留供其他场景使用（如 FIRE 计算）。

---

## 3. 组件设计

### 3.1 文件结构

```
apps/desktop/src/renderer/src/
├── pages/
│   └── AccountsPage.tsx              # 替换 M2 占位页
├── components/
│   └── accounts/                     # 新增目录
│       ├── AccountOverviewCards.tsx   # 5 张概览卡片
│       ├── AccountListTable.tsx       # 账户列表表格
│       ├── AccountFormModal.tsx       # 新增/编辑表单 Modal
│       └── account-constants.ts       # 常量映射 + 格式化函数
```

### 3.2 account-constants.ts

纯常量文件，无组件、无 Props。

**ASSET_CLASS_CONFIG**: `Record<AssetClass, { label: string; dotClass: string; tagClass: string }>`

| AssetClass | label | dotClass | tagClass |
|------------|-------|----------|----------|
| liquid | 流动资产 | bg-blue-500 | bg-blue-100 text-blue-700 |
| invested | 投资资产 | bg-purple-500 | bg-purple-100 text-purple-700 |
| use_asset | 使用资产 | bg-orange-500 | bg-orange-100 text-orange-700 |
| liability | 负债 | bg-red-500 | bg-red-100 text-red-700 |

**ACCOUNT_TYPE_LABELS**: `Record<AccountType, string>`

| AccountType | 中文名 |
|-------------|--------|
| checking | 活期存款 |
| savings | 储蓄账户 |
| cash | 现金 |
| investment | 投资账户 |
| retirement | 退休账户 |
| fund | 基金 |
| real_estate | 房产 |
| vehicle | 车辆 |
| credit_card | 信用卡 |
| loan | 贷款 |
| mortgage | 房贷 |

**formatBalance(cents: number): string**
- 分→元转换（`cents / 100`）
- ¥符号 + 千分位格式化（`Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' })`）
- 负数自然显示为 -¥

### 3.3 AccountOverviewCards

**职责**: 展示 5 张资产概览卡片（4 分类 + 净资产）。

**Props**:
```typescript
interface AccountOverviewCardsProps {
  accounts: Account[];
}
```

**行为**:
- 调用 `computeOverview(accounts)` 计算聚合数据
- 4 张分类卡（grid 4 列）：每张显示分类名、`formatBalance(sum)`、"{n} 个账户"
- 净资产卡（全宽）：显示 `formatBalance(net_worth)`
- 复用 M2 的 `<Card>` 组件
- accounts 为空时显示全 0

### 3.4 AccountListTable

**职责**: 展示账户列表表格，支持排序和行操作。

**Props**:
```typescript
interface AccountListTableProps {
  accounts: Account[];
  loading: boolean;
  onEdit: (account: Account) => void;
  onDelete: (account: Account) => void;
}
```

**列定义**:

| 列 | 数据源 | 渲染 |
|----|--------|------|
| 色标 | `asset_class` | 8px 圆形色点（`ASSET_CLASS_CONFIG[asset_class].dotClass`） |
| 账户名称 | `name` + `note` | 名称加粗 + 备注 caption 灰色小字 |
| 资产分类 | `asset_class` | `<Tag>` 带颜色（`ASSET_CLASS_CONFIG` 配色） |
| 账户类型 | `account_type` | `ACCOUNT_TYPE_LABELS[account_type]` 文本 |
| 当前余额 | `current_balance` | `formatBalance()`，负数额外加 `text-red-600` |
| 操作 | — | 编辑/删除 `<Button variant="ghost" size="sm">` |

**排序**:
- 默认按 `display_order` 升序（model 层 `getAccounts` 已按 `display_order, name` 排序）
- 点击"账户名称"表头 → 按名称字母序切换升/降
- 点击"当前余额"表头 → 按余额数值切换升/降
- 排序状态由组件内部 `useState` 管理

**空状态**: accounts 为空时渲染 `<EmptyState>` 提示"暂无账户，点击右上角新增"

**加载状态**: loading 为 true 时表格区域显示"加载中..."

**复用**: M2 的 `<Table>`、`<Tag>`、`<Button>`、`<EmptyState>` 组件

### 3.5 AccountFormModal

**职责**: 新增/编辑账户的表单弹窗。

**Props**:
```typescript
interface AccountFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  account?: Account;          // edit 模式必填
  onSubmit: (input: CreateAccountInput | EditAccountInput) => void;
  onClose: () => void;
}
```

**表单字段**:

| 字段 | 组件 | create 模式 | edit 模式 | 校验 |
|------|------|------------|-----------|------|
| 账户名称 | `<Input>` | 可填 | 预填充 | 必填，非空 |
| 资产分类 | `<Select>` | 可选，默认 liquid | 预填充 | 必选 |
| 账户类型 | `<Select>` | 可选，默认 checking | 预填充 | 必选 |
| 初始余额 | `<Input type="number">` | 可填，默认 0 | **只读**（显示但 disabled） | 有效数字 |
| 备注 | `<Input>` | 可填 | 预填充 | 可选 |

**行为**:
- `open` 为 false 时不渲染
- 打开时根据 mode 初始化表单值（create 清空，edit 预填充 account）
- 提交时校验 → `onSubmit(input)` → 父组件负责关闭
- 复用 M2 的 `<Modal>`、`<Input>`、`<Select>`、`<Button>` 组件

### 3.6 AccountsPage

**职责**: 页面容器，协调数据加载和子组件交互。

**数据源**:
- `useAccountStore`: accounts, loading, error, fetchAccounts, createAccount, updateAccount, softDeleteAccount
- `useAppStore`: currentUser (获取 userId)
- `useToastStore`: showSuccess, showError

**状态管理** (useState):
- `modalOpen: boolean` — 表单 Modal 开关
- `modalMode: 'create' | 'edit'` — 表单模式
- `editingAccount: Account | null` — 当前编辑的账户
- `confirmOpen: boolean` — 删除确认弹窗开关
- `deleteTarget: Account | null` — 待删除账户

**生命周期**:
- `useEffect(() => { if (currentUser) fetchAccounts(currentUser.id); }, [currentUser])`

**布局**:
```
<PageHeader title="账户管理" action={<Button onClick={openCreateModal}>+ 新增账户</Button>} />
<AccountOverviewCards accounts={accounts} />
<AccountListTable accounts={accounts} loading={loading} onEdit={openEditModal} onDelete={openConfirm} />
<AccountFormModal open={modalOpen} mode={modalMode} account={editingAccount} onSubmit={handleSubmit} onClose={closeModal} />
<ConfirmDialog open={confirmOpen} title="删除账户" message={`确定删除账户「${deleteTarget?.name}」吗？`} onConfirm={handleDelete} onCancel={closeConfirm} />
```

**错误监听**:
- `useEffect(() => { if (error) { showError(error); /* clear error */ } }, [error])`

---

## 4. 交互流程

### 4.1 新增账户

1. 点击 PageHeader 的"+ 新增账户"按钮 → `setModalMode('create')` + `setEditingAccount(null)` + `setModalOpen(true)`
2. AccountFormModal 打开（空表单）
3. 填写表单 → 点击"确定" → 校验通过 → `onSubmit(input)`
4. AccountsPage 调用 `createAccount(input, userId)`
5. 成功 → `setModalOpen(false)` + `showSuccess('账户创建成功')`
6. 失败 → `showError(err.message)`，Modal 保持打开

### 4.2 编辑账户

1. 点击表格行"编辑"按钮 → `setModalMode('edit')` + `setEditingAccount(account)` + `setModalOpen(true)`
2. AccountFormModal 打开（预填充 account 数据，余额只读）
3. 修改字段 → 点击"确定" → `onSubmit(input)`
4. AccountsPage 调用 `updateAccount(editingAccount.id, input, userId)`
5. 成功 → `setModalOpen(false)` + `showSuccess('账户更新成功')`
6. 失败 → `showError(err.message)`

### 4.3 删除账户

1. 点击表格行"删除"按钮 → `setDeleteTarget(account)` + `setConfirmOpen(true)`
2. ConfirmDialog 显示"确定删除账户「{name}」吗？"
3. 点击"确认" → `softDeleteAccount(deleteTarget.id, userId)`
4. 成功 → `setConfirmOpen(false)` + `showSuccess('账户已删除')`
5. 失败（有关联交易）→ model 层抛出"该账户下有关联交易，无法删除" → store 捕获 → `showError(err.message)`
6. 点击"取消" → `setConfirmOpen(false)`

### 4.4 加载与错误状态

| 状态 | 表现 |
|------|------|
| 初始加载 | 表格区域显示"加载中..."，按钮 disabled |
| 操作中 | loading=true，提交按钮 disabled，防止重复提交 |
| 操作成功 | Toast(success)，列表+卡片自动刷新 |
| 操作失败 | Toast(error)，显示 err.message，Modal 保持打开 |

---

## 5. 文件变更清单

### 5.1 新建文件（4 个）

| 类型 | 路径 | 职责 |
|------|------|------|
| 组件 | `components/accounts/account-constants.ts` | 资产分类配色/标签 + 账户类型中文名 + formatBalance |
| 组件 | `components/accounts/AccountOverviewCards.tsx` | 5 张概览卡片 |
| 组件 | `components/accounts/AccountListTable.tsx` | 账户列表表格 + 排序 |
| 组件 | `components/accounts/AccountFormModal.tsx` | 新增/编辑表单 Modal |

### 5.2 修改文件（8 个）

| 路径 | 变更内容 |
|------|---------|
| `packages/shared/src/models/account.ts` | 新增 `EditAccountInput` 接口 + `updateAccount` 函数 |
| `apps/desktop/src/main/ipc/account-handlers.ts` | 新增 `db:account:update` handler |
| `apps/desktop/src/preload/index.ts` | account 组新增 `update(id, input)` 方法 |
| `apps/desktop/src/renderer/src/types/ipc.d.ts` | DataAccessAPI.account 新增 `update` 声明 |
| `apps/desktop/src/renderer/src/data/data-access-port.ts` | 新增 `updateAccount` 方法声明 |
| `apps/desktop/src/renderer/src/data/ipc-data-access.ts` | 新增 `updateAccount` 实现 |
| `apps/desktop/src/renderer/src/stores/account-store.ts` | 新增 `updateAccount` 方法 + 导入 `EditAccountInput` |
| `apps/desktop/src/renderer/src/pages/AccountsPage.tsx` | 替换 M2 占位页为完整实现 |

### 5.3 不变文件

- `packages/shared/src/index.ts` — barrel `export *` 自动覆盖新增的 `EditAccountInput` 和 `updateAccount`
- M2 的 14 个基础组件 — 全部复用，不修改

---

## 6. 测试策略

### 6.1 Model 层测试

**文件**: `packages/shared/tests/models/account.test.ts`（已有，扩展）

新增测试用例：
- `updateAccount: 更新名称 → 返回更新后的 Account`
- `updateAccount: 更新多个字段 → 所有字段更新 + sync_version 递增`
- `updateAccount: 空输入 → 返回原 Account 不变`
- `updateAccount: 不存在的 ID → 抛出错误`

### 6.2 组件测试（手动验证）

里程碑 3 不引入组件单元测试框架（vitest 仅覆盖 shared 包）。验证方式：
1. `pnpm --filter @fire-app/shared test` — model 层测试全绿
2. `npx tsc --noEmit -p apps/desktop/tsconfig.json` — 类型检查零错误
3. `pnpm --filter @fire-app/desktop build` — 构建成功
4. 启动应用手动验证 CRUD 流程

---

## 7. 决策记录

| # | 决策 | 理由 |
|---|------|------|
| 1 | 新增 `db:account:update` IPC 通道（第 37 个） | M2 的 36 个通道无账户更新功能，UI/UX 设计要求编辑账户。删除重建会丢失交易关联，不可接受。 |
| 2 | 余额不在 EditAccountInput 中 | 余额由交易创建/编辑/删除自动维护（transaction-service 中的 balanceDelta 逻辑），用户直接编辑余额会导致与交易记录不一致。 |
| 3 | 概览卡片前端计算 | accounts 数组已加载，前端计算零延迟、无需 IPC 往返。model 层的 `getInvestableBalance`/`getNetWorth` 保留供 FIRE 计算等场景。 |
| 4 | 组件放在 `components/accounts/` 子目录 | 按功能域组织，与 M2 的 `base/`、`layout/`、`auxiliary/` 平级。后续里程碑的交易、快照等页面组件同样按域分目录。 |
| 5 | AccountFormModal 复用于新增和编辑 | 通过 `mode` prop 区分，避免两个表单组件。edit 模式余额只读是唯一差异。 |
| 6 | 表格排序由组件内部 useState 管理 | 排序是纯 UI 交互，不涉及数据层，无需 store 或 IPC。 |
| 7 | 不引入组件单元测试 | vitest 仅配置在 shared 包。引入 renderer 组件测试需要 jsdom + testing-library 配置，超出本里程碑范围。手动验证 + 类型检查作为质量门槛。 |

---

## 8. 风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| IPC 通道数从 36 → 37，与 M2 文档不一致 | 低 | M2 文档描述"为后续里程碑提供基础设施"，新增通道是预期内的扩展。在 M3 spec 中明确记录。 |
| 前端计算概览卡片在账户数量极大时性能问题 | 极低 | 个人财务应用账户数量通常 < 50，前端遍历无性能问题。 |
| 编辑账户时修改 asset_class 导致分类汇总变化 | 低 | 这是预期行为——用户修改分类后卡片和列表都会刷新。 |
| 删除有关联交易的账户时错误信息不够具体 | 低 | model 层 `softDeleteAccount` 的错误信息"该账户下有关联交易，无法删除"已足够清晰。 |
