# FIRE-APP M9 加固里程碑实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 对 FIRE-APP 桌面应用做四维度（安全/数据一致性/性能/UX）全面加固，修复全部 6 Critical + 33 High 级别问题（Electron 31→36 升级单列后续），使应用从「能跑」提升到「可信、稳健、安全」。

**Architecture:** 按共享文件依赖锁定 Sprint 顺序 S→D→P→U。Sprint S 先修复安全漏洞（import-service 列白名单 + 路径校验 + Electron 运行时加固 + IPC 输入校验 + 导出脱敏）；Sprint D 紧随修复数据一致性（clear 同步可见性 + recurring 原子幂等 + CSV 导入复用 createTransaction + schema CHECK 约束）；Sprint P 做性能优化（partial index + 服务端分页 + 虚拟化 + selector + 路由懒加载）；Sprint U 做 UX 体验（Error Boundary + try/catch + Enter 提交 + 响应式 + 货币动态化 + store 刷新 + label 关联）。

**Tech Stack:** Electron 31、React 19、Zustand 5、better-sqlite3 11、vitest 2、@testing-library/react 16、Tailwind CSS 4、electron-vite 2、pnpm 9 workspace monorepo。新增依赖：zod（IPC 校验）、@tanstack/react-virtual（表格虚拟化）。

**Spec:** [docs/superpowers/specs/2026-07-29-fire-app-milestone9-hardening-design.md](../specs/2026-07-29-fire-app-milestone9-hardening-design.md)

**约束：** 可破坏性变更（应用 0.1.0 dev 阶段，无真实用户数据，可直接改表结构/加索引/加约束，不必为旧 dev 库写迁移）。

---

## 文件结构总览

### 新建文件
| 文件 | 职责 |
|------|------|
| `packages/shared/src/services/column-whitelist.ts` | 导出每表的合法列名白名单（从 schema 派生），供 import-service 过滤 |
| `packages/shared/src/models/transaction-queries.ts` | 服务端分页/聚合查询（getTransactionsPage / getRecentTransactions / getMonthlyOverview） |
| `apps/desktop/src/main/ipc/path-guard.ts` | dialog 签发路径 + token 集合管理，文件读写前校验 |
| `apps/desktop/src/main/ipc/schemas.ts` | zod schema 定义，各 IPC handler 输入校验 |
| `apps/desktop/src/renderer/src/components/base/ErrorBoundary.tsx` | 全局 Error Boundary + 兜底页 |
| `apps/desktop/src/renderer/src/components/base/Skeleton.tsx` | 加载骨架行/卡片骨架（本计划仅 Error Boundary 必须，Skeleton 列 backlog） |
| `apps/desktop/tests/path-guard.test.ts` | 路径校验单元测试 |
| `apps/desktop/tests/error-boundary.test.tsx` | Error Boundary 测试 |
| `packages/shared/tests/services/column-whitelist.test.ts` | 列白名单测试 |
| `packages/shared/tests/models/transaction-queries.test.ts` | 分页/聚合查询测试 |

### 修改文件（按 Sprint 分组）
- **Sprint S:** `import-service.ts`、`export-service.ts`、`export-import-handlers.ts`、`register-handlers.ts`、`main/index.ts`、`renderer/index.html`、各 `*-handlers.ts`、`package.json`（+zod）
- **Sprint D:** `clear-service.ts`、`recurring-service.ts`、`import-service.ts`、`recurring.ts`、`db/schema.ts`
- **Sprint P:** `db/schema.ts`、`models/transaction.ts`、4 个 store、`Table.tsx`、各 pages、`TransactionListTable.tsx`、`RecentTransactions.tsx`、`router/index.tsx`、`electron.vite.config.ts`、`DashboardPage.tsx`、`package.json`（+@tanstack/react-virtual）
- **Sprint U:** `App.tsx`、`main.tsx`、`DataManagementPanel.tsx`、各 FormModal、`Sidebar.tsx`、`Table.tsx`、各 grid、format 函数们、`CsvImportWizard.tsx`、`ClearTransactionsDialog.tsx`、`FireCalculatorPage.tsx`、`Input.tsx`、`Select.tsx`

---

# Sprint S — 安全加固

## Task S1: 列白名单模块 + SQL 注入防护

**Files:**
- Create: `packages/shared/src/services/column-whitelist.ts`
- Create: `packages/shared/tests/services/column-whitelist.test.ts`
- Modify: `packages/shared/src/services/import-service.ts:64-98`

- [ ] **Step 1: 写列白名单失败测试**

Create `packages/shared/tests/services/column-whitelist.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getColumnWhitelist, isValidColumnName, filterRecordColumns } from '../../src/services/column-whitelist.js';

describe('column-whitelist', () => {
  it('返回 transactions 表的合法列名', () => {
    const cols = getColumnWhitelist('transactions');
    expect(cols).toContain('id');
    expect(cols).toContain('amount');
    expect(cols).toContain('transaction_date');
    expect(cols).toContain('deleted_flag');
  });

  it('isValidColumnName 拒绝注入串', () => {
    expect(isValidColumnName('amount')).toBe(true);
    expect(isValidColumnName('name) VALUES (\'x\');--')).toBe(false);
    expect(isValidColumnName('updated_at = 0, sync_version = 0 --')).toBe(false);
    expect(isValidColumnName('foo; DROP TABLE users')).toBe(false);
    expect(isValidColumnName('123abc')).toBe(false);
    expect(isValidColumnName('')).toBe(false);
  });

  it('filterRecordColumns 仅保留白名单列', () => {
    const record = { id: 'x', amount: 100, evil: 'DROP TABLE', 'name) VALUES(1)': 'bad' };
    const filtered = filterRecordColumns('transactions', record);
    expect(Object.keys(filtered)).toEqual(['id', 'amount']);
    expect(filtered.evil).toBeUndefined();
  });

  it('未知表名返回空集合', () => {
    expect(getColumnWhitelist('nonexistent_table' as any)).toEqual([]);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd packages/shared && pnpm exec vitest run tests/services/column-whitelist.test.ts`
Expected: FAIL — 模块不存在

- [ ] **Step 3: 实现列白名单模块**

Create `packages/shared/src/services/column-whitelist.ts`:

```typescript
import type { ExportTableName } from './export-service.js';

/**
 * 每张表的合法列名白名单（从 schema 派生，与 db/schema.ts 保持同步）
 * Legal column whitelist per table (derived from schema, kept in sync with db/schema.ts)
 */
const COLUMN_WHITELIST: Record<ExportTableName, readonly string[]> = {
  users: ['id', 'display_name', 'base_currency', 'is_china_market', 'default_withdrawal_rate', 'default_expected_return', 'default_inflation_rate', 'encryption_key_hash', 'last_sync_at', 'sync_version', 'updated_at', 'deleted_flag'],
  accounts: ['id', 'user_id', 'name', 'asset_class', 'account_type', 'current_balance', 'last_updated', 'display_order', 'note', 'sync_version', 'updated_at', 'deleted_flag'],
  categories: ['id', 'user_id', 'parent_id', 'name', 'type', 'icon', 'color', 'linked_fire_concept', 'display_order', 'is_system', 'sync_version', 'updated_at', 'deleted_flag'],
  transactions: ['id', 'user_id', 'account_id', 'to_account_id', 'category_id', 'recurring_id', 'transaction_type', 'amount', 'transaction_date', 'description', 'sync_version', 'updated_at', 'deleted_flag'],
  recurring_transactions: ['id', 'user_id', 'account_id', 'to_account_id', 'category_id', 'transaction_type', 'amount', 'frequency', 'interval', 'start_date', 'end_date', 'next_due_date', 'last_generated_date', 'description', 'is_active', 'auto_create', 'sync_version', 'updated_at', 'deleted_flag'],
  net_worth_snapshots: ['id', 'user_id', 'snapshot_date', 'snapshot_year_month', 'total_liquid', 'total_invested', 'total_use_asset', 'total_liability', 'net_worth', 'sync_version', 'updated_at', 'deleted_flag'],
  fire_scenarios: ['id', 'user_id', 'name', 'description', 'current_age', 'retirement_age', 'current_portfolio_value', 'auto_sync_assets', 'monthly_savings', 'annual_expenses', 'expected_return_rate', 'inflation_rate', 'withdrawal_rate', 'retirement_years', 'post_retirement_monthly_income', 'is_china_market', 'is_active', 'sync_version', 'updated_at', 'deleted_flag'],
};

const COLUMN_NAME_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export function getColumnWhitelist(tableName: ExportTableName): readonly string[] {
  return COLUMN_WHITELIST[tableName] ?? [];
}

export function isValidColumnName(column: string): boolean {
  return COLUMN_NAME_REGEX.test(column);
}

export function filterRecordColumns(tableName: ExportTableName, record: Record<string, unknown>): Record<string, unknown> {
  const allowed = new Set(getColumnWhitelist(tableName));
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (allowed.has(key) && isValidColumnName(key)) {
      filtered[key] = value;
    }
  }
  return filtered;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd packages/shared && pnpm exec vitest run tests/services/column-whitelist.test.ts`
Expected: PASS — 4 用例

- [ ] **Step 5: 修改 import-service 使用白名单 + 加固 envelope 校验**

Modify `packages/shared/src/services/import-service.ts`。在文件顶部 import 区添加:

```typescript
import { getColumnWhitelist, filterRecordColumns } from './column-whitelist.js';
```

替换 `validateEnvelope`（第 64-72 行）为:

```typescript
function validateEnvelope(envelope: ExportEnvelope): { success: boolean; errors: string[] } {
  const errors: string[] = [];
  if (envelope.header.format !== 'fire-app-export') errors.push('文件不是 FIRE APP 导出文件（format 字段不匹配）');
  if (envelope.header.version !== '1.0') errors.push(`导出文件版本 ${envelope.header.version} 不被支持，当前支持版本 1.0`);
  if (envelope.header.crypto !== null) errors.push('加密文件暂不支持导入');
  const tableCount = Object.keys(envelope.data).length;
  if (tableCount !== EXPORT_TABLE_NAMES.length) errors.push(`数据表数量不匹配：期望 ${EXPORT_TABLE_NAMES.length}，实际 ${tableCount}`);
  // 校验 data 键名严格等于 7 张表名集合
  const dataKeys = Object.keys(envelope.data).sort();
  const expectedKeys = [...EXPORT_TABLE_NAMES].sort();
  if (JSON.stringify(dataKeys) !== JSON.stringify(expectedKeys)) {
    errors.push(`数据表名不匹配：期望 ${expectedKeys.join(',')}，实际 ${dataKeys.join(',')}`);
  }
  // 校验每条记录字段名在白名单内
  for (const tableName of EXPORT_TABLE_NAMES) {
    const records = (envelope.data as unknown as Record<string, Record<string, unknown>[]>)[tableName] ?? [];
    const allowed = new Set(getColumnWhitelist(tableName));
    for (let i = 0; i < records.length; i++) {
      const invalidCols = Object.keys(records[i]).filter(k => !allowed.has(k));
      if (invalidCols.length > 0) {
        errors.push(`表 ${tableName} 第 ${i + 1} 条记录含非法字段: ${invalidCols.join(', ')}`);
      }
    }
  }
  return { success: errors.length === 0, errors };
}
```

替换 `insertRecord`（第 88-92 行）和 `updateRecord`（第 94-98 行）为:

```typescript
function insertRecord(db: DatabaseType, tableName: ExportTableName, record: Record<string, unknown>): void {
  const safe = filterRecordColumns(tableName, record);
  const columns = Object.keys(safe);
  if (columns.length === 0) throw new Error(`表 ${tableName} 记录无合法字段`);
  const placeholders = columns.map(() => '?').join(',');
  db.prepare(`INSERT INTO ${tableName} (${columns.join(',')}) VALUES (${placeholders})`).run(...columns.map(c => safe[c]));
}

function updateRecord(db: DatabaseType, tableName: ExportTableName, record: Record<string, unknown>): void {
  const safe = filterRecordColumns(tableName, record);
  const columns = Object.keys(safe).filter(c => c !== 'id');
  if (columns.length === 0) throw new Error(`表 ${tableName} 记录无可更新字段`);
  const setClause = columns.map(c => `${c} = ?`).join(',');
  db.prepare(`UPDATE ${tableName} SET ${setClause} WHERE id = ?`).run(...columns.map(c => safe[c]), safe.id);
}
```

- [ ] **Step 6: 在 import-service.test.ts 添加注入对抗测试**

在 `packages/shared/tests/services/import-service.test.ts` 末尾 `describe` 块内添加:

```typescript
  it('importJsonWithLww: 恶意 envelope 含注入列名被拒绝', () => {
    const envelope = buildExportEnvelope(db, userId, '0.8.0');
    // 注入恶意列名到 users 记录
    (envelope.data.users[0] as any)['name) VALUES (\'x\');--'] = 'evil';
    const result = importJsonWithLww(db, envelope);
    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.includes('非法字段'))).toBe(true);
  });

  it('importJsonWithLww: data 键名缺失某张表被拒绝', () => {
    const envelope = buildExportEnvelope(db, userId, '0.8.0');
    delete (envelope.data as any).fire_scenarios;
    const result = importJsonWithLww(db, envelope);
    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.includes('数据表名不匹配'))).toBe(true);
  });
```

