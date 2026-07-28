# FIRE计算APP 用户数据模型 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 FIRE 计算APP 的用户数据模型层，包含7张核心表的数据库 schema、CRUD 操作、事务强一致的交易余额管理、经常性交易引擎、净资产快照生成和 FIRE 投影计算引擎。

**Architecture:** TypeScript + better-sqlite3（同步SQLite驱动，事务支持完善）+ Vitest。数据模型按领域分层：工具层（money/time/sync）→ 数据库层（connection/schema）→ 模型层（7张表CRUD）→ 服务层（交易事务/经常性引擎/快照生成/FIRE计算）。

**Tech Stack:** TypeScript 5.x, Node.js 20+, better-sqlite3, Vitest, uuid

**Spec:** `docs/superpowers/specs/2026-07-12-fire-app-user-data-model-design.md`

---

## File Structure

```
fire-app/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── utils/
│   │   ├── money.ts          # 分↔元转换
│   │   ├── time.ts           # 时间戳工具
│   │   └── sync.ts           # 同步元数据工具（LWW）
│   ├── db/
│   │   ├── connection.ts     # SQLite连接管理
│   │   └── schema.ts         # 7张表DDL + 索引
│   ├── types/
│   │   └── index.ts          # 所有实体TypeScript接口
│   ├── models/
│   │   ├── user.ts           # 用户CRUD
│   │   ├── category.ts       # 分类CRUD + 种子数据
│   │   ├── account.ts        # 账户CRUD
│   │   ├── transaction.ts    # 交易CRUD（不含余额逻辑）
│   │   ├── recurring.ts      # 经常性交易CRUD
│   │   ├── snapshot.ts       # 快照CRUD
│   │   └── scenario.ts       # FIRE场景CRUD
│   └── services/
│       ├── transaction-service.ts  # 交易写入/编辑/删除 + 余额事务
│       ├── recurring-service.ts    # 经常性交易生成引擎
│       ├── snapshot-service.ts     # 月度快照生成
│       └── fire-calc.ts           # FIRE投影计算引擎
├── tests/
│   ├── utils/
│   │   ├── money.test.ts
│   │   ├── time.test.ts
│   │   └── sync.test.ts
│   ├── db/
│   │   └── schema.test.ts
│   ├── models/
│   │   ├── user.test.ts
│   │   ├── category.test.ts
│   │   ├── account.test.ts
│   │   ├── transaction.test.ts
│   │   ├── recurring.test.ts
│   │   ├── snapshot.test.ts
│   │   └── scenario.test.ts
│   ├── services/
│   │   ├── transaction-service.test.ts
│   │   ├── recurring-service.test.ts
│   │   ├── snapshot-service.test.ts
│   │   └── fire-calc.test.ts
│   └── integration/
│       └── workflow.test.ts
└── data/                     # SQLite数据库文件目录（gitignore）
```

---

## Task 1: 项目初始化

**Files:**
- Create: `fire-app/package.json`
- Create: `fire-app/tsconfig.json`
- Create: `fire-app/vitest.config.ts`
- Create: `fire-app/.gitignore`

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "fire-app",
  "version": "0.1.0",
  "description": "FIRE计算APP — 用户数据模型",
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "better-sqlite3": "^11.0.0",
    "uuid": "^10.0.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.10",
    "@types/node": "^20.14.0",
    "@types/uuid": "^10.0.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: 创建 vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
  },
});
```

- [ ] **Step 4: 创建 .gitignore**

```
node_modules/
dist/
data/*.db
data/*.db-journal
```

- [ ] **Step 5: 安装依赖**

Run: `cd fire-app && npm install`
Expected: 依赖安装成功，无错误

- [ ] **Step 6: 验证项目结构**

Run: `cd fire-app && npx vitest run --reporter=verbose 2>&1 | head -5`
Expected: 输出 "No test files found" 或类似（表示vitest可运行）

- [ ] **Step 7: 提交**

```bash
cd fire-app
git init
git add .
git commit -m "chore: 项目初始化 — TypeScript + better-sqlite3 + Vitest"
```

---

## Task 2: 金额工具函数 (money.ts)

**Files:**
- Create: `fire-app/src/utils/money.ts`
- Test: `fire-app/tests/utils/money.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// tests/utils/money.test.ts
import { describe, it, expect } from 'vitest';
import { yuanToCents, centsToYuan, basisPointsToDecimal } from '../../src/utils/money.js';

describe('money utils', () => {
  it('yuanToCents: 1234.56元 → 123456分', () => {
    expect(yuanToCents(1234.56)).toBe(123456);
  });

  it('yuanToCents: 0元 → 0分', () => {
    expect(yuanToCents(0)).toBe(0);
  });

  it('yuanToCents: 四舍五入到分', () => {
    expect(yuanToCents(1.005)).toBe(101);
  });

  it('centsToYuan: 123456分 → 1234.56元', () => {
    expect(centsToYuan(123456)).toBe(1234.56);
  });

  it('centsToYuan: 0分 → 0元', () => {
    expect(centsToYuan(0)).toBe(0);
  });

  it('basisPointsToDecimal: 350基点 → 0.035', () => {
    expect(basisPointsToDecimal(350)).toBe(0.035);
  });

  it('basisPointsToDecimal: 700基点 → 0.07', () => {
    expect(basisPointsToDecimal(700)).toBe(0.07);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd fire-app && npx vitest run tests/utils/money.test.ts`
Expected: FAIL — 模块不存在

- [ ] **Step 3: 实现最小代码**

```typescript
// src/utils/money.ts

/**
 * 元转分（金额存储为整数分，避免浮点误差）
 */
export function yuanToCents(yuan: number): number {
  return Math.round(Math.round(yuan * 1000) / 10);
}

/**
 * 分转元（用于UI展示）
 */
export function centsToYuan(cents: number): number {
  return cents / 100;
}

/**
 * 基点转小数（利率字段存储为基点整数，如350=3.5%）
 * 100基点 = 1%，所以 350基点 = 0.035
 */
