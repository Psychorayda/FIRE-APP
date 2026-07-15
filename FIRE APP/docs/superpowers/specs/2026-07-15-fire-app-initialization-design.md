# FIRE 计算APP — 应用初始化设计

> **版本**: 1.0
> **日期**: 2026-07-15
> **状态**: 待审核
> **前置文档**: [前端架构设计文档 v1.0](./2026-07-15-fire-app-frontend-architecture-design.md), [用户数据模型设计文档 v1.0](./2026-07-12-fire-app-user-data-model-design.md)

---

## 1. 设计概述

### 1.1 目标

本文档定义 FIRE 计算APP 从 Electron 启动到用户可操作之间的完整初始化流程，覆盖以下核心目标：

1. **数据目录管理**：基于 Electron `app.getPath('userData')` 建立规范的目录结构，管理数据库文件、日志、备份三类资源。
2. **首次启动引导**：通过向导式交互完成用户档案创建和种子数据初始化，确保首次使用即可进入完整功能。
3. **后续启动恢复**：自动恢复数据库连接，补生成遗漏的经常性交易和月度快照，对用户透明。
4. **数据库迁移**：基于 `PRAGMA user_version` 建立可扩展的 schema 版本管理机制，支持未来迭代升级。
5. **配置管理**：明确用户数据与应用级配置的存储边界，用户相关数据存 SQLite，窗口/主题等应用级配置存 electron-store。
6. **进程职责对齐**：所有数据库操作在主进程执行，渲染进程通过 IPC 桥间接调用，与前端架构文档定义的进程隔离模型一致。

### 1.2 设计原则

| 原则 | 说明 |
|------|------|
| **最小改动复用** | 现有 `createDatabase()`, `initSchema()`, `createUser()`, `seedCategories()` 等函数签名保持不变，仅在外层增加初始化编排逻辑 |
| **首次判断基于数据而非文件** | 通过查询 `users` 表是否有记录判断是否首次启动，而非检查 DB 文件是否存在（DB 文件可能在 schema 初始化后已创建但无用户数据） |
| **幂等性优先** | 种子数据创建、快照生成均内置幂等检查，重复执行不产生副作用 |
| **迁移事务化** | 每个迁移步骤在独立事务中执行，失败则整体回滚，保证 schema 一致性 |
| **主进程持有 DB** | better-sqlite3 连接仅在主进程创建和管理，渲染进程通过 `contextBridge` + `ipcRenderer.invoke` 调用 |
| **渐进式启动** | 主进程完成 DB 初始化后即创建窗口，非关键后台任务（补生成、快照）异步执行不阻塞 UI |

### 1.3 初始化流程总览

```
Electron app.whenReady()
         │
         ▼
┌────────────────────────┐
│  主进程：创建数据目录      │  fs.mkdir({ recursive: true })
│  {userData}/fire-app/    │
│  ├── data/               │
│  ├── logs/               │
│  └── backups/            │
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│  主进程：打开数据库        │  createDatabase(dbPath)
│  启用 WAL + 外键约束     │  db.pragma('journal_mode = WAL')
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│  主进程：执行 Schema 迁移  │  runMigrations(db)
│  initSchema(db)         │  → PRAGMA user_version 检查
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│  主进程：检查首次启动      │  getFirstUser(db)
│  (users 表是否有记录)     │
└─────┬──────────┬───────┘
      │          │
  首次启动      后续启动
      │          │
      ▼          ▼
┌──────────┐  ┌───────────────────────┐
│ 渲染进程   │  │ 主进程：异步执行         │
│ 显示向导   │  │ ├── 补生成经常性交易     │
│ /onboarding│  │ │   processRecurring()  │
│           │  │ └── 生成月度快照         │
│ 用户填写   │  │     generateSnapshot() │
│ 显示名称   │  └───────┬───────────────┘
│ 选择市场   │          │
│ 确认偏好   │          ▼
│           │  ┌───────────────────────┐
│ 向导完成   │  │ 渲染进程：加载首页数据   │
│ ↓ IPC     │  │ → 显示主界面            │
└───┬───────┘  └───────────────────────┘
    │
    ▼
┌────────────────────────┐
│  主进程：创建用户记录      │  createUser(db, input)
│  + 创建种子数据           │  seedCategories(db, userId)
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│  渲染进程：跳转主页        │  navigate('/')
│  显示主界面              │
└────────────────────────┘
```

---

## 2. 数据目录约定

### 2.1 目录结构

基于 Electron `app.getPath('userData')` 建立以下目录结构（跨平台自动适配）：

```
{userData}/                    # app.getPath('userData') 返回值
│
│  Windows: C:\Users\{user}\AppData\Roaming\fire-app
│  macOS:   ~/Library/Application Support/fire-app
│  Linux:   ~/.config/fire-app
│
└── fire-app/                 # 应用数据根目录（与 productName 一致）
    │
    ├── data/                  # 数据库文件目录
    │   ├── fire.db            # SQLite 主数据库文件
    │   ├── fire.db-wal        # WAL 日志文件（SQLite 自动管理）
    │   └── fire.db-shm        # 共享内存文件（SQLite 自动管理）
    │
    ├── logs/                  # 日志文件目录
    │   └── app-2026-07-15.log # 按日期滚动的日志文件
    │
    └── backups/               # 数据库备份目录
        └── fire-20260715-143022.db  # 带时间戳的备份文件
```

> **说明**：`fire.db-wal` 和 `fire.db-shm` 是 SQLite WAL 模式的附属文件，由 SQLite 自动创建和维护，应用无需手动管理。在正常关闭数据库时，WAL 日志会被 checkpoint 合并回主数据库文件。

### 2.2 各文件路径规范

| 文件/目录 | 完整路径定义 | 命名规则 | 说明 |
|-----------|-------------|---------|------|
| 数据根目录 | `path.join(app.getPath('userData'), 'fire-app')` | 固定为 `fire-app` | 所有应用数据的根目录 |
| 数据库文件 | `path.join(dataRoot, 'data', 'fire.db')` | 固定为 `fire.db` | SQLite 主数据库，单一文件 |
| WAL 日志 | `path.join(dataRoot, 'data', 'fire.db-wal')` | SQLite 自动命名 | WAL 模式自动生成 |
| 日志文件 | `path.join(dataRoot, 'logs', \`app-${YYYY-MM-DD}.log\`)` | `app-` + ISO 日期 + `.log` | 按天滚动，便于排查问题 |
| 备份文件 | `path.join(dataRoot, 'backups', \`fire-${YYYYMMDD-HHmmss}.db\`)` | `fire-` + 紧凑时间戳 + `.db` | 迁移前自动备份 |

**路径计算函数签名**：

```typescript
// apps/desktop/src/main/paths.ts
// 数据目录路径管理 / Data directory path management

import { app } from 'electron';
import path from 'path';

/**
 * 获取应用数据根目录
 * Get application data root directory
 * @returns {userData}/fire-app 的完整路径
 */
export function getDataRoot(): string {
  return path.join(app.getPath('userData'), 'fire-app');
}

/**
 * 获取数据库文件路径
 * Get database file path
 * @returns 数据库文件的完整路径
 */
export function getDatabasePath(): string {
  return path.join(getDataRoot(), 'data', 'fire.db');
}

/**
 * 获取日志目录路径
 * Get logs directory path
 * @returns 日志目录的完整路径
 */
export function getLogsDir(): string {
  return path.join(getDataRoot(), 'logs');
}

/**
 * 获取备份目录路径
 * Get backups directory path
 * @returns 备份目录的完整路径
 */
export function getBackupsDir(): string {
  return path.join(getDataRoot(), 'backups');
}

/**
 * 生成带时间戳的备份文件路径
 * Generate timestamped backup file path
 * @returns 备份文件的完整路径，如 fire-20260715-143022.db
 */
export function getBackupFilePath(): string {
  const now = new Date();
  const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  return path.join(getBackupsDir(), `fire-${ts}.db`);
}
```

