# 数据库持久化 T0 修复设计

**日期**：2026-08-04
**状态**：待审阅
**优先级**：T0（阻断性数据丢失）
**关联**：自动更新 / Onboarding / db-manager

## 背景与问题

用户多次反馈：完成 Onboarding 创建账户后，重启应用会回到 Onboarding 页面，账户信息丢失。安装 v67（已包含"安装前同步关闭数据库"+"完整性检查自动重建"修复）后问题仍然存在。

这是一个**数据丢失**类阻断性 BUG，直接影响产品可用性，列为 T0 最高优先级。

## 根因（已通过代码审查确认）

根因在 [db-manager.ts](file:///workspace/apps/desktop/src/main/db-manager.ts) 的 `initDatabase()`：**"自愈"逻辑实际是"自毁"逻辑**——在打开失败或完整性检查未通过时，会**永久删除数据库文件并重建空库**。

### 危险路径 1：完整性检查误判（第 64-85 行）

```typescript
if (!checkIntegrity(dbInstance)) {
  // 重命名 db 为 .corrupted 备份
  // unlinkSync 删除 -wal 和 -shm（可能含未 checkpoint 的用户数据）
  // 创建全新空库
}
```

`checkIntegrity()` 只要 `db.pragma('integrity_check')` **抛错**（native 模块抖动、文件锁）或返回格式不符，就清空全部数据。WAL 文件被删除意味着未 checkpoint 的写入也一并丢失。

### 危险路径 2：打开失败兜底（第 90-106 行）

```typescript
catch (err) {
  // unlinkSync 直接删除 db 文件
  // 删除 -wal / -shm
  // 创建全新空库
}
```

`createDatabase()` 因**任何瞬时原因**抛错即触发删除。常见瞬时原因：
- Windows Defender / 杀毒软件扫描刚修改的文件 → 文件锁
- 用户双击快捷方式启动第二实例 → DB 被第一个实例锁定
- 文件句柄未及时释放 / 权限抖动

### 表现时序

1. Onboarding 写入用户 → `fire.db` + `fire.db-wal` → 成功提示 → Dashboard ✓
2. 关闭 → `closeAppDatabase()` checkpoint + close ✓（已修好）
3. **下次启动** → `initDatabase()`：
   - 杀毒扫描 / 第二实例抢锁 → 打开抛错或 `integrity_check` 失败
   - **DB 文件被删除** → 空库 → `getFirstUser()` 返回 null → 回到 Onboarding

### 加剧因素

1. **无单实例锁**：多实例竞争 DB，第二实例打开失败 → 删除 DB。
2. **双层 `fire-app` 路径**：`fixUserDataPath()` 设 userData=`appData/fire-app`，`getDataDir()` 又拼 `fire-app/data` → 实际 `appData/fire-app/fire-app/data/fire.db`。路径稳定不直接丢数据，但与 productName `FIRE App`（带空格）默认路径不一致，旧数据可能被孤立，且路径混乱增加排查难度。
3. **`db-manager` 无文件日志**：`debugLog` 仅在 `index.ts`，`db-manager` 用 `console.log`（打包后不可见），无法事后诊断到底走了哪条路径。

## 设计目标

- **绝不静默删除用户数据**：打开失败 / 完整性异常时保留原文件，明确报错，绝不 unlink。
- **可诊断**：每次启动写文件日志，记录路径、打开结果、完整性结果、用户表行数。
- **防并发**：单实例锁，杜绝多实例抢锁。
- **路径清晰**：消除双层 `fire-app`，userData 与 data 目录关系单一明确。
- **可回滚**：单次提交可回退。
- **不破坏现有 IPC / 渲染层**：renderer 零改动。

## 方案

### 核心原则

**永远不要自动删除用户数据库。** 损坏或锁定应被报告，而非销毁。

### 1. 重写 `initDatabase()` 错误处理

| 场景 | 旧行为（危险） | 新行为（安全） |
|------|----------------|----------------|
| `createDatabase` 抛错 | 删除文件 + 重建空库 | **重抛异常**，应用显示错误页，文件原样保留（**绝不碰 `-wal`/`-shm`**，WAL 含未 checkpoint 写入，SQLite 下次打开自动 replay 恢复） |
| `integrity_check` 非 'ok' | 重命名 + 删 WAL + 重建 | **仅记录警告**，继续使用（SQLite 多数异常可读）；若后续 schema 初始化失败再降级 |
| `initSchema` 抛错 | 删除文件 + 重建 | 重抛异常，文件保留 |

**WAL 保护原则**：正常打开失败重抛时，**绝不删除 `-wal`/`-shm` 文件**。WAL 含未 checkpoint 的用户写入，SQLite 下次成功打开时会自动 replay 恢复。删除 WAL = 丢失未 checkpoint 数据。仅在降级重建（主库已备份为 `.corrupted-<ts>`）后才清理 `-wal`/`-shm`。

降级策略（仅当确需重建时）：
- 重命名原文件为 `fire.db.corrupted-<timestamp>`（**保留数据**供事后恢复）
- 删除残留的 `-wal`/`-shm`（此时主库已备份，WAL 无意义）
- 创建新库
- **大声告警**写日志 + 主进程 console.error
- **通过 IPC 通知 renderer 显示明确提示**（非静默回 Onboarding）："数据库已损坏并已备份为 `.corrupted-<ts>`，请联系支持恢复数据。当前已创建新空库。"——避免用户误以为"又丢数据"
- 此降级仅在"打开成功但 schema 初始化失败"且"确认是结构损坏"时触发，不在"打开抛错"时触发（打开抛错多为瞬时锁，应让用户重试）

### 2. 单实例锁

`app.whenReady()` 之前调用 `app.requestSingleInstanceLock()`：
- 获取锁失败（第二实例）→ `app.quit()` 立即退出，不触碰 DB
- 主实例收到 `second-instance` 事件 → 聚焦并激活已有窗口

### 3. 修正路径

`getDataDir()` 改为 `join(app.getPath('userData'), 'data')`，不再拼 `fire-app`。
因 `fixUserDataPath()` 已把 userData 固定为 `appData/fire-app`，最终 DB 路径变为 `appData/fire-app/data/fire.db`（单层 fire-app）。

**迁移**：启动时若检测到旧路径 `appData/fire-app/fire-app/data/fire.db` 存在且新路径不存在，执行 **copy → 验证可打开 → delete 源** 三步迁移，避免老用户数据丢失。迁移任一步失败则回退使用旧路径（记日志），不强行删除源。

### 4. 文件诊断日志

在 `db-manager.ts` 引入与 `index.ts` 相同的 `debugLog`（写 `userData/fire-app-debug.log`），记录：
- 每次 `initDatabase` 的 dbPath
- `createDatabase` 成功 / 失败 + 错误信息
- `integrity_check` 原始返回
- `users` 表行数（启动后）
- 是否触发降级重建
- `closeAppDatabase` 的 checkpoint / close 结果

### 5. 保留并强化正确部分

- `closeAppDatabase()` 的 `wal_checkpoint(TRUNCATE)` + close：保留，正确。
- `install-runner.ts` 安装前同步关闭：保留，正确。
- `before-quit` / `window-all-closed` 双重关闭：保留（`closeAppDatabase` 幂等）。

### 6. `busy_timeout` 防瞬时锁（补强）

[connection.ts](file:///workspace/packages/shared/src/db/connection.ts) 的 `createDatabase()` 当前未设 `busy_timeout`，better-sqlite3 默认 `0`，任何瞬时锁（杀毒扫描、文件句柄延迟释放）立即抛 `SQLITE_BUSY`。spec 已移除"打开失败删库"，但瞬时锁会让用户频繁看到"数据库打开失败"错误页，体验差且易误判。

修复：在 `createDatabase()` 的 `journal_mode = WAL` 之后加 `db.pragma('busy_timeout = 5000')`，让 SQLite 遇到锁自动重试 5 秒，消化 99% 瞬时锁。该改动在 shared 层，对所有调用方（主进程 + 测试）生效，零副作用。

### 7. 降级重建 IPC 通知（补强）

降级重建后若静默回 Onboarding，用户会误以为"又丢数据"。新增 IPC 通道让 main 主动通知 renderer：

- `db:corrupted-recovered` 事件（main → renderer，单向推送）：payload 含 `{ backupPath, timestamp }`
- renderer 收到后通过 `useToastStore.showError` 显示明确提示："数据库已损坏并已备份为 `fire.db.corrupted-<ts>`，请联系支持恢复。当前已创建新空库。"
- preload 暴露 `window.dataAccess.onCorruptedRecovered(callback)` 订阅

仅降级路径触发，正常启动零开销。

## 架构

```
packages/shared/src/db/
└── connection.ts         (改造：加 busy_timeout = 5000)

apps/desktop/src/main/
├── index.ts              (改造：加单实例锁)
├── db-manager.ts         (重写：安全错误处理 + 路径修正 + 日志 + 迁移 + 降级 IPC 通知)
└── updater/
    └── install-runner.ts (不改：已正确)

apps/desktop/src/preload/
└── index.ts              (改造：暴露 onCorruptedRecovered 订阅)

apps/desktop/src/renderer/src/
└── App.tsx               (改造：订阅 db:corrupted-recovered，显示 toast 提示)
```

涉及文件：
| 文件 | 改动 |
|------|------|
| `packages/shared/src/db/connection.ts` | 加 `busy_timeout = 5000` |
| `apps/desktop/src/main/db-manager.ts` | 重写 `initDatabase`、修正 `getDataDir`、加 `debugLog`、加迁移逻辑、降级时发 IPC 事件 |
| `apps/desktop/src/main/index.ts` | 加单实例锁 |
| `apps/desktop/src/preload/index.ts` | 暴露 `onCorruptedRecovered` 订阅 |
| `apps/desktop/src/renderer/src/App.tsx` | 订阅降级事件，显示 toast |
| `apps/desktop/tests/db-manager.test.ts` | 新增：覆盖打开失败不删库、完整性异常不删库、WAL 保留、迁移逻辑、busy_timeout |

## 数据流

### 正常启动（有数据）

```
app.whenReady
  → requestSingleInstanceLock（成功）
  → fixUserDataPath
  → initDatabase
      → getDataDir (appData/fire-app/data)
      → 若新路径无库但旧路径有 → 迁移
      → createDatabase（成功）
      → checkIntegrity（ok）→ 仅记日志
      → initSchema（幂等）
      → 记日志：users 行数
  → registerIpcHandlers
  → createWindow
  → renderer initialize() → getFirstUser → 返回用户 → initialized=true
```

### 异常启动（杀毒锁文件）

```
initDatabase
  → createDatabase（busy_timeout 自动重试 5s）
    → 5s 内锁释放 → 成功打开 → 正常流程
    → 5s 仍锁 → 抛 SQLITE_BUSY
  → 记日志：打开失败 + 错误
  → 重抛异常（不删文件，不碰 -wal/-shm！）
  → 应用显示"数据库打开失败，请关闭其他实例或杀毒软件后重试"错误页
  → 用户重试 → 成功打开 → WAL 自动 replay → 数据仍在
```

### 异常启动（确实损坏）

```
initDatabase
  → createDatabase（成功）
  → checkIntegrity（返回非 ok，如 "database disk image is malformed"）
  → 记日志：完整性异常 + 原始返回
  → 尝试 initSchema
    → 若成功：继续用（多数情况可读）
    → 若失败：降级
        → renameSync 备份为 fire.db.corrupted-<ts>
        → 删除 -wal/-shm（主库已备份）
        → 新建空库
        → 告警日志 + console.error
        → IPC 推送 db:corrupted-recovered 事件
        → renderer 显示 toast："数据库已损坏并备份，请联系支持恢复"
```

## 测试

### 单元测试（`tests/db-manager.test.ts` 新增）

用 `:memory:` 与临时文件验证：

1. **打开成功 + 完整性 ok** → 正常返回，日志含 users 行数。
2. **createDatabase 抛错**（mock 或指向不可写路径）→ `initDatabase` 抛错，**原文件未被删除**，**`-wal`/`-shm` 未被删除**。
3. **integrity_check 非 ok**（mock pragma 返回非 ok）→ 不抛错、不删库、记警告日志。
4. **降级重建**（initSchema 抛错）→ 原库重命名为 `.corrupted-<ts>`（保留），新库创建，IPC `db:corrupted-recovered` 事件被发送。
5. **迁移逻辑**：旧路径有库、新路径无库 → copy→验证→delete 后新路径可读、旧路径已清；迁移失败时回退旧路径。
6. **单实例锁**：第二实例 `requestSingleInstanceLock` 返回 false → quit。
7. **busy_timeout**：`createDatabase` 后 `db.pragma('busy_timeout')` 返回 5000。

### shared 层测试（`packages/shared/tests/db/connection.test.ts` 补充）

- `createDatabase` 后 `busy_timeout = 5000`、`journal_mode = 'wal'`、`foreign_keys = 1`。

### 手动验证（用户侧）

1. 安装修复版本，完成 Onboarding，**正常关闭**后重启 → 应保留账户。
2. 完成 Onboarding 后，**任务管理器强杀**进程 → 重启 → 应保留账户（WAL 自动恢复）。
3. 完成 Onboarding 后，**双击快捷方式两次**（启动两实例）→ 第二实例退出，第一实例数据不丢。
4. 查看 `%APPDATA%\fire-app\fire-app-debug.log` → 应有完整启动日志。

## 风险

| 风险 | 缓解 |
|------|------|
| 旧用户数据在双层路径，新代码读单层路径 → 看似丢数据 | 迁移逻辑：检测旧路径并移动 |
| 迁移过程中崩溃 → 数据半移动 | 三步迁移（copy → 验证 → delete）；失败回退旧路径，不强行删除源 |
| 去掉自动重建后，真正损坏的库无法启动 | 降级逻辑仍会备份 + 重建，只是不轻易触发；且保留 .corrupted 备份 |
| 单实例锁在某些环境异常 | 失败时 fallback 允许启动（记日志），不阻断 |

## 不做（YAGNI）

- 不做数据库加密（已有 `encryption_key_hash` 字段预留，非本次范围）。
- 不做云同步 / 远程备份。
- 不改 Onboarding 流程。
- 不改 schema。
- 不引入额外依赖。