- [ ] **Step 7: 运行全量 shared 测试确认无回归**

Run: `cd packages/shared && pnpm test`
Expected: PASS — 所有原有测试 + 新增 6 列白名单 + 2 注入对抗测试

- [ ] **Step 8: 提交**

```bash
cd /workspace
git add packages/shared/src/services/column-whitelist.ts packages/shared/tests/services/column-whitelist.test.ts packages/shared/src/services/import-service.ts packages/shared/tests/services/import-service.test.ts
git commit -m "fix(security): prevent SQL column injection via column whitelist + envelope validation

- Add column-whitelist module derived from schema (per-table legal columns)
- insertRecord/updateRecord filter columns through whitelist + regex validation
- validateEnvelope now checks data keys match 7 table names + record fields in whitelist
- Add adversarial tests: malicious column names rejected, missing table rejected"
```

---

## Task S2: 路径校验守卫（dialog 签发 token 机制）

**Files:**
- Create: `apps/desktop/src/main/ipc/path-guard.ts`
- Create: `apps/desktop/tests/path-guard.test.ts`
- Modify: `apps/desktop/src/main/ipc/export-import-handlers.ts:29-100,103-118`

- [ ] **Step 1: 写路径守卫失败测试**

Create `apps/desktop/tests/path-guard.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { issuePathToken, consumePathToken, isPathSafe } from '../src/main/ipc/path-guard.js';

describe('path-guard', () => {
  beforeEach(() => {
    // 清空已签发集合（模块内 Map）
    consumePathToken('/tmp/test.json'); // 尝试消费不存在的，无副作用
  });

  it('dialog 签发路径后可消费一次', () => {
    issuePathToken('/tmp/legit.json');
    expect(consumePathToken('/tmp/legit.json')).toBe(true);
    // 二次消费失败（一次性）
    expect(consumePathToken('/tmp/legit.json')).toBe(false);
  });

  it('未签发路径被拒绝', () => {
    expect(consumePathToken('/etc/shadow')).toBe(false);
    expect(consumePathToken('C:\\Windows\\evil.txt')).toBe(false);
  });

  it('isPathSafe 拒绝含 .. 的穿越路径', () => {
    expect(isPathSafe('/tmp/../etc/passwd')).toBe(false);
    expect(isPathSafe('/tmp/..\\evil')).toBe(false);
    expect(isPathSafe('/tmp/legit/file.json')).toBe(true);
  });

  it('isPathSafe 拒绝非绝对路径', () => {
    expect(isPathSafe('relative/path.json')).toBe(false);
    expect(isPathSafe('/abs/path.json')).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd apps/desktop && pnpm exec vitest run tests/path-guard.test.ts`
Expected: FAIL — 模块不存在

- [ ] **Step 3: 实现路径守卫**

Create `apps/desktop/src/main/ipc/path-guard.ts`:

```typescript
import path from 'node:path';

/**
 * 已签发路径集合：dialog:save/open 返回路径时记录，文件读写前校验并消费
 * Issued-path set: recorded when dialog:save/open returns, validated+consumed before file I/O
 * 一次性 token：消费后即焚，防止渲染端复用旧路径绕过
 * One-time token: burned after consumption, prevents renderer reusing stale paths
 */
const issuedPaths = new Set<string>();

/**
 * 签发路径 token（dialog 返回合法路径时调用）
 * Issue a path token (called when dialog returns a legitimate path)
 */
export function issuePathToken(filePath: string): void {
  const resolved = path.resolve(filePath);
  issuedPaths.add(resolved);
}

/**
 * 消费路径 token（文件读写前调用，一次性）
 * Consume path token (called before file I/O, one-time)
 * @returns true 若路径已签发且未被消费
 */
export function consumePathToken(filePath: string): boolean {
  const resolved = path.resolve(filePath);
  if (issuedPaths.has(resolved)) {
    issuedPaths.delete(resolved);
    return true;
  }
  return false;
}

/**
 * 校验路径本身是否安全（绝对路径 + 无 .. 穿越）
 * Validate path is inherently safe (absolute + no .. traversal)
 */
export function isPathSafe(filePath: string): boolean {
  if (!path.isAbsolute(filePath)) return false;
  const resolved = path.resolve(filePath);
  // 检测 .. 穿越：resolve 后若包含 .. 段（已被 normalize 则检查原始是否含 ..）
  if (filePath.includes('..')) return false;
  // resolved 应与 normalize 一致
  return resolved === path.normalize(filePath);
}

/**
 * 文件操作前置校验：必须经过 dialog 签发且路径安全
 * Pre-check for file operations: must be dialog-issued and path-safe
 * @throws 若路径未经 dialog 签发或含穿越
 */
export function assertFileOperationAllowed(filePath: string, operation: 'read' | 'write'): void {
  if (!isPathSafe(filePath)) {
    throw new Error(`路径不安全，拒绝${operation === 'read' ? '读取' : '写入'}: ${filePath}`);
  }
  if (!consumePathToken(filePath)) {
    throw new Error(`路径未经文件对话框选择，拒绝${operation === 'read' ? '读取' : '写入'}`);
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd apps/desktop && pnpm exec vitest run tests/path-guard.test.ts`
Expected: PASS — 4 用例

- [ ] **Step 5: 修改 export-import-handlers 接入路径守卫**

Modify `apps/desktop/src/main/ipc/export-import-handlers.ts`。在 import 区添加:

```typescript
import { issuePathToken, assertFileOperationAllowed } from './path-guard.js';
```

替换 `dialog:save` handler（第 103-109 行）为:

```typescript
  ipcMain.handle('dialog:save', async (_event, params: { defaultName: string; extension: 'json' | 'csv' }) => {
    const result = await dialog.showSaveDialog({
      defaultPath: path.join(app.getPath('desktop'), params.defaultName),
      filters: [{ name: params.extension.toUpperCase() + ' 文件', extensions: [params.extension] }],
    });
    if (!result.canceled && result.filePath) {
      issuePathToken(result.filePath);
    }
    return { canceled: result.canceled, filePath: result.filePath ?? null };
  });
```

替换 `dialog:open` handler（第 112-118 行）为:

```typescript
  ipcMain.handle('dialog:open', async (_event, params: { extensions: string[] }) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: '文件', extensions: params.extensions }],
    });
    if (!result.canceled && result.filePaths[0]) {
      issuePathToken(result.filePaths[0]);
    }
    return { canceled: result.canceled, filePath: result.filePaths[0] ?? null };
  });
```

在各文件操作 handler 内加校验。`export:json`（第 29-36 行）改为:

```typescript
  registerHandler('export:json', (_db, filePath: string) => {
    assertFileOperationAllowed(filePath, 'write');
    const userId = getLocalUserId(_db);
    if (!userId) throw new Error('无用户数据');
    const envelope = buildExportEnvelope(_db, userId, app.getVersion());
    const json = serializeExportEnvelope(envelope);
    fs.writeFileSync(filePath, json, 'utf-8');
    return { success: true, recordCount: envelope.header.record_count };
  }, db);
```

`export:csv`（第 39-46 行）在首行加 `assertFileOperationAllowed(filePath, 'write');`。

`import:json`（第 49-53 行）改为:

```typescript
  registerHandler('import:json', (_db, filePath: string) => {
    assertFileOperationAllowed(filePath, 'read');
    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch {
      throw new Error('文件读取失败，请确认文件存在且可访问');
    }
    let envelope;
    try {
      envelope = JSON.parse(content);
    } catch {
      throw new Error('文件不是有效的 JSON 格式');
    }
    return importJsonWithLww(_db, envelope);
  }, db);
```

`import:parseCsv`（第 56-62 行）、`import:csvTransactions`（第 65-80 行，对 params.filePath）、`import:detectTemplate`（第 95-100 行）均在首行加 `assertFileOperationAllowed(filePath, 'read');`（csvTransactions 用 `params.filePath`）。

- [ ] **Step 6: 运行 desktop 测试确认无回归**

Run: `cd apps/desktop && pnpm test`
Expected: PASS — 所有测试通过（path-guard mock 的 dialog 测试可能需调整：现有测试直接传路径，现在会被守卫拒绝）

- [ ] **Step 7: 修复受影响的现有测试**

检查 `csv-import-wizard.test.tsx`、`data-management-panel.test.tsx` 等含 `showSaveDialog`/`showOpenDialog` mock 的测试。这些测试的 mock 现在需要同时 issuePathToken。在 mock 实现内调用 `issuePathToken`：

在 `apps/desktop/vitest.setup.ts` 中找到 `showSaveDialog`/`showOpenDialog` 的 mock（`fn()`），改为:

```typescript
showSaveDialog: vi.fn().mockImplementation(async (defaultName: string) => {
  const { issuePathToken } = await import('./src/main/ipc/path-guard.js');
  const filePath = `/tmp/${defaultName}`;
  issuePathToken(filePath);
  return { canceled: false, filePath };
}),
showOpenDialog: vi.fn().mockImplementation(async (extensions: string[]) => {
  const { issuePathToken } = await import('./src/main/ipc/path-guard.js');
  const filePath = '/tmp/test-import.csv';
  issuePathToken(filePath);
  return { canceled: false, filePath };
}),
```

> 注：vitest.setup.ts 是 renderer 环境的 mock，但 path-guard 是 main 进程模块。测试中 window.dataAccess 的 exportImport 方法被整体 mock，实际不会走到 path-guard。若现有测试直接断言 `exportJson` 被调用且不校验路径，则无需改 mock。仅在测试真实调用主进程路径守卫时才需调整。先跑测试看实际影响。

- [ ] **Step 8: 提交**

```bash
cd /workspace
git add apps/desktop/src/main/ipc/path-guard.ts apps/desktop/tests/path-guard.test.ts apps/desktop/src/main/ipc/export-import-handlers.ts apps/desktop/vitest.setup.ts
git commit -m "fix(security): enforce dialog-issued path token for file read/write

- Add path-guard module: one-time token issued by dialog:save/open, consumed on file I/O
- isPathSafe rejects non-absolute paths and .. traversal
- All export/import file operations now assertFileOperationAllowed before fs calls
- import:json wraps JSON.parse with business-friendly error message
- Update vitest.setup mocks to issue tokens for dialog calls"
```

---

## Task S3: Electron 运行时加固（sandbox + CSP + dev URL 守卫 + 窗口拦截）

**Files:**
- Modify: `apps/desktop/src/main/index.ts:42-67`
- Modify: `apps/desktop/src/renderer/index.html`

- [ ] **Step 1: 写主进程安全配置测试**

Create `apps/desktop/tests/main-security.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Electron 安全配置', () => {
  it('main/index.ts 启用 sandbox', () => {
    const content = fs.readFileSync(path.resolve(__dirname, '../src/main/index.ts'), 'utf-8');
    expect(content).toMatch(/sandbox:\s*true/);
  });

  it('main/index.ts dev URL 加 app.isPackaged 守卫', () => {
    const content = fs.readFileSync(path.resolve(__dirname, '../src/main/index.ts'), 'utf-8');
    expect(content).toMatch(/app\.isPackaged/);
    expect(content).toMatch(/ELECTRON_RENDERER_URL/);
  });

  it('main/index.ts 设置 setWindowOpenHandler', () => {
    const content = fs.readFileSync(path.resolve(__dirname, '../src/main/index.ts'), 'utf-8');
    expect(content).toMatch(/setWindowOpenHandler/);
  });

  it('index.html 含 CSP meta 标签', () => {
    const content = fs.readFileSync(path.resolve(__dirname, '../src/renderer/index.html'), 'utf-8');
    expect(content).toMatch(/http-equiv="Content-Security-Policy"/);
    expect(content).toMatch(/default-src 'self'/);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd apps/desktop && pnpm exec vitest run tests/main-security.test.ts`
Expected: FAIL — sandbox: false、无 app.isPackaged、无 setWindowOpenHandler、无 CSP

- [ ] **Step 3: 修改 main/index.ts**

Modify `apps/desktop/src/main/index.ts`。更新 import:

```typescript
import { app, BrowserWindow, shell, session } from 'electron';
```

`createWindow` 函数（第 42-67 行）替换为:

```typescript
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });

  // 拦截 window.open，转系统浏览器打开外链
  // Intercept window.open, delegate external links to system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // 阻止渲染端导航到外部协议（非 dev 模式）
  // Prevent renderer navigation to external protocols (non-dev mode)
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!app.isPackaged && url.startsWith(process.env['ELECTRON_RENDERER_URL'] ?? '__invalid__')) {
      return; // dev 模式下允许 vite HMR 导航
    }
    event.preventDefault();
  });

  // 开发模式加载 dev server，生产模式加载打包文件
  // Dev mode loads dev server, production loads packaged file
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}
```