### 2.3 目录自动创建逻辑

主进程在 `app.whenReady()` 回调中，打开数据库之前递归创建所有目录：

```typescript
// apps/desktop/src/main/init/dirs.ts
// 数据目录初始化 / Data directory initialization

import fs from 'fs';
import { getDataRoot, getLogsDir, getBackupsDir, getDatabasePath } from '../paths';

/**
 * 创建所有必要的数据目录
 * Create all necessary data directories
 * 使用 fs.mkdir recursive 策略，目录已存在时不报错
 * @throws {Error} 磁盘空间不足或权限不足时抛出
 */
export function ensureDataDirectories(): void {
  const dirs = [getDataRoot(), getLogsDir(), getBackupsDir()];

  // 确保数据库文件所在目录存在
  const dbDir = path.dirname(getDatabasePath());
  dirs.push(dbDir);

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
```

**权限处理策略**：

| 场景 | 处理方式 |
|------|---------|
| 目录已存在 | `fs.existsSync` 检查后跳过，`recursive: true` 本身也不报错 |
| 父目录不存在 | `recursive: true` 自动创建完整路径链 |
| 权限不足 | 捕获 `EACCES` 错误，向用户展示友好的错误对话框并退出应用 |
| 磁盘空间不足 | 捕获 `ENOSPC` 错误，提示用户清理磁盘后重试 |
| 路径过长（Windows） | 捕获 `ENOENT` 或 `UNKNOWN` 错误，提示用户检查 userData 路径 |

---

## 3. 首次启动流程

### 3.1 首次启动判断逻辑

**判断方式**：检查 `users` 表是否有未删除的记录（`deleted_flag = 0`），而非检查数据库文件是否存在。

**理由**：数据库文件在 `initSchema(db)` 执行后即已创建，此时表结构已就绪但无用户数据。因此文件存在性不能作为首次启动的判断依据。

**判断函数签名**：

```typescript
// apps/desktop/src/main/models/user.ts (新增方法)
// 新增 getFirstUser 方法用于启动时检查

import type { Database as DatabaseType } from 'better-sqlite3';
import type { User } from '@fire-app/shared';

/**
 * 获取第一个未删除的用户记录（MVP 单用户模式）
 * Get the first non-deleted user record (MVP single-user mode)
 * 用于应用启动时判断是否已初始化
 * @param db 数据库实例 / Database instance
 * @returns 第一个用户记录，无用户时返回 null / First user record, or null if no user exists
 */
export function getFirstUser(db: DatabaseType): User | null {
  const row = db.prepare(
    'SELECT * FROM users WHERE deleted_flag = 0 ORDER BY updated_at ASC LIMIT 1'
  ).get() as User | undefined;
  return row ?? null;
}
```

> **注**：此函数与前端架构文档中 DataAccessPort 的 `getFirstUser()` 方法和 IPC 通道 `db:user:getFirst` 对应。前端架构文档已规划此方法（见 4.2 节 DataAccessPort 接口和 4.3 节 IPC 通道表），本文档补充其在 models 层的具体实现。

### 3.2 数据库创建与 Schema 初始化

**流程**：

1. 主进程调用 `ensureDataDirectories()` 创建目录结构
2. 调用现有 `createDatabase(dbPath)` 打开/创建数据库文件
   - 函数签名：`createDatabase(path: string = 'data/fire-app.db'): DatabaseType`（来自 `connection.ts`）
   - 内部自动启用 `foreign_keys = ON` 和 `journal_mode = WAL`
3. 调用现有 `initSchema(db)` 执行 DDL
   - 函数签名：`initSchema(db: DatabaseType): void`（来自 `schema.ts`）
   - 包含 7 张表的 `CREATE TABLE IF NOT EXISTS` 和 9 个 `CREATE INDEX IF NOT EXISTS`，共 16 条 DDL 语句
   - 所有 DDL 使用 `IF NOT EXISTS`，重复执行安全
4. 设置 schema 版本号
   - 首次创建后设置 `PRAGMA user_version = 1`
   - 已有数据库则读取当前版本号，由迁移逻辑处理

```typescript
// apps/desktop/src/main/init/database.ts
// 数据库初始化编排 / Database initialization orchestration

import type { Database as DatabaseType } from 'better-sqlite3';
import { createDatabase } from '../db/connection';
import { initSchema } from '@fire-app/shared/db/schema';
import { runMigrations } from '../db/migration';
import { getDatabasePath } from '../paths';

/**
 * 当前 Schema 版本号
 * Current schema version number
 */
export const CURRENT_SCHEMA_VERSION = 1;

/**
 * 初始化数据库：创建连接、执行 Schema、运行迁移
 * Initialize database: create connection, execute schema, run migrations
 * @returns 数据库实例 / Database instance
 * @throws {Error} 数据库文件损坏或迁移失败时抛出
 */
export function initializeDatabase(): DatabaseType {
  const dbPath = getDatabasePath();
  const db = createDatabase(dbPath);

  // 执行 Schema 初始化（幂等，CREATE TABLE IF NOT EXISTS）
  initSchema(db);

  // 读取当前版本号
  const currentVersion = db.pragma('user_version', { simple: true }) as number;

  // 首次创建：版本号为 0，设置为当前版本
  if (currentVersion === 0) {
    db.pragma(`user_version = ${CURRENT_SCHEMA_VERSION}`);
  } else if (currentVersion < CURRENT_SCHEMA_VERSION) {
    // 需要迁移
    runMigrations(db, currentVersion, CURRENT_SCHEMA_VERSION);
  }
  // currentVersion === CURRENT_SCHEMA_VERSION → 无需操作

  return db;
}
```

### 3.3 用户档案创建向导

首次启动时，渲染进程在 `/onboarding` 路由显示引导向导。向导完成后通过 IPC 调用主进程创建用户记录。

**向导步骤**：

| 步骤 | 页面内容 | 表单字段 | 校验规则 |
|------|---------|---------|---------|
| 1. 欢迎页 | 应用介绍 + FIRE 理念简介 + "开始"按钮 | 无 | 无 |
| 2. 输入显示名称 | 文本输入框 + 示例占位符 | `display_name: string` | 非空，1-20 字符，不允许纯空格 |
| 3. 选择市场 | 单选：中国市场 / 全球市场 | `is_china_market: number` | 必选一项（默认选中"中国市场"） |
| 4. 确认默认利率偏好 | 展示基于市场选择的默认值，允许调整 | `default_withdrawal_rate: number`（基点）<br>`default_expected_return: number`（基点）<br>`default_inflation_rate: number`（基点） | 提现率：200-600；预期回报：0-2000；通胀率：0-1000 |
| 5. 完成 | 汇总信息 + "完成创建"按钮 | 无 | 显示所有已填信息供确认 |

**市场选择与默认值映射**：

| 市场选择 | `is_china_market` | `default_withdrawal_rate` | `default_expected_return` | `default_inflation_rate` | `base_currency` |
|---------|-------------------|--------------------------|--------------------------|--------------------------|-----------------|
| 中国市场 | 1 | 350 (3.5%) | 700 (7%) | 300 (3%) | CNY |
| 全球市场 | 0 | 400 (4%) | 700 (7%) | 300 (3%) | USD |

> **注**：以上默认值与 `createUser()` 函数（`user.ts` 第 30-41 行）中的默认逻辑完全一致。中国市场默认提现率 350 基点，全球市场默认 400 基点。