export function basisPointsToDecimal(basisPoints: number): number {
  return basisPoints / 10000;
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `cd fire-app && npx vitest run tests/utils/money.test.ts`
Expected: PASS — 7个测试全部通过

- [ ] **Step 5: 提交**

```bash
cd fire-app
git add src/utils/money.ts tests/utils/money.test.ts
git commit -m "feat: 金额工具函数 — 元分转换 + 基点转换"
```

---

## Task 3: 时间工具函数 (time.ts)

**Files:**
- Create: `fire-app/src/utils/time.ts`
- Test: `fire-app/tests/utils/time.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// tests/utils/time.test.ts
import { describe, it, expect } from 'vitest';
import { nowMs, toYearMonth, addMonths, monthsBetween } from '../../src/utils/time.js';

describe('time utils', () => {
  it('nowMs: 返回当前毫秒时间戳', () => {
    const before = Date.now();
    const result = nowMs();
    const after = Date.now();
    expect(result).toBeGreaterThanOrEqual(before);
    expect(result).toBeLessThanOrEqual(after);
  });

  it('toYearMonth: 从时间戳提取 YYYY-MM', () => {
    // 2026-07-13 00:00:00 UTC
    const ts = Date.UTC(2026, 6, 13);
    expect(toYearMonth(ts)).toBe('2026-07');
  });

  it('toYearMonth: 不同月份', () => {
    // 2026-01-01 00:00:00 UTC
    const ts = Date.UTC(2026, 0, 1);
    expect(toYearMonth(ts)).toBe('2026-01');
  });

  it('addMonths: 在时间戳上加N个月', () => {
    // 2026-01-15 00:00:00 UTC
    const ts = Date.UTC(2026, 0, 15);
    const result = addMonths(ts, 3);
    // 2026-04-15
    expect(toYearMonth(result)).toBe('2026-04');
  });

  it('addMonths: 跨年', () => {
    const ts = Date.UTC(2026, 10, 15);
    const result = addMonths(ts, 3);
    expect(toYearMonth(result)).toBe('2027-02');
  });

  it('monthsBetween: 计算两个月时间戳间的月数', () => {
    const start = Date.UTC(2026, 0, 1);
    const end = Date.UTC(2026, 6, 1);
    expect(monthsBetween(start, end)).toBe(6);
  });

  it('monthsBetween: 跨年', () => {
    const start = Date.UTC(2026, 0, 1);
    const end = Date.UTC(2028, 5, 1);
    expect(monthsBetween(start, end)).toBe(29);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd fire-app && npx vitest run tests/utils/time.test.ts`
Expected: FAIL — 模块不存在

- [ ] **Step 3: 实现最小代码**

```typescript
// src/utils/time.ts

/**
 * 当前Unix时间戳（毫秒）
 */
export function nowMs(): number {
  return Date.now();
}

/**
 * 从毫秒时间戳提取 "YYYY-MM" 格式字符串
 */
export function toYearMonth(timestampMs: number): string {
  const date = new Date(timestampMs);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * 在时间戳上增加N个月，返回新的时间戳
 * 保持日历日不变（如1月15日 + 3月 = 4月15日）
 */
export function addMonths(timestampMs: number, months: number): number {
  const date = new Date(timestampMs);
  const day = date.getUTCDate();
  date.setUTCMonth(date.getUTCMonth() + months);
  // 处理月末溢出（如1月31日 + 1月 = 3月3日 → 修正为2月28/29日）
  if (date.getUTCDate() < day) {
    date.setUTCDate(0); // 回退到上月最后一天
  }
  return date.getTime();
}

/**
 * 计算两个时间戳之间的月数差（向上取整到完整月）
 */
export function monthsBetween(startMs: number, endMs: number): number {
  const start = new Date(startMs);
  const end = new Date(endMs);
  const yearDiff = end.getUTCFullYear() - start.getUTCFullYear();
  const monthDiff = end.getUTCMonth() - start.getUTCMonth();
  return yearDiff * 12 + monthDiff;
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `cd fire-app && npx vitest run tests/utils/time.test.ts`
Expected: PASS — 7个测试全部通过

- [ ] **Step 5: 提交**

```bash
cd fire-app
git add src/utils/time.ts tests/utils/time.test.ts
git commit -m "feat: 时间工具函数 — 时间戳/年月/月运算"
```

---

## Task 4: 同步元数据工具 (sync.ts)

**Files:**
- Create: `fire-app/src/utils/sync.ts`
- Test: `fire-app/tests/utils/sync.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// tests/utils/sync.test.ts
import { describe, it, expect } from 'vitest';
import { createSyncMeta, shouldRemoteWin, bumpSyncVersion } from '../../src/utils/sync.js';

describe('sync utils', () => {
  it('createSyncMeta: 返回初始同步元数据', () => {
    const meta = createSyncMeta();
    expect(meta.sync_version).toBe(0);
    expect(meta.deleted_flag).toBe(0);
    expect(meta.updated_at).toBeGreaterThan(0);
  });

  it('bumpSyncVersion: 版本号+1并更新时间戳', async () => {
    const before = createSyncMeta();
    // 确保时间戳不同
    await new Promise(r => setTimeout(r, 10));
    const after = bumpSyncVersion(before);
    expect(after.sync_version).toBe(before.sync_version + 1);
    expect(after.updated_at).toBeGreaterThanOrEqual(before.updated_at);
  });

  it('shouldRemoteWin: 远程更新时间更晚 → true', () => {
    const local = { updated_at: 1000, sync_version: 1, deleted_flag: 0 };
    const remote = { updated_at: 2000, sync_version: 2, deleted_flag: 0 };
    expect(shouldRemoteWin(local, remote)).toBe(true);
  });

  it('shouldRemoteWin: 本地更新时间更晚 → false', () => {
    const local = { updated_at: 2000, sync_version: 2, deleted_flag: 0 };
    const remote = { updated_at: 1000, sync_version: 1, deleted_flag: 0 };
    expect(shouldRemoteWin(local, remote)).toBe(false);
  });

  it('shouldRemoteWin: 时间相同 → 远程胜（避免死锁）', () => {
    const local = { updated_at: 1000, sync_version: 1, deleted_flag: 0 };
    const remote = { updated_at: 1000, sync_version: 2, deleted_flag: 0 };
    expect(shouldRemoteWin(local, remote)).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd fire-app && npx vitest run tests/utils/sync.test.ts`
Expected: FAIL — 模块不存在

- [ ] **Step 3: 实现最小代码**

```typescript
// src/utils/sync.ts
import { nowMs } from './time.js';

export interface SyncMeta {
  updated_at: number;
  sync_version: number;
  deleted_flag: number;
}

/**
 * 创建初始同步元数据（新记录）
 */
export function createSyncMeta(): SyncMeta {
  return {
    updated_at: nowMs(),
    sync_version: 0,
    deleted_flag: 0,
  };
}

/**
 * 更新记录时递增同步版本号并刷新时间戳
 */
export function bumpSyncVersion(current: SyncMeta): SyncMeta {
  return {
    updated_at: nowMs(),
    sync_version: current.sync_version + 1,
    deleted_flag: current.deleted_flag,
  };
}

/**
 * LWW 冲突解决：判断远程记录是否应该覆盖本地
 * 规则：remote.updated_at >= local.updated_at 时远程胜
 */
export function shouldRemoteWin(local: SyncMeta, remote: SyncMeta): boolean {
  return remote.updated_at >= local.updated_at;
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `cd fire-app && npx vitest run tests/utils/sync.test.ts`
Expected: PASS — 5个测试全部通过

- [ ] **Step 5: 提交**

```bash
cd fire-app
git add src/utils/sync.ts tests/utils/sync.test.ts
git commit -m "feat: 同步元数据工具 — LWW冲突解决"
```

---

## Task 5: 数据库连接管理 (connection.ts)

**Files:**
- Create: `fire-app/src/db/connection.ts`
- Test: `fire-app/tests/db/connection.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// tests/db/connection.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, closeDatabase } from '../../src/db/connection.js';

describe('database connection', () => {
  let db: ReturnType<typeof createDatabase>;

  beforeEach(() => {
    db = createDatabase(':memory:');
  });

  afterEach(() => {
    closeDatabase(db);
  });

  it('createDatabase: 内存数据库可创建', () => {
    expect(db).toBeDefined();
    expect(db.open).toBe(true);
  });

  it('createDatabase: 可执行简单SQL', () => {
    db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
    db.prepare('INSERT INTO test (name) VALUES (?)').run('hello');
    const row = db.prepare('SELECT * FROM test WHERE id = 1').get() as { name: string };
    expect(row.name).toBe('hello');
  });

  it('createDatabase: 开启WAL模式（内存库回退到memory）', () => {
    // 内存数据库不支持WAL但不报错
    expect(db.open).toBe(true);
  });

  it('closeDatabase: 关闭后不可用', () => {
    closeDatabase(db);
    expect(db.open).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd fire-app && npx vitest run tests/db/connection.test.ts`
Expected: FAIL — 模块不存在

- [ ] **Step 3: 实现最小代码**

```typescript
// src/db/connection.ts
import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';

/**
 * 创建数据库连接
 * @param path 数据库文件路径，':memory:' 为内存数据库（用于测试）
 */
export function createDatabase(path: string = 'data/fire-app.db'): DatabaseType {
  const db = new Database(path);

  // 启用外键约束
  db.pragma('foreign_keys = ON');

  // 文件数据库开启WAL模式（内存数据库不支持WAL，会静默忽略）
  if (path !== ':memory:') {
    db.pragma('journal_mode = WAL');
  }

  return db;
}

/**
 * 关闭数据库连接
 */
export function closeDatabase(db: DatabaseType): void {
  if (db.open) {
    db.close();
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `cd fire-app && npx vitest run tests/db/connection.test.ts`
Expected: PASS — 4个测试全部通过

- [ ] **Step 5: 提交**

```bash
cd fire-app
git add src/db/connection.ts tests/db/connection.test.ts
git commit -m "feat: 数据库连接管理 — SQLite + WAL + 外键"
```

---

## Task 6: 数据库Schema — 全部7张表 (schema.ts)

**Files:**
- Create: `fire-app/src/db/schema.ts`
- Test: `fire-app/tests/db/schema.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// tests/db/schema.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, closeDatabase } from '../../src/db/connection.js';
import { initSchema, TABLE_NAMES } from '../../src/db/schema.js';
import type { Database as DatabaseType } from 'better-sqlite3';

describe('schema', () => {
  let db: DatabaseType;

  beforeEach(() => {
    db = createDatabase(':memory:');
    initSchema(db);
  });

  afterEach(() => {
    closeDatabase(db);
  });

  it('initSchema: 7张表全部创建', () => {
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all() as { name: string }[];
    const tableNames = tables.map(t => t.name);

    expect(tableNames).toContain('users');
    expect(tableNames).toContain('accounts');
    expect(tableNames).toContain('transactions');
    expect(tableNames).toContain('categories');
    expect(tableNames).toContain('recurring_transactions');
    expect(tableNames).toContain('net_worth_snapshots');
    expect(tableNames).toContain('fire_scenarios');
  });

  it('TABLE_NAMES: 包含所有7张表名', () => {
    expect(TABLE_NAMES).toHaveLength(7);
    expect(TABLE_NAMES).toContain('users');
    expect(TABLE_NAMES).toContain('accounts');
    expect(TABLE_NAMES).toContain('transactions');
    expect(TABLE_NAMES).toContain('categories');
    expect(TABLE_NAMES).toContain('recurring_transactions');
    expect(TABLE_NAMES).toContain('net_worth_snapshots');
    expect(TABLE_NAMES).toContain('fire_scenarios');
  });

  it('users表: 字段完整', () => {
    const cols = db.prepare("PRAGMA table_info('users')").all() as { name: string }[];
    const colNames = cols.map(c => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('display_name');
    expect(colNames).toContain('base_currency');
    expect(colNames).toContain('is_china_market');
    expect(colNames).toContain('default_withdrawal_rate');
    expect(colNames).toContain('default_expected_return');
    expect(colNames).toContain('default_inflation_rate');
    expect(colNames).toContain('encryption_key_hash');
    expect(colNames).toContain('last_sync_at');
    expect(colNames).toContain('sync_version');
    expect(colNames).toContain('updated_at');
    expect(colNames).toContain('deleted_flag');
  });

  it('accounts表: asset_class 和 account_type 字段存在', () => {
    const cols = db.prepare("PRAGMA table_info('accounts')").all() as { name: string }[];
    const colNames = cols.map(c => c.name);
    expect(colNames).toContain('asset_class');
    expect(colNames).toContain('account_type');
    expect(colNames).toContain('current_balance');
  });

  it('transactions表: transaction_type 和 to_account_id 字段存在', () => {
    const cols = db.prepare("PRAGMA table_info('transactions')").all() as { name: string }[];
    const colNames = cols.map(c => c.name);
    expect(colNames).toContain('transaction_type');
    expect(colNames).toContain('to_account_id');
    expect(colNames).toContain('recurring_id');
  });

  it('net_worth_snapshots表: snapshot_year_month 字段存在', () => {
    const cols = db.prepare("PRAGMA table_info('net_worth_snapshots')").all() as { name: string }[];
    const colNames = cols.map(c => c.name);
    expect(colNames).toContain('snapshot_year_month');
    expect(colNames).toContain('total_liquid');
    expect(colNames).toContain('total_invested');
    expect(colNames).toContain('total_use_asset');
    expect(colNames).toContain('total_liability');
    expect(colNames).toContain('net_worth');
  });

  it('fire_scenarios表: 完整参数字段', () => {
    const cols = db.prepare("PRAGMA table_info('fire_scenarios')").all() as { name: string }[];
    const colNames = cols.map(c => c.name);
    expect(colNames).toContain('current_age');
    expect(colNames).toContain('retirement_age');
    expect(colNames).toContain('auto_sync_assets');
    expect(colNames).toContain('monthly_savings');
    expect(colNames).toContain('annual_expenses');
    expect(colNames).toContain('withdrawal_rate');
    expect(colNames).toContain('post_retirement_monthly_income');
  });

  it('索引: transactions 表有4个索引', () => {
    const indexes = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='transactions'"
    ).all() as { name: string }[];
    const indexNames = indexes.map(i => i.name);
    expect(indexNames).toContain('idx_tx_user_date');
    expect(indexNames).toContain('idx_tx_account');
    expect(indexNames).toContain('idx_tx_category');
    expect(indexNames).toContain('idx_tx_recurring');
  });

  it('net_worth_snapshots: 唯一约束 (user_id, snapshot_year_month)', () => {
    // 插入第一条 → 成功
    db.prepare(`
      INSERT INTO net_worth_snapshots (id, user_id, snapshot_date, snapshot_year_month,
        total_liquid, total_invested, total_use_asset, total_liability, net_worth,
        sync_version, updated_at, deleted_flag)
      VALUES ('s1', 'u1', 1000, '2026-07', 100, 200, 300, -50, 550, 0, 1000, 0)
    `).run();

    // 插入同月第二条 → 应失败
    expect(() => {
      db.prepare(`
        INSERT INTO net_worth_snapshots (id, user_id, snapshot_date, snapshot_year_month,
          total_liquid, total_invested, total_use_asset, total_liability, net_worth,
          sync_version, updated_at, deleted_flag)
        VALUES ('s2', 'u1', 2000, '2026-07', 100, 200, 300, -50, 550, 0, 2000, 0)
      `).run();
    }).toThrow();
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd fire-app && npx vitest run tests/db/schema.test.ts`
Expected: FAIL — 模块不存在

- [ ] **Step 3: 实现最小代码**

```typescript
// src/db/schema.ts
import type { Database as DatabaseType } from 'better-sqlite3';

export const TABLE_NAMES = [
  'users',
  'accounts',
  'categories',
  'transactions',
  'recurring_transactions',
  'net_worth_snapshots',
  'fire_scenarios',
] as const;

const DDL_STATEMENTS: string[] = [
  // 1. users 表
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY NOT NULL,
    display_name TEXT NOT NULL,
    base_currency TEXT NOT NULL DEFAULT 'CNY',
    is_china_market INTEGER NOT NULL DEFAULT 1,
    default_withdrawal_rate INTEGER NOT NULL DEFAULT 350,
    default_expected_return INTEGER NOT NULL DEFAULT 700,
    default_inflation_rate INTEGER NOT NULL DEFAULT 300,
    encryption_key_hash TEXT,
    last_sync_at INTEGER,
    sync_version INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    deleted_flag INTEGER NOT NULL DEFAULT 0
  )`,

  // 2. accounts 表
  `CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    asset_class TEXT NOT NULL CHECK (asset_class IN ('liquid', 'invested', 'use_asset', 'liability')),
    account_type TEXT NOT NULL CHECK (account_type IN (
      'checking', 'savings', 'cash',
      'investment', 'retirement', 'fund',
      'real_estate', 'vehicle',
      'credit_card', 'loan', 'mortgage'
    )),
    current_balance INTEGER NOT NULL DEFAULT 0,
    last_updated INTEGER NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    note TEXT,
    sync_version INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    deleted_flag INTEGER NOT NULL DEFAULT 0
  )`,

  // 3. categories 表
  `CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id),
    parent_id TEXT REFERENCES categories(id),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    icon TEXT,
    color TEXT,
    linked_fire_concept TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_system INTEGER NOT NULL DEFAULT 0,
    sync_version INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    deleted_flag INTEGER NOT NULL DEFAULT 0
  )`,

  // 4. transactions 表
  `CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id),
    account_id TEXT NOT NULL REFERENCES accounts(id),
    to_account_id TEXT REFERENCES accounts(id),
    category_id TEXT REFERENCES categories(id),
    recurring_id TEXT REFERENCES recurring_transactions(id),
    transaction_type TEXT NOT NULL CHECK (transaction_type IN (
      'income', 'expense', 'transfer', 'initial_balance'
    )),
    amount INTEGER NOT NULL CHECK (amount > 0),
    transaction_date INTEGER NOT NULL,
    description TEXT,
    sync_version INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    deleted_flag INTEGER NOT NULL DEFAULT 0
  )`,

  // 5. recurring_transactions 表
  `CREATE TABLE IF NOT EXISTS recurring_transactions (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id),
    account_id TEXT NOT NULL REFERENCES accounts(id),
    to_account_id TEXT REFERENCES accounts(id),
    category_id TEXT REFERENCES categories(id),
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('income', 'expense', 'transfer')),
    amount INTEGER NOT NULL CHECK (amount > 0),
    frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
    interval INTEGER NOT NULL DEFAULT 1,
    start_date INTEGER NOT NULL,
    end_date INTEGER,
    next_due_date INTEGER NOT NULL CHECK (next_due_date >= start_date),
    last_generated_date INTEGER,
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    auto_create INTEGER NOT NULL DEFAULT 1,
    sync_version INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    deleted_flag INTEGER NOT NULL DEFAULT 0
  )`,

  // 6. net_worth_snapshots 表
  `CREATE TABLE IF NOT EXISTS net_worth_snapshots (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id),
    snapshot_date INTEGER NOT NULL,
    snapshot_year_month TEXT NOT NULL,
    total_liquid INTEGER NOT NULL,
    total_invested INTEGER NOT NULL,
    total_use_asset INTEGER NOT NULL,
    total_liability INTEGER NOT NULL,
    net_worth INTEGER NOT NULL,
    sync_version INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    deleted_flag INTEGER NOT NULL DEFAULT 0,
    UNIQUE(user_id, snapshot_year_month)
  )`,

  // 7. fire_scenarios 表
  `CREATE TABLE IF NOT EXISTS fire_scenarios (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    description TEXT,
    current_age INTEGER NOT NULL,
    retirement_age INTEGER NOT NULL CHECK (retirement_age > current_age),
    current_portfolio_value INTEGER NOT NULL DEFAULT 0,
    auto_sync_assets INTEGER NOT NULL DEFAULT 1,
    monthly_savings INTEGER NOT NULL DEFAULT 0,
    annual_expenses INTEGER NOT NULL,
    expected_return_rate INTEGER NOT NULL,
    inflation_rate INTEGER NOT NULL DEFAULT 300,
    withdrawal_rate INTEGER NOT NULL CHECK (withdrawal_rate BETWEEN 200 AND 600),
    retirement_years INTEGER NOT NULL DEFAULT 30,
    post_retirement_monthly_income INTEGER NOT NULL DEFAULT 0,
    is_china_market INTEGER NOT NULL DEFAULT 1,
    is_active INTEGER NOT NULL DEFAULT 1,
    sync_version INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    deleted_flag INTEGER NOT NULL DEFAULT 0
  )`,

  // 索引
  `CREATE INDEX IF NOT EXISTS idx_tx_user_date ON transactions(user_id, transaction_date DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_tx_account ON transactions(account_id, transaction_date DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(category_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tx_recurring ON transactions(recurring_id)`,
  `CREATE INDEX IF NOT EXISTS idx_acc_user ON accounts(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_cat_user ON categories(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_recur_user ON recurring_transactions(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_snap_user ON net_worth_snapshots(user_id, snapshot_date DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_fire_user ON fire_scenarios(user_id)`,
];

/**
 * 初始化数据库 schema（创建所有表和索引）
 */
export function initSchema(db: DatabaseType): void {
  for (const ddl of DDL_STATEMENTS) {
    db.exec(ddl);
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `cd fire-app && npx vitest run tests/db/schema.test.ts`
Expected: PASS — 9个测试全部通过

- [ ] **Step 5: 提交**

```bash
cd fire-app
git add src/db/schema.ts tests/db/schema.test.ts
git commit -m "feat: 数据库Schema — 7张表DDL + 索引 + 约束"
```

---

## Task 7: TypeScript类型定义 (types/index.ts)

**Files:**
- Create: `fire-app/src/types/index.ts`

- [ ] **Step 1: 实现类型定义**

```typescript
// src/types/index.ts

// ============= 枚举类型 =============

export type AssetClass = 'liquid' | 'invested' | 'use_asset' | 'liability';

export type AccountType =
  | 'checking' | 'savings' | 'cash'
  | 'investment' | 'retirement' | 'fund'
  | 'real_estate' | 'vehicle'
  | 'credit_card' | 'loan' | 'mortgage';

export type TransactionType = 'income' | 'expense' | 'transfer' | 'initial_balance';

export type CategoryType = 'income' | 'expense';

export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

// ============= 实体接口 =============

export interface User {
  id: string;
  display_name: string;
  base_currency: string;
  is_china_market: number;
  default_withdrawal_rate: number;
  default_expected_return: number;
  default_inflation_rate: number;
  encryption_key_hash: string | null;
  last_sync_at: number | null;
  sync_version: number;
  updated_at: number;
  deleted_flag: number;
}

export interface Account {
  id: string;
  user_id: string;
  name: string;
  asset_class: AssetClass;
  account_type: AccountType;
  current_balance: number;
  last_updated: number;
  display_order: number;
  note: string | null;
  sync_version: number;
  updated_at: number;
  deleted_flag: number;
}

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  recurring_id: string | null;
  transaction_type: TransactionType;
  amount: number;
  transaction_date: number;
  description: string | null;
  sync_version: number;
  updated_at: number;
  deleted_flag: number;
}

export interface Category {
  id: string;
  user_id: string;
  parent_id: string | null;
  name: string;
  type: CategoryType;
  icon: string | null;
  color: string | null;
  linked_fire_concept: string | null;
  display_order: number;
  is_system: number;
  sync_version: number;
  updated_at: number;
  deleted_flag: number;
}

export interface RecurringTransaction {
  id: string;
  user_id: string;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  transaction_type: TransactionType;
  amount: number;
  frequency: Frequency;
  interval: number;
  start_date: number;
  end_date: number | null;
  next_due_date: number;
  last_generated_date: number | null;
  description: string | null;
  is_active: number;
  auto_create: number;
  sync_version: number;
  updated_at: number;
  deleted_flag: number;
}

export interface NetWorthSnapshot {
  id: string;
  user_id: string;
  snapshot_date: number;
  snapshot_year_month: string;
  total_liquid: number;
  total_invested: number;
  total_use_asset: number;
  total_liability: number;
  net_worth: number;
  sync_version: number;
  updated_at: number;
  deleted_flag: number;
}

export interface FireScenario {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  current_age: number;
  retirement_age: number;
  current_portfolio_value: number;
  auto_sync_assets: number;
  monthly_savings: number;
  annual_expenses: number;
  expected_return_rate: number;
  inflation_rate: number;
  withdrawal_rate: number;
  retirement_years: number;
  post_retirement_monthly_income: number;
  is_china_market: number;
  is_active: number;
  sync_version: number;
  updated_at: number;
  deleted_flag: number;
}
```

- [ ] **Step 2: 验证编译**

Run: `cd fire-app && npx tsc --noEmit`
Expected: 无编译错误

- [ ] **Step 3: 提交**

```bash
cd fire-app
git add src/types/index.ts
git commit -m "feat: TypeScript类型定义 — 7张表实体接口"
```

---

## Task 8: 用户模型 CRUD (user.ts)

**Files:**
- Create: `fire-app/src/models/user.ts`
- Test: `fire-app/tests/models/user.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// tests/models/user.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, closeDatabase } from '../../src/db/connection.js';
import { initSchema } from '../../src/db/schema.js';
import { createUser, getUser, updateUser } from '../../src/models/user.js';
import type { Database as DatabaseType } from 'better-sqlite3';

describe('user model', () => {
  let db: DatabaseType;
  const userId = 'test-user-id';

  beforeEach(() => {
    db = createDatabase(':memory:');
    initSchema(db);
  });

  afterEach(() => {
    closeDatabase(db);
  });

  it('createUser: 创建用户记录', () => {
    const user = createUser(db, { id: userId, display_name: '测试用户' });
    expect(user.id).toBe(userId);
    expect(user.display_name).toBe('测试用户');
    expect(user.base_currency).toBe('CNY');
    expect(user.is_china_market).toBe(1);
    expect(user.default_withdrawal_rate).toBe(350);
    expect(user.default_expected_return).toBe(700);
    expect(user.default_inflation_rate).toBe(300);
    expect(user.sync_version).toBe(0);
    expect(user.deleted_flag).toBe(0);
  });

  it('createUser: 非中国市场 → 默认提现率400', () => {
    const user = createUser(db, { id: userId, display_name: '全球用户', is_china_market: 0 });
    expect(user.default_withdrawal_rate).toBe(400);
  });

  it('getUser: 读取用户记录', () => {
    createUser(db, { id: userId, display_name: '测试用户' });
    const user = getUser(db, userId);
    expect(user).not.toBeNull();
    expect(user!.display_name).toBe('测试用户');
  });

  it('getUser: 不存在的用户 → null', () => {
    const user = getUser(db, 'nonexistent');
    expect(user).toBeNull();
  });

  it('updateUser: 修改显示名称', () => {
    createUser(db, { id: userId, display_name: '旧名称' });
    const updated = updateUser(db, userId, { display_name: '新名称' });
    expect(updated.display_name).toBe('新名称');
    expect(updated.sync_version).toBe(1);
  });

  it('updateUser: 修改FIRE偏好', () => {
    createUser(db, { id: userId, display_name: '测试' });
    const updated = updateUser(db, userId, {
      default_withdrawal_rate: 400,
      default_expected_return: 500,
    });
    expect(updated.default_withdrawal_rate).toBe(400);
    expect(updated.default_expected_return).toBe(500);
    expect(updated.sync_version).toBe(1);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd fire-app && npx vitest run tests/models/user.test.ts`
Expected: FAIL — 模块不存在

- [ ] **Step 3: 实现最小代码**

```typescript
// src/models/user.ts
import type { Database as DatabaseType } from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { nowMs } from '../utils/time.js';
import type { User } from '../types/index.js';

export interface CreateUserInput {
  id?: string;
  display_name: string;
  base_currency?: string;
  is_china_market?: number;
  default_withdrawal_rate?: number;
  default_expected_return?: number;
  default_inflation_rate?: number;
}

export interface UpdateUserInput {
  display_name?: string;
  base_currency?: string;
  is_china_market?: number;
  default_withdrawal_rate?: number;
  default_expected_return?: number;
  default_inflation_rate?: number;
  encryption_key_hash?: string | null;
  last_sync_at?: number | null;
}

export function createUser(db: DatabaseType, input: CreateUserInput): User {
  const id = input.id ?? uuidv4();
  const isChina = input.is_china_market ?? 1;
  const now = nowMs();

  const user: User = {
    id,
    display_name: input.display_name,
    base_currency: input.base_currency ?? 'CNY',
    is_china_market: isChina,
    default_withdrawal_rate: input.default_withdrawal_rate ?? (isChina ? 350 : 400),
    default_expected_return: input.default_expected_return ?? 700,
    default_inflation_rate: input.default_inflation_rate ?? 300,
    encryption_key_hash: null,
    last_sync_at: null,
    sync_version: 0,
    updated_at: now,
    deleted_flag: 0,
  };

  db.prepare(`
    INSERT INTO users (id, display_name, base_currency, is_china_market,
      default_withdrawal_rate, default_expected_return, default_inflation_rate,
      encryption_key_hash, last_sync_at, sync_version, updated_at, deleted_flag)
    VALUES (@id, @display_name, @base_currency, @is_china_market,
      @default_withdrawal_rate, @default_expected_return, @default_inflation_rate,
      @encryption_key_hash, @last_sync_at, @sync_version, @updated_at, @deleted_flag)
  `).run(user);

  return user;
}

export function getUser(db: DatabaseType, id: string): User | null {
  const row = db.prepare(
    'SELECT * FROM users WHERE id = ? AND deleted_flag = 0'
  ).get(id) as User | undefined;
  return row ?? null;
}

export function updateUser(db: DatabaseType, id: string, input: UpdateUserInput): User {
  const current = getUser(db, id);
  if (!current) {
    throw new Error(`User not found: ${id}`);
  }

  const updated: User = {
    ...current,
    ...input,
    sync_version: current.sync_version + 1,
    updated_at: nowMs(),
  };

  db.prepare(`
    UPDATE users SET
      display_name = @display_name,
      base_currency = @base_currency,
      is_china_market = @is_china_market,
      default_withdrawal_rate = @default_withdrawal_rate,
      default_expected_return = @default_expected_return,
      default_inflation_rate = @default_inflation_rate,
      encryption_key_hash = @encryption_key_hash,
      last_sync_at = @last_sync_at,
      sync_version = @sync_version,
      updated_at = @updated_at
    WHERE id = @id
  `).run(updated);

  return updated;
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `cd fire-app && npx vitest run tests/models/user.test.ts`
Expected: PASS — 7个测试全部通过

- [ ] **Step 5: 提交**

```bash
cd fire-app
git add src/models/user.ts tests/models/user.test.ts
git commit -m "feat: 用户模型CRUD — 创建/读取/更新"
```

---

## Task 9: 分类模型 CRUD + 种子数据 (category.ts)

**Files:**
- Create: `fire-app/src/models/category.ts`
- Test: `fire-app/tests/models/category.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// tests/models/category.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, closeDatabase } from '../../src/db/connection.js';
import { initSchema } from '../../src/db/schema.js';
import { createUser } from '../../src/models/user.js';
import {
  createCategory,
  getCategories,
  getCategory,
  seedCategories,
} from '../../src/models/category.js';
import type { Database as DatabaseType } from 'better-sqlite3';

describe('category model', () => {
  let db: DatabaseType;
  const userId = 'test-user-id';

  beforeEach(() => {
    db = createDatabase(':memory:');
    initSchema(db);
    createUser(db, { id: userId, display_name: '测试' });
  });

  afterEach(() => {
    closeDatabase(db);
  });

  it('createCategory: 创建自定义分类', () => {
    const cat = createCategory(db, {
      user_id: userId,
      name: '咖啡',
      type: 'expense',
    });
    expect(cat.id).toBeDefined();
    expect(cat.name).toBe('咖啡');
    expect(cat.type).toBe('expense');
    expect(cat.is_system).toBe(0);
  });

  it('createCategory: 创建子分类', () => {
    const parent = createCategory(db, { user_id: userId, name: '食品', type: 'expense' });
    const child = createCategory(db, {
      user_id: userId,
      name: '日用品',
      type: 'expense',
      parent_id: parent.id,
    });
    expect(child.parent_id).toBe(parent.id);
  });

  it('getCategories: 返回所有非删除分类', () => {
    createCategory(db, { user_id: userId, name: '住房', type: 'expense' });
    createCategory(db, { user_id: userId, name: '食品', type: 'expense' });
    createCategory(db, { user_id: userId, name: '工资', type: 'income' });
    const cats = getCategories(db, userId);
    expect(cats).toHaveLength(3);
  });

  it('getCategories: 按type过滤', () => {
    createCategory(db, { user_id: userId, name: '住房', type: 'expense' });
    createCategory(db, { user_id: userId, name: '工资', type: 'income' });
    const expenses = getCategories(db, userId, 'expense');
    expect(expenses).toHaveLength(1);
    expect(expenses[0].name).toBe('住房');
  });

  it('getCategory: 读取单个分类', () => {
    const created = createCategory(db, { user_id: userId, name: '交通', type: 'expense' });
    const cat = getCategory(db, created.id);
    expect(cat).not.toBeNull();
    expect(cat!.name).toBe('交通');
  });

  it('seedCategories: 创建18个标准分类', () => {
    seedCategories(db, userId);
    const cats = getCategories(db, userId);
    // 11个支出 + 7个收入 = 18
    expect(cats).toHaveLength(18);
    const expenses = cats.filter(c => c.type === 'expense');
    const incomes = cats.filter(c => c.type === 'income');
    expect(expenses).toHaveLength(11);
    expect(incomes).toHaveLength(7);
  });

  it('seedCategories: 保险分类关联 insurance_planning', () => {
    seedCategories(db, userId);
    const cats = getCategories(db, userId);
    const insurance = cats.find(c => c.name === '保险');
    expect(insurance).toBeDefined();
    expect(insurance!.linked_fire_concept).toBe('insurance_planning');
  });

  it('seedCategories: 医疗分类关联 china_medical_insurance', () => {
    seedCategories(db, userId);
    const cats = getCategories(db, userId);
    const medical = cats.find(c => c.name === '医疗');
    expect(medical).toBeDefined();
    expect(medical!.linked_fire_concept).toBe('china_medical_insurance');
  });

  it('seedCategories: 社保养老金关联 china_pension_system', () => {
    seedCategories(db, userId);
    const cats = getCategories(db, userId);
    const pension = cats.find(c => c.name === '社保养老金');
    expect(pension).toBeDefined();
    expect(pension!.linked_fire_concept).toBe('china_pension_system');
  });

  it('seedCategories: 系统分类标记 is_system=1', () => {
    seedCategories(db, userId);
    const cats = getCategories(db, userId);
    expect(cats.every(c => c.is_system === 1)).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd fire-app && npx vitest run tests/models/category.test.ts`
Expected: FAIL — 模块不存在

- [ ] **Step 3: 实现最小代码**

```typescript
// src/models/category.ts
import type { Database as DatabaseType } from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { nowMs } from '../utils/time.js';
import type { Category, CategoryType } from '../types/index.js';

export interface CreateCategoryInput {
  user_id: string;
  parent_id?: string | null;
  name: string;
  type: CategoryType;
  icon?: string | null;
  color?: string | null;
  linked_fire_concept?: string | null;
  display_order?: number;
}

const SEED_CATEGORIES: { name: string; type: CategoryType; linked_fire_concept?: string }[] = [
  // 支出分类 (11)
  { name: '住房', type: 'expense' },
  { name: '食品', type: 'expense' },
  { name: '交通', type: 'expense' },
  { name: '保险', type: 'expense', linked_fire_concept: 'insurance_planning' },
  { name: '医疗', type: 'expense', linked_fire_concept: 'china_medical_insurance' },
  { name: '娱乐', type: 'expense' },
  { name: '购物', type: 'expense' },
  { name: '个人护理', type: 'expense' },
  { name: '教育', type: 'expense' },
  { name: '债务还款', type: 'expense', linked_fire_concept: 'debt_management' },
  { name: '其他支出', type: 'expense' },
  // 收入分类 (7)
  { name: '工资薪金', type: 'income' },
  { name: '自由职业', type: 'income' },
  { name: '投资收益', type: 'income' },
  { name: '租金收入', type: 'income', linked_fire_concept: 'retirement_income_diversification' },
  { name: '退税', type: 'income' },
  { name: '社保养老金', type: 'income', linked_fire_concept: 'china_pension_system' },
  { name: '其他收入', type: 'income' },
];

export function createCategory(db: DatabaseType, input: CreateCategoryInput): Category {
  const id = uuidv4();
  const now = nowMs();

  const category: Category = {
    id,
    user_id: input.user_id,
    parent_id: input.parent_id ?? null,
    name: input.name,
    type: input.type,
    icon: input.icon ?? null,
    color: input.color ?? null,
    linked_fire_concept: input.linked_fire_concept ?? null,
    display_order: input.display_order ?? 0,
    is_system: 0,
    sync_version: 0,
    updated_at: now,
    deleted_flag: 0,
  };

  db.prepare(`
    INSERT INTO categories (id, user_id, parent_id, name, type, icon, color,
      linked_fire_concept, display_order, is_system, sync_version, updated_at, deleted_flag)
    VALUES (@id, @user_id, @parent_id, @name, @type, @icon, @color,
      @linked_fire_concept, @display_order, @is_system, @sync_version, @updated_at, @deleted_flag)
  `).run(category);

  return category;
}

export function getCategory(db: DatabaseType, id: string): Category | null {
  const row = db.prepare(
    'SELECT * FROM categories WHERE id = ? AND deleted_flag = 0'
  ).get(id) as Category | undefined;
  return row ?? null;
}

export function getCategories(
  db: DatabaseType,
  userId: string,
  type?: CategoryType
): Category[] {
  if (type) {
    return db.prepare(
      'SELECT * FROM categories WHERE user_id = ? AND type = ? AND deleted_flag = 0 ORDER BY display_order, name'
    ).all(userId, type) as Category[];
  }
  return db.prepare(
    'SELECT * FROM categories WHERE user_id = ? AND deleted_flag = 0 ORDER BY display_order, name'
  ).all(userId) as Category[];
}

export function seedCategories(db: DatabaseType, userId: string): void {
  const now = nowMs();
  const insert = db.prepare(`
    INSERT INTO categories (id, user_id, parent_id, name, type, icon, color,
      linked_fire_concept, display_order, is_system, sync_version, updated_at, deleted_flag)
    VALUES (@id, @user_id, @parent_id, @name, @type, @icon, @color,
      @linked_fire_concept, @display_order, @is_system, @sync_version, @updated_at, @deleted_flag)
  `);

  SEED_CATEGORIES.forEach((seed, index) => {
    insert.run({
      id: uuidv4(),
      user_id: userId,
      parent_id: null,
      name: seed.name,
      type: seed.type,
      icon: null,
      color: null,
      linked_fire_concept: seed.linked_fire_concept ?? null,
      display_order: index,
      is_system: 1,
      sync_version: 0,
      updated_at: now,
      deleted_flag: 0,
    });
  });
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `cd fire-app && npx vitest run tests/models/category.test.ts`
Expected: PASS — 11个测试全部通过

- [ ] **Step 5: 提交**

```bash
cd fire-app
git add src/models/category.ts tests/models/category.test.ts
git commit -m "feat: 分类模型CRUD + 18个标准种子分类"
```

---

## Task 10: 账户模型 CRUD (account.ts)

**Files:**
- Create: `fire-app/src/models/account.ts`
- Test: `fire-app/tests/models/account.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// tests/models/account.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, closeDatabase } from '../../src/db/connection.js';
import { initSchema } from '../../src/db/schema.js';
import { createUser } from '../../src/models/user.js';
import {
  createAccount,
  getAccount,
  getAccounts,
  getInvestableBalance,
  getNetWorth,
  softDeleteAccount,
  hasTransactions,
  updateAccountBalance,
} from '../../src/models/account.js';
import type { Database as DatabaseType } from 'better-sqlite3';

describe('account model', () => {
  let db: DatabaseType;
  const userId = 'test-user-id';

  beforeEach(() => {
    db = createDatabase(':memory:');
    initSchema(db);
    createUser(db, { id: userId, display_name: '测试' });
  });

  afterEach(() => {
    closeDatabase(db);
  });

  it('createAccount: 创建活期账户，余额0', () => {
    const acc = createAccount(db, {
      user_id: userId,
      name: '招商活期',
      asset_class: 'liquid',
      account_type: 'checking',
    });
    expect(acc.id).toBeDefined();
    expect(acc.current_balance).toBe(0);
    expect(acc.asset_class).toBe('liquid');
    expect(acc.account_type).toBe('checking');
  });

  it('createAccount: 创建投资账户带初始余额', () => {
    const acc = createAccount(db, {
      user_id: userId,
      name: '券商账户',
      asset_class: 'invested',
      account_type: 'investment',
      initial_balance: 500000,
    });
    expect(acc.current_balance).toBe(500000);
  });

  it('createAccount: 创建负债账户', () => {
    const acc = createAccount(db, {
      user_id: userId,
      name: '信用卡',
      asset_class: 'liability',
      account_type: 'credit_card',
      initial_balance: -20000,
    });
    expect(acc.current_balance).toBe(-20000);
  });

  it('getAccount: 读取单个账户', () => {
    const created = createAccount(db, {
      user_id: userId,
      name: '测试',
      asset_class: 'liquid',
      account_type: 'savings',
    });
    const acc = getAccount(db, created.id);
    expect(acc).not.toBeNull();
    expect(acc!.name).toBe('测试');
  });

  it('getAccounts: 返回用户所有账户', () => {
    createAccount(db, { user_id: userId, name: 'A', asset_class: 'liquid', account_type: 'checking' });
    createAccount(db, { user_id: userId, name: 'B', asset_class: 'invested', account_type: 'fund' });
    const accs = getAccounts(db, userId);
    expect(accs).toHaveLength(2);
  });

  it('updateAccountBalance: 更新余额和last_updated', () => {
    const acc = createAccount(db, {
      user_id: userId,
      name: '测试',
      asset_class: 'liquid',
      account_type: 'checking',
    });
    updateAccountBalance(db, acc.id, 100000);
    const updated = getAccount(db, acc.id);
    expect(updated!.current_balance).toBe(100000);
  });

  it('getInvestableBalance: 只汇总 liquid + invested', () => {
    createAccount(db, { user_id: userId, name: '活期', asset_class: 'liquid', account_type: 'checking', initial_balance: 100000 });
    createAccount(db, { user_id: userId, name: '基金', asset_class: 'invested', account_type: 'fund', initial_balance: 300000 });
    createAccount(db, { user_id: userId, name: '房产', asset_class: 'use_asset', account_type: 'real_estate', initial_balance: 2000000 });
    createAccount(db, { user_id: userId, name: '信用卡', asset_class: 'liability', account_type: 'credit_card', initial_balance: -10000 });

    const investable = getInvestableBalance(db, userId);
    expect(investable).toBe(400000); // 100000 + 300000
  });

  it('getNetWorth: 所有账户余额之和', () => {
    createAccount(db, { user_id: userId, name: '活期', asset_class: 'liquid', account_type: 'checking', initial_balance: 100000 });
    createAccount(db, { user_id: userId, name: '房产', asset_class: 'use_asset', account_type: 'real_estate', initial_balance: 2000000 });
    createAccount(db, { user_id: userId, name: '信用卡', asset_class: 'liability', account_type: 'credit_card', initial_balance: -50000 });

    const netWorth = getNetWorth(db, userId);
    expect(netWorth).toBe(2050000); // 100000 + 2000000 - 50000
  });

  it('hasTransactions: 无交易 → false', () => {
    const acc = createAccount(db, { user_id: userId, name: '测试', asset_class: 'liquid', account_type: 'checking' });
    expect(hasTransactions(db, acc.id)).toBe(false);
  });

  it('hasTransactions: 有交易 → true', () => {
    const acc = createAccount(db, { user_id: userId, name: '测试', asset_class: 'liquid', account_type: 'checking' });
    // 直接插入一条交易记录模拟
    db.prepare(`
      INSERT INTO transactions (id, user_id, account_id, transaction_type, amount, transaction_date,
        sync_version, updated_at, deleted_flag)
      VALUES ('tx1', ?, ?, 'income', 100, 1000, 0, 1000, 0)
    `).run(userId, acc.id);
    expect(hasTransactions(db, acc.id)).toBe(true);
  });

  it('softDeleteAccount: 有关联交易 → 抛出错误', () => {
    const acc = createAccount(db, { user_id: userId, name: '测试', asset_class: 'liquid', account_type: 'checking' });
    db.prepare(`
      INSERT INTO transactions (id, user_id, account_id, transaction_type, amount, transaction_date,
        sync_version, updated_at, deleted_flag)
      VALUES ('tx1', ?, ?, 'income', 100, 1000, 0, 1000, 0)
    `).run(userId, acc.id);
    expect(() => softDeleteAccount(db, acc.id)).toThrow(/有关联交易/);
  });

  it('softDeleteAccount: 无关联交易 → 成功', () => {
    const acc = createAccount(db, { user_id: userId, name: '测试', asset_class: 'liquid', account_type: 'checking' });
    softDeleteAccount(db, acc.id);
    const deleted = getAccount(db, acc.id);
    expect(deleted).toBeNull(); // 软删除后查询返回null
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd fire-app && npx vitest run tests/models/account.test.ts`
Expected: FAIL — 模块不存在

- [ ] **Step 3: 实现最小代码**

```typescript
// src/models/account.ts
import type { Database as DatabaseType } from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { nowMs } from '../utils/time.js';
import type { Account, AssetClass, AccountType } from '../types/index.js';

export interface CreateAccountInput {
  user_id: string;
  name: string;
  asset_class: AssetClass;
  account_type: AccountType;
  initial_balance?: number;
  display_order?: number;
  note?: string | null;
}

export function createAccount(db: DatabaseType, input: CreateAccountInput): Account {
  const id = uuidv4();
  const now = nowMs();

  const account: Account = {
    id,
    user_id: input.user_id,
    name: input.name,
    asset_class: input.asset_class,
    account_type: input.account_type,
    current_balance: input.initial_balance ?? 0,
    last_updated: now,
    display_order: input.display_order ?? 0,
    note: input.note ?? null,
    sync_version: 0,
    updated_at: now,
    deleted_flag: 0,
  };

  db.prepare(`
    INSERT INTO accounts (id, user_id, name, asset_class, account_type, current_balance,
      last_updated, display_order, note, sync_version, updated_at, deleted_flag)
    VALUES (@id, @user_id, @name, @asset_class, @account_type, @current_balance,
      @last_updated, @display_order, @note, @sync_version, @updated_at, @deleted_flag)
  `).run(account);

  return account;
}

export function getAccount(db: DatabaseType, id: string): Account | null {
  const row = db.prepare(
    'SELECT * FROM accounts WHERE id = ? AND deleted_flag = 0'
  ).get(id) as Account | undefined;
  return row ?? null;
}

export function getAccounts(db: DatabaseType, userId: string): Account[] {
  return db.prepare(
    'SELECT * FROM accounts WHERE user_id = ? AND deleted_flag = 0 ORDER BY display_order, name'
  ).all(userId) as Account[];
}

export function updateAccountBalance(db: DatabaseType, id: string, newBalance: number): void {
  db.prepare(`
    UPDATE accounts SET current_balance = ?, last_updated = ? WHERE id = ?
  `).run(newBalance, nowMs(), id);
}

/**
 * 获取可投资组合余额（liquid + invested）
 */
export function getInvestableBalance(db: DatabaseType, userId: string): number {
  const result = db.prepare(`
    SELECT COALESCE(SUM(current_balance), 0) as total
    FROM accounts
    WHERE user_id = ? AND asset_class IN ('liquid', 'invested') AND deleted_flag = 0
  `).get(userId) as { total: number };
  return result.total;
}

/**
 * 获取净资产（所有账户余额之和，负债为负数）
 */
export function getNetWorth(db: DatabaseType, userId: string): number {
  const result = db.prepare(`
    SELECT COALESCE(SUM(current_balance), 0) as total
    FROM accounts
    WHERE user_id = ? AND deleted_flag = 0
  `).get(userId) as { total: number };
  return result.total;
}

/**
 * 检查账户是否有关联交易
 */
export function hasTransactions(db: DatabaseType, accountId: string): boolean {
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM transactions
    WHERE (account_id = ? OR to_account_id = ?) AND deleted_flag = 0
  `).get(accountId, accountId) as { count: number };
  return result.count > 0;
}

/**
 * 软删除账户（有关联交易时抛出错误）
 */
export function softDeleteAccount(db: DatabaseType, id: string): void {
  if (hasTransactions(db, id)) {
    throw new Error('该账户下有关联交易，无法删除。请先处理关联交易。');
  }

  const current = getAccount(db, id);
  if (!current) {
    throw new Error(`Account not found: ${id}`);
  }

  db.prepare(`
    UPDATE accounts SET
      deleted_flag = 1,
      sync_version = ?,
      updated_at = ?
    WHERE id = ?
  `).run(current.sync_version + 1, nowMs(), id);
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `cd fire-app && npx vitest run tests/models/account.test.ts`
Expected: PASS — 13个测试全部通过

- [ ] **Step 5: 提交**

```bash
cd fire-app
git add src/models/account.ts tests/models/account.test.ts
git commit -m "feat: 账户模型CRUD — 余额管理 + 可投资资产汇总 + 级联删除保护"
```

---

## Task 11: 交易服务 — 创建/编辑/删除 + 余额事务 (transaction-service.ts)

**Files:**
- Create: `fire-app/src/services/transaction-service.ts`
- Test: `fire-app/tests/services/transaction-service.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// tests/services/transaction-service.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, closeDatabase } from '../../src/db/connection.js';
import { initSchema } from '../../src/db/schema.js';
import { createUser } from '../../src/models/user.js';
import { createAccount, getAccount } from '../../src/models/account.js';
import { createCategory } from '../../src/models/category.js';
import { getTransaction } from '../../src/models/transaction.js';
import {
  createTransaction,
  editTransaction,
  deleteTransaction,
} from '../../src/services/transaction-service.js';
import type { Database as DatabaseType } from 'better-sqlite3';

describe('transaction service', () => {
  let db: DatabaseType;
  let userId: string;
  let accountId: string;
  let toAccountId: string;
  let categoryId: string;

  beforeEach(() => {
    db = createDatabase(':memory:');
    initSchema(db);
    userId = 'test-user-id';
    createUser(db, { id: userId, display_name: '测试' });

    const acc = createAccount(db, { user_id: userId, name: '活期', asset_class: 'liquid', account_type: 'checking' });
    accountId = acc.id;

    const toAcc = createAccount(db, { user_id: userId, name: '基金', asset_class: 'invested', account_type: 'fund' });
    toAccountId = toAcc.id;

    const cat = createCategory(db, { user_id: userId, name: '工资', type: 'income' });
    categoryId = cat.id;
  });

  afterEach(() => {
    closeDatabase(db);
  });

  // === 创建交易 ===

  it('createTransaction: income → 账户余额增加', () => {
    const tx = createTransaction(db, {
      user_id: userId,
      account_id: accountId,
      category_id: categoryId,
      transaction_type: 'income',
      amount: 10000,
      transaction_date: 1000000,
    });
    expect(tx.id).toBeDefined();
    expect(tx.amount).toBe(10000);

    const acc = getAccount(db, accountId);
    expect(acc!.current_balance).toBe(10000);
  });

  it('createTransaction: expense → 账户余额减少', () => {
    createTransaction(db, {
      user_id: userId,
      account_id: accountId,
      category_id: categoryId,
      transaction_type: 'income',
      amount: 50000,
      transaction_date: 1000000,
    });
    createTransaction(db, {
      user_id: userId,
      account_id: accountId,
      category_id: categoryId,
      transaction_type: 'expense',
      amount: 30000,
      transaction_date: 2000000,
    });

    const acc = getAccount(db, accountId);
    expect(acc!.current_balance).toBe(20000); // 50000 - 30000
  });

  it('createTransaction: transfer → 源账户减、目标账户加', () => {
    // 先给源账户充值
    createTransaction(db, {
      user_id: userId,
      account_id: accountId,
      category_id: categoryId,
      transaction_type: 'income',
      amount: 100000,
      transaction_date: 1000000,
    });

    createTransaction(db, {
      user_id: userId,
      account_id: accountId,
      to_account_id: toAccountId,
      transaction_type: 'transfer',
      amount: 50000,
      transaction_date: 2000000,
    });

    const source = getAccount(db, accountId);
    const target = getAccount(db, toAccountId);
    expect(source!.current_balance).toBe(50000);  // 100000 - 50000
    expect(target!.current_balance).toBe(50000);   // 0 + 50000
  });

  it('createTransaction: initial_balance → 余额增加', () => {
    const tx = createTransaction(db, {
      user_id: userId,
      account_id: accountId,
      transaction_type: 'initial_balance',
      amount: 200000,
      transaction_date: 500000,
    });
    expect(tx.transaction_type).toBe('initial_balance');

    const acc = getAccount(db, accountId);
    expect(acc!.current_balance).toBe(200000);
  });

  it('createTransaction: transfer 无 to_account_id → 抛出错误', () => {
    expect(() => {
      createTransaction(db, {
        user_id: userId,
        account_id: accountId,
        transaction_type: 'transfer',
        amount: 1000,
        transaction_date: 1000000,
      });
    }).toThrow(/to_account_id/);
  });

  it('createTransaction: transfer to_account_id = account_id → 抛出错误', () => {
    expect(() => {
      createTransaction(db, {
        user_id: userId,
        account_id: accountId,
        to_account_id: accountId,
        transaction_type: 'transfer',
        amount: 1000,
        transaction_date: 1000000,
      });
    }).toThrow(/不能转账给自己/);
  });

  // === 编辑交易 ===

  it('editTransaction: 修改金额 → 余额正确调整', () => {
    const tx = createTransaction(db, {
      user_id: userId,
      account_id: accountId,
      category_id: categoryId,
      transaction_type: 'income',
      amount: 10000,
      transaction_date: 1000000,
    });

    editTransaction(db, tx.id, { amount: 15000 });

    const acc = getAccount(db, accountId);
    expect(acc!.current_balance).toBe(15000); // 从10000改为15000
  });

  it('editTransaction: 修改类型 income→expense → 余额反转', () => {
    const tx = createTransaction(db, {
      user_id: userId,
      account_id: accountId,
      category_id: categoryId,
      transaction_type: 'income',
      amount: 10000,
      transaction_date: 1000000,
    });

    editTransaction(db, tx.id, { transaction_type: 'expense' });

    const acc = getAccount(db, accountId);
    expect(acc!.current_balance).toBe(-10000); // +10000 反向 → 0, 再 -10000
  });

  // === 删除交易 ===

  it('deleteTransaction: 删除后余额回滚', () => {
    const tx = createTransaction(db, {
      user_id: userId,
      account_id: accountId,
      category_id: categoryId,
      transaction_type: 'income',
      amount: 10000,
      transaction_date: 1000000,
    });

    deleteTransaction(db, tx.id);

    const acc = getAccount(db, accountId);
    expect(acc!.current_balance).toBe(0); // 回滚到0

    // 交易标记为软删除
    const deletedTx = db.prepare(
      'SELECT * FROM transactions WHERE id = ?'
    ).get(tx.id) as { deleted_flag: number };
    expect(deletedTx.deleted_flag).toBe(1);
  });

  it('deleteTransaction: 转账删除后两个账户都回滚', () => {
    createTransaction(db, {
      user_id: userId,
      account_id: accountId,
      category_id: categoryId,
      transaction_type: 'income',
      amount: 100000,
      transaction_date: 1000000,
    });

    const transfer = createTransaction(db, {
      user_id: userId,
      account_id: accountId,
      to_account_id: toAccountId,
      transaction_type: 'transfer',
      amount: 50000,
      transaction_date: 2000000,
    });

    deleteTransaction(db, transfer.id);

    const source = getAccount(db, accountId);
    const target = getAccount(db, toAccountId);
    expect(source!.current_balance).toBe(100000); // 回滚到转账前
    expect(target!.current_balance).toBe(0);       // 回滚到0
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd fire-app && npx vitest run tests/services/transaction-service.test.ts`
Expected: FAIL — 模块不存在

- [ ] **Step 3: 实现 transaction.ts (基础CRUD)**

```typescript
// src/models/transaction.ts
import type { Database as DatabaseType } from 'better-sqlite3';
import type { Transaction } from '../types/index.js';

export function getTransaction(db: DatabaseType, id: string): Transaction | null {
  const row = db.prepare(
    'SELECT * FROM transactions WHERE id = ? AND deleted_flag = 0'
  ).get(id) as Transaction | undefined;
  return row ?? null;
}

export function getTransactionById(db: DatabaseType, id: string): Transaction | null {
  // 不过滤 deleted_flag，用于查看已删除记录
  const row = db.prepare(
    'SELECT * FROM transactions WHERE id = ?'
  ).get(id) as Transaction | undefined;
  return row ?? null;
}
```

- [ ] **Step 4: 实现 transaction-service.ts**

```typescript
// src/services/transaction-service.ts
import type { Database as DatabaseType } from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { nowMs } from '../utils/time.js';
import { getAccount, updateAccountBalance } from '../models/account.js';
import { getTransaction, getTransactionById } from '../models/transaction.js';
import type { Transaction, TransactionType } from '../types/index.js';

export interface CreateTransactionInput {
  user_id: string;
  account_id: string;
  to_account_id?: string | null;
  category_id?: string | null;
  recurring_id?: string | null;
  transaction_type: TransactionType;
  amount: number;
  transaction_date: number;
  description?: string | null;
}

export interface EditTransactionInput {
  account_id?: string;
  to_account_id?: string | null;
  category_id?: string | null;
  transaction_type?: TransactionType;
  amount?: number;
  transaction_date?: number;
  description?: string | null;
}

/**
 * 计算交易对账户余额的影响
 */
function balanceDelta(type: TransactionType, amount: number): number {
  switch (type) {
    case 'income':
    case 'initial_balance':
      return amount;
    case 'expense':
      return -amount;
    case 'transfer':
      return -amount; // 对源账户
    default:
      return 0;
  }
}

/**
 * 创建交易（事务内更新账户余额）
 */
export function createTransaction(db: DatabaseType, input: CreateTransactionInput): Transaction {
  // 验证
  if (input.transaction_type === 'transfer') {
    if (!input.to_account_id) {
      throw new Error('转账交易必须指定 to_account_id');
    }
    if (input.to_account_id === input.account_id) {
      throw new Error('不能转账给自己');
    }
  }

  const id = uuidv4();
  const now = nowMs();

  const tx: Transaction = {
    id,
    user_id: input.user_id,
    account_id: input.account_id,
    to_account_id: input.to_account_id ?? null,
    category_id: input.category_id ?? null,
    recurring_id: input.recurring_id ?? null,
    transaction_type: input.transaction_type,
    amount: input.amount,
    transaction_date: input.transaction_date,
    description: input.description ?? null,
    sync_version: 0,
    updated_at: now,
    deleted_flag: 0,
  };

  const insertTx = db.prepare(`
    INSERT INTO transactions (id, user_id, account_id, to_account_id, category_id,
      recurring_id, transaction_type, amount, transaction_date, description,
      sync_version, updated_at, deleted_flag)
    VALUES (@id, @user_id, @account_id, @to_account_id, @category_id,
      @recurring_id, @transaction_type, @amount, @transaction_date, @description,
      @sync_version, @updated_at, @deleted_flag)
  `);

  const updateBalance = db.prepare(`
    UPDATE accounts SET current_balance = current_balance + ?, last_updated = ?
    WHERE id = ?
  `);

  const delta = balanceDelta(tx.transaction_type, tx.amount);

  // 事务执行
  const result = db.transaction(() => {
    insertTx.run(tx);

    // 更新源账户余额
    updateBalance.run(delta, now, tx.account_id);

    // 转账：更新目标账户余额
    if (tx.transaction_type === 'transfer' && tx.to_account_id) {
      updateBalance.run(tx.amount, now, tx.to_account_id);
    }
  });

  result();

  return tx;
}

/**
 * 编辑交易（事务内：先反向调整旧交易，再正向应用新交易）
 */
export function editTransaction(db: DatabaseType, id: string, input: EditTransactionInput): Transaction {
  const oldTx = getTransaction(db, id);
  if (!oldTx) {
    throw new Error(`Transaction not found: ${id}`);
  }

  // 构建新交易值
  const newType = input.transaction_type ?? oldTx.transaction_type;
  const newAmount = input.amount ?? oldTx.amount;
  const newAccountId = input.account_id ?? oldTx.account_id;
  const newToAccountId = input.to_account_id !== undefined
    ? input.to_account_id
    : oldTx.to_account_id;

  // 验证
  if (newType === 'transfer') {
    if (!newToAccountId) {
      throw new Error('转账交易必须指定 to_account_id');
    }
    if (newToAccountId === newAccountId) {
      throw new Error('不能转账给自己');
    }
  }

  const now = nowMs();
  const oldDelta = balanceDelta(oldTx.transaction_type, oldTx.amount);
  const newDelta = balanceDelta(newType, newAmount);

  const updateTx = db.prepare(`
    UPDATE transactions SET
      account_id = ?,
      to_account_id = ?,
      category_id = ?,
      transaction_type = ?,
      amount = ?,
      transaction_date = ?,
      description = ?,
      sync_version = ?,
      updated_at = ?
    WHERE id = ?
  `);

  const updateBalance = db.prepare(`
    UPDATE accounts SET current_balance = current_balance + ?, last_updated = ? WHERE id = ?
  `);

  const result = db.transaction(() => {
    // 1. 反向调整旧交易余额
    updateBalance.run(-oldDelta, now, oldTx.account_id);
    if (oldTx.transaction_type === 'transfer' && oldTx.to_account_id) {
      updateBalance.run(-oldTx.amount, now, oldTx.to_account_id); // 反向：目标账户减
    }

    // 2. 正向应用新交易余额
    updateBalance.run(newDelta, now, newAccountId);
    if (newType === 'transfer' && newToAccountId) {
      updateBalance.run(newAmount, now, newToAccountId);
    }

    // 3. 更新交易记录
    updateTx.run(
      newAccountId,
      newToAccountId,
      input.category_id !== undefined ? input.category_id : oldTx.category_id,
      newType,
      newAmount,
      input.transaction_date ?? oldTx.transaction_date,
      input.description !== undefined ? input.description : oldTx.description,
      oldTx.sync_version + 1,
      now,
      id
    );
  });

  result();

  return getTransaction(db, id)!;
}

/**
 * 删除交易（事务内：反向调整余额 + 软删除）
 */
export function deleteTransaction(db: DatabaseType, id: string): void {
  const tx = getTransaction(db, id);
  if (!tx) {
    throw new Error(`Transaction not found: ${id}`);
  }

  const now = nowMs();
  const delta = balanceDelta(tx.transaction_type, tx.amount);

  const updateBalance = db.prepare(`
    UPDATE accounts SET current_balance = current_balance + ?, last_updated = ? WHERE id = ?
  `);

  const softDelete = db.prepare(`
    UPDATE transactions SET deleted_flag = 1, sync_version = ?, updated_at = ? WHERE id = ?
  `);

  const result = db.transaction(() => {
    // 反向调整余额
    updateBalance.run(-delta, now, tx.account_id);
    if (tx.transaction_type === 'transfer' && tx.to_account_id) {
      updateBalance.run(-tx.amount, now, tx.to_account_id);
    }

    // 软删除
    softDelete.run(tx.sync_version + 1, now, id);
  });

  result();
}
```

- [ ] **Step 5: 运行测试验证通过**

Run: `cd fire-app && npx vitest run tests/services/transaction-service.test.ts`
Expected: PASS — 11个测试全部通过

- [ ] **Step 6: 提交**

```bash
cd fire-app
git add src/models/transaction.ts src/services/transaction-service.ts tests/services/transaction-service.test.ts
git commit -m "feat: 交易服务 — 创建/编辑/删除 + 事务强一致余额管理"
```

---

## Task 12: 经常性交易模型 + 生成引擎 (recurring.ts + recurring-service.ts)

**Files:**
- Create: `fire-app/src/models/recurring.ts`
- Create: `fire-app/src/services/recurring-service.ts`
- Test: `fire-app/tests/services/recurring-service.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// tests/services/recurring-service.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, closeDatabase } from '../../src/db/connection.js';
import { initSchema } from '../../src/db/schema.js';
import { createUser } from '../../src/models/user.js';
import { createAccount, getAccount } from '../../src/models/account.js';
import { createCategory } from '../../src/models/category.js';
import {
  createRecurring,
  getActiveRecurring,
} from '../../src/models/recurring.js';
import { processRecurringTransactions } from '../../src/services/recurring-service.js';
import { nowMs, addMonths } from '../../src/utils/time.js';
import type { Database as DatabaseType } from 'better-sqlite3';

describe('recurring service', () => {
  let db: DatabaseType;
  let userId: string;
  let accountId: string;
  let categoryId: string;

  beforeEach(() => {
    db = createDatabase(':memory:');
    initSchema(db);
    userId = 'test-user-id';
    createUser(db, { id: userId, display_name: '测试' });
    const acc = createAccount(db, { user_id: userId, name: '活期', asset_class: 'liquid', account_type: 'checking' });
    accountId = acc.id;
    const cat = createCategory(db, { user_id: userId, name: '工资', type: 'income' });
    categoryId = cat.id;
  });

  afterEach(() => {
    closeDatabase(db);
  });

  it('processRecurringTransactions: 到期模板生成交易', () => {
    const pastDate = nowMs() - 100000; // 已过期
    createRecurring(db, {
      user_id: userId,
      account_id: accountId,
      category_id: categoryId,
      transaction_type: 'income',
      amount: 10000,
      frequency: 'monthly',
      start_date: pastDate,
      next_due_date: pastDate,
    });

    const generated = processRecurringTransactions(db, userId);
    expect(generated).toHaveLength(1);

    const acc = getAccount(db, accountId);
    expect(acc!.current_balance).toBe(10000);
  });

  it('processRecurringTransactions: 补生成多月遗漏交易', () => {
    const threeMonthsAgo = addMonths(nowMs(), -3);
    createRecurring(db, {
      user_id: userId,
      account_id: accountId,
      category_id: categoryId,
      transaction_type: 'income',
      amount: 5000,
      frequency: 'monthly',
      start_date: threeMonthsAgo,
      next_due_date: threeMonthsAgo,
    });

    const generated = processRecurringTransactions(db, userId);
    // 应生成 4 笔（3个月前、2个月前、1个月前、本月）
    expect(generated.length).toBeGreaterThanOrEqual(3);
    expect(generated.length).toBeLessThanOrEqual(4);

    const acc = getAccount(db, accountId);
    expect(acc!.current_balance).toBe(5000 * generated.length);
  });

  it('processRecurringTransactions: 未到期 → 不生成', () => {
    const futureDate = nowMs() + 100000000; // 未来
    createRecurring(db, {
      user_id: userId,
      account_id: accountId,
      category_id: categoryId,
      transaction_type: 'income',
      amount: 10000,
      frequency: 'monthly',
      start_date: futureDate,
      next_due_date: futureDate,
    });

    const generated = processRecurringTransactions(db, userId);
    expect(generated).toHaveLength(0);
  });

  it('processRecurringTransactions: end_date过期 → 设为inactive', () => {
    const pastDate = nowMs() - 100000;
    const recentEndDate = nowMs() - 50000;
    createRecurring(db, {
      user_id: userId,
      account_id: accountId,
      category_id: categoryId,
      transaction_type: 'income',
      amount: 10000,
      frequency: 'monthly',
      start_date: pastDate,
      end_date: recentEndDate,
      next_due_date: pastDate,
    });

    processRecurringTransactions(db, userId);

    const templates = getActiveRecurring(db, userId);
    // end_date已过 → is_active设为0 → 不在active列表中
    expect(templates).toHaveLength(0);
  });

  it('processRecurringTransactions: 暂停模板不生成', () => {
    const pastDate = nowMs() - 100000;
    createRecurring(db, {
      user_id: userId,
      account_id: accountId,
      category_id: categoryId,
      transaction_type: 'income',
      amount: 10000,
      frequency: 'monthly',
      start_date: pastDate,
      next_due_date: pastDate,
      is_active: 0,
    });

    const generated = processRecurringTransactions(db, userId);
    expect(generated).toHaveLength(0);

    const acc = getAccount(db, accountId);
    expect(acc!.current_balance).toBe(0);
  });

  it('processRecurringTransactions: 转账模板正确生成', () => {
    const toAcc = createAccount(db, { user_id: userId, name: '基金', asset_class: 'invested', account_type: 'fund' });
    const pastDate = nowMs() - 100000;

    // 先给源账户充钱
    db.prepare(`
      INSERT INTO transactions (id, user_id, account_id, transaction_type, amount, transaction_date,
        sync_version, updated_at, deleted_flag)
      VALUES ('seed1', ?, ?, 'income', 100000, 50000, 0, 50000, 0)
    `).run(userId, accountId);

    createRecurring(db, {
      user_id: userId,
      account_id: accountId,
      to_account_id: toAcc.id,
      transaction_type: 'transfer',
      amount: 5000,
      frequency: 'monthly',
      start_date: pastDate,
      next_due_date: pastDate,
    });

    const generated = processRecurringTransactions(db, userId);
    expect(generated).toHaveLength(1);

    const source = getAccount(db, accountId);
    const target = getAccount(db, toAcc.id);
    expect(source!.current_balance).toBe(95000);  // 100000 - 5000
    expect(target!.current_balance).toBe(5000);    // 0 + 5000
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd fire-app && npx vitest run tests/services/recurring-service.test.ts`
Expected: FAIL — 模块不存在

- [ ] **Step 3: 实现 recurring.ts (模型CRUD)**

```typescript
// src/models/recurring.ts
import type { Database as DatabaseType } from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { nowMs } from '../utils/time.js';
import type { RecurringTransaction, TransactionType, Frequency } from '../types/index.js';

export interface CreateRecurringInput {
  user_id: string;
  account_id: string;
  to_account_id?: string | null;
  category_id?: string | null;
  transaction_type: TransactionType;
  amount: number;
  frequency: Frequency;
  interval?: number;
  start_date: number;
  end_date?: number | null;
  next_due_date: number;
  description?: string | null;
  is_active?: number;
  auto_create?: number;
}

export function createRecurring(db: DatabaseType, input: CreateRecurringInput): RecurringTransaction {
  const id = uuidv4();
  const now = nowMs();

  const rec: RecurringTransaction = {
    id,
    user_id: input.user_id,
    account_id: input.account_id,
    to_account_id: input.to_account_id ?? null,
    category_id: input.category_id ?? null,
    transaction_type: input.transaction_type,
    amount: input.amount,
    frequency: input.frequency,
    interval: input.interval ?? 1,
    start_date: input.start_date,
    end_date: input.end_date ?? null,
    next_due_date: input.next_due_date,
    last_generated_date: null,
    description: input.description ?? null,
    is_active: input.is_active ?? 1,
    auto_create: input.auto_create ?? 1,
    sync_version: 0,
    updated_at: now,
    deleted_flag: 0,
  };

  db.prepare(`
    INSERT INTO recurring_transactions (id, user_id, account_id, to_account_id, category_id,
      transaction_type, amount, frequency, interval, start_date, end_date, next_due_date,
      last_generated_date, description, is_active, auto_create, sync_version, updated_at, deleted_flag)
    VALUES (@id, @user_id, @account_id, @to_account_id, @category_id,
      @transaction_type, @amount, @frequency, @interval, @start_date, @end_date, @next_due_date,
      @last_generated_date, @description, @is_active, @auto_create, @sync_version, @updated_at, @deleted_flag)
  `).run(rec);

  return rec;
}

export function getActiveRecurring(db: DatabaseType, userId: string): RecurringTransaction[] {
  return db.prepare(
    'SELECT * FROM recurring_transactions WHERE user_id = ? AND is_active = 1 AND deleted_flag = 0'
  ).all(userId) as RecurringTransaction[];
}

export function updateRecurring(db: DatabaseType, id: string, updates: Partial<RecurringTransaction>): void {
  const current = db.prepare(
    'SELECT * FROM recurring_transactions WHERE id = ?'
  ).get(id) as RecurringTransaction | undefined;

  if (!current) {
    throw new Error(`Recurring transaction not found: ${id}`);
  }

  const updated = {
    ...current,
    ...updates,
    sync_version: current.sync_version + 1,
    updated_at: nowMs(),
  };

  db.prepare(`
    UPDATE recurring_transactions SET
      next_due_date = @next_due_date,
      last_generated_date = @last_generated_date,
      is_active = @is_active,
      sync_version = @sync_version,
      updated_at = @updated_at
    WHERE id = @id
  `).run(updated);
}
```

- [ ] **Step 4: 实现 recurring-service.ts (生成引擎)**

```typescript
// src/services/recurring-service.ts
import type { Database as DatabaseType } from 'better-sqlite3';
import { nowMs, addMonths } from '../utils/time.js';
import { getActiveRecurring, updateRecurring } from '../models/recurring.js';
import { createTransaction } from './transaction-service.js';
import type { RecurringTransaction, Transaction } from '../types/index.js';
import type { Frequency } from '../types/index.js';

/**
 * 推进 next_due_date
 */
function advanceDueDate(currentDue: number, frequency: Frequency, interval: number): number {
  switch (frequency) {
    case 'daily':
      return currentDue + interval * 24 * 60 * 60 * 1000;
    case 'weekly':
      return currentDue + interval * 7 * 24 * 60 * 60 * 1000;
    case 'monthly':
      return addMonths(currentDue, interval);
    case 'yearly':
      return addMonths(currentDue, interval * 12);
    default:
      return currentDue;
  }
}

/**
 * 处理所有到期的经常性交易模板，补生成遗漏的交易
 * 返回生成的交易列表
 */
export function processRecurringTransactions(
  db: DatabaseType,
  userId: string
): Transaction[] {
  const templates = getActiveRecurring(db, userId);
  const generated: Transaction[] = [];
  const currentTime = nowMs();

  for (const template of templates) {
    let { next_due_date } = template;

    while (next_due_date <= currentTime) {
      // 检查是否超过 end_date
      if (template.end_date !== null && next_due_date > template.end_date) {
        // 超过结束日期 → 设为不活跃
        updateRecurring(db, template.id, { is_active: 0 });
        break;
      }

      // 生成交易
      const tx = createTransaction(db, {
        user_id: userId,
        account_id: template.account_id,
        to_account_id: template.to_account_id,
        category_id: template.category_id,
        recurring_id: template.id,
        transaction_type: template.transaction_type,
        amount: template.amount,
        transaction_date: next_due_date,
        description: template.description,
      });
      generated.push(tx);

      // 更新 last_generated_date
      updateRecurring(db, template.id, {
        last_generated_date: next_due_date,
      });

      // 推进 next_due_date
      next_due_date = advanceDueDate(next_due_date, template.frequency, template.interval);
    }

    // 更新模板的 next_due_date
    if (next_due_date !== template.next_due_date) {
      // 检查是否超过 end_date
      if (template.end_date !== null && next_due_date > template.end_date) {
        updateRecurring(db, template.id, {
          next_due_date,
          is_active: 0,
        });
      } else {
        updateRecurring(db, template.id, {
          next_due_date,
        });
      }
    }
  }

  return generated;
}
```

- [ ] **Step 5: 运行测试验证通过**

Run: `cd fire-app && npx vitest run tests/services/recurring-service.test.ts`
Expected: PASS — 6个测试全部通过

- [ ] **Step 6: 提交**

```bash
cd fire-app
git add src/models/recurring.ts src/services/recurring-service.ts tests/services/recurring-service.test.ts
git commit -m "feat: 经常性交易引擎 — 模板CRUD + 补生成遗漏交易"
```

---

## Task 13: 净资产快照服务 (snapshot-service.ts)

**Files:**
- Create: `fire-app/src/models/snapshot.ts`
- Create: `fire-app/src/services/snapshot-service.ts`
- Test: `fire-app/tests/services/snapshot-service.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// tests/services/snapshot-service.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, closeDatabase } from '../../src/db/connection.js';
import { initSchema } from '../../src/db/schema.js';
import { createUser } from '../../src/models/user.js';
import { createAccount } from '../../src/models/account.js';
import { generateMonthlySnapshot, getSnapshots } from '../../src/services/snapshot-service.js';
import { nowMs } from '../../src/utils/time.js';
import type { Database as DatabaseType } from 'better-sqlite3';

describe('snapshot service', () => {
  let db: DatabaseType;
  let userId: string;

  beforeEach(() => {
    db = createDatabase(':memory:');
    initSchema(db);
    userId = 'test-user-id';
    createUser(db, { id: userId, display_name: '测试' });
  });

  afterEach(() => {
    closeDatabase(db);
  });

  it('generateMonthlySnapshot: 首次生成快照', () => {
    createAccount(db, { user_id: userId, name: '活期', asset_class: 'liquid', account_type: 'checking', initial_balance: 100000 });
    createAccount(db, { user_id: userId, name: '基金', asset_class: 'invested', account_type: 'fund', initial_balance: 300000 });
    createAccount(db, { user_id: userId, name: '房产', asset_class: 'use_asset', account_type: 'real_estate', initial_balance: 2000000 });
    createAccount(db, { user_id: userId, name: '信用卡', asset_class: 'liability', account_type: 'credit_card', initial_balance: -50000 });

    const snapshot = generateMonthlySnapshot(db, userId);
    expect(snapshot).not.toBeNull();
    expect(snapshot!.total_liquid).toBe(100000);
    expect(snapshot!.total_invested).toBe(300000);
    expect(snapshot!.total_use_asset).toBe(2000000);
    expect(snapshot!.total_liability).toBe(-50000);
    expect(snapshot!.net_worth).toBe(2350000); // 100000 + 300000 + 2000000 - 50000
  });

  it('generateMonthlySnapshot: 同月重复调用 → 返回null（不重复生成）', () => {
    createAccount(db, { user_id: userId, name: '活期', asset_class: 'liquid', account_type: 'checking', initial_balance: 100000 });

    const first = generateMonthlySnapshot(db, userId);
    expect(first).not.toBeNull();

    const second = generateMonthlySnapshot(db, userId);
    expect(second).toBeNull();
  });

  it('generateMonthlySnapshot: 无账户 → 净资产0', () => {
    const snapshot = generateMonthlySnapshot(db, userId);
    expect(snapshot).not.toBeNull();
    expect(snapshot!.net_worth).toBe(0);
    expect(snapshot!.total_liquid).toBe(0);
    expect(snapshot!.total_invested).toBe(0);
  });

  it('getSnapshots: 返回按日期降序', () => {
    createAccount(db, { user_id: userId, name: '活期', asset_class: 'liquid', account_type: 'checking', initial_balance: 100000 });

    // 手动插入两条历史快照
    db.prepare(`
      INSERT INTO net_worth_snapshots (id, user_id, snapshot_date, snapshot_year_month,
        total_liquid, total_invested, total_use_asset, total_liability, net_worth,
        sync_version, updated_at, deleted_flag)
      VALUES ('old1', ?, 1000000, '2026-01', 50000, 0, 0, 0, 50000, 0, 1000000, 0)
    `).run(userId);

    db.prepare(`
      INSERT INTO net_worth_snapshots (id, user_id, snapshot_date, snapshot_year_month,
        total_liquid, total_invested, total_use_asset, total_liability, net_worth,
        sync_version, updated_at, deleted_flag)
      VALUES ('old2', ?, 2000000, '2026-03', 80000, 0, 0, 0, 80000, 0, 2000000, 0)
    `).run(userId);

    generateMonthlySnapshot(db, userId); // 本月快照

    const snapshots = getSnapshots(db, userId);
    expect(snapshots.length).toBeGreaterThanOrEqual(3);
    // 最新的在前
    expect(snapshots[0].snapshot_date).toBeGreaterThanOrEqual(snapshots[1].snapshot_date);
  });

  it('getSnapshots: snapshot_year_month 格式正确', () => {
    createAccount(db, { user_id: userId, name: '活期', asset_class: 'liquid', account_type: 'checking', initial_balance: 100000 });
    const snapshot = generateMonthlySnapshot(db, userId);
    expect(snapshot!.snapshot_year_month).toMatch(/^\d{4}-\d{2}$/);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd fire-app && npx vitest run tests/services/snapshot-service.test.ts`
Expected: FAIL — 模块不存在

- [ ] **Step 3: 实现 snapshot.ts (模型CRUD)**

```typescript
// src/models/snapshot.ts
import type { Database as DatabaseType } from 'better-sqlite3';
import type { NetWorthSnapshot } from '../types/index.js';

export function getSnapshots(db: DatabaseType, userId: string): NetWorthSnapshot[] {
  return db.prepare(
    'SELECT * FROM net_worth_snapshots WHERE user_id = ? AND deleted_flag = 0 ORDER BY snapshot_date DESC'
  ).all(userId) as NetWorthSnapshot[];
}

export function getSnapshotByMonth(
  db: DatabaseType,
  userId: string,
  yearMonth: string
): NetWorthSnapshot | null {
  const row = db.prepare(
    'SELECT * FROM net_worth_snapshots WHERE user_id = ? AND snapshot_year_month = ? AND deleted_flag = 0'
  ).get(userId, yearMonth) as NetWorthSnapshot | undefined;
  return row ?? null;
}

export function insertSnapshot(db: DatabaseType, snapshot: NetWorthSnapshot): void {
  db.prepare(`
    INSERT INTO net_worth_snapshots (id, user_id, snapshot_date, snapshot_year_month,
      total_liquid, total_invested, total_use_asset, total_liability, net_worth,
      sync_version, updated_at, deleted_flag)
    VALUES (@id, @user_id, @snapshot_date, @snapshot_year_month,
      @total_liquid, @total_invested, @total_use_asset, @total_liability, @net_worth,
      @sync_version, @updated_at, @deleted_flag)
  `).run(snapshot);
}
```

- [ ] **Step 4: 实现 snapshot-service.ts**

```typescript
// src/services/snapshot-service.ts
import type { Database as DatabaseType } from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { nowMs, toYearMonth } from '../utils/time.js';
import { getSnapshotByMonth, insertSnapshot } from '../models/snapshot.js';
import type { NetWorthSnapshot } from '../types/index.js';

/**
 * 按资产大类汇总账户余额
 */
function summarizeByAssetClass(
  db: DatabaseType,
  userId: string
): { total_liquid: number; total_invested: number; total_use_asset: number; total_liability: number } {
  const rows = db.prepare(`
    SELECT asset_class, COALESCE(SUM(current_balance), 0) as total
    FROM accounts
    WHERE user_id = ? AND deleted_flag = 0
    GROUP BY asset_class
  `).all(userId) as { asset_class: string; total: number }[];

  const result = {
    total_liquid: 0,
    total_invested: 0,
    total_use_asset: 0,
    total_liability: 0,
  };

  for (const row of rows) {
    switch (row.asset_class) {
      case 'liquid':
        result.total_liquid = row.total;
        break;
      case 'invested':
        result.total_invested = row.total;
        break;
      case 'use_asset':
        result.total_use_asset = row.total;
        break;
      case 'liability':
        result.total_liability = row.total;
        break;
    }
  }

  return result;
}

/**
 * 生成当月净资产快照（若当月已有快照则返回null）
 */
export function generateMonthlySnapshot(
  db: DatabaseType,
  userId: string
): NetWorthSnapshot | null {
  const now = nowMs();
  const yearMonth = toYearMonth(now);

  // 检查当月是否已有快照
  const existing = getSnapshotByMonth(db, userId, yearMonth);
  if (existing) {
    return null;
  }

  // 汇总账户余额
  const summary = summarizeByAssetClass(db, userId);

  const snapshot: NetWorthSnapshot = {
    id: uuidv4(),
    user_id: userId,
    snapshot_date: now,
    snapshot_year_month: yearMonth,
    total_liquid: summary.total_liquid,
    total_invested: summary.total_invested,
    total_use_asset: summary.total_use_asset,
    total_liability: summary.total_liability,
    net_worth:
      summary.total_liquid +
      summary.total_invested +
      summary.total_use_asset +
      summary.total_liability,
    sync_version: 0,
    updated_at: now,
    deleted_flag: 0,
  };

  insertSnapshot(db, snapshot);
  return snapshot;
}

/**
 * 获取所有快照（按日期降序）
 */
export function getSnapshots(
  db: DatabaseType,
  userId: string
): NetWorthSnapshot[] {
  return db.prepare(
    'SELECT * FROM net_worth_snapshots WHERE user_id = ? AND deleted_flag = 0 ORDER BY snapshot_date DESC'
  ).all(userId) as NetWorthSnapshot[];
}
```

- [ ] **Step 5: 运行测试验证通过**

Run: `cd fire-app && npx vitest run tests/services/snapshot-service.test.ts`
Expected: PASS — 5个测试全部通过

- [ ] **Step 6: 提交**

```bash
cd fire-app
git add src/models/snapshot.ts src/services/snapshot-service.ts tests/services/snapshot-service.test.ts
git commit -m "feat: 净资产快照服务 — 月度分类汇总 + 去重"
```

---

## Task 14: FIRE场景模型 + 投影计算引擎 (scenario.ts + fire-calc.ts)

**Files:**
- Create: `fire-app/src/models/scenario.ts`
- Create: `fire-app/src/services/fire-calc.ts`
- Test: `fire-app/tests/services/fire-calc.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// tests/services/fire-calc.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, closeDatabase } from '../../src/db/connection.js';
import { initSchema } from '../../src/db/schema.js';
import { createUser } from '../../src/models/user.js';
import { createAccount } from '../../src/models/account.js';
import { createScenario, getScenario, getScenarios } from '../../src/models/scenario.js';
import {
  calculateFireNumber,
  calculateAdjustedFireNumber,
  calculateAccumulation,
  calculateProgress,
  runProjection,
} from '../../src/services/fire-calc.js';
import { basisPointsToDecimal } from '../../src/utils/money.js';
import type { Database as DatabaseType } from 'better-sqlite3';

describe('fire calculation engine', () => {
  let db: DatabaseType;
  let userId: string;

  beforeEach(() => {
    db = createDatabase(':memory:');
    initSchema(db);
    userId = 'test-user-id';
    createUser(db, { id: userId, display_name: '测试' });
  });

  afterEach(() => {
    closeDatabase(db);
  });

  // === FIRE Number 计算 ===

  it('calculateFireNumber: 年支出50000 × 3.5% → ~1428571', () => {
    // annual_expenses = 50000元 = 5000000分
    // withdrawal_rate = 350 基点 (3.5%)
    // fire_number = 5000000 × (10000 / 350) = 142857142 分 ≈ 1428571.42元
    const fireNumber = calculateFireNumber(5000000, 350);
    expect(fireNumber).toBe(142857142); // 分
  });

  it('calculateFireNumber: 年支出50000 × 4% → 1250000', () => {
    const fireNumber = calculateFireNumber(5000000, 400);
    expect(fireNumber).toBe(125000000); // 5000000 × 25 = 125000000 分
  });

  it('calculateAdjustedFireNumber: 扣除退休后月收入3000的抵减', () => {
    // annual_expenses = 50000元 = 5000000分
    // withdrawal_rate = 350 (3.5%)
    // post_retirement_monthly_income = 3000元 = 300000分
    // 年收入 = 300000 × 12 = 3600000分
    // 抵减 = 3600000 / 0.035 = 102857142分
    // adjusted = 142857142 - 102857142 = 40000000分 = 400000元
    const adjusted = calculateAdjustedFireNumber(5000000, 350, 300000);
    expect(adjusted).toBe(40000000); // 400000元
  });

  it('calculateAdjustedFireNumber: 无退休后收入 → 等于基础FIRE Number', () => {
    const adjusted = calculateAdjustedFireNumber(5000000, 350, 0);
    expect(adjusted).toBe(142857142);
  });

  // === 积累阶段计算 ===

  it('calculateAccumulation: PV=500000 + PMT=3000/月, 10年, 5%年化', () => {
    // PV = 500000元 = 50000000分
    // PMT = 3000元 = 300000分
    // r = 0.05 / 12 = 0.00416667
    // n = 10 × 12 = 120
    // FV = 50000000 × (1.00416667)^120 + 300000 × ((1.00416667)^120 - 1) / 0.00416667
    // (1.00416667)^120 ≈ 1.6470
    // FV ≈ 50000000 × 1.6470 + 300000 × (1.6470 - 1) / 0.00416667
    //    ≈ 82350000 + 300000 × 155.28
    //    ≈ 82350000 + 46584000
    //    ≈ 128934000 分 ≈ 1289340元
    const fv = calculateAccumulation(50000000, 300000, 500, 120);
    // 允许一定误差
    expect(fv).toBeGreaterThan(128000000);
    expect(fv).toBeLessThan(130000000);
  });

  it('calculateAccumulation: PV=0, 纯定投', () => {
    // PV = 0, PMT = 3000元, 10年, 7%年化
    const fv = calculateAccumulation(0, 300000, 700, 120);
    expect(fv).toBeGreaterThan(0);
    // 大约 300000 × ((1.005833)^120 - 1) / 0.005833
    // ≈ 300000 × 174.5 ≈ 52350000
    expect(fv).toBeGreaterThan(50000000);
    expect(fv).toBeLessThan(55000000);
  });

  // === 进度计算 ===

  it('calculateProgress: 当前50万 / FIRE目标142.8万 → ~35%', () => {
    const progress = calculateProgress(50000000, 142857142);
    expect(progress).toBeCloseTo(35.0, 0);
  });

  it('calculateProgress: 已达成 → 100%', () => {
    const progress = calculateProgress(150000000, 142857142);
    expect(progress).toBe(100);
  });

  // === 完整投影 ===

  it('runProjection: 完整FIRE投影', () => {
    const scenario = createScenario(db, {
      user_id: userId,
      name: '标准计划',
      current_age: 30,
      retirement_age: 50,
      current_portfolio_value: 50000000, // 50万
      monthly_savings: 300000,            // 3000元
      annual_expenses: 5000000,           // 5万
      expected_return_rate: 700,          // 7%
      withdrawal_rate: 350,               // 3.5%
      post_retirement_monthly_income: 0,
    });

    const result = runProjection(db, scenario);

    expect(result.fire_number).toBe(142857142);
    expect(result.adjusted_fire_number).toBe(142857142);
    expect(result.retirement_portfolio).toBeGreaterThan(0);
    expect(result.progress).toBeGreaterThan(0);
    expect(result.progress).toBeLessThan(100);
    expect(result.monthly_projection).toBeDefined();
    expect(result.monthly_projection.length).toBeGreaterThan(0);
    // 20年 × 12月 = 240个月积累期
    expect(result.monthly_projection.length).toBe(240);
  });

  it('runProjection: auto_sync_assets=1 → 从accounts汇总', () => {
    createAccount(db, { user_id: userId, name: '活期', asset_class: 'liquid', account_type: 'checking', initial_balance: 100000 });
    createAccount(db, { user_id: userId, name: '基金', asset_class: 'invested', account_type: 'fund', initial_balance: 400000 });

    const scenario = createScenario(db, {
      user_id: userId,
      name: '自动同步',
      current_age: 35,
      retirement_age: 55,
      current_portfolio_value: 0, // 设为0，靠自动同步
      auto_sync_assets: 1,
      monthly_savings: 500000,
      annual_expenses: 6000000,
      expected_return_rate: 700,
      withdrawal_rate: 350,
    });

    const result = runProjection(db, scenario);
    // current_portfolio_value 应从accounts汇总 = 500000
    expect(result.monthly_projection[0].balance).toBeGreaterThanOrEqual(500000);
  });

  it('runProjection: 退休后收入抵减FIRE Number', () => {
    const scenario = createScenario(db, {
      user_id: userId,
      name: '有养老金',
      current_age: 40,
      retirement_age: 55,
      current_portfolio_value: 100000000,
      monthly_savings: 200000,
      annual_expenses: 5000000,
      expected_return_rate: 700,
      withdrawal_rate: 350,
      post_retirement_monthly_income: 300000, // 月3000元
    });

    const result = runProjection(db, scenario);
    expect(result.adjusted_fire_number).toBeLessThan(result.fire_number);
  });

  it('getScenarios: 返回用户所有场景', () => {
    createScenario(db, { user_id: userId, name: '保守', current_age: 30, retirement_age: 55, annual_expenses: 4000000, expected_return_rate: 500, withdrawal_rate: 300 });
    createScenario(db, { user_id: userId, name: '标准', current_age: 30, retirement_age: 50, annual_expenses: 5000000, expected_return_rate: 700, withdrawal_rate: 350 });
    const scenarios = getScenarios(db, userId);
    expect(scenarios).toHaveLength(2);
  });

  it('getScenario: 读取单个场景', () => {
    const created = createScenario(db, {
      user_id: userId, name: '测试', current_age: 30, retirement_age: 50,
      annual_expenses: 5000000, expected_return_rate: 700, withdrawal_rate: 350,
    });
    const scenario = getScenario(db, created.id);
    expect(scenario).not.toBeNull();
    expect(scenario!.name).toBe('测试');
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd fire-app && npx vitest run tests/services/fire-calc.test.ts`
Expected: FAIL — 模块不存在

- [ ] **Step 3: 实现 scenario.ts (模型CRUD)**

```typescript
// src/models/scenario.ts
import type { Database as DatabaseType } from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { nowMs } from '../utils/time.js';
import type { FireScenario } from '../types/index.js';

export interface CreateScenarioInput {
  user_id: string;
  name: string;
  description?: string | null;
  current_age: number;
  retirement_age: number;
  current_portfolio_value?: number;
  auto_sync_assets?: number;
  monthly_savings?: number;
  annual_expenses: number;
  expected_return_rate: number;
  inflation_rate?: number;
  withdrawal_rate: number;
  retirement_years?: number;
  post_retirement_monthly_income?: number;
  is_china_market?: number;
}

export function createScenario(db: DatabaseType, input: CreateScenarioInput): FireScenario {
  const id = uuidv4();
  const now = nowMs();

  const scenario: FireScenario = {
    id,
    user_id: input.user_id,
    name: input.name,
    description: input.description ?? null,
    current_age: input.current_age,
    retirement_age: input.retirement_age,
    current_portfolio_value: input.current_portfolio_value ?? 0,
    auto_sync_assets: input.auto_sync_assets ?? 1,
    monthly_savings: input.monthly_savings ?? 0,
    annual_expenses: input.annual_expenses,
    expected_return_rate: input.expected_return_rate,
    inflation_rate: input.inflation_rate ?? 300,
    withdrawal_rate: input.withdrawal_rate,
    retirement_years: input.retirement_years ?? 30,
    post_retirement_monthly_income: input.post_retirement_monthly_income ?? 0,
    is_china_market: input.is_china_market ?? 1,
    is_active: 1,
    sync_version: 0,
    updated_at: now,
    deleted_flag: 0,
  };

  db.prepare(`
    INSERT INTO fire_scenarios (id, user_id, name, description, current_age, retirement_age,
      current_portfolio_value, auto_sync_assets, monthly_savings, annual_expenses,
      expected_return_rate, inflation_rate, withdrawal_rate, retirement_years,
      post_retirement_monthly_income, is_china_market, is_active,
      sync_version, updated_at, deleted_flag)
    VALUES (@id, @user_id, @name, @description, @current_age, @retirement_age,
      @current_portfolio_value, @auto_sync_assets, @monthly_savings, @annual_expenses,
      @expected_return_rate, @inflation_rate, @withdrawal_rate, @retirement_years,
      @post_retirement_monthly_income, @is_china_market, @is_active,
      @sync_version, @updated_at, @deleted_flag)
  `).run(scenario);

  return scenario;
}

export function getScenario(db: DatabaseType, id: string): FireScenario | null {
  const row = db.prepare(
    'SELECT * FROM fire_scenarios WHERE id = ? AND deleted_flag = 0'
  ).get(id) as FireScenario | undefined;
  return row ?? null;
}

export function getScenarios(db: DatabaseType, userId: string): FireScenario[] {
  return db.prepare(
    'SELECT * FROM fire_scenarios WHERE user_id = ? AND deleted_flag = 0 ORDER BY updated_at DESC'
  ).all(userId) as FireScenario[];
}

export function updateScenario(
  db: DatabaseType,
  id: string,
  updates: Partial<FireScenario>
): FireScenario {
  const current = getScenario(db, id);
  if (!current) {
    throw new Error(`Scenario not found: ${id}`);
  }

  const updated: FireScenario = {
    ...current,
    ...updates,
    id: current.id, // 不可修改
    user_id: current.user_id, // 不可修改
    sync_version: current.sync_version + 1,
    updated_at: nowMs(),
  };

  db.prepare(`
    UPDATE fire_scenarios SET
      name = @name,
      description = @description,
      current_age = @current_age,
      retirement_age = @retirement_age,
      current_portfolio_value = @current_portfolio_value,
      auto_sync_assets = @auto_sync_assets,
      monthly_savings = @monthly_savings,
      annual_expenses = @annual_expenses,
      expected_return_rate = @expected_return_rate,
      inflation_rate = @inflation_rate,
      withdrawal_rate = @withdrawal_rate,
      retirement_years = @retirement_years,
      post_retirement_monthly_income = @post_retirement_monthly_income,
      is_china_market = @is_china_market,
      is_active = @is_active,
      sync_version = @sync_version,
      updated_at = @updated_at
    WHERE id = @id
  `).run(updated);

  return updated;
}
```

- [ ] **Step 4: 实现 fire-calc.ts (计算引擎)**

```typescript
// src/services/fire-calc.ts
import type { Database as DatabaseType } from 'better-sqlite3';
import { basisPointsToDecimal } from '../utils/money.js';
import { getInvestableBalance } from '../models/account.js';
import type { FireScenario } from '../types/index.js';

export interface MonthlyProjectionPoint {
  month: number;
  age: number;
  balance: number;       // 当前资产（分）
  contribution: number;  // 本月储蓄（分）
  growth: number;        // 本月增长（分）
  cumulative_contribution: number;
  cumulative_growth: number;
  phase: 'accumulation' | 'retirement';
}

export interface ProjectionResult {
  fire_number: number;
  adjusted_fire_number: number;
  retirement_portfolio: number;
  progress: number;
  monthly_projection: MonthlyProjectionPoint[];
}

/**
 * 计算FIRE Number
 * fire_number = annual_expenses × (10000 / withdrawal_rate)
 * 所有参数以分/基点为单位
 */
export function calculateFireNumber(
  annualExpenses: number,
  withdrawalRateBp: number
): number {
  return Math.round(annualExpenses * (10000 / withdrawalRateBp));
}

/**
 * 计算调整后FIRE Number（扣除退休后其他收入的抵减）
 * 抵减 = (post_retirement_monthly_income × 12) / (withdrawal_rate / 10000)
 */
export function calculateAdjustedFireNumber(
  annualExpenses: number,
  withdrawalRateBp: number,
  postRetirementMonthlyIncome: number
): number {
  const baseFireNumber = calculateFireNumber(annualExpenses, withdrawalRateBp);
  if (postRetirementMonthlyIncome === 0) {
    return baseFireNumber;
  }
  const annualOtherIncome = postRetirementMonthlyIncome * 12;
  const deduction = Math.round(annualOtherIncome / (withdrawalRateBp / 10000));
  return Math.max(0, baseFireNumber - deduction);
}

/**
 * 计算积累阶段终值
 * FV = PV × (1 + r)^n + PMT × ((1 + r)^n - 1) / r
 */
export function calculateAccumulation(
  pv: number,
  pmt: number,
  annualReturnBp: number,
  months: number
): number {
  const r = basisPointsToDecimal(annualReturnBp) / 12; // 月回报率
  if (r === 0) {
    return pv + pmt * months;
  }
  const growthFactor = Math.pow(1 + r, months);
  const fv = pv * growthFactor + pmt * ((growthFactor - 1) / r);
  return Math.round(fv);
}

/**
 * 计算进度百分比
 */
export function calculateProgress(
  currentValue: number,
  fireNumber: number
): number {
  if (fireNumber <= 0) return 0;
  return Math.min(100, Math.round((currentValue / fireNumber) * 1000) / 10);
}

/**
 * 运行完整FIRE投影
 */
export function runProjection(
  db: DatabaseType,
  scenario: FireScenario
): ProjectionResult {
  // 确定当前投资组合价值
  let currentValue = scenario.current_portfolio_value;
  if (scenario.auto_sync_assets === 1) {
    currentValue = getInvestableBalance(db, scenario.user_id);
  }

  // 计算FIRE Number
  const fireNumber = calculateFireNumber(
    scenario.annual_expenses,
    scenario.withdrawal_rate
  );

  const adjustedFireNumber = calculateAdjustedFireNumber(
    scenario.annual_expenses,
    scenario.withdrawal_rate,
    scenario.post_retirement_monthly_income
  );

  // 积累期月数
  const accumulationMonths = (scenario.retirement_age - scenario.current_age) * 12;

  // 月度投影
  const monthlyProjection: MonthlyProjectionPoint[] = [];
  let balance = currentValue;
  let cumulativeContribution = 0;
  let cumulativeGrowth = 0;

  const monthlyReturnRate = basisPointsToDecimal(scenario.expected_return_rate) / 12;

  // 积累阶段
  for (let m = 0; m < accumulationMonths; m++) {
    const monthGrowth = Math.round(balance * monthlyReturnRate);
    balance += monthGrowth + scenario.monthly_savings;
    cumulativeContribution += scenario.monthly_savings;
    cumulativeGrowth += monthGrowth;

    monthlyProjection.push({
      month: m + 1,
      age: scenario.current_age + (m + 1) / 12,
      balance,
      contribution: scenario.monthly_savings,
      growth: monthGrowth,
      cumulative_contribution: cumulativeContribution,
      cumulative_growth: cumulativeGrowth,
      phase: 'accumulation',
    });
  }

  const retirementPortfolio = balance;

  // 提现阶段（简化的月度提现模拟）
  const retirementMonths = scenario.retirement_years * 12;
  const monthlyWithdrawal = Math.round(scenario.annual_expenses / 12);
  const monthlyOtherIncome = scenario.post_retirement_monthly_income;
  const monthlyInflation = basisPointsToDecimal(scenario.inflation_rate) / 12;
  let currentWithdrawal = monthlyWithdrawal;

  for (let m = 0; m < retirementMonths; m++) {
    const monthGrowth = Math.round(balance * monthlyReturnRate);
    const netWithdrawal = Math.max(0, currentWithdrawal - monthlyOtherIncome);
    balance += monthGrowth - netWithdrawal;

    if (balance < 0) balance = 0;

    monthlyProjection.push({
      month: accumulationMonths + m + 1,
      age: scenario.retirement_age + (m + 1) / 12,
      balance,
      contribution: 0,
      growth: monthGrowth,
      cumulative_contribution: cumulativeContribution,
      cumulative_growth: cumulativeGrowth + monthGrowth,
      phase: 'retirement',
    });

    // 通胀调整提现额
    currentWithdrawal = Math.round(currentWithdrawal * (1 + monthlyInflation));
  }

  const progress = calculateProgress(currentValue, adjustedFireNumber);

  return {
    fire_number: fireNumber,
    adjusted_fire_number: adjustedFireNumber,
    retirement_portfolio: retirementPortfolio,
    progress,
    monthly_projection: monthlyProjection,
  };
}
```

- [ ] **Step 5: 运行测试验证通过**

Run: `cd fire-app && npx vitest run tests/services/fire-calc.test.ts`
Expected: PASS — 13个测试全部通过

- [ ] **Step 6: 提交**

```bash
cd fire-app
git add src/models/scenario.ts src/services/fire-calc.ts tests/services/fire-calc.test.ts
git commit -m "feat: FIRE计算引擎 — 多场景投影 + FIRE Number + 积累/提现模拟"
```

---

## Task 15: 集成测试 — 端到端工作流

**Files:**
- Test: `fire-app/tests/integration/workflow.test.ts`

- [ ] **Step 1: 写集成测试**

```typescript
// tests/integration/workflow.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, closeDatabase } from '../../src/db/connection.js';
import { initSchema } from '../../src/db/schema.js';
import { createUser } from '../../src/models/user.js';
import { seedCategories } from '../../src/models/category.js';
import { createAccount, getAccount, getNetWorth, getInvestableBalance } from '../../src/models/account.js';
import { createTransaction } from '../../src/services/transaction-service.js';
import { processRecurringTransactions } from '../../src/services/recurring-service.js';
import { generateMonthlySnapshot, getSnapshots } from '../../src/services/snapshot-service.js';
import { createScenario } from '../../src/models/scenario.js';
import { runProjection } from '../../src/services/fire-calc.js';
import { nowMs, addMonths } from '../../src/utils/time.js';
import type { Database as DatabaseType } from 'better-sqlite3';

describe('integration: FIRE APP 端到端工作流', () => {
  let db: DatabaseType;
  let userId: string;

  beforeEach(() => {
    db = createDatabase(':memory:');
    initSchema(db);
    userId = 'integration-user';
    createUser(db, { id: userId, display_name: '集成测试用户' });
    seedCategories(db, userId);
  });

  afterEach(() => {
    closeDatabase(db);
  });

  it('完整工作流: 建账 → 记账 → 快照 → FIRE计算', () => {
    // 1. 创建账户
    const checking = createAccount(db, {
      user_id: userId, name: '招商活期', asset_class: 'liquid', account_type: 'checking',
      initial_balance: 500000, // 5000元
    });
    const fund = createAccount(db, {
      user_id: userId, name: '沪深300定投', asset_class: 'invested', account_type: 'fund',
      initial_balance: 200000, // 2000元
    });
    const creditCard = createAccount(db, {
      user_id: userId, name: '信用卡', asset_class: 'liability', account_type: 'credit_card',
      initial_balance: -100000, // -1000元
    });

    // 2. 验证初始余额
    expect(getAccount(db, checking.id)!.current_balance).toBe(500000);
    expect(getAccount(db, fund.id)!.current_balance).toBe(200000);
    expect(getAccount(db, creditCard.id)!.current_balance).toBe(-100000);

    // 3. 记录收入（种子分类已在 seedCategories 调用时创建）
    // 直接用SQL查询获取分类ID
    const incomeCat = db.prepare(
      "SELECT * FROM categories WHERE user_id = ? AND name = '工资薪金'"
    ).get(userId) as { id: string };
    const expenseCat = db.prepare(
      "SELECT * FROM categories WHERE user_id = ? AND name = '食品'"
    ).get(userId) as { id: string };

    createTransaction(db, {
      user_id: userId,
      account_id: checking.id,
      category_id: incomeCat.id,
      transaction_type: 'income',
      amount: 1500000, // 15000元工资
      transaction_date: nowMs(),
    });

    // 4. 记录支出
    createTransaction(db, {
      user_id: userId,
      account_id: checking.id,
      category_id: expenseCat.id,
      transaction_type: 'expense',
      amount: 300000, // 3000元食品
      transaction_date: nowMs(),
    });

    // 5. 转账定投
    createTransaction(db, {
      user_id: userId,
      account_id: checking.id,
      to_account_id: fund.id,
      transaction_type: 'transfer',
      amount: 500000, // 5000元定投
      transaction_date: nowMs(),
    });

    // 6. 验证余额
    const checkingBalance = getAccount(db, checking.id)!.current_balance;
    const fundBalance = getAccount(db, fund.id)!.current_balance;
    // 活期: 500000(初始) + 1500000(工资) - 300000(食品) - 500000(转出) = 1200000
    expect(checkingBalance).toBe(1200000);
    // 基金: 200000(初始) + 500000(转入) = 700000
    expect(fundBalance).toBe(700000);

    // 7. 验证净资产
    const netWorth = getNetWorth(db, userId);
    // 1200000 + 700000 + 0(房产) + (-100000)(信用卡) = 1800000
    expect(netWorth).toBe(1800000);

    // 8. 验证可投资资产
    const investable = getInvestableBalance(db, userId);
    // liquid(1200000) + invested(700000) = 1900000
    expect(investable).toBe(1900000);

    // 9. 生成月度快照
    const snapshot = generateMonthlySnapshot(db, userId);
    expect(snapshot).not.toBeNull();
    expect(snapshot!.total_liquid).toBe(1200000);
    expect(snapshot!.total_invested).toBe(700000);
    expect(snapshot!.total_liability).toBe(-100000);
    expect(snapshot!.net_worth).toBe(1800000);

    // 10. 创建FIRE场景并计算
    const scenario = createScenario(db, {
      user_id: userId,
      name: '标准计划',
      current_age: 30,
      retirement_age: 50,
      auto_sync_assets: 1, // 自动从accounts同步
      monthly_savings: 500000, // 5000元/月
      annual_expenses: 6000000, // 6万/年
      expected_return_rate: 700, // 7%
      withdrawal_rate: 350, // 3.5%
      post_retirement_monthly_income: 300000, // 3000元/月养老金
    });

    const result = runProjection(db, scenario);

    // 验证FIRE计算
    expect(result.fire_number).toBe(171428571); // 6000000 × (10000/350)
    expect(result.adjusted_fire_number).toBeLessThan(result.fire_number);
    expect(result.progress).toBeGreaterThan(0);
    expect(result.monthly_projection.length).toBe(240 + 360); // 20年积累 + 30年退休
  });

  it('经常性交易工作流: 创建模板 → 补生成 → 余额更新', () => {
    const checking = createAccount(db, {
      user_id: userId, name: '活期', asset_class: 'liquid', account_type: 'checking',
      initial_balance: 1000000,
    });
    const fund = createAccount(db, {
      user_id: userId, name: '基金', asset_class: 'invested', account_type: 'fund',
    });

    // 创建月度定投模板（已过期3个月）
    const incomeCat = db.prepare(
      "SELECT * FROM categories WHERE user_id = ? AND name = '工资薪金'"
    ).get(userId) as { id: string };

    const threeMonthsAgo = addMonths(nowMs(), -3);
    db.prepare(`
      INSERT INTO recurring_transactions (id, user_id, account_id, to_account_id, category_id,
        transaction_type, amount, frequency, interval, start_date, end_date, next_due_date,
        last_generated_date, description, is_active, auto_create, sync_version, updated_at, deleted_flag)
      VALUES ('recur1', ?, ?, ?, ?, 'income', 1000000, 'monthly', 1, ?, NULL, ?, NULL,
        '月工资', 1, 1, 0, ?, 0)
    `).run(userId, checking.id, null, incomeCat.id, threeMonthsAgo, threeMonthsAgo, nowMs());

    // 处理经常性交易
    const generated = processRecurringTransactions(db, userId);
    expect(generated.length).toBeGreaterThanOrEqual(3);

    // 验证余额（每月10000元工资 × N月）
    const balance = getAccount(db, checking.id)!.current_balance;
    expect(balance).toBe(1000000 + 1000000 * generated.length);
  });

  it('快照历史工作流: 多月快照按日期降序', () => {
    createAccount(db, {
      user_id: userId, name: '活期', asset_class: 'liquid', account_type: 'checking',
      initial_balance: 100000,
    });

    // 手动插入3个月的历史快照
    const months = ['2026-01', '2026-02', '2026-03'];
    months.forEach((ym, i) => {
      db.prepare(`
        INSERT INTO net_worth_snapshots (id, user_id, snapshot_date, snapshot_year_month,
          total_liquid, total_invested, total_use_asset, total_liability, net_worth,
          sync_version, updated_at, deleted_flag)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0)
      `).run(`snap-${ym}`, userId, (i + 1) * 1000000, ym, 100000, 0, 0, 0, 100000, (i + 1) * 1000000);
    });

    // 生成本月快照
    generateMonthlySnapshot(db, userId);

    const snapshots = getSnapshots(db, userId);
    expect(snapshots.length).toBe(4); // 3个历史 + 1个本月
    // 降序排列
    expect(snapshots[0].snapshot_date).toBeGreaterThan(snapshots[1].snapshot_date);
  });
});
```

- [ ] **Step 2: 运行测试验证通过**

Run: `cd fire-app && npx vitest run tests/integration/workflow.test.ts`
Expected: PASS — 3个测试全部通过

- [ ] **Step 3: 运行全部测试**

Run: `cd fire-app && npx vitest run`
Expected: 所有测试通过，无失败

- [ ] **Step 4: 提交**

```bash
cd fire-app
git add tests/integration/workflow.test.ts
git commit -m "test: 集成测试 — 端到端FIRE APP工作流"
```

---

## Task 16: 最终验证与清理

**Files:**
- Verify: `fire-app/src/**/*.ts`
- Verify: `fire-app/tests/**/*.test.ts`

- [ ] **Step 1: TypeScript 类型检查**

Run: `cd fire-app && npx tsc --noEmit`
Expected: 无错误输出，退出码 0

- [ ] **Step 2: 运行全部测试套件**

Run: `cd fire-app && npx vitest run`
Expected: 所有测试通过。预期测试文件列表：
- `tests/utils/money.test.ts`
- `tests/utils/time.test.ts`
- `tests/utils/sync.test.ts`
- `tests/db/connection.test.ts`
- `tests/db/schema.test.ts`
- `tests/models/user.test.ts`
- `tests/models/category.test.ts`
- `tests/models/account.test.ts`
- `tests/models/recurring.test.ts`
- `tests/models/snapshot.test.ts`
- `tests/models/scenario.test.ts`
- `tests/services/transaction-service.test.ts`
- `tests/services/recurring-service.test.ts`
- `tests/services/snapshot-service.test.ts`
- `tests/services/fire-calc.test.ts`
- `tests/integration/workflow.test.ts`

- [ ] **Step 3: 验证 spec 覆盖检查表**

逐项确认 spec 中的设计要求已被实现：

| Spec 要求 | 实现位置 | 确认 |
|-----------|---------|------|
| 7张表DDL + 索引 | `src/db/schema.ts` | ☐ |
| 金额整数存分 | `src/utils/money.ts` | ☐ |
| 基点存储利率 | `src/utils/money.ts` (`basisPointsToDecimal`) | ☐ |
| 同步元数据 (updated_at/sync_version/deleted_flag) | `src/utils/sync.ts` | ☐ |
| UUID v4 主键 | 所有 model 文件 | ☐ |
| 软删除 (deleted_flag) | 所有 model 文件 | ☐ |
| 交易事务强一致 (写入/编辑/删除) | `src/services/transaction-service.ts` | ☐ |
| 反向调整余额 | `src/services/transaction-service.ts` | ☐ |
| 转账单记录双账户更新 | `src/services/transaction-service.ts` | ☐ |
| 初始余额自动生成 | `src/models/account.ts` (`createAccount`) | ☐ |
| 账户删除约束 (有关联交易禁止删除) | `src/models/account.ts` (`hasTransactions`/`softDeleteAccount`) | ☐ |
| 18条标准分类种子数据 | `src/models/category.ts` (`seedCategories`) | ☐ |
| 经常性交易补生成 (while循环) | `src/services/recurring-service.ts` | ☐ |
| next_due_date 推进 | `src/services/recurring-service.ts` (`advanceDueDate`) | ☐ |
| 快照月度唯一约束 | `src/db/schema.ts` (UNIQUE index) | ☐ |
| 快照分类存储 (5字段) | `src/models/snapshot.ts` | ☐ |
| 快照打开时生成 | `src/services/snapshot-service.ts` | ☐ |
| FIRE Number 计算 | `src/services/fire-calc.ts` (`calculateFireNumber`) | ☐ |
| 调整后FIRE Number (收入抵减) | `src/services/fire-calc.ts` (`calculateAdjustedFireNumber`) | ☐ |
| 积累阶段月度投影 | `src/services/fire-calc.ts` (`runProjection`) | ☐ |
| 进度百分比计算 | `src/services/fire-calc.ts` (`calculateProgress`) | ☐ |
| auto_sync_assets 实时汇总 | `src/services/fire-calc.ts` + `src/models/account.ts` (`getInvestableBalance`) | ☐ |
| 市场标志影响默认提现率 | `src/models/user.ts` (`createUser`) | ☐ |

- [ ] **Step 4: 清理临时文件**

检查并删除任何调试用的临时文件（如 `console.log`、测试数据库文件等）：

Run: `cd fire-app && ls *.db *.sqlite 2>/dev/null || echo "无临时数据库文件"`
Expected: "无临时数据库文件"（测试使用 `:memory:` 数据库）

- [ ] **Step 5: 最终提交**

```bash
cd fire-app
git add -A
git status
# 确认无遗漏文件
git commit -m "chore: 最终验证通过 — 全部测试通过，spec覆盖完整"
```

- [ ] **Step 6: 输出验证报告**

在终端输出最终状态：

```bash
cd fire-app
echo "=== FIRE APP 数据模型层 — 验证报告 ==="
echo ""
echo "TypeScript 类型检查:"
npx tsc --noEmit && echo "  PASS" || echo "  FAIL"
echo ""
echo "测试套件:"
npx vitest run --reporter=verbose 2>&1 | tail -5
echo ""
echo "代码文件数:"
find src -name "*.ts" | wc -l
echo ""
echo "测试文件数:"
find tests -name "*.test.ts" | wc -l
echo ""
echo "=== 验证完成 ==="
```

Expected: TypeScript PASS，全部测试通过，16个源文件，16个测试文件