在 `app.whenReady().then(() => {` 块内 `fixUserDataPath()` 之后、`createWindow()` 之前插入 CSP 注入:

```typescript
  // 注入 CSP 响应头（生产模式）
  // Inject CSP response headers (production mode)
  if (app.isPackaged) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': ["default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'"],
        },
      });
    });
  }
```

- [ ] **Step 4: 修改 index.html 加 CSP meta（dev 模式兜底）**

Read `apps/desktop/src/renderer/index.html`，在 `<head>` 内 `<meta charset>` 后添加:

```html
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws://localhost:* http://localhost:*">
```

> 注：dev 模式需放行 `unsafe-inline`（vite 内联脚本）和 `ws://localhost:*`（HMR）。生产模式由 onHeadersReceived 覆盖更严格的策略。

- [ ] **Step 5: 运行测试确认通过**

Run: `cd apps/desktop && pnpm exec vitest run tests/main-security.test.ts`
Expected: PASS — 4 用例

- [ ] **Step 6: 运行全量 desktop 测试确认无回归**

Run: `cd apps/desktop && pnpm test`
Expected: PASS

- [ ] **Step 7: 提交**

```bash
cd /workspace
git add apps/desktop/src/main/index.ts apps/desktop/src/renderer/index.html apps/desktop/tests/main-security.test.ts
git commit -m "fix(security): enable sandbox, CSP, dev URL guard, window.open interception

- webPreferences.sandbox: true (preload runs in sandbox)
- app.isPackaged guards dev URL loading (prevent remote injection in prod)
- setWindowOpenHandler denies new windows, delegates http(s) to shell.openExternal
- will-navigate prevents external protocol navigation in production
- CSP injected via onHeadersReceived (prod) + meta tag (dev, allows vite HMR)"
```

---

## Task S4: IPC 错误信息脱敏 + 输入校验（zod）

**Files:**
- Modify: `apps/desktop/src/main/ipc/register-handlers.ts:24-40`
- Create: `apps/desktop/src/main/ipc/schemas.ts`
- Modify: `apps/desktop/src/main/ipc/scenario-handlers.ts`（示范，其余 handlers 同模式）
- Modify: `apps/desktop/package.json`（+zod）

- [ ] **Step 1: 安装 zod**

Run:
```bash
cd /workspace/apps/desktop && pnpm add zod@^3.23.0 --filter @fire-app/desktop
```
（用 --ignore-scripts 若 electron postinstall 报错）

- [ ] **Step 2: 写 schemas 失败测试**

Create `apps/desktop/tests/ipc-schemas.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createTransactionSchema, updateScenarioSchema, createAccountSchema } from '../src/main/ipc/schemas.js';

describe('IPC input schemas', () => {
  it('createTransactionSchema 接受合法输入', () => {
    const valid = { user_id: 'u1', account_id: 'a1', transaction_type: 'expense', amount: 1000, transaction_date: 1700000000000 };
    expect(createTransactionSchema.safeParse(valid).success).toBe(true);
  });

  it('createTransactionSchema 拒绝 NaN/Infinity amount', () => {
    const invalid = { user_id: 'u1', account_id: 'a1', transaction_type: 'expense', amount: NaN, transaction_date: 1700000000000 };
    expect(createTransactionSchema.safeParse(invalid).success).toBe(false);
  });

  it('createTransactionSchema 拒绝负数 amount', () => {
    const invalid = { user_id: 'u1', account_id: 'a1', transaction_type: 'expense', amount: -100, transaction_date: 1700000000000 };
    expect(createTransactionSchema.safeParse(invalid).success).toBe(false);
  });

  it('updateScenarioSchema 剔除 user_id/sync_version 字段', () => {
    const parsed = updateScenarioSchema.safeParse({ user_id: 'evil', sync_version: 999, name: '新名' });
    expect(parsed.success).toBe(true);
    expect(parsed.data!.user_id).toBeUndefined();
    expect(parsed.data!.sync_version).toBeUndefined();
    expect(parsed.data!.name).toBe('新名');
  });

  it('createAccountSchema 校验 asset_class 枚举', () => {
    expect(createAccountSchema.safeParse({ user_id: 'u1', name: '招行', asset_class: 'liquid', account_type: 'checking' }).success).toBe(true);
    expect(createAccountSchema.safeParse({ user_id: 'u1', name: '招行', asset_class: 'evil', account_type: 'checking' }).success).toBe(false);
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `cd apps/desktop && pnpm exec vitest run tests/ipc-schemas.test.ts`
Expected: FAIL — 模块不存在

- [ ] **Step 4: 实现 schemas**

Create `apps/desktop/src/main/ipc/schemas.ts`:

```typescript
import { z } from 'zod';

export const createTransactionSchema = z.object({
  user_id: z.string().min(1),
  account_id: z.string().min(1),
  to_account_id: z.string().nullable().optional(),
  category_id: z.string().nullable().optional(),
  recurring_id: z.string().nullable().optional(),
  transaction_type: z.enum(['income', 'expense', 'transfer', 'initial_balance']),
  amount: z.number().finite().positive(),
  transaction_date: z.number().finite(),
  description: z.string().nullable().optional(),
});

export const createAccountSchema = z.object({
  user_id: z.string().min(1),
  name: z.string().min(1).max(255),
  asset_class: z.enum(['liquid', 'invested', 'use_asset', 'liability']),
  account_type: z.enum(['checking', 'savings', 'cash', 'investment', 'retirement', 'fund', 'real_estate', 'vehicle', 'credit_card', 'loan', 'mortgage']),
  initial_balance: z.number().finite().optional(),
  note: z.string().max(1024).nullable().optional(),
});

export const updateScenarioSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1024).nullable().optional(),
  current_age: z.number().int().nonnegative().optional(),
  retirement_age: z.number().int().positive().optional(),
  current_portfolio_value: z.number().int().nonnegative().optional(),
  auto_sync_assets: z.number().int().min(0).max(1).optional(),
  monthly_savings: z.number().int().nonnegative().optional(),
  annual_expenses: z.number().int().positive().optional(),
  expected_return_rate: z.number().int().min(-1000).max(5000).optional(),
  inflation_rate: z.number().int().min(-1000).max(5000).optional(),
  withdrawal_rate: z.number().int().min(200).max(600).optional(),
  retirement_years: z.number().int().positive().optional(),
  post_retirement_monthly_income: z.number().int().nonnegative().optional(),
  is_china_market: z.number().int().min(0).max(1).optional(),
  is_active: z.number().int().min(0).max(1).optional(),
}).strict().omit({ user_id: true, sync_version: true, updated_at: true, deleted_flag: true, id: true });
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd apps/desktop && pnpm exec vitest run tests/ipc-schemas.test.ts`
Expected: PASS — 5 用例

- [ ] **Step 6: 修改 register-handlers 错误脱敏**

Replace `apps/desktop/src/main/ipc/register-handlers.ts` 全文:

```typescript
// IPC handler 注册器：统一错误处理包装（脱敏版）
// IPC handler registrar: unified error handling (sanitized)

import { ipcMain } from 'electron';
import type { Database as DatabaseType } from 'better-sqlite3';

export interface IpcError {
  code: string;
  message: string;
  entity?: string;
}

/**
 * 将底层错误映射为业务化文案，避免泄露 SQL/表结构/堆栈
 * Map underlying errors to business-friendly messages, avoid leaking SQL/schema/stack
 */
function sanitizeError(error: unknown): IpcError {
  const raw = error instanceof Error ? error.message : String(error);
  // SQLite 约束错误 → 通用文案
  if (raw.includes('SQLITE_CONSTRAINT: CHECK')) {
    return { code: 'VALIDATION_ERROR', message: '数据校验失败，请检查输入值' };
  }
  if (raw.includes('SQLITE_CONSTRAINT: UNIQUE')) {
    return { code: 'DUPLICATE_ERROR', message: '数据已存在，请勿重复添加' };
  }
  if (raw.includes('SQLITE_CONSTRAINT')) {
    return { code: 'VALIDATION_ERROR', message: '数据约束冲突，请检查输入' };
  }
  // not found
  if (raw.includes('not found') || raw.includes('不存在')) {
    return { code: 'NOT_FOUND', message: '记录不存在或已被删除' };
  }
  // zod 校验错误
  if (raw.includes('validation') || error instanceof Error && 'issues' in error) {
    return { code: 'VALIDATION_ERROR', message: '输入参数校验失败' };
  }
  // 路径守卫错误
  if (raw.includes('路径不安全') || raw.includes('路径未经')) {
    return { code: 'PATH_FORBIDDEN', message: raw }; // 路径错误对用户有意义，保留
  }
  // 兜底：不暴露原始 SQL/堆栈
  // Fallback: do not expose raw SQL/stack
  console.error('[IPC] unhandled error:', raw); // 主进程日志
  return { code: 'DB_ERROR', message: '操作失败，请稍后重试' };
}

export function registerHandler<TArgs extends unknown[], TResult>(
  channel: string,
  handler: (db: DatabaseType, ...args: TArgs) => TResult,
  db: DatabaseType,
): void {
  ipcMain.handle(channel, async (_event, ...args: TArgs): Promise<TResult> => {
    try {
      return handler(db, ...args);
    } catch (error) {
      throw sanitizeError(error);
    }
  });
}
```

- [ ] **Step 7: 在 scenario-handlers 接入 zod（示范，其余 handler 按需）**

Read `apps/desktop/src/main/ipc/scenario-handlers.ts`，在 `updateScenario` handler 入口加校验:

```typescript
import { updateScenarioSchema } from './schemas.js';
// ...
  registerHandler('db:scenario:update', (_db, id: string, updates: Partial<FireScenario>) => {
    const safe = updateScenarioSchema.parse(updates);
    return updateScenario(_db, id, safe);
  }, db);
```

> 注：其余 handlers（account/transaction/user/recurring）按同模式接入对应 schema。本计划只示范 scenario（最关键：防 user_id/sync_version 篡改）。其余作为该 task 的一部分逐一接入，但代码重复，可在 review 时决定是否抽取通用 wrapper。

- [ ] **Step 8: 运行全量 desktop 测试**

Run: `cd apps/desktop && pnpm test`
Expected: PASS

- [ ] **Step 9: 提交**

```bash
cd /workspace
git add apps/desktop/package.json apps/desktop/src/main/ipc/schemas.ts apps/desktop/src/main/ipc/register-handlers.ts apps/desktop/src/main/ipc/scenario-handlers.ts apps/desktop/tests/ipc-schemas.test.ts
git commit -m "fix(security): sanitize IPC errors + zod input validation

- register-handlers: map SQLite constraint / not-found / path errors to business messages,
  never leak raw SQL/stack to renderer (full error logged in main process)
- Add zod schemas: createTransaction (finite positive amount), createAccount (enum),
  updateScenario (strips user_id/sync_version via .omit)