**向导完成后的 IPC 调用**：

```typescript
// 渲染进程向导完成回调 / Renderer wizard completion callback
// 通过 DataAccessPort 调用主进程创建用户

async function handleWizardComplete(formData: OnboardingFormData): Promise<void> {
  // 1. 创建用户记录
  const user = await dataAccess.createUser({
    display_name: formData.display_name,
    is_china_market: formData.is_china_market,
    base_currency: formData.is_china_market ? 'CNY' : 'USD',
    default_withdrawal_rate: formData.default_withdrawal_rate,
    default_expected_return: formData.default_expected_return,
    default_inflation_rate: formData.default_inflation_rate,
  });

  // 2. 创建种子数据（分类）
  await dataAccess.seedCategories(user.id);

  // 3. 更新应用状态
  useAppStore.getState().setCurrentUser(user);
  useAppStore.getState().setInitialized(true);

  // 4. 跳转主页
  navigate('/');
}
```

**`CreateUserInput` 接口**（与现有 `user.ts` 完全一致）：

```typescript
export interface CreateUserInput {
  id?: string;                    // 可选，不传则自动生成 UUID v4
  display_name: string;           // 必填，用户显示名称
  base_currency?: string;         // 可选，默认 'CNY'
  is_china_market?: number;       // 可选，默认 1（中国市场）
  default_withdrawal_rate?: number; // 可选，中国市场默认 350，全球默认 400
  default_expected_return?: number; // 可选，默认 700（7%）
  default_inflation_rate?: number;  // 可选，默认 300（3%）
}
```

**主进程 IPC handler**（对应 IPC 通道 `db:user:create`）：

```typescript
// apps/desktop/src/main/ipc/user-handlers.ts
// 调用现有 createUser(db, input) 函数，签名不变

ipcMain.handle('db:user:create', (_event, input: CreateUserInput) => {
  return createUser(db, input);  // 返回 User 对象
});

ipcMain.handle('db:user:getFirst', () => {
  return getFirstUser(db);  // 返回 User | null
});

ipcMain.handle('db:category:seed', (_event, userId: string) => {
  seedCategories(db, userId);  // 返回 void
});
```

### 3.4 种子数据创建

**时机**：在用户记录创建成功后立即执行，通过 IPC 通道 `db:category:seed` 调用现有 `seedCategories(db, userId)` 函数。

**函数签名**（与现有 `category.ts` 完全一致）：

```typescript
/**
 * 为新用户创建预置标准分类
 * Seed default categories for a new user
 * @param db 数据库实例 / Database instance
 * @param userId 用户 ID / User ID
 */
export function seedCategories(db: DatabaseType, userId: string): void
```

**执行逻辑**（现有代码已实现，见 `category.ts` 第 93-119 行）：

1. 遍历 `SEED_CATEGORIES` 数组（18 个分类）
2. 为每个分类生成 UUID v4 作为 ID
3. 设置 `is_system = 1`（标记为系统内置）
4. 按数组索引设置 `display_order`（0-17）
5. 设置 `parent_id = null`（顶级分类）
6. 批量 INSERT 到 `categories` 表

> **注**：现有 `seedCategories()` 函数不使用事务包裹。在主进程 IPC handler 中，应在调用前后包裹事务，确保用户创建和种子数据创建的原子性。详见第 4.2 节幂等性保证。

---

## 4. 种子数据策略

### 4.1 内置标准分类清单

内置标准分类共 **18 个**（11 个支出 + 7 个收入），与数据模型文档 3.4 节和现有 `category.ts` 的 `SEED_CATEGORIES` 数组完全一致。

**支出分类（11 个）**：

| # | 分类名称 | type | linked_fire_concept | display_order | 说明 |
|---|---------|------|---------------------|---------------|------|
| 1 | 住房 | expense | — | 0 | 房租/房贷/物业/水电燃气 |
| 2 | 食品 | expense | — | 1 | 日用品/外出就餐 |
| 3 | 交通 | expense | — | 2 | 油费/公共交通/车辆维护 |
| 4 | 保险 | expense | `insurance_planning` | 3 | 健康险/车险/寿险/意外险 |
| 5 | 医疗 | expense | `china_medical_insurance` | 4 | 门诊/药品/牙科 |
| 6 | 娱乐 | expense | — | 5 | 流媒体/电影/爱好 |
| 7 | 购物 | expense | — | 6 | 服装/电子产品 |
| 8 | 个人护理 | expense | — | 7 | 理发/健身房 |
| 9 | 教育 | expense | — | 8 | 学费/书籍/课程 |
| 10 | 债务还款 | expense | `debt_management` | 9 | 信用卡还款/贷款还款 |
| 11 | 其他支出 | expense | — | 10 | 未分类支出 |

**收入分类（7 个）**：

| # | 分类名称 | type | linked_fire_concept | display_order | 说明 |
|---|---------|------|---------------------|---------------|------|
| 12 | 工资薪金 | income | — | 11 | 税后工资 |
| 13 | 自由职业 | income | — | 12 | 兼职/咨询/外包 |
| 14 | 投资收益 | income | — | 13 | 股息/利息/资本利得 |
| 15 | 租金收入 | income | `retirement_income_diversification` | 14 | 出租房产/房间 |
| 16 | 退税 | income | — | 15 | 个税退税 |
| 17 | 社保养老金 | income | `china_pension_system` | 16 | 退休后领取的养老金 |
| 18 | 其他收入 | income | — | 17 | 未分类收入 |

**核对结论**：现有 `category.ts` 的 `SEED_CATEGORIES` 数组包含 18 个条目（11 支出 + 7 收入），与数据模型文档 3.4 节完全一致。`linked_fire_concept` 字段共 5 个分类有值（保险、医疗、债务还款、租金收入、社保养老金），其余 13 个为 `null`。

### 4.2 创建时机与幂等性保证

**创建时机**：首次启动时，用户档案创建（`createUser()`）成功后立即执行 `seedCategories()`。

**原子性保证**：用户创建和种子数据创建应在同一事务中执行，确保不会出现"有用户但无分类"的不一致状态：

```typescript
// apps/desktop/src/main/ipc/user-handlers.ts
// 用户创建 + 种子数据创建的原子性包装
// Atomic wrapper for user creation + seed data creation

import { createUser, getFirstUser } from '../models/user';
import { seedCategories } from '../models/category';
import { hasSystemCategories } from '../models/category';

ipcMain.handle('db:user:create', (_event, input: CreateUserInput) => {
  // 在事务中执行用户创建和种子数据创建
  const result = db.transaction(() => {
    const user = createUser(db, input);
    seedCategories(db, user.id);
    return user;
  })();
  return result;
});

ipcMain.handle('db:category:seed', (_event, userId: string) => {
  // 幂等检查：如果已有系统分类则跳过
  if (hasSystemCategories(db, userId)) {
    return;  // 已存在种子数据，跳过
  }
  seedCategories(db, userId);
});
```

**幂等检查函数签名**（新增方法）：

```typescript
// apps/desktop/src/main/models/category.ts (新增方法)
// 新增幂等检查方法

/**
 * 检查用户是否已有系统内置分类
 * Check if user already has system categories
 * 用于种子数据的幂等性保证
 * @param db 数据库实例 / Database instance
 * @param userId 用户 ID / User ID
 * @returns true 表示已存在系统分类，应跳过种子数据创建
 */
export function hasSystemCategories(db: DatabaseType, userId: string): boolean {
  const row = db.prepare(
    'SELECT COUNT(*) as count FROM categories WHERE user_id = ? AND is_system = 1 AND deleted_flag = 0'
  ).get(userId) as { count: number };
  return row.count > 0;
}
```

### 4.3 种子数据与用户自定义数据的关系

| 规则 | 说明 |
|------|------|
| 不可删除 | `is_system = 1` 的分类不可通过软删除移除，应用层拦截删除请求并返回错误 |
| 可编辑名称 | 用户可修改系统分类的显示名称（如将"住房"改为"房租房贷"），`is_system` 标志不变 |
| 可新增子分类 | 用户可在系统分类下创建子分类（`parent_id` 指向系统分类），子分类 `is_system = 0` |
| 可新增顶级分类 | 用户可创建全新的顶级分类（`parent_id = null`），`is_system = 0` |
| FIRE 概念保留 | `linked_fire_concept` 字段在用户编辑名称时保持不变，确保知识库关联不丢失 |
| 删除约束 | 任何分类（含用户自定义）有关联交易时禁止删除，需先迁移交易到其他分类 |

---

## 5. 后续启动流程

### 5.1 数据库连接恢复

**主进程 `app.whenReady()` 时序**：

```typescript
// apps/desktop/src/main/index.ts (简化)
// 主进程入口 / Main process entry

import { app, BrowserWindow } from 'electron';
import { ensureDataDirectories } from './init/dirs';
import { initializeDatabase } from './init/database';
import { closeDatabase } from './db/connection';
import { registerHandlers } from './ipc/register-handlers';
import { runStartupTasks } from './init/startup-tasks';
import type { Database as DatabaseType } from 'better-sqlite3';

let db: DatabaseType | null = null;

app.whenReady().then(() => {
  // 1. 创建数据目录
  ensureDataDirectories();

  // 2. 初始化数据库（打开连接 + Schema + 迁移）
  db = initializeDatabase();

  // 3. 注册 IPC handlers
  registerHandlers(db);

  // 4. 创建主窗口
  const mainWindow = new BrowserWindow({
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.loadURL('app://./index.html');

  // 5. 异步执行后台任务（不阻塞窗口加载）
  // 检查是否首次启动，非首次则执行后台任务
  const user = getFirstUser(db);
  if (user) {
    runStartupTasks(db, user.id);  // 异步，不 await
  }
  // 首次启动：渲染进程自行处理向导流程
});

app.on('will-quit', () => {
  if (db) {
    closeDatabase(db);  // 关闭前 SQLite 自动 checkpoint WAL
  }
});
```

**连接配置**（与现有 `createDatabase()` 一致）：

| 配置项 | 值 | 说明 |
|--------|---|------|
| `foreign_keys` | `ON` | 启用外键约束，保证引用完整性 |
| `journal_mode` | `WAL` | Write-Ahead Logging，提升并发读写性能 |
| 连接持有方 | 主进程 | 单一 Database 实例，通过全局变量管理 |
| 连接生命周期 | 应用启动到退出 | `will-quit` 事件时关闭 |

### 5.2 经常性交易补生成检查

**触发时机**：数据库连接恢复后、确认用户已存在时，在主进程异步执行。

**调用函数**（与现有 `recurring-service.ts` 签名一致）：

```typescript
/**
 * 处理所有到期的经常性交易（补生成遗漏的交易）
 * Process all due recurring transactions (backfill missed transactions)
 * @param db 数据库实例 / Database instance
 * @param userId 用户 ID / User ID
 * @returns 生成的交易数组 / Array of generated transactions
 */
export function processRecurringTransactions(db: DatabaseType, userId: string): Transaction[]
```

**执行逻辑**（现有代码已实现，见 `recurring-service.ts`）：

1. 查询所有 `is_active = 1 AND deleted_flag = 0` 的模板
2. 对每条模板，检查 `next_due_date <= 当前时间`
3. 若满足，生成交易记录（`recurring_id` 指向模板），更新账户余额
4. 推进 `next_due_date`，更新 `last_generated_date`
5. 循环直到 `next_due_date > 当前时间`（补生成所有遗漏的交易）
6. 若 `end_date` 不为空且 `next_due_date > end_date`，设置 `is_active = 0`

**性能考量**：

| 场景 | 影响 | 应对策略 |
|------|------|---------|
| 正常（1-3 天未打开） | 生成 0-3 笔交易，毫秒级完成 | 无需特殊处理 |
| 长期未打开（1-6 个月） | 可能生成 1-6 笔月度交易 | 毫秒级完成，用户无感 |
| 极端情况（1 年未打开） | 可能生成 12 笔月度交易 | 仍在 100ms 内完成，可接受 |
| 大量日频模板 | 理论上可能生成 365+ 笔交易 | UI 显示 loading 状态，通过 IPC 进度通知 |

**UI Loading 状态**：

```typescript
// 渲染进程在 App.tsx 中监听启动任务进度
// Renderer listens to startup task progress in App.tsx

useEffect(() => {
  // 监听后台任务进度
  const cleanup = window.api.onStartupProgress((progress: StartupProgress) => {
    if (progress.stage === 'recurring') {
      useAppStore.getState().setLoading(true);
    }
    if (progress.stage === 'complete') {
      useAppStore.getState().setLoading(false);
      // 刷新数据
      refreshAllStores();
    }
  });
  return cleanup;
}, []);
```

### 5.3 月度快照生成检查

**触发时机**：经常性交易补生成完成后执行。

**调用函数**（与现有 `snapshot-service.ts` 签名一致）：

```typescript
/**
 * 生成当月净资产快照（如当月已存在则返回 null）
 * Generate current month's net worth snapshot (returns null if already exists)
 * @param db 数据库实例 / Database instance
 * @param userId 用户 ID / User ID
 * @returns 新生成的快照，或 null（当月已有快照）
 */
export function generateMonthlySnapshot(db: DatabaseType, userId: string): NetWorthSnapshot | null
```

**执行逻辑**（现有代码已实现，见 `snapshot-service.ts`）：

1. 获取当前时间 `nowMs()`，提取年月 `toYearMonth(now)`
2. 查询当月是否已有快照 `getSnapshotByMonth(db, userId, yearMonth)`
3. 若已存在，返回 `null`（幂等跳过）
4. 若不存在，按 `asset_class` 分组汇总所有账户余额
5. 计算 `net_worth = total_liquid + total_invested + total_use_asset + total_liability`
6. 插入新的快照记录

**执行顺序保证**：先补生成经常性交易（可能改变账户余额），再生成快照，确保快照反映最新余额。

### 5.4 后台任务调度策略

```typescript
// apps/desktop/src/main/init/startup-tasks.ts
// 启动后台任务编排 / Startup background task orchestration

import type { Database as DatabaseType } from 'better-sqlite3';
import { processRecurringTransactions } from '../services/recurring-service';
import { generateMonthlySnapshot } from '../services/snapshot-service';
import { BrowserWindow } from 'electron';

/**
 * 启动时执行的后台任务序列
 * Background task sequence executed on startup
 * 执行顺序：补生成经常性交易 → 生成月度快照
 * @param db 数据库实例 / Database instance
 * @param userId 用户 ID / User ID
 */
export function runStartupTasks(db: DatabaseType, userId: string): void {
  // 异步执行，不阻塞主进程
  setImmediate(() => {
    try {
      // 1. 通知渲染进程：开始后台任务
      sendProgress('recurring', 'started');

      // 2. 补生成经常性交易
      const generated = processRecurringTransactions(db, userId);

      // 3. 通知渲染进程：经常性交易完成
      sendProgress('recurring', 'completed', { count: generated.length });

      // 4. 生成月度快照
      sendProgress('snapshot', 'started');
      const snapshot = generateMonthlySnapshot(db, userId);

      // 5. 通知渲染进程：全部完成
      sendProgress('snapshot', 'completed', { generated: snapshot !== null });

      // 6. 通知渲染进程：刷新数据
      sendProgress('complete', 'done');
    } catch (error) {
      // 后台任务失败不阻塞应用使用，记录日志
      console.error('Startup task failed:', error);
      sendProgress('error', error instanceof Error ? error.message : String(error));
    }
  });
}

/**
 * 向渲染进程发送进度通知
 * Send progress notification to renderer process
 * @param stage 任务阶段 / Task stage
 * @param status 任务状态 / Task status
 * @param data 附加数据 / Additional data
 */
function sendProgress(stage: string, status: string, data?: unknown): void {
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    win.webContents.send('startup:progress', { stage, status, data, timestamp: Date.now() });
  }
}
```