- scenario-handlers: validate update input through schema (prevents field tampering)"
```

---

## Task S5: 导出脱敏（剔除 encryption_key_hash）

**Files:**
- Modify: `packages/shared/src/services/export-service.ts:28-44`
- Modify: `packages/shared/tests/services/export-service.test.ts`

- [ ] **Step 1: 写脱敏失败测试**

在 `packages/shared/tests/services/export-service.test.ts` 末尾添加:

```typescript
  it('buildExportEnvelope: 不导出 encryption_key_hash', () => {
    // 直接设置 encryption_key_hash
    db.prepare('UPDATE users SET encryption_key_hash = ? WHERE id = ?').run('secret-hash-value', userId);
    const envelope = buildExportEnvelope(db, userId, '0.8.0');
    expect(envelope.data.users[0].encryption_key_hash).toBeNull();
  });
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd packages/shared && pnpm exec vitest run tests/services/export-service.test.ts`
Expected: FAIL — encryption_key_hash 仍为 'secret-hash-value'

- [ ] **Step 3: 修改 buildExportEnvelope 显式列名并剔除敏感字段**

Modify `packages/shared/src/services/export-service.ts`，`buildExportEnvelope` 函数内第 29 行替换:

```typescript
export function buildExportEnvelope(db: DatabaseType, userId: string, appVersion: string): ExportEnvelope {
  // 显式列名查询 users，剔除 encryption_key_hash（避免离线密码爆破）
  // Explicit column list for users, exclude encryption_key_hash (prevent offline password brute-force)
  const users = db.prepare(`SELECT id, display_name, base_currency, is_china_market, default_withdrawal_rate, default_expected_return, default_inflation_rate, NULL as encryption_key_hash, last_sync_at, sync_version, updated_at, deleted_flag FROM users WHERE id = ?`).all(userId) as User[];
  const accounts = db.prepare('SELECT * FROM accounts WHERE user_id = ?').all(userId) as Account[];
```

（其余 accounts/categories/transactions 等行不变）

- [ ] **Step 4: 运行测试确认通过**

Run: `cd packages/shared && pnpm exec vitest run tests/services/export-service.test.ts`
Expected: PASS

- [ ] **Step 5: 运行全量 shared 测试**

Run: `cd packages/shared && pnpm test`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
cd /workspace
git add packages/shared/src/services/export-service.ts packages/shared/tests/services/export-service.test.ts
git commit -m "fix(security): exclude encryption_key_hash from export envelope

- SELECT explicit columns for users table, NULL out encryption_key_hash
- Prevents offline password brute-force if export file leaks
- Add test asserting exported key_hash is null"
```

---

# Sprint D — 数据一致性

## Task D1: clear-service 补 sync_version/updated_at

**Files:**
- Modify: `packages/shared/src/services/clear-service.ts:27-29`
- Modify: `packages/shared/tests/services/clear-service.test.ts`

- [ ] **Step 1: 写 sync_version 递增失败测试**

在 `packages/shared/tests/services/clear-service.test.ts` 末尾添加:

```typescript
  it('clearAllTransactions: 软删除交易递增 sync_version + updated_at', () => {
    const tx = createTransaction(db, { user_id: userId, account_id: accountId, category_id: null, transaction_type: 'income', amount: 10000, transaction_date: 1000000 });
    const beforeVersion = tx.sync_version;
    const beforeUpdatedAt = tx.updated_at;
    clearAllTransactions(db, userId);
    const softDeleted = db.prepare('SELECT sync_version, updated_at FROM transactions WHERE id = ?').get(tx.id) as { sync_version: number; updated_at: number };
    expect(softDeleted.sync_version).toBe(beforeVersion + 1);
    expect(softDeleted.updated_at).toBeGreaterThan(beforeUpdatedAt);
  });

  it('clearAllTransactions: 账户余额归零递增 sync_version + updated_at', () => {
    createTransaction(db, { user_id: userId, account_id: accountId, category_id: null, transaction_type: 'income', amount: 50000, transaction_date: 1000000 });
    const accBefore = getAccount(db, accountId)!;
    const beforeVersion = accBefore.sync_version;
    const beforeUpdatedAt = accBefore.updated_at;
    clearAllTransactions(db, userId);
    const accAfter = getAccount(db, accountId)!;
    expect(accAfter.current_balance).toBe(0);
    expect(accAfter.sync_version).toBe(beforeVersion + 1);
    expect(accAfter.updated_at).toBeGreaterThan(beforeUpdatedAt);
  });
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd packages/shared && pnpm exec vitest run tests/services/clear-service.test.ts`
Expected: FAIL — sync_version 未递增

- [ ] **Step 3: 修改 clear-service 三条 UPDATE**

Modify `packages/shared/src/services/clear-service.ts` 第 27-29 行替换为:

```typescript
      db.prepare('UPDATE transactions SET deleted_flag = 1, sync_version = sync_version + 1, updated_at = ? WHERE user_id = ? AND deleted_flag = 0').run(now, userId);
      db.prepare('UPDATE recurring_transactions SET deleted_flag = 1, sync_version = sync_version + 1, updated_at = ? WHERE user_id = ? AND deleted_flag = 0').run(now, userId);
      db.prepare('UPDATE accounts SET current_balance = 0, last_updated = ?, sync_version = sync_version + 1, updated_at = ? WHERE user_id = ? AND deleted_flag = 0').run(now, now, userId);
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd packages/shared && pnpm exec vitest run tests/services/clear-service.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
cd /workspace
git add packages/shared/src/services/clear-service.ts packages/shared/tests/services/clear-service.test.ts
git commit -m "fix(consistency): clear-service now increments sync_version + updated_at

- All 3 UPDATE statements (transactions, recurring, accounts) add
  sync_version = sync_version + 1, updated_at = ?
- Ensures clear operation is visible to future LWW sync layer
  (previously: clear was invisible to sync, remote could resurrect cleared data)"
```

---

## Task D2: recurring-service 事务包裹 + 幂等检查

**Files:**
- Modify: `packages/shared/src/services/recurring-service.ts:17-53`
- Modify: `packages/shared/tests/services/recurring-service.test.ts`

- [ ] **Step 1: 写幂等失败测试**

在 `packages/shared/tests/services/recurring-service.test.ts` 末尾添加:

```typescript
  it('processRecurringTransactions: 重复调用不重复生成（幂等）', () => {
    const pastDate = nowMs() - 100000;
    createRecurring(db, {
      user_id: userId, account_id: accountId, category_id: categoryId,
      transaction_type: 'income', amount: 10000, frequency: 'monthly',
      start_date: pastDate, next_due_date: pastDate,
    });
    const firstRun = processRecurringTransactions(db, userId);
    expect(firstRun).toHaveLength(1);
    // 再次调用：next_due_date 已推进到未来，不应生成新交易
    const secondRun = processRecurringTransactions(db, userId);
    expect(secondRun).toHaveLength(0);
    const allTx = db.prepare('SELECT * FROM transactions WHERE recurring_id IS NOT NULL').all();
    expect(allTx.length).toBe(1);
  });

  it('processRecurringTransactions: 同月同 recurring_id 即使 next_due_date 未推进也不重复', () => {
    const pastDate = nowMs() - 100000;
    const tmpl = createRecurring(db, {
      user_id: userId, account_id: accountId, category_id: categoryId,
      transaction_type: 'income', amount: 10000, frequency: 'monthly',
      start_date: pastDate, next_due_date: pastDate,
    });
    processRecurringTransactions(db, userId);
    // 模拟崩溃：手动把 next_due_date 改回过去（模拟未推进）
    db.prepare('UPDATE recurring_transactions SET next_due_date = ? WHERE id = ?').run(pastDate, tmpl.id);
    const secondRun = processRecurringTransactions(db, userId);
    expect(secondRun).toHaveLength(0); // 幂等：已存在同 recurring_id+date 的交易
  });
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd packages/shared && pnpm exec vitest run tests/services/recurring-service.test.ts`
Expected: FAIL — 第二个测试会重复生成

- [ ] **Step 3: 修改 recurring-service 加事务包裹 + 幂等检查**

Replace `packages/shared/src/services/recurring-service.ts` 第 17-53 行（processRecurringTransactions 全函数）为:

```typescript
export function processRecurringTransactions(db: DatabaseType, userId: string): Transaction[] {
  const templates = getActiveRecurring(db, userId);
  const generated: Transaction[] = [];
  const currentTime = nowMs();

  // 预编译幂等检查语句（查同 recurring_id + transaction_date 是否已存在）
  // Pre-compiled idempotency check (whether same recurring_id + transaction_date already exists)
  const checkExisting = db.prepare('SELECT 1 FROM transactions WHERE recurring_id = ? AND transaction_date = ? AND deleted_flag = 0 LIMIT 1');

  db.transaction(() => {
    for (const template of templates) {
      let { next_due_date } = template;

      while (next_due_date <= currentTime) {
        if (template.end_date !== null && next_due_date > template.end_date) {
          updateRecurring(db, template.id, { is_active: 0 });
          break;
        }

        // 幂等检查：同 recurring_id + transaction_date 已存在则跳过
        // Idempotency: skip if same recurring_id + transaction_date already exists
        const exists = checkExisting.get(template.id, next_due_date);
        if (!exists) {
          const tx = createTransaction(db, {
            user_id: userId, account_id: template.account_id,
            to_account_id: template.to_account_id, category_id: template.category_id,
            recurring_id: template.id, transaction_type: template.transaction_type,
            amount: template.amount, transaction_date: next_due_date,
            description: template.description,
          });
          generated.push(tx);
        }

        updateRecurring(db, template.id, { last_generated_date: next_due_date });
        next_due_date = advanceDueDate(next_due_date, template.frequency, template.interval);
      }

      if (next_due_date !== template.next_due_date) {
        if (template.end_date !== null && next_due_date > template.end_date) {
          updateRecurring(db, template.id, { next_due_date, is_active: 0 });
        } else {
          updateRecurring(db, template.id, { next_due_date });
        }
      }
    }
  })();

  return generated;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd packages/shared && pnpm exec vitest run tests/services/recurring-service.test.ts`
Expected: PASS — 含 2 新增幂等测试

- [ ] **Step 5: 提交**

```bash
cd /workspace
git add packages/shared/src/services/recurring-service.ts packages/shared/tests/services/recurring-service.test.ts
git commit -m "fix(consistency): wrap recurring processing in transaction + idempotency check

- Entire for...of loop wrapped in db.transaction (crash-safe: all-or-nothing)
- Pre-compiled SELECT checks (recurring_id, transaction_date) existence before createTransaction
  → prevents duplicate generation if next_due_date fails to advance after crash
- Add idempotency tests: repeat call generates 0; stale next_due_date still skips existing"
```

---

## Task D3: CSV 导入复用 createTransaction + dedupHash 加 transaction_type

**Files:**
- Modify: `packages/shared/src/services/import-service.ts:110-170`
- Modify: `packages/shared/tests/services/import-service.test.ts`

- [ ] **Step 1: 写 dedupHash 含 type 失败测试**

在 `packages/shared/tests/services/import-service.test.ts` 的 CSV describe 块内添加:

```typescript
  it('markDuplicateTransactions: 同日同金额同描述但不同 type 不判重', () => {
    createTransaction(db, { user_id: userId, account_id: accountId, category_id: null, transaction_type: 'income', amount: 5000, transaction_date: 1700000000000, description: '工资' });
    const candidates: ParsedCsvTransaction[] = [
      { tempId: 't1', transactionDate: 1700000000000, amount: -5000, transactionType: 'expense', description: '工资', counterparty: '', productDescription: '', mappedCategoryId: '', inferredCategoryId: '', finalCategoryId: '', dedupHash: '', isDuplicate: false, sourceLine: 0 },
    ];
    const marked = markDuplicateTransactions(db, accountId, candidates);
    expect(marked[0].isDuplicate).toBe(false); // expense 不与 income 判重
  });
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd packages/shared && pnpm exec vitest run tests/services/import-service.test.ts`
Expected: FAIL — isDuplicate 为 true（当前 hash 不含 type）

- [ ] **Step 3: 修改 importCsvTransactions 复用 createTransaction + markDuplicate hash 加 type**

Modify `packages/shared/src/services/import-service.ts`。删除 `insertCsvTransaction`（第 138-147 行）和 `updateAccountBalance`（第 149-156 行）函数。修改 `importCsvTransactions`（第 110-136 行）为:

```typescript
export function importCsvTransactions(db: DatabaseType, params: CsvImportParams): ImportResult {
  const result: ImportResult = { success: true, inserted: 0, updated: 0, skipped: 0, errors: [] };
  const { userId, accountId, transactions } = params;

  const account = db.prepare('SELECT * FROM accounts WHERE id = ? AND user_id = ?').get(accountId, userId);
  if (!account) {
    return { success: false, inserted: 0, updated: 0, skipped: 0, errors: ['目标账户不存在'] };
  }

  try {
    db.transaction(() => {
      for (const tx of transactions) {
        if (tx.isDuplicate) {
          result.skipped++;
          continue;
        }
        // 复用 createTransaction 统一余额联动语义，消除符号处理分叉
        // Reuse createTransaction for unified balance linkage, eliminate sign-handling divergence
        createTransaction(db, {
          user_id: userId, account_id: accountId,
          category_id: tx.finalCategoryId || null,
          transaction_type: tx.transactionType,
          amount: Math.abs(tx.amount), // DB CHECK > 0，统一存正数
          transaction_date: tx.transactionDate,
          description: tx.description,
        });
        result.inserted++;
      }
    })();
  } catch (e) {
    return { success: false, inserted: 0, updated: 0, skipped: 0, errors: [(e as Error).message] };
  }

  return result;
}
```

修改 `markDuplicateTransactions`（第 158-170 行）hash 含 type:

```typescript
export function markDuplicateTransactions(db: DatabaseType, accountId: string, transactions: ParsedCsvTransaction[]): ParsedCsvTransaction[] {
  const existingTx = db.prepare(
    'SELECT transaction_date, amount, transaction_type, description FROM transactions WHERE account_id = ? AND deleted_flag = 0'
  ).all(accountId) as { transaction_date: number; amount: number; transaction_type: string; description: string | null }[];

  // hash 含 transaction_type，避免同日同金额同描述的 income/expense 误判
  // hash includes transaction_type to avoid income/expense false-positive dedup
  const existingSet = new Set(existingTx.map(t => `${t.transaction_date}|${t.amount}|${t.transaction_type}|${t.description ?? ''}`));

  return transactions.map(tx => {
    const absAmount = Math.abs(tx.amount);
    const hash = `${tx.transactionDate}|${absAmount}|${tx.transactionType}|${tx.description ?? ''}`;
    return { ...tx, isDuplicate: existingSet.has(hash) };
  });
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd packages/shared && pnpm exec vitest run tests/services/import-service.test.ts`
Expected: PASS

- [ ] **Step 5: 运行 desktop CSV E2E 测试确认无回归**

Run: `cd apps/desktop && pnpm exec vitest run tests/csv-parser-e2e.test.ts tests/csv-import-wizard.test.tsx`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
cd /workspace
git add packages/shared/src/services/import-service.ts packages/shared/tests/services/import-service.test.ts
git commit -m "fix(consistency): CSV import reuses createTransaction + dedupHash includes type

- Remove insertCsvTransaction/updateAccountBalance fork; importCsvTransactions
  now calls createTransaction for unified balance linkage (was: separate path
  with divergent sign handling, no transfer support)
- dedupHash now includes transaction_type (was: date|amount|description only,
  causing income/expense with same date/amount/desc to be falsely deduped)
- description unified with ?? '' to prevent 'undefined'/'null' in hash"
```

---

## Task D4: schema CHECK 约束 + updateRecurring 类型收紧

**Files:**
- Modify: `packages/shared/src/db/schema.ts:72-152`
- Modify: `packages/shared/src/models/recurring.ts:44-48`
- Modify: `packages/shared/tests/db/schema.test.ts`

- [ ] **Step 1: 写 CHECK 约束失败测试**

在 `packages/shared/tests/db/schema.test.ts` 末尾添加:

```typescript
  it('transactions: transfer 无 to_account_id 被拒绝', () => {
    expect(() => {
      db.prepare(`INSERT INTO transactions (id, user_id, account_id, transaction_type, amount, transaction_date, description, sync_version, updated_at, deleted_flag) VALUES (?, ?, ?, 'transfer', 1000, 1000, NULL, 0, 0, 0)`).run('tx1', userId, accountId);
    }).toThrow(/CHECK constraint failed/);
  });

  it('transactions: transfer to_account_id == account_id 被拒绝', () => {
    expect(() => {
      db.prepare(`INSERT INTO transactions (id, user_id, account_id, to_account_id, transaction_type, amount, transaction_date, description, sync_version, updated_at, deleted_flag) VALUES (?, ?, ?, ?, 'transfer', 1000, 1000, NULL, 0, 0, 0)`).run('tx2', userId, accountId, accountId);
    }).toThrow(/CHECK constraint failed/);
  });

  it('recurring_transactions: interval=0 被拒绝', () => {
    expect(() => {
      db.prepare(`INSERT INTO recurring_transactions (id, user_id, account_id, transaction_type, amount, frequency, interval, start_date, next_due_date, sync_version, updated_at, deleted_flag) VALUES (?, ?, ?, 'income', 1000, 'monthly', 0, 1000, 1000, 0, 0, 0)`).run('r1', userId, accountId);
    }).toThrow(/CHECK constraint failed/);
  });

  it('accounts: liability 正余额被拒绝', () => {
    expect(() => {
      db.prepare(`INSERT INTO accounts (id, user_id, name, asset_class, account_type, current_balance, last_updated, sync_version, updated_at, deleted_flag) VALUES (?, ?, ?, 'liability', 'credit_card', 5000, 0, 0, 0, 0)`).run('acc-liab', userId, '信用卡');
    }).toThrow(/CHECK constraint failed/);
  });
```

> 注：需在 schema.test.ts 的 beforeEach 内确保有 userId 和 accountId 可用。若现有 beforeEach 未创建，补充 createUser + createAccount。

- [ ] **Step 2: 运行测试确认失败**

Run: `cd packages/shared && pnpm exec vitest run tests/db/schema.test.ts`
Expected: FAIL — 约束未生效

- [ ] **Step 3: 修改 schema.ts 加 CHECK 约束**

Modify `packages/shared/src/db/schema.ts`。

accounts 表（第 32-50 行）末尾 `deleted_flag` 行前加:

```typescript
    current_balance INTEGER NOT NULL DEFAULT 0 CHECK (asset_class != 'liability' OR current_balance <= 0),
```
（替换原 `current_balance INTEGER NOT NULL DEFAULT 0,` 行）

transactions 表（第 72-88 行）在 `amount` 行后加:

```typescript
    amount INTEGER NOT NULL CHECK (amount > 0),
    CHECK (transaction_type != 'transfer' OR to_account_id IS NOT NULL),
    CHECK (to_account_id IS NULL OR to_account_id != account_id),
```

recurring_transactions 表（第 91-111 行）`interval` 行改为:

```typescript
    interval INTEGER NOT NULL DEFAULT 1 CHECK (interval > 0),
```

在 `end_date INTEGER,` 行后加:

```typescript
    CHECK (end_date IS NULL OR end_date >= start_date),
```

fire_scenarios 表（第 131-152 行）在 `current_age` 行改为:

```typescript
    current_age INTEGER NOT NULL CHECK (current_age >= 0),
```

`retirement_years` 行改为:

```typescript
    retirement_years INTEGER NOT NULL DEFAULT 30 CHECK (retirement_years > 0),
```

`current_portfolio_value` 行改为:

```typescript
    current_portfolio_value INTEGER NOT NULL DEFAULT 0 CHECK (current_portfolio_value >= 0),
```

`monthly_savings` 行改为:

```typescript
    monthly_savings INTEGER NOT NULL DEFAULT 0 CHECK (monthly_savings >= 0),
```

`annual_expenses` 行改为:

```typescript
    annual_expenses INTEGER NOT NULL CHECK (annual_expenses > 0),
```

`expected_return_rate` 行改为:

```typescript
    expected_return_rate INTEGER NOT NULL CHECK (expected_return_rate BETWEEN -1000 AND 5000),
```

`inflation_rate` 行改为:

```typescript
    inflation_rate INTEGER NOT NULL DEFAULT 300 CHECK (inflation_rate BETWEEN -1000 AND 5000),
```

`post_retirement_monthly_income` 行改为:

```typescript
    post_retirement_monthly_income INTEGER NOT NULL DEFAULT 0 CHECK (post_retirement_monthly_income >= 0),
```

categories 表（第 53-67 行）末尾 `deleted_flag` 行后加 partial unique:

```typescript
    UNIQUE(user_id, name, type) WHERE deleted_flag = 0
```
（需在 `deleted_flag` 行末加逗号）

- [ ] **Step 4: 修改 updateRecurring 收紧 updates 类型**

Modify `packages/shared/src/models/recurring.ts` 第 44-48 行。更新签名 + SQL 覆盖可编辑字段:

```typescript
export type RecurringUpdateFields = Pick<RecurringTransaction, 'next_due_date' | 'last_generated_date' | 'is_active'>;

export function updateRecurring(db: DatabaseType, id: string, updates: RecurringUpdateFields): void {
  const current = db.prepare('SELECT * FROM recurring_transactions WHERE id = ? AND deleted_flag = 0').get(id) as RecurringTransaction | undefined;
  if (!current) { throw new Error(`Recurring transaction not found: ${id}`); }
  const updated = { ...current, ...updates, sync_version: current.sync_version + 1, updated_at: nowMs() };
  db.prepare(`UPDATE recurring_transactions SET next_due_date = @next_due_date, last_generated_date = @last_generated_date, is_active = @is_active, sync_version = @sync_version, updated_at = @updated_at WHERE id = @id`).run(updated);
}
```

- [ ] **Step 5: 修复 recurring-service 类型引用**

`packages/shared/src/services/recurring-service.ts` 内 `updateRecurring(db, template.id, { is_active: 0 })` 等调用现在类型已收紧，参数仍合法（is_active 在 Pick 内）。运行 tsc 检查:

Run: `cd packages/shared && pnpm exec tsc --noEmit -p tsconfig.json`
Expected: 无错误

- [ ] **Step 6: 运行 shared 全量测试**

Run: `cd packages/shared && pnpm test`
Expected: PASS — 含 4 新增约束测试。若现有测试因新约束失败（如测试数据违反），修正测试数据。

- [ ] **Step 7: 提交**

```bash
cd /workspace
git add packages/shared/src/db/schema.ts packages/shared/src/models/recurring.ts packages/shared/tests/db/schema.test.ts packages/shared/src/services/recurring-service.ts
git commit -m "fix(consistency): add CHECK constraints + tighten updateRecurring type

- transactions: CHECK transfer requires to_account_id, to_account_id != account_id
- accounts: CHECK liability current_balance <= 0
- recurring: CHECK interval > 0, end_date >= start_date
- fire_scenarios: range checks on age/years/rates/amounts
- categories: partial UNIQUE(user_id,name,type) WHERE deleted_flag=0
- updateRecurring: updates type narrowed to Pick<next_due_date|last_generated_date|is_active>
  + SELECT filters deleted_flag=0 (prevents updating soft-deleted templates)"
```

---

# Sprint P — 性能

## Task P1: partial index 优化

**Files:**
- Modify: `packages/shared/src/db/schema.ts:154-164`
- Modify: `packages/shared/tests/db/schema.test.ts`

- [ ] **Step 1: 修改索引为 partial index**

Modify `packages/shared/src/db/schema.ts` 索引段（第 154-163 行）替换为:

```typescript
  // 索引（partial index：仅索引未软删记录，减小体积 + 避免行内过滤）
  // Indexes (partial index: only non-deleted rows, smaller + avoids row-level filtering)
  `CREATE INDEX IF NOT EXISTS idx_tx_user_date ON transactions(user_id, transaction_date DESC, updated_at DESC) WHERE deleted_flag = 0`,
  `CREATE INDEX IF NOT EXISTS idx_tx_account ON transactions(account_id, transaction_date DESC) WHERE deleted_flag = 0`,
  `CREATE INDEX IF NOT EXISTS idx_tx_to_account ON transactions(to_account_id) WHERE deleted_flag = 0`,
  `CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(category_id) WHERE deleted_flag = 0`,
  `CREATE INDEX IF NOT EXISTS idx_tx_recurring ON transactions(recurring_id) WHERE deleted_flag = 0`,
  `CREATE INDEX IF NOT EXISTS idx_tx_recurring_date ON transactions(recurring_id, transaction_date) WHERE deleted_flag = 0`,
  `CREATE INDEX IF NOT EXISTS idx_acc_user_class ON accounts(user_id, asset_class) WHERE deleted_flag = 0`,
  `CREATE INDEX IF NOT EXISTS idx_acc_user ON accounts(user_id) WHERE deleted_flag = 0`,
  `CREATE INDEX IF NOT EXISTS idx_cat_user ON categories(user_id) WHERE deleted_flag = 0`,
  `CREATE INDEX IF NOT EXISTS idx_recur_active ON recurring_transactions(user_id) WHERE is_active = 1 AND deleted_flag = 0`,
  `CREATE INDEX IF NOT EXISTS idx_recur_user ON recurring_transactions(user_id) WHERE deleted_flag = 0`,
  `CREATE INDEX IF NOT EXISTS idx_snap_user ON net_worth_snapshots(user_id, snapshot_year_month DESC) WHERE deleted_flag = 0`,
  `CREATE INDEX IF NOT EXISTS idx_fire_user ON fire_scenarios(user_id) WHERE deleted_flag = 0`,
```

> 注：因可破坏性变更，旧 dev 库重建即可。`initSchema` 用 `CREATE INDEX IF NOT EXISTS`，但 partial index 与非 partial 不同名同结构不会自动替换。需在 db-manager 的 initDatabase 内加 `DROP INDEX IF EXISTS idx_tx_user_date` 等旧索引删除逻辑，或直接删 dev 库文件重建。后者更简单（dev 阶段）。

- [ ] **Step 2: 在 db-manager 加旧索引清理**

Read `apps/desktop/src/main/db-manager.ts`。在 `initSchema(db)` 调用前插入旧索引删除:

```typescript
  // 清理旧版非 partial 索引（可破坏性变更，dev 阶段直接重建）
  // Clean up old non-partial indexes (breaking change, dev stage rebuilds)
  const legacyIndexes = ['idx_tx_user_date', 'idx_tx_account', 'idx_tx_category', 'idx_tx_recurring', 'idx_acc_user', 'idx_cat_user', 'idx_recur_user', 'idx_snap_user', 'idx_fire_user'];
  for (const idx of legacyIndexes) {
    db.exec(`DROP INDEX IF EXISTS ${idx}`);
  }
```

- [ ] **Step 3: 运行 shared + desktop 全量测试**

Run: `cd packages/shared && pnpm test && cd ../../apps/desktop && pnpm test`
Expected: PASS

- [ ] **Step 4: 提交**

```bash
cd /workspace
git add packages/shared/src/db/schema.ts apps/desktop/src/main/db-manager.ts
git commit -m "perf: convert indexes to partial indexes + add missing indexes

- All indexes now WHERE deleted_flag = 0 (smaller, faster, no row filtering)
- transactions.idx_tx_user_date includes updated_at DESC (avoids filesort)
- New idx_tx_to_account (was: full scan for hasTransactions OR query)
- New idx_tx_recurring_date (supports recurring idempotency check)
- New idx_acc_user_class, idx_recur_active, idx_snap_user(year_month)
- db-manager drops legacy non-partial indexes before initSchema (breaking change)"
```

---

## Task P2: 服务端分页 + 聚合查询

**Files:**
- Create: `packages/shared/src/models/transaction-queries.ts`
- Create: `packages/shared/tests/models/transaction-queries.test.ts`
- Modify: `apps/desktop/src/main/ipc/transaction-handlers.ts`（新增 IPC）
- Modify: `apps/desktop/src/preload/index.ts`（暴露新 API）
- Modify: `apps/desktop/src/renderer/src/data/data-access.ts`（新增方法签名）

- [ ] **Step 1: 写分页查询失败测试**

Create `packages/shared/tests/models/transaction-queries.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, closeDatabase } from '../../src/db/connection.js';
import { initSchema } from '../../src/db/schema.js';
import { createUser } from '../../src/models/user.js';
import { createAccount } from '../../src/models/account.js';
import { createTransaction } from '../../src/services/transaction-service.js';
import { getTransactionsPage, getRecentTransactions, getMonthlyOverview } from '../../src/models/transaction-queries.js';
import type { Database as DatabaseType } from 'better-sqlite3';