**渲染进程监听**：

```typescript
// apps/desktop/src/preload/index.ts (新增)
// Preload 中暴露进度监听 API

const api = {
  // ... 现有 API ...

  // 启动进度监听 / Startup progress listener
  onStartupProgress: (callback: (progress: StartupProgress) => void) => {
    ipcRenderer.on('startup:progress', (_event, progress) => callback(progress));
    return () => ipcRenderer.removeAllListeners('startup:progress');
  },
};

// 启动进度对象类型
interface StartupProgress {
  stage: 'recurring' | 'snapshot' | 'complete' | 'error';
  status: string;
  data?: unknown;
  timestamp: number;
}
```

---

## 6. 数据库迁移

### 6.1 版本管理方案

**版本号存储**：使用 SQLite 的 `PRAGMA user_version` 记录当前 schema 版本号。

| 属性 | 说明 |
|------|------|
| 存储方式 | `PRAGMA user_version = N`（整数，存储在数据库文件头中） |
| 初始版本 | 1（首次创建 schema 后设置） |
| 当前版本 | 1（MVP 版本） |
| 读取方式 | `db.pragma('user_version', { simple: true })` 返回数字 |
| 跨数据库 | 每个数据库文件独立维护版本号，备份恢复后版本号随文件保留 |

**版本号递增规则**：

- 每次 schema 变更（新增表、新增字段、修改约束、新增索引）递增版本号
- 版本号只增不减，不因功能回退而降低
- 迁移函数一旦发布不可修改（保证已部署用户的一致性）

### 6.2 迁移脚本组织结构

```typescript
// apps/desktop/src/main/db/migration.ts
// 数据库迁移管理 / Database migration management

import type { Database as DatabaseType } from 'better-sqlite3';
import { getBackupFilePath } from '../paths';
import fs from 'fs';

/**
 * 迁移函数类型定义
 * Migration function type definition
 * @param db 数据库实例 / Database instance
 */
type MigrationFn = (db: DatabaseType) => void;

/**
 * 迁移注册表
 * Migration registry
 * key: 起始版本号, value: 迁移到下一版本的函数
 * 新增迁移时在此注册
 */
const MIGRATIONS: Map<number, { version: number; fn: MigrationFn; description: string }> = new Map([
  // 当前为版本 1，暂无已注册的迁移
  // 以下为未来版本迁移的注册示例：
  // {
  //   version: 1,
  //   fn: migrate_v1_to_v2,
  //   description: '添加 budgets 表支持预算管理'
  // },
  // {
  //   version: 2,
  //   fn: migrate_v2_to_v3,
  //   description: 'accounts 表增加 currency_code 字段'
  // },
]);

/**
 * 迁移函数示例：v1 → v2
 * Migration function example: v1 → v2
 * 演示如何编写一个迁移函数，当前未启用
 * @param db 数据库实例 / Database instance
 */
function migrate_v1_to_v2(db: DatabaseType): void {
  // 示例：新增 budgets 表
  db.exec(`
    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id),
      category_id TEXT NOT NULL REFERENCES categories(id),
      monthly_limit INTEGER NOT NULL,
      sync_version INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      deleted_flag INTEGER NOT NULL DEFAULT 0
    )
  `);
  // 示例：新增索引
  db.exec('CREATE INDEX IF NOT EXISTS idx_budget_user_cat ON budgets(user_id, category_id)');
}

/**
 * 执行数据库迁移
 * Execute database migrations
 * 从 fromVersion 依次迁移到 toVersion
 * @param db 数据库实例 / Database instance
 * @param fromVersion 当前版本号 / Current version
 * @param toVersion 目标版本号 / Target version
 * @throws {Error} 迁移失败时抛出，事务已回滚
 */
export function runMigrations(
  db: DatabaseType,
  fromVersion: number,
  toVersion: number
): void {
  // 迁移前创建备份
  createBackup(db);

  let currentVersion = fromVersion;

  while (currentVersion < toVersion) {
    const migration = MIGRATIONS.get(currentVersion);
    if (!migration) {
      throw new Error(`No migration found for version ${currentVersion} → ${currentVersion + 1}`);
    }

    console.log(`Running migration v${currentVersion} → v${currentVersion + 1}: ${migration.description}`);

    // 每个迁移在独立事务中执行
    db.transaction(() => {
      migration.fn(db);
      // 迁移成功后更新版本号
      db.pragma(`user_version = ${currentVersion + 1}`);
    })();

    currentVersion++;
  }

  console.log(`Migrations completed: v${fromVersion} → v${currentVersion}`);
}

/**
 * 创建数据库备份
 * Create database backup
 * 使用 SQLite 的 backup API 创建安全备份
 * @param db 数据库实例 / Database instance
 */
function createBackup(db: DatabaseType): void {
  const backupPath = getBackupFilePath();
  db.backup(backupPath);
  console.log(`Database backed up to: ${backupPath}`);
}
```

### 6.3 迁移执行流程

```
启动 → initializeDatabase()
         │
         ▼
    initSchema(db)          ← CREATE TABLE IF NOT EXISTS（幂等）
         │
         ▼
    读取 PRAGMA user_version
         │
         ├── version === 0  →  首次创建
         │                     设置 user_version = 1
         │                     无需迁移
         │
         ├── version === 1 (CURRENT_SCHEMA_VERSION)
         │                     版本已是最新
         │                     无需迁移
         │
         └── version < CURRENT_SCHEMA_VERSION
                               需要迁移
                                    │
                                    ▼
                              createBackup(db)
                                    │
                                    ▼
                              for v = version → CURRENT_SCHEMA_VERSION - 1:
                                    │
                                    ▼
                                BEGIN TRANSACTION
                                    │
                                    ▼
                                MIGRATIONS[v].fn(db)
                                    │
                                    ▼
                                PRAGMA user_version = v + 1
                                    │
                                    ▼
                                COMMIT
                                    │
                                    ▼
                              (若失败 → ROLLBACK)
```

### 6.4 迁移失败回滚策略

| 失败场景 | 回滚行为 | 用户提示 |
|---------|---------|---------|
| 迁移函数抛出异常 | 事务自动 ROLLBACK，数据库恢复到迁移前状态 | 弹出错误对话框，显示失败原因和迁移版本号 |
| 备份创建失败 | 中止迁移流程，不修改数据库 | 提示"无法创建备份，迁移已中止"，建议检查磁盘空间 |
| 版本号跳跃（缺少中间迁移） | 抛出错误，不执行任何迁移 | 提示"数据库版本异常，请联系支持" |
| 迁移后版本号不匹配 | 校验 `PRAGMA user_version` 是否等于预期值 | 不匹配则提示"迁移可能不完整，建议恢复备份" |

**错误处理代码**：

```typescript
// apps/desktop/src/main/init/database.ts (补充错误处理)

import { dialog } from 'electron';

export function initializeDatabase(): DatabaseType {
  const dbPath = getDatabasePath();
  const db = createDatabase(dbPath);

  try {
    initSchema(db);
    const currentVersion = db.pragma('user_version', { simple: true }) as number;

    if (currentVersion === 0) {
      db.pragma(`user_version = ${CURRENT_SCHEMA_VERSION}`);
    } else if (currentVersion < CURRENT_SCHEMA_VERSION) {
      runMigrations(db, currentVersion, CURRENT_SCHEMA_VERSION);
    }

    return db;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // 关闭可能损坏的连接
    try { db.close(); } catch { /* 忽略关闭错误 */ }

    // 向用户展示错误信息
    dialog.showErrorBox(
      '数据库初始化失败 / Database Initialization Failed',
      `数据库初始化或迁移失败：\n${message}\n\n` +
      `建议：\n` +
      `1. 从备份恢复数据库文件\n` +
      `2. 备份文件位于：${getBackupsDir()}\n` +
      `3. 如无备份，可能需要重新初始化（将丢失数据）`
    );

    throw error;  // 重新抛出，由上层处理应用退出
  }
}
```

---

## 7. 配置管理

### 7.1 配置存储方案选型

**对比分析**：

| 维度 | electron-store | SQLite users 表 |
|------|----------------|-----------------|
| 存储格式 | JSON 文件 | SQLite 表记录 |
| 访问方式 | 主进程同步读写 | 主进程通过 SQL 读写 |
| 适用场景 | 应用级配置（窗口尺寸、主题、语言） | 用户业务数据（档案、偏好） |
| 与用户数据关联 | 无关联（应用级独立） | 与用户 ID 绑定 |
| 同步支持 | 不参与同步 | 通过 sync_version 参与同步 |
| 读写性能 | 文件 I/O，小数据量毫秒级 | 内存缓存 + WAL，微秒级 |
| 依赖 | 需要额外安装 `electron-store` | 已有 better-sqlite3，无额外依赖 |

**选型结论**：

| 配置类型 | 存储位置 | 理由 |
|---------|---------|------|
| 用户档案与 FIRE 偏好 | SQLite `users` 表 | 与用户数据强关联，需参与同步，已在数据模型中定义 |
| 窗口尺寸/位置/最大化状态 | electron-store | 应用级配置，与用户数据无关，不需同步 |
| 主题偏好（亮色/暗色/跟随系统） | electron-store | 应用级 UI 偏好，在用户创建前即需生效 |
| 首次启动完成标志 | SQLite `users` 表 | 通过 `getFirstUser()` 判断，不单独存储标志 |
| 数据库 schema 版本 | SQLite `PRAGMA user_version` | SQLite 原生机制，与数据库文件绑定 |

> **理由**：用户相关数据存 SQLite `users` 表与现有数据模型一致（已定义 `is_china_market`、`default_withdrawal_rate` 等字段）。应用级配置（窗口、主题）使用 electron-store，避免在数据库中创建与业务无关的配置表，职责清晰。

### 7.2 配置项清单

**SQLite users 表配置项**（已有，通过 `createUser` / `updateUser` 管理）：

| 配置项 | 字段 | 类型 | 默认值 | 说明 |
|--------|------|------|--------|------|
| 显示名称 | `display_name` | TEXT | （用户输入） | 用户显示名称 |
| 基准货币 | `base_currency` | TEXT | `'CNY'` | ISO 4217 货币代码 |
| 市场选择 | `is_china_market` | INTEGER | `1` | 1=中国市场，0=全球市场 |
| 默认提现率 | `default_withdrawal_rate` | INTEGER | `350` | 基点（350=3.5%），中国市场默认 350，全球默认 400 |
| 默认预期回报率 | `default_expected_return` | INTEGER | `700` | 基点（700=7%） |
| 默认通胀率 | `default_inflation_rate` | INTEGER | `300` | 基点（300=3%） |
| 加密密钥哈希 | `encryption_key_hash` | TEXT | `null` | 同步加密密钥的验证哈希 |

**electron-store 配置项**（新增）：

| 配置项 | 键名 | 类型 | 默认值 | 说明 |
|--------|------|------|--------|------|
| 窗口宽度 | `window.width` | number | `1280` | 主窗口宽度（像素） |
| 窗口高度 | `window.height` | number | `800` | 主窗口高度（像素） |
| 窗口 X 坐标 | `window.x` | number | `undefined` | 窗口左上角 X 坐标（居中时为 undefined） |
| 窗口 Y 坐标 | `window.y` | number | `undefined` | 窗口左上角 Y 坐标（居中时为 undefined） |
| 窗口最大化 | `window.isMaximized` | boolean | `false` | 是否最大化 |
| 主题模式 | `theme.mode` | string | `'system'` | `'light'` / `'dark'` / `'system'` |
| 侧边栏折叠 | `ui.sidebarCollapsed` | boolean | `false` | 侧边栏是否折叠 |
| 最近使用页面 | `ui.lastPage` | string | `'/'` | 最近访问的路由路径 |

**electron-store 初始化**：

```typescript
// apps/desktop/src/main/config/store.ts
// 应用级配置管理 / Application-level configuration management

import Store from 'electron-store';

interface AppConfig {
  window: {
    width: number;
    height: number;
    x?: number;
    y?: number;
    isMaximized: boolean;
  };
  theme: {
    mode: 'light' | 'dark' | 'system';
  };
  ui: {
    sidebarCollapsed: boolean;
    lastPage: string;
  };
}

/**
 * 应用配置存储实例
 * Application configuration store instance
 * 使用 electron-store 管理，数据存储在 userData 目录
 */
export const configStore = new Store<AppConfig>({
  defaults: {
    window: {
      width: 1280,
      height: 800,
      isMaximized: false,
    },
    theme: {
      mode: 'system',
    },
    ui: {
      sidebarCollapsed: false,
      lastPage: '/',
    },
  },
});
```

### 7.3 窗口状态记忆

```typescript
// apps/desktop/src/main/index.ts (窗口状态管理部分)
// Window state management

import { configStore } from './config/store';

function createMainWindow(): BrowserWindow {
  const savedBounds = configStore.get('window');

  const mainWindow = new BrowserWindow({
    width: savedBounds.width,
    height: savedBounds.height,
    x: savedBounds.x,
    y: savedBounds.y,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // 恢复最大化状态
  if (savedBounds.isMaximized) {
    mainWindow.maximize();
  }

  // 监听窗口尺寸变化（防抖保存）
  let resizeTimer: NodeJS.Timeout | null = null;
  mainWindow.on('resize', () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!mainWindow.isMaximized() && !mainWindow.isMinimized()) {
        const bounds = mainWindow.getBounds();
        configStore.set('window', {
          width: bounds.width,
          height: bounds.height,
          x: bounds.x,
          y: bounds.y,
          isMaximized: false,
        });
      }
    }, 500);  // 500ms 防抖
  });

  // 监听最大化/取消最大化
  mainWindow.on('maximize', () => {
    configStore.set('window.isMaximized', true);
  });
  mainWindow.on('unmaximize', () => {
    configStore.set('window.isMaximized', false);
  });

  return mainWindow;
}
```

### 7.4 主题偏好管理

**主题切换方案**：使用 CSS 变量 + `document.documentElement.classList` 实现。