describe('transaction-queries', () => {
  let db: DatabaseType;
  let userId: string;
  let accountId: string;

  beforeEach(() => {
    db = createDatabase(':memory:');
    initSchema(db);
    userId = 'u1';
    createUser(db, { id: userId, display_name: '测试' });
    const acc = createAccount(db, { user_id: userId, name: '招行', asset_class: 'liquid', account_type: 'checking' });
    accountId = acc.id;
    // 生成 25 条交易：5 收 + 20 支，日期跨 2 个月
    for (let i = 0; i < 5; i++) {
      createTransaction(db, { user_id: userId, account_id: accountId, category_id: null, transaction_type: 'income', amount: 10000, transaction_date: 1700000000000 + i * 86400000 });
    }
    for (let i = 0; i < 20; i++) {
      createTransaction(db, { user_id: userId, account_id: accountId, category_id: null, transaction_type: 'expense', amount: 1000 + i * 100, transaction_date: 1701000000000 + i * 86400000 });
    }
  });
  afterEach(() => closeDatabase(db));

  it('getTransactionsPage: limit + offset 分页', () => {
    const page1 = getTransactionsPage(db, userId, { limit: 10, offset: 0 });
    expect(page1.items).toHaveLength(10);
    expect(page1.total).toBe(25);
    const page3 = getTransactionsPage(db, userId, { limit: 10, offset: 20 });
    expect(page3.items).toHaveLength(5);
  });

  it('getTransactionsPage: type 筛选下推', () => {
    const result = getTransactionsPage(db, userId, { limit: 100, offset: 0, type: 'income' });
    expect(result.items).toHaveLength(5);
    expect(result.total).toBe(5);
    expect(result.items.every(t => t.transaction_type === 'income')).toBe(true);
  });

  it('getTransactionsPage: dateFrom/dateTo 筛选', () => {
    const result = getTransactionsPage(db, userId, { limit: 100, offset: 0, dateFrom: 1700000000000, dateTo: 1700000000000 + 4 * 86400000 });
    expect(result.items.every(t => t.transaction_date >= 1700000000000 && t.transaction_date <= 1700000000000 + 4 * 86400000)).toBe(true);
  });

  it('getRecentTransactions: LIMIT N', () => {
    const recent = getRecentTransactions(db, userId, 5);
    expect(recent).toHaveLength(5);
    // 按日期倒序
    for (let i = 1; i < recent.length; i++) {
      expect(recent[i].transaction_date).toBeLessThanOrEqual(recent[i - 1].transaction_date);
    }
  });

  it('getMonthlyOverview: 聚合月度收支', () => {
    // 第一批 income 在 2023-11 (1700000000000 = 2023-11-14)
    const overview = getMonthlyOverview(db, userId, '2023-11');
    expect(overview.income).toBe(5 * 10000);
    expect(overview.expense).toBe(0); // expense 在 2023-11 之后的日期
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd packages/shared && pnpm exec vitest run tests/models/transaction-queries.test.ts`
Expected: FAIL — 模块不存在

- [ ] **Step 3: 实现查询模块**

Create `packages/shared/src/models/transaction-queries.ts`:

```typescript
import type { Database as DatabaseType } from 'better-sqlite3';
import type { Transaction } from '../types/index.js';

export interface TransactionPageParams {
  dateFrom?: number;
  dateTo?: number;
  type?: 'income' | 'expense' | 'transfer' | 'initial_balance';
  accountId?: string;
  limit: number;
  offset: number;
}

export interface TransactionPage {
  items: Transaction[];
  total: number;
}

export interface MonthlyOverview {
  income: number;
  expense: number;
  transfer: number;
}

/**
 * 分页查询交易（筛选/排序下推到 SQL）
 * Paginated transaction query (filters/order pushed to SQL)
 */
export function getTransactionsPage(db: DatabaseType, userId: string, params: TransactionPageParams): TransactionPage {
  const conditions = ['user_id = ?', 'deleted_flag = 0'];
  const args: unknown[] = [userId];
  if (params.dateFrom !== undefined) { conditions.push('transaction_date >= ?'); args.push(params.dateFrom); }
  if (params.dateTo !== undefined) { conditions.push('transaction_date <= ?'); args.push(params.dateTo); }
  if (params.type !== undefined) { conditions.push('transaction_type = ?'); args.push(params.type); }
  if (params.accountId !== undefined) { conditions.push('account_id = ?'); args.push(params.accountId); }
  const where = conditions.join(' AND ');

  const total = (db.prepare(`SELECT COUNT(*) as cnt FROM transactions WHERE ${where}`).get(...args) as { cnt: number }).cnt;
  const items = db.prepare(`SELECT * FROM transactions WHERE ${where} ORDER BY transaction_date DESC, updated_at DESC LIMIT ? OFFSET ?`).all(...args, params.limit, params.offset) as Transaction[];
  return { items, total };
}

/**
 * 获取最近 N 条交易（SQL LIMIT，避免拉全量）
 * Get recent N transactions (SQL LIMIT, avoids full table fetch)
 */
export function getRecentTransactions(db: DatabaseType, userId: string, limit: number): Transaction[] {
  return db.prepare('SELECT * FROM transactions WHERE user_id = ? AND deleted_flag = 0 ORDER BY transaction_date DESC, updated_at DESC LIMIT ?').all(userId, limit) as Transaction[];
}

/**
 * 月度收支聚合（SQL SUM/CASE，避免拉全量再前端聚合）
 * Monthly income/expense aggregation (SQL SUM/CASE, avoids full fetch + frontend aggregation)
 */
export function getMonthlyOverview(db: DatabaseType, userId: string, yearMonth: string): MonthlyOverview {
  // yearMonth 格式 YYYY-MM，匹配 transaction_date 所在月
  // yearMonth format YYYY-MM, matching transaction_date's month
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE 0 END), 0) as income,
      COALESCE(SUM(CASE WHEN transaction_type = 'expense' THEN amount ELSE 0 END), 0) as expense,
      COALESCE(SUM(CASE WHEN transaction_type = 'transfer' THEN amount ELSE 0 END), 0) as transfer
    FROM transactions
    WHERE user_id = ? AND deleted_flag = 0
      AND strftime('%Y-%m', transaction_date / 1000, 'unixepoch') = ?
  `).get(userId, yearMonth) as MonthlyOverview;
  return row ?? { income: 0, expense: 0, transfer: 0 };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd packages/shared && pnpm exec vitest run tests/models/transaction-queries.test.ts`
Expected: PASS — 5 用例

- [ ] **Step 5: 暴露新查询到 IPC + preload + data-access**

Read `apps/desktop/src/main/ipc/transaction-handlers.ts`，添加新 handlers:

```typescript
import { getTransactionsPage, getRecentTransactions, getMonthlyOverview } from '@shared/models/transaction-queries.js';
// ...
  registerHandler('db:tx:page', (_db, userId: string, params: { dateFrom?: number; dateTo?: number; type?: string; accountId?: string; limit: number; offset: number }) => {
    return getTransactionsPage(_db, userId, params as any);
  }, db);
  registerHandler('db:tx:recent', (_db, userId: string, limit: number) => {
    return getRecentTransactions(_db, userId, limit);
  }, db);
  registerHandler('db:tx:monthlyOverview', (_db, userId: string, yearMonth: string) => {
    return getMonthlyOverview(_db, userId, yearMonth);
  }, db);
```

Read `apps/desktop/src/preload/index.ts`，在 transaction 命名空间添加:

```typescript
    page: (userId: string, params: { dateFrom?: number; dateTo?: number; type?: string; accountId?: string; limit: number; offset: number }) => ipcRenderer.invoke('db:tx:page', userId, params),
    recent: (userId: string, limit: number) => ipcRenderer.invoke('db:tx:recent', userId, limit),
    monthlyOverview: (userId: string, yearMonth: string) => ipcRenderer.invoke('db:tx:monthlyOverview', userId, yearMonth),
```

Read `apps/desktop/src/renderer/src/data/data-access.ts`，在 transaction 接口添加对应方法签名。

> 注：本 task 仅暴露 API，不改造 pages/stores（P3 处理）。保留旧 `getTransactionsByUser` 过渡使用。

- [ ] **Step 6: 运行全量测试 + tsc**

Run: `cd packages/shared && pnpm test && cd ../../apps/desktop && pnpm test && pnpm exec tsc --noEmit -p tsconfig.json && pnpm exec tsc --noEmit -p tsconfig.node.json`
Expected: PASS

- [ ] **Step 7: 提交**

```bash
cd /workspace
git add packages/shared/src/models/transaction-queries.ts packages/shared/tests/models/transaction-queries.test.ts apps/desktop/src/main/ipc/transaction-handlers.ts apps/desktop/src/preload/index.ts apps/desktop/src/renderer/src/data/data-access.ts
git commit -m "perf: add server-side pagination + aggregation queries

- getTransactionsPage: WHERE+ORDER+LIMIT/OFFSET pushed to SQL (type/date/account filters)
- getRecentTransactions: SQL LIMIT N (replaces full fetch + slice for dashboard)
- getMonthlyOverview: SQL SUM/CASE aggregation (replaces full fetch + filter for dashboard)
- Expose via IPC db:tx:page, db:tx:recent, db:tx:monthlyOverview + preload + data-access
- Legacy getTransactionsByUser retained for transition (removed in P3 end)"
```

---

## Task P3: 写操作局部更新 store + Dashboard/Transactions 接入分页

**Files:**
- Modify: `apps/desktop/src/renderer/src/stores/transaction-store.ts`
- Modify: `apps/desktop/src/renderer/src/stores/account-store.ts`
- Modify: `apps/desktop/src/renderer/src/pages/DashboardPage.tsx`
- Modify: `apps/desktop/src/renderer/src/pages/TransactionsPage.tsx`
- Delete: `getTransactionsByUser`（P2 末删除，或保留标记 deprecated）

> 注：此 task 是本里程碑最大的改造点，涉及 store 状态管理范式变更。按 YAGNI，Dashboard 改用 recent+monthlyOverview，Transactions 改用 page 分页。

- [ ] **Step 1: 改造 transaction-store 支持分页 + 局部更新**

Read `apps/desktop/src/renderer/src/stores/transaction-store.ts`。改造为:

```typescript
interface TransactionStoreState {
  pagedTransactions: Transaction[];
  total: number;
  recentTransactions: Transaction[];
  loading: boolean;
  error: string | null;
  fetchTransactionPage: (userId: string, params: { limit: number; offset: number; type?: string; dateFrom?: number; dateTo?: number; accountId?: string }) => Promise<void>;
  fetchRecentTransactions: (userId: string, limit: number) => Promise<void>;
  createTransaction: (userId: string, input: CreateTransactionInput) => Promise<void>;
  editTransaction: (userId: string, id: string, input: EditTransactionInput) => Promise<void>;
  deleteTransaction: (userId: string, id: string) => Promise<void>;
  // 局部更新辅助
  upsertLocal: (tx: Transaction) => void;
  removeLocal: (id: string) => void;
}
```

实现: createTransaction 后 `upsertLocal(返回的tx)` + 刷新 account 余额（fetchAccounts 或单独 getAccount）；editTransaction 后 upsertLocal；deleteTransaction 后 removeLocal。不再调 getTransactionsByUser 全量重拉。

- [ ] **Step 2: 改造 DashboardPage 用 recent + monthlyOverview**

Read `apps/desktop/src/renderer/src/pages/DashboardPage.tsx`。替换全量拉取为:

```typescript
  useEffect(() => {
    if (!currentUser?.id) return;
    Promise.all([
      dataAccess.account.list(currentUser.id),
      dataAccess.transaction.recent(currentUser.id, 10),
      dataAccess.snapshot.list(currentUser.id),
      dataAccess.transaction.monthlyOverview(currentUser.id, currentYearMonth()),
    ]).then(([accounts, recent, snapshots, overview]) => { ... });
  }, [currentUser?.id]);
```

删除 `filterCurrentMonthTransactions` 和 `getRecentTransactions` 前端聚合调用。

- [ ] **Step 3: 改造 TransactionsPage 用 page 分页**

Read `apps/desktop/src/renderer/src/pages/TransactionsPage.tsx`。替换全量拉取+前端筛选为服务端分页:

```typescript
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState({ type: '', accountId: '', dateFrom: '', dateTo: '' });
  useEffect(() => {
    if (!currentUser?.id) return;
    fetchTransactionPage(currentUser.id, { limit: 50, offset: page * 50, type: filters.type || undefined, accountId: filters.accountId || undefined, dateFrom: ..., dateTo: ... });
  }, [currentUser?.id, page, filters]);
```

删除前端 `filterTransactions` 和 `sortTransactions` 逻辑。

- [ ] **Step 4: 删除旧 getTransactionsByUser（确认无引用后）**

Run: `grep -r "getTransactionsByUser" packages/shared/src apps/desktop/src`
若仅 model 定义和测试引用，删除 model 函数 + 更新测试。

- [ ] **Step 5: 更新 desktop renderer 测试**

更新 `transactions-page.test.tsx`、`dashboard.test.tsx` 等测试，mock 新的 `transaction.recent`/`transaction.page`/`transaction.monthlyOverview`。

- [ ] **Step 6: 运行全量测试 + tsc + build**

Run: `cd packages/shared && pnpm test && cd ../../apps/desktop && pnpm test && pnpm exec tsc --noEmit -p tsconfig.json && pnpm exec tsc --noEmit -p tsconfig.node.json && pnpm build`
Expected: PASS

- [ ] **Step 7: 提交**

```bash
cd /workspace
git add packages/shared/src/models/transaction.ts apps/desktop/src/renderer/src/stores/transaction-store.ts apps/desktop/src/renderer/src/pages/DashboardPage.tsx apps/desktop/src/renderer/src/pages/TransactionsPage.tsx apps/desktop/tests/
git commit -m "perf: stores use local upsert + pages use server-side pagination

- transaction-store: CRUD upserts/removes locally instead of full refetch
- DashboardPage: uses transaction.recent(10) + transaction.monthlyOverview (SQL aggregation)
- TransactionsPage: uses transaction.page with server-side filters/pagination
- Remove getTransactionsByUser (was: full table fetch + frontend filter/sort)
- Update renderer tests to mock new paginated APIs"
```

---

## Task P4: 虚拟化表格 + selector 细粒度 + render Map 查找

**Files:**
- Modify: `apps/desktop/package.json`（+@tanstack/react-virtual）
- Modify: `apps/desktop/src/renderer/src/components/base/Table.tsx`
- Modify: `apps/desktop/src/renderer/src/components/transactions/TransactionListTable.tsx`
- Modify: `apps/desktop/src/renderer/src/components/dashboard/RecentTransactions.tsx`
- Modify: 各 pages（selector 改造）

- [ ] **Step 1: 安装 @tanstack/react-virtual**

Run: `cd /workspace/apps/desktop && pnpm add @tanstack/react-virtual@^3.0.0 --filter @fire-app/desktop --ignore-scripts`

- [ ] **Step 2: 改造 Table 组件支持虚拟化**

Read `apps/desktop/src/renderer/src/components/base/Table.tsx`。用 `useVirtualizer` 改造 data.map 为虚拟滚动:

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';
// ...
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48, // 行高
    overscan: 10,
  });
  return (
    <div ref={parentRef} className="overflow-auto max-h-[600px]">
      <table className="w-full">
        <thead>{/* 不变 */}</thead>
        <tbody style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
          {virtualizer.getVirtualItems().map(virtualItem => {
            const record = data[virtualItem.index];
            return (
              <tr key={record.id} style={{ position: 'absolute', top: 0, transform: `translateY(${virtualItem.start}px)`, height: `${virtualItem.size}px` }}>
                {columns.map(col => <td key={col.key}>{col.render(record)}</td>)}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
```

- [ ] **Step 3: TransactionListTable 用 useMemo 构造 Map 查找**

Read `apps/desktop/src/renderer/src/components/transactions/TransactionListTable.tsx`。改造:

```typescript
  const accountMap = useMemo(() => new Map(accounts.map(a => [a.id, a.name])), [accounts]);
  const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c.name])), [categories]);
  // render 内: accountMap.get(tx.account_id) ?? '-'
```

RecentTransactions 同改造。

- [ ] **Step 4: pages 改用细粒度 selector**

Read `apps/desktop/src/renderer/src/pages/TransactionsPage.tsx`。替换解构:

```typescript
  const transactions = useTransactionStore((s) => s.pagedTransactions);
  const total = useTransactionStore((s) => s.total);
  const loading = useTransactionStore((s) => s.loading);
  const fetchTransactionPage = useTransactionStore((s) => s.fetchTransactionPage);
  const accounts = useAccountStore((s) => s.accounts);
  // ...
```

AccountsPage/NetWorthPage/FireCalculatorPage 同模式。

- [ ] **Step 5: 运行全量测试 + tsc + build**

Run: `cd apps/desktop && pnpm test && pnpm exec tsc --noEmit -p tsconfig.json && pnpm build`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
cd /workspace
git add apps/desktop/package.json apps/desktop/src/renderer/src/components/base/Table.tsx apps/desktop/src/renderer/src/components/transactions/TransactionListTable.tsx apps/desktop/src/renderer/src/components/dashboard/RecentTransactions.tsx apps/desktop/src/renderer/src/pages/
git commit -m "perf: virtualized table + Map lookups + fine-grained selectors

- Table uses @tanstack/react-virtual (only renders visible + overscan rows)
- TransactionListTable/RecentTransactions: useMemo Map<id,name> for O(1) lookup
- Pages use fine-grained Zustand selectors (was: destructure entire store,
  causing re-render on any store field change)"
```

---

## Task P5: 路由懒加载 + manualChunks

**Files:**
- Modify: `apps/desktop/src/renderer/src/router/index.tsx`
- Modify: `apps/desktop/electron.vite.config.ts`
- Modify: `apps/desktop/src/renderer/src/App.tsx`（加 Suspense）

- [ ] **Step 1: 改造路由为懒加载**

Replace `apps/desktop/src/renderer/src/router/index.tsx`:

```typescript
import { lazy } from 'react';
import { createHashRouter, Navigate } from 'react-router-dom';
import { RequireInit } from './RequireInit.js';
import { AppLayout } from '../components/layout/AppLayout.js';

const OnboardingPage = lazy(() => import('../pages/OnboardingPage.js').then(m => ({ default: m.OnboardingPage })));
const DashboardPage = lazy(() => import('../pages/DashboardPage.js').then(m => ({ default: m.DashboardPage })));
const AccountsPage = lazy(() => import('../pages/AccountsPage.js').then(m => ({ default: m.AccountsPage })));
const TransactionsPage = lazy(() => import('../pages/TransactionsPage.js').then(m => ({ default: m.TransactionsPage })));
const NetWorthPage = lazy(() => import('../pages/NetWorthPage.js').then(m => ({ default: m.NetWorthPage })));
const FireCalculatorPage = lazy(() => import('../pages/FireCalculatorPage.js').then(m => ({ default: m.FireCalculatorPage })));
const SettingsPage = lazy(() => import('../pages/SettingsPage.js').then(m => ({ default: m.SettingsPage })));

export const router = createHashRouter([
  {
    path: '/onboarding',
    element: <OnboardingPage />,
  },
  {
    element: <RequireInit />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <DashboardPage /> },
          { path: '/accounts', element: <AccountsPage /> },
          { path: '/transactions', element: <TransactionsPage /> },
          { path: '/net-worth', element: <NetWorthPage /> },
          { path: '/fire-calculator', element: <FireCalculatorPage /> },
          { path: '/settings', element: <SettingsPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
```

- [ ] **Step 2: App.tsx 加 Suspense**

Modify `apps/desktop/src/renderer/src/App.tsx`:

```typescript
import { Suspense } from 'react';
// ...
  return (
    <Suspense fallback={<div className="p-8 text-gray-500">加载中...</div>}>
      <RouterProvider router={router} />
    </Suspense>
  );
```

- [ ] **Step 3: 配置 manualChunks**

Modify `apps/desktop/electron.vite.config.ts` renderer 段:

```typescript
  renderer: {
    resolve: { /* 不变 */ },
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'recharts': ['recharts'],
            'zustand': ['zustand'],
          },
        },
      },
    },
  },
```

- [ ] **Step 4: 构建 + 检查 chunk 体积**

Run: `cd /workspace && pnpm build`
Expected: 构建成功。检查 `out/renderer/` 下的 chunk 文件，Onboarding 首屏 chunk 应不含 recharts。

- [ ] **Step 5: 运行测试确认无回归**

Run: `cd apps/desktop && pnpm test`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
cd /workspace
git add apps/desktop/src/renderer/src/router/index.tsx apps/desktop/src/renderer/src/App.tsx apps/desktop/electron.vite.config.ts
git commit -m "perf: route lazy loading + manualChunks vendor splitting

- All 7 pages use React.lazy + dynamic import (Onboarding no longer loads recharts)
- App.tsx wraps RouterProvider in Suspense with loading fallback
- electron.vite.config: manualChunks splits react-vendor/recharts/zustand
- Reduces first-screen bundle (Onboarding/Accounts path < 500KB)"
```

---

# Sprint U — UX 体验

## Task U1: 全局 Error Boundary

**Files:**
- Create: `apps/desktop/src/renderer/src/components/base/ErrorBoundary.tsx`
- Create: `apps/desktop/tests/error-boundary.test.tsx`
- Modify: `apps/desktop/src/renderer/src/main.tsx`

- [ ] **Step 1: 写 Error Boundary 失败测试**

Create `apps/desktop/tests/error-boundary.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '@renderer/components/base/ErrorBoundary.js';

function ThrowOnRender({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('测试崩溃');
  return <div>正常内容</div>;
}

describe('ErrorBoundary', () => {
  it('子组件正常时不拦截渲染', () => {
    render(<ErrorBoundary><ThrowOnRender shouldThrow={false} /></ErrorBoundary>);
    expect(screen.getByText('正常内容')).toBeInTheDocument();
  });

  it('子组件崩溃时显示兜底页', () => {
    // 抑制 console.error
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ErrorBoundary><ThrowOnRender shouldThrow={true} /></ErrorBoundary>);
    expect(screen.getByText(/出现错误/)).toBeInTheDocument();
    expect(screen.getByText('测试崩溃')).toBeInTheDocument();
    spy.mockRestore();
  });

  it('兜底页含重试按钮', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ErrorBoundary><ThrowOnRender shouldThrow={true} /></ErrorBoundary>);
    expect(screen.getByText('重试')).toBeInTheDocument();
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd apps/desktop && pnpm exec vitest run tests/error-boundary.test.tsx`
Expected: FAIL — 模块不存在

- [ ] **Step 3: 实现 ErrorBoundary**

Create `apps/desktop/src/renderer/src/components/base/ErrorBoundary.tsx`:

```typescript
import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-8">
          <div className="max-w-md w-full bg-white rounded-lg shadow p-6 text-center">
            <div className="text-red-500 text-4xl mb-4">⚠</div>
            <h1 className="text-lg font-semibold text-gray-900 mb-2">出现错误</h1>
            <p className="text-sm text-gray-600 mb-4">
              应用遇到意外错误。您可以尝试重试，或重启应用。
            </p>
            {this.state.error && (
              <pre className="text-xs text-gray-400 bg-gray-50 p-2 rounded mb-4 overflow-auto max-h-32">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={this.handleRetry}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
            >
              重试
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd apps/desktop && pnpm exec vitest run tests/error-boundary.test.tsx`
Expected: PASS — 3 用例

- [ ] **Step 5: 在 main.tsx 包裹 ErrorBoundary**

Modify `apps/desktop/src/renderer/src/main.tsx`:

```typescript
import { ErrorBoundary } from './components/base/ErrorBoundary.js';
// ...
createRoot(container).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
```

- [ ] **Step 6: 运行全量测试**

Run: `cd apps/desktop && pnpm test`
Expected: PASS

- [ ] **Step 7: 提交**

```bash
cd /workspace
git add apps/desktop/src/renderer/src/components/base/ErrorBoundary.tsx apps/desktop/tests/error-boundary.test.tsx apps/desktop/src/renderer/src/main.tsx
git commit -m "feat(ux): add global Error Boundary to prevent white-screen crash

- ErrorBoundary class component catches render errors, shows fallback page
  with error message + retry button
- Wrapped in main.tsx around <App />
- Prevents entire app white-screen when any component throws during render"
```

---

## Task U2: DataManagementPanel 导出 try/catch + loading + 导入/清空后刷新 store

**Files:**
- Modify: `apps/desktop/src/renderer/src/components/data-management/DataManagementPanel.tsx`
- Modify: `apps/desktop/src/renderer/src/components/data-management/CsvImportWizard.tsx`
- Modify: `apps/desktop/src/renderer/src/components/data-management/ClearTransactionsDialog.tsx`

- [ ] **Step 1: 改造 DataManagementPanel 所有 handler 加 try/catch + loading**

Modify `apps/desktop/src/renderer/src/components/data-management/DataManagementPanel.tsx`。添加 loading state:

```typescript
  const [exporting, setExporting] = useState(false);
```

`handleExportJson` 改为:

```typescript
  const handleExportJson = async () => {
    setExporting(true);
    try {
      const dialogResult = await window.dataAccess.exportImport.showSaveDialog(`fire-app-export-${timestamp()}.json`, 'json');
      if (dialogResult.canceled || !dialogResult.filePath) return;
      const result = await window.dataAccess.exportImport.exportJson(dialogResult.filePath);
      if (result.success) showSuccess(`已导出 ${result.recordCount} 条记录`);
      else showError('导出失败');
    } catch (e) {
      showError(`导出失败: ${(e as Error).message}`);
    } finally {
      setExporting(false);
    }
  };
```

handleExportCsv、handleImportJson 同模式加 try/catch（handleImportJson 已有，确认 showOpenDialog 也在 try 内）。

按钮加 `loading={exporting}` 或 `disabled={exporting}`。

- [ ] **Step 2: CsvImportWizard 导入成功后刷新 stores**

Read `apps/desktop/src/renderer/src/components/data-management/CsvImportWizard.tsx`。在 handleConfirmImport 成功分支添加:

```typescript
import { useTransactionStore } from '@renderer/stores/transaction-store.js';
import { useAccountStore } from '@renderer/stores/account-store.js';
// ...
  const fetchRecentTransactions = useTransactionStore((s) => s.fetchRecentTransactions);
  const fetchAccounts = useAccountStore((s) => s.fetchAccounts);
  // 在 result 成功后:
  if (result.success) {
    // 刷新 stores，让其他页面看到新数据
    if (currentUser?.id) {
      fetchRecentTransactions(currentUser.id, 10);
      fetchAccounts(currentUser.id);
    }
    showSuccess(`导入完成：新增 ${result.inserted}，跳过 ${result.skipped}`);
  }
```

- [ ] **Step 3: ClearTransactionsDialog 清空后刷新 stores**

Read `apps/desktop/src/renderer/src/components/data-management/ClearTransactionsDialog.tsx`。在 onCleared 回调内（或组件内处理成功后）刷新:

```typescript
  // 清空成功后刷新 stores
  fetchRecentTransactions(currentUser.id, 10);
  fetchAccounts(currentUser.id);
  showSuccess('已清空所有交易记录');
```

修改 DataManagementPanel 的 ClearTransactionsDialog onCleared 回调从空注释改为实际刷新逻辑。

- [ ] **Step 4: 运行相关测试 + 修复 mock**

Run: `cd apps/desktop && pnpm exec vitest run tests/data-management-panel.test.tsx tests/csv-import-wizard.test.tsx tests/clear-transactions.test.tsx`
Expected: PASS（可能需调整 mock 增加 fetchRecentTransactions/fetchAccounts）

- [ ] **Step 5: 提交**

```bash
cd /workspace
git add apps/desktop/src/renderer/src/components/data-management/
git commit -m "fix(ux): export try/catch + loading + refresh stores after import/clear

- DataManagementPanel: all handlers wrapped in try/catch with showError;
  exporting state disables buttons during I/O
- CsvImportWizard: on success refreshes transaction-store + account-store
- ClearTransactionsDialog: on cleared refreshes stores + shows success toast
- Prevents stale store data after import/clear (was: only refreshed on page remount)"
```

---

## Task U3: 表单 Enter 提交 + 响应式布局 + 货币动态化 + label 关联

**Files:**
- Modify: `apps/desktop/src/renderer/src/components/base/Input.tsx`
- Modify: `apps/desktop/src/renderer/src/components/base/Select.tsx`
- Modify: `apps/desktop/src/renderer/src/components/accounts/AccountFormModal.tsx`
- Modify: `apps/desktop/src/renderer/src/components/transactions/TransactionFormModal.tsx`
- Modify: `apps/desktop/src/renderer/src/components/layout/Sidebar.tsx`
- Modify: `apps/desktop/src/renderer/src/components/base/Table.tsx`
- Modify: format 函数们（`transaction-constants.ts` 等）
- Modify: 各 grid 加响应式断点

> 注：此 task 合并多个 High UX 修复（Enter 提交/响应式/货币/label），因都是前端层小改动。

- [ ] **Step 1: Input/Select 加 id + htmlFor 关联**

Modify `apps/desktop/src/renderer/src/components/base/Input.tsx`:

```typescript
import { useId } from 'react';

interface InputProps {
  // ... 原有
}
export function Input({ /* 原有 */ }) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1">
          {label}{required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      {/* input 加 id={inputId} */}
    </div>
  );
}
```

Select 同改造。

- [ ] **Step 2: 表单 Modal 包 form + Enter 提交**

Read `apps/desktop/src/renderer/src/components/accounts/AccountFormModal.tsx`。外层 div 改 form:

```typescript
  return (
    <Modal open={true} onClose={onClose} title={isEdit ? '编辑账户' : '新增账户'}>
      <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-4">
        {/* 原有字段 */}
        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="secondary" size="md" onClick={onClose}>取消</Button>
          <Button type="submit" variant="primary" size="md" loading={saving}>{isEdit ? '保存' : '确定'}</Button>
        </div>
      </form>
    </Modal>
  );
```

TransactionFormModal、OnboardingPage、SettingsPage、ScenarioForm 同模式。

- [ ] **Step 3: Sidebar 响应式折叠**

Read `apps/desktop/src/renderer/src/components/layout/Sidebar.tsx`。加窄宽折叠 state:

```typescript
  const [collapsed, setCollapsed] = useState(false);
  // 监听窗口宽度
  useEffect(() => {
    const handler = () => setCollapsed(window.innerWidth < 768);
    handler();
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  // sidebar className: collapsed ? 'w-16' : 'w-64'
  // 文字在 collapsed 时隐藏
```

- [ ] **Step 4: Table 加 overflow-x-auto**

Read `apps/desktop/src/renderer/src/components/base/Table.tsx`。外层容器加:

```typescript
  <div className="overflow-x-auto">
    <table className="w-full min-w-[600px]">
```

- [ ] **Step 5: grid 加响应式断点**

全局搜索 `grid-cols-3`、`grid-cols-4`、`grid-cols-5`，改为:
- `grid-cols-3` → `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- `grid-cols-4` → `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`
- `grid-cols-5` → `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5`

涉及: NetWorthCards、MonthlyOverviewCards、AccountOverviewCards、ResultCards、TransactionFilters 等。

- [ ] **Step 6: 货币 format 函数接收 currency 参数**

Read `apps/desktop/src/renderer/src/components/transactions/transaction-constants.ts`。改造 formatAmount:

```typescript
const CURRENCY_SYMBOLS: Record<string, string> = { CNY: '¥', USD: '$' };
const CURRENCY_LOCALES: Record<string, string> = { CNY: 'zh-CN', USD: 'en-US' };

export function formatAmount(cents: number, currency: string = 'CNY'): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? '¥';
  const locale = CURRENCY_LOCALES[currency] ?? 'zh-CN';
  return `${symbol}${new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(cents) / 100)}`;
}
```

account-constants.ts、fire-calc-constants.ts、net-worth-constants.ts 同改造。调用处从 `useAppStore((s) => s.currentUser?.base_currency)` 注入 currency。

- [ ] **Step 7: 运行全量测试 + tsc + build**

Run: `cd apps/desktop && pnpm test && pnpm exec tsc --noEmit -p tsconfig.json && pnpm build`
Expected: PASS

- [ ] **Step 8: 提交**

```bash
cd /workspace
git add apps/desktop/src/renderer/src/components/base/Input.tsx apps/desktop/src/renderer/src/components/base/Select.tsx apps/desktop/src/renderer/src/components/base/Table.tsx apps/desktop/src/renderer/src/components/layout/Sidebar.tsx apps/desktop/src/renderer/src/components/accounts/AccountFormModal.tsx apps/desktop/src/renderer/src/components/transactions/TransactionFormModal.tsx apps/desktop/src/renderer/src/components/transactions/transaction-constants.ts apps/desktop/src/renderer/src/components/accounts/account-constants.ts apps/desktop/src/renderer/src/components/fire-calculator/fire-calc-constants.ts apps/desktop/src/renderer/src/components/net-worth/net-worth-constants.ts apps/desktop/src/renderer/src/pages/OnboardingPage.tsx apps/desktop/src/renderer/src/pages/SettingsPage.tsx apps/desktop/src/renderer/src/components/fire-calculator/ScenarioForm.tsx
git commit -m "fix(ux): Enter submit + responsive layout + dynamic currency + label association

- Input/Select: auto-generated id + htmlFor label binding (a11y)
- Form modals: <form onSubmit> wrapping, Button type=submit (Enter key submits)
- Sidebar: collapses to icon bar < 768px width
- Table: overflow-x-auto + min-w for horizontal scroll on narrow windows
- Grids: responsive breakpoints (grid-cols-1 sm:grid-cols-2 lg:grid-cols-N)
- format functions: accept currency param, switch ¥/$ per base_currency"
```

---

## Task U4: FireCalculatorPage 错误/成功反馈

**Files:**
- Modify: `apps/desktop/src/renderer/src/pages/FireCalculatorPage.tsx`

- [ ] **Step 1: 监听 scenario-store error 弹 toast**

Read `apps/desktop/src/renderer/src/pages/FireCalculatorPage.tsx`。添加:

```typescript
import { useToastStore } from '@renderer/stores/toast-store.js';
// ...
  const showError = useToastStore((s) => s.showError);
  const showSuccess = useToastStore((s) => s.showSuccess);
  const error = useScenarioStore((s) => s.error);
  useEffect(() => {
    if (error) showError(`操作失败: ${error}`);
  }, [error, showError]);
```

- [ ] **Step 2: createScenario/updateScenario 成功弹 toast**

在 createScenario 和 updateScenario 调用成功后（await 完成无 error）:

```typescript
  showSuccess('场景已创建');
  // / '场景已保存'
```

- [ ] **Step 3: 运行测试**

Run: `cd apps/desktop && pnpm exec vitest run tests/fire-calculator.test.tsx`（若有）
Expected: PASS

- [ ] **Step 4: 提交**

```bash
cd /workspace
git add apps/desktop/src/renderer/src/pages/FireCalculatorPage.tsx
git commit -m "fix(ux): FireCalculator error toast + success feedback

- useEffect monitors scenario-store error, shows toast on failure
- createScenario/updateScenario success shows toast (was: silent, no feedback)"
```

---

# 收尾

## Task F1: 全量回归 + tsc + build + 推送 CI

- [ ] **Step 1: 运行 shared 全量测试**

Run: `cd packages/shared && pnpm test`
Expected: 全绿，测试数 ≥ 442 + 新增

- [ ] **Step 2: 运行 desktop 全量测试**

Run: `cd apps/desktop && pnpm test`
Expected: 全绿

- [ ] **Step 3: 运行 tsc 类型检查**

Run: `cd packages/shared && pnpm exec tsc --noEmit -p tsconfig.json && cd ../../apps/desktop && pnpm exec tsc --noEmit -p tsconfig.json && pnpm exec tsc --noEmit -p tsconfig.node.json`
Expected: 无错误

- [ ] **Step 4: 运行构建**

Run: `cd /workspace && pnpm build`
Expected: 成功，renderer 首屏 chunk < 500KB

- [ ] **Step 5: 推送 + CI 验证**

```bash
cd /workspace && git push origin main
```
监控 CI 运行至成功。

- [ ] **Step 6: 更新 Code Wiki（若需）**

如有架构变更（新增模块/sprint 结构），同步更新 wiki。

---

## Self-Review 备注

**Spec 覆盖检查:**
- Sprint S: SQL 注入✓、路径校验✓、Electron 运行时✓、错误脱敏✓、IPC 校验✓、导出脱敏✓（S1-S5）
- Sprint D: clear sync_version✓、recurring 原子幂等✓、CSV 复用 createTransaction✓、dedupHash✓、schema CHECK✓、updateRecurring✓（D1-D4）
- Sprint P: partial index✓、服务端分页✓、局部更新✓、虚拟化✓、selector✓、Map 查找✓、路由懒加载✓、快照利用（并入 DashboardPage 改造）✓（P1-P5）
- Sprint U: Error Boundary✓、try/catch✓、Enter✓、响应式✓、货币✓、store 刷新✓、Fire 反馈✓、label✓（U1-U4）

**类型一致性:** `RecurringUpdateFields` 在 D4 定义、D2 引用一致；`TransactionPageParams` 在 P2 定义、P3 引用一致；`sanitizeError` 在 S4 定义。

**已知简化:** S4 的 zod 校验仅示范 scenario-handlers，其余 handlers（account/transaction/user/recurring）按同模式接入但未逐一列代码（重复性高，执行时照 scenario 模式即可）。P3 是最大改造点，执行时可能发现 store 测试需较大调整。