```typescript
// apps/desktop/src/renderer/styles/theme.ts
// 主题管理 / Theme management

type ThemeMode = 'light' | 'dark' | 'system';

/**
 * 应用主题模式
 * Apply theme mode
 * @param mode 主题模式 / Theme mode
 */
export function applyTheme(mode: ThemeMode): void {
  const root = document.documentElement;
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const effectiveDark = mode === 'dark' || (mode === 'system' && systemDark);

  root.classList.toggle('dark', effectiveDark);
  root.classList.toggle('light', !effectiveDark);
}

// 监听系统主题变化（当 mode='system' 时自动跟随）
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  const currentMode = window.api.getConfig('theme.mode');
  if (currentMode === 'system') {
    applyTheme('system');
  }
});
```

**CSS 变量定义**（Tailwind CSS v4 配合）：

```css
/* apps/desktop/src/renderer/styles/globals.css */
/* 全局样式 + 主题变量 / Global styles + theme variables */

:root {
  --color-bg-primary: #ffffff;
  --color-bg-secondary: #f9fafb;
  --color-text-primary: #111827;
  --color-text-secondary: #6b7280;
  --color-border: #e5e7eb;
}

:root.dark {
  --color-bg-primary: #1a1a2e;
  --color-bg-secondary: #16213e;
  --color-text-primary: #f1f5f9;
  --color-text-secondary: #94a3b8;
  --color-border: #334155;
}
```

**主题偏好的 IPC 暴露**：

```typescript
// apps/desktop/src/preload/index.ts (新增)
const api = {
  // ... 现有 API ...

  // 配置管理 / Configuration management
  config: {
    get: (key: string) => ipcRenderer.invoke('config:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('config:set', key, value),
  },
};
```

---

## 8. 启动序列

### 8.1 完整启动时序图

```
主进程 (Main)                         渲染进程 (Renderer)               IPC Bridge
─────────────                        ─────────────────                ──────────

app.whenReady()
    │
    ├── ensureDataDirectories()
    │   创建 {userData}/fire-app/
    │   ├── data/
    │   ├── logs/
    │   └── backups/
    │
    ├── initializeDatabase()
    │   ├── createDatabase(dbPath)
    │   │   └── WAL + foreign_keys ON
    │   ├── initSchema(db)
    │   │   └── 16 条 DDL (7 表 + 9 索引)
    │   └── 迁移检查
    │       └── PRAGMA user_version
    │           ├── 0 → 设为 1 (首次)
    │           ├── 1 → 无操作 (最新)
    │           └── <1 → runMigrations()
    │
    ├── registerHandlers(db)
    │   └── 注册所有 IPC handlers
    │
    ├── createMainWindow()
    │   ├── 读取 electron-store 窗口配置
    │   └── new BrowserWindow(...)
    │
    ├── loadURL(index.html)  ──────────────────►  React 应用加载
    │                                                   │
    │                                                   ├── App.tsx bootstrap
    │                                                   │   await initDatabase()  ───►  db:init
    │                                                   │   ← (void)
    │                                                   │
    │                                                   │   await getFirstUser()  ───►  db:user:getFirst
    │                                                   │   ← User | null
    │                                                   │
    │                                          ┌────────┴────────┐
    │                                          │                 │
    │                                     User === null      User !== null
    │                                     (首次启动)          (后续启动)
    │                                          │                 │
    │                                          ▼                 │
    │                                    Navigate('/onboarding')  │
    │                                    显示引导向导             │
    │                                          │                 │
    │                                    用户填写表单             │
    │                                    点击"完成创建"           │
    │                                          │                 │
    │                                          ▼                 │
    │                                    createUser(input) ──►  db:user:create
    │                                    ← User                      (主进程事务:
    │                                    seedCategories(id) ──►  db:category:seed   createUser +
    │                                    ← (void)                     seedCategories)
    │                                          │
    │                                    setCurrentUser(user)
    │                                    setInitialized(true)
    │                                    Navigate('/')
    │                                          │
    │                                          ▼                 ▼
    │                                    ┌─────────────────────────┐
    │                                    │  渲染进程加载首页数据     │
    │                                    │  ├── loadAccounts()     │
    │                                    │  ├── loadTransactions() │
    │                                    │  ├── loadSnapshots()    │
    │                                    │  └── loadScenarios()    │
    │                                    └─────────────────────────┘
    │
    ├── runStartupTasks(db, userId) [异步]       │
    │   ├── processRecurringTransactions()       │
    │   │   └── 补生成遗漏交易                    │
    │   ├── generateMonthlySnapshot()             │
    │   │   └── 生成当月快照                      │
    │   └── sendProgress('complete') ─────────►  收到进度通知
    │                                             └── refreshAllStores()
    │
    ▼
  应用就绪，用户可操作
```

### 8.2 首次启动时序（详细步骤）

| 步骤 | 进程 | 操作 | 函数/IPC | 说明 |
|------|------|------|---------|------|
| 1 | 主进程 | 创建数据目录 | `ensureDataDirectories()` | `fs.mkdir({ recursive: true })` |
| 2 | 主进程 | 打开数据库 | `createDatabase(dbPath)` | 创建 `fire.db`，启用 WAL + 外键 |
| 3 | 主进程 | 初始化 Schema | `initSchema(db)` | 7 表 + 9 索引，全部 `IF NOT EXISTS` |
| 4 | 主进程 | 设置版本号 | `PRAGMA user_version = 1` | 首次创建，版本 0 → 1 |
| 5 | 主进程 | 注册 IPC | `registerHandlers(db)` | 注册 33+ 个 IPC handler |
| 6 | 主进程 | 创建窗口 | `new BrowserWindow(...)` | 读取 electron-store 窗口配置 |
| 7 | 主进程 | 加载页面 | `mainWindow.loadURL(...)` | 渲染进程开始加载 React 应用 |
| 8 | 渲染进程 | 初始化 DB | `dataAccess.initDatabase()` → IPC `db:init` | 触发主进程执行 `initSchema(db)`（幂等，已执行则跳过） |
| 9 | 渲染进程 | 检查用户 | `dataAccess.getFirstUser()` → IPC `db:user:getFirst` | 返回 `null`（无用户记录） |
| 10 | 渲染进程 | 路由重定向 | `Navigate('/onboarding')` | `isInitialized = false`，路由守卫触发 |
| 11 | 渲染进程 | 显示向导 | OnboardingPage 渲染 | 欢迎页 → 输入名称 → 选择市场 → 确认偏好 |
| 12 | 渲染进程 | 创建用户 | `dataAccess.createUser(input)` → IPC `db:user:create` | 主进程事务：`createUser(db, input)` + `seedCategories(db, userId)` |
| 13 | 渲染进程 | 更新状态 | `setCurrentUser(user)` + `setInitialized(true)` | Zustand store 更新 |
| 14 | 渲染进程 | 跳转主页 | `Navigate('/')` | 路由守卫通过（`isInitialized = true`） |
| 15 | 渲染进程 | 加载数据 | `loadAccounts()` + `loadTransactions()` + ... | 各 Store 通过 DataAccessPort 加载数据 |
| 16 | 渲染进程 | 显示界面 | DashboardPage 渲染 | 用户看到主界面 |

### 8.3 后续启动时序（详细步骤）

| 步骤 | 进程 | 操作 | 函数/IPC | 说明 |
|------|------|------|---------|------|
| 1 | 主进程 | 创建数据目录 | `ensureDataDirectories()` | 目录已存在，`existsSync` 跳过 |
| 2 | 主进程 | 打开数据库 | `createDatabase(dbPath)` | 打开已有 `fire.db`，启用 WAL + 外键 |
| 3 | 主进程 | 初始化 Schema | `initSchema(db)` | 所有 DDL 为 `IF NOT EXISTS`，幂等跳过 |
| 4 | 主进程 | 迁移检查 | `PRAGMA user_version` | 版本号 = 1 = `CURRENT_SCHEMA_VERSION`，无需迁移 |
| 5 | 主进程 | 注册 IPC | `registerHandlers(db)` | 注册所有 IPC handler |
| 6 | 主进程 | 创建窗口 | `new BrowserWindow(...)` | 恢复窗口尺寸/位置/最大化状态 |
| 7 | 主进程 | 加载页面 | `mainWindow.loadURL(...)` | 渲染进程开始加载 |
| 8 | 主进程 | 检查用户 | `getFirstUser(db)` | 返回已有用户记录 |
| 9 | 主进程 | 启动后台任务 | `runStartupTasks(db, userId)` | 异步执行，不阻塞 |
| 9a | 主进程 | 补生成交易 | `processRecurringTransactions(db, userId)` | 检查并补生成到期的经常性交易 |
| 9b | 主进程 | 生成快照 | `generateMonthlySnapshot(db, userId)` | 检查并生成当月净资产快照 |
| 9c | 主进程 | 通知进度 | `webContents.send('startup:progress', ...)` | 通知渲染进程后台任务完成 |
| 10 | 渲染进程 | 初始化 DB | `dataAccess.initDatabase()` → IPC `db:init` | 幂等，已初始化则跳过 |
| 11 | 渲染进程 | 检查用户 | `dataAccess.getFirstUser()` → IPC `db:user:getFirst` | 返回已有用户 |
| 12 | 渲染进程 | 更新状态 | `setCurrentUser(user)` + `setInitialized(true)` | 直接进入已初始化状态 |
| 13 | 渲染进程 | 加载数据 | 各 Store 加载首页数据 | 账户、交易、快照、场景 |
| 14 | 渲染进程 | 显示界面 | DashboardPage 渲染 | 用户看到主界面（后台任务可能仍在执行） |
| 15 | 渲染进程 | 刷新数据 | 收到 `startup:progress` 通知后 | 后台任务完成，刷新 Store 数据 |

### 8.4 启动失败处理

| 失败场景 | 检测方式 | 处理策略 | 用户提示 |
|---------|---------|---------|---------|
| 数据目录创建失败 | `fs.mkdirSync` 抛出异常 | 捕获异常，记录日志 | "无法创建数据目录：{原因}。请检查磁盘权限。" |
| 数据库文件损坏 | `createDatabase` 或 `initSchema` 抛出异常 | 关闭连接，检查备份目录 | "数据库文件可能已损坏。建议从备份恢复：{备份路径}。" |
| 迁移失败 | `runMigrations` 抛出异常 | 事务回滚，数据库恢复迁移前状态 | "数据库迁移失败：{原因}。已自动回滚，请从备份恢复或联系支持。" |
| 磁盘空间不足 | `fs.mkdirSync` 或 SQLite 操作抛出 `ENOSPC` | 捕获异常，提前终止启动 | "磁盘空间不足，无法创建数据库文件。请清理磁盘后重试。" |
| IPC 注册失败 | `ipcMain.handle` 重复注册抛出异常 | 捕获异常，记录日志 | 开发模式下提示，生产环境忽略（可能由 HMR 重载引起） |
| 渲染进程加载失败 | `did-fail-load` 事件 | 重试一次，仍失败则提示 | "应用页面加载失败。请重启应用。" |
| 后台任务失败 | `runStartupTasks` 内 try-catch | 记录日志，不阻塞 UI | UI 右下角显示 toast 提示"部分数据更新失败" |

**磁盘空间预检查**：

```typescript
// apps/desktop/src/main/init/dirs.ts (补充)
// 磁盘空间预检查

import fs from 'fs';

/**
 * 检查磁盘是否有足够空间（至少 10MB）
 * Check if disk has sufficient space (at least 10MB)
 * @param dirPath 要检查的目录路径
 * @throws {Error} 磁盘空间不足时抛出
 */
export function checkDiskSpace(dirPath: string): void {
  const MIN_SPACE_BYTES = 10 * 1024 * 1024; // 10MB

  try {
    const stats = fs.statfsSync(dirPath);
    const availableSpace = stats.bavail * stats.bsize;

    if (availableSpace < MIN_SPACE_BYTES) {
      throw new Error(
        `磁盘空间不足。可用: ${(availableSpace / 1024 / 1024).toFixed(1)}MB，` +
        `需要至少: ${MIN_SPACE_BYTES / 1024 / 1024}MB`
      );
    }
  } catch (error) {
    // statfsSync 在某些平台可能不可用，忽略检查
    if (error instanceof Error && error.message.includes('磁盘空间不足')) {
      throw error;
    }
    // 其他错误忽略，不阻塞启动
  }
}
```

---

## 附录：决策记录表

| # | 决策项 | 选择 | 理由 |
|---|--------|------|------|
| 1 | 首次启动判断方式 | 查询 `users` 表记录 | DB 文件在 schema 初始化后即创建，文件存在性不能作为判断依据 |
| 2 | 数据目录根路径 | `app.getPath('userData') + '/fire-app'` | Electron 跨平台标准路径，用户数据与系统应用数据隔离 |
| 3 | 目录创建策略 | `fs.mkdir({ recursive: true })` + `existsSync` 预检 | recursive 模式自动创建父目录，已存在时不报错 |
| 4 | Schema 版本管理 | `PRAGMA user_version` | SQLite 原生机制，版本号存储在数据库文件头中，无需额外表 |
| 5 | 迁移事务粒度 | 每个版本迁移独立事务 | 单个迁移失败不影响其他已完成的迁移，回滚粒度最小化 |
| 6 | 迁移前备份 | `db.backup()` API | SQLite 原生备份 API，保证备份一致性（包含 WAL 数据） |
| 7 | 种子数据创建时机 | 用户创建后立即执行，同一事务 | 保证不会出现"有用户但无分类"的不一致状态 |
| 8 | 种子数据幂等性 | `hasSystemCategories()` 检查 | 防止重复创建，支持故障恢复后重新执行 |
| 9 | 内置分类数量 | 18 个（11 支出 + 7 收入） | 与数据模型文档 3.4 节和 `category.ts` `SEED_CATEGORIES` 数组完全一致 |
| 10 | 用户级配置存储 | SQLite `users` 表 | 与业务数据强关联，需参与同步 |
| 11 | 应用级配置存储 | electron-store | 窗口/主题等配置与用户数据无关，JSON 文件足够 |
| 12 | 窗口状态记忆 | electron-store + 防抖保存 | 避免频繁写文件，500ms 防抖足够 |
| 13 | 主题切换方案 | CSS 变量 + `classList.toggle` | Tailwind CSS v4 原生支持 dark 模式变体 |
| 14 | 后台任务执行方式 | `setImmediate` 异步执行 | 不阻塞窗口加载，通过 IPC 进度通知渲染进程 |
| 15 | 后台任务执行顺序 | 补生成交易 → 生成快照 | 快照需反映最新余额，交易补生成可能改变余额 |
| 16 | 后台任务失败处理 | 记录日志 + 不阻塞 UI | 后台任务为非关键路径，失败不影响核心功能 |
| 17 | 渲染进程启动检查 | `getFirstUser()` 返回值判断 | 与前端架构文档 `App.tsx` bootstrap 逻辑一致 |
| 18 | 数据库关闭时机 | `app.on('will-quit')` | 确保所有 IPC 请求完成后关闭，SQLite 自动 checkpoint WAL |
| 19 | 迁移函数不可变性 | 发布后不可修改 | 保证已部署用户的迁移路径一致，新增变更只能追加新迁移 |
| 20 | 备份文件命名 | `fire-YYYYMMDD-HHmmss.db` | 时间戳确保唯一性，便于按时间排序查找 |
