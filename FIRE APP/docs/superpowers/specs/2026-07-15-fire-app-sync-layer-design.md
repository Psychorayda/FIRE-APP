# FIRE 计算APP — 同步层详细设计

> **版本**: 1.0
> **日期**: 2026-07-15
> **状态**: 待审核
> **前置文档**: `2026-07-15-fire-app-frontend-architecture-design.md` v1.0, `2026-07-15-fire-app-data-export-import-design.md` v1.0
> **范围**: 定义多设备数据同步的抽象接口、增量同步协议、LWW 冲突解决算法、离线队列和重试机制。本设计仅定义接口和协议，不含服务器端实现

---

## 1. 设计目标

1. **接口先行**：定义 `SyncPort` 抽象接口，锁定数据结构和协议，为未来实现预留清晰的接入点
2. **增量同步**：仅同步 `updated_at > last_sync_at` 的记录，减少数据传输量
3. **自动冲突解决**：LWW + sync_version 三级比较，无需用户干预
4. **离线容错**：指数退避重试机制，网络恢复后自动重试
5. **零知识架构**：同步数据加密传输，服务器仅存储加密 blob，无法解密用户数据
6. **跨平台复用**：SyncPort 接口同时适用于桌面端（Electron）和移动端（React Native）

---

## 2. 设计原则

- **接口与实现分离**：本设计仅定义接口和协议，不绑定具体服务器技术
- **与导入流程一致**：同步的 LWW 合并算法与数据导入的合并算法保持一致
- **主进程持有同步逻辑**：所有同步操作在主进程执行，渲染进程通过 IPC 触发
- **非破坏性同步**：同步不会删除本地数据，仅 INSERT/UPDATE/SKIP

---

## 3. SyncPort 接口定义

### 3.1 核心接口

```typescript
/**
 * 同步端口接口 — 定义数据同步的抽象层
 * 桌面端实现通过 HTTP/WebSocket 与同步服务器通信
 * 移动端实现可复用相同接口
 */
interface SyncPort {
  /**
   * 推送本地变更到服务器
   * 发送 updated_at > lastSyncAt 的所有记录
   */
  push(changes: SyncPayload): Promise<SyncResult>;

  /**
   * 拉取服务器变更到本地
   * 获取服务器端 updated_at > lastSyncAt 的所有记录
   */
  pull(lastSyncAt: number): Promise<SyncPayload>;

  /**
   * 获取同步状态
   */
  getSyncStatus(): SyncStatus;

  /**
   * 设置同步凭证（token 等）
   */
  setCredentials(credentials: SyncCredentials): void;
}
```

### 3.2 辅助类型

```typescript
interface SyncPayload {
  tables: {
    users: SyncRecord[];
    accounts: SyncRecord[];
    categories: SyncRecord[];
    transactions: SyncRecord[];
    recurring_transactions: SyncRecord[];
    net_worth_snapshots: SyncRecord[];
    fire_scenarios: SyncRecord[];
  };
  sync_from: number;  // 本次同步的起始时间戳
  sync_to: number;    // 本次同步的截止时间戳
}

interface SyncRecord {
  [key: string]: unknown;  // 各表的完整记录
}

interface SyncResult {
  success: boolean;
  pushed: number;    // 推送的记录数
  conflicts: number; // 冲突数（已自动解决）
  errors: string[];
}

interface SyncStatus {
  lastSyncAt: number | null;
  isSyncing: boolean;
  pendingChanges: number;  // 待同步的本地变更数
  retryCount: number;      // 当前重试次数
  nextRetryAt: number | null;
}

interface SyncCredentials {
  token: string;
  userId: string;
}
```

---

## 4. 增量同步协议

### 4.1 同步流程

```
本地数据变更 → 防抖 30 秒 → 触发 sync()

sync() {
  1. 获取 lastSyncAt（从 users.last_sync_at）
  2. 查询本地 updated_at > lastSyncAt 的所有记录（含 deleted_flag=1）
  3. 调用 syncPort.push(localChanges) → 服务器返回冲突结果
  4. 调用 syncPort.pull(lastSyncAt) → 获取服务器端变更
  5. 对 pull 返回的记录执行 LWW 合并（与导入流程相同）
  6. 更新 users.last_sync_at = 当前时间戳
  7. 如有失败，进入重试队列
}
```

### 4.2 增量查询

- `last_sync_at` 存储在 `users` 表中（已有字段），记录上次成功同步的时间戳
- 本地变更查询：`SELECT * FROM {table} WHERE updated_at > last_sync_at AND deleted_flag IN (0, 1)`
- 服务器变更查询：服务器返回 `updated_at > last_sync_at` 的记录
- 推送和拉取在同一个 sync 周期内完成，避免遗漏

### 4.3 防抖机制

- 数据写入后标记 `pendingChanges++`
- 30 秒内无新变更 → 触发 sync
- 30 秒内有新变更 → 重置计时器
- 手动触发立即执行，跳过防抖

### 4.4 表处理顺序

按外键依赖顺序处理（与数据导入一致）：

```
1. users
2. categories
3. accounts
4. recurring_transactions
5. transactions
6. net_worth_snapshots
7. fire_scenarios
```

---

## 5. LWW + sync_version 冲突解决

### 5.1 冲突场景

同一条记录在两端都被修改，push 时服务器发现冲突。

### 5.2 解决算法（三级比较）

```typescript
function resolveConflict(local: SyncRecord, remote: SyncRecord): 'local' | 'remote' {
  // 第一级：比较 updated_at（毫秒时间戳）
  if (local.updated_at > remote.updated_at) return 'local';
  if (local.updated_at < remote.updated_at) return 'remote';

  // 第二级：updated_at 相同时，比较 sync_version
  if (local.sync_version > remote.sync_version) return 'local';
  if (local.sync_version < remote.sync_version) return 'remote';

  // 第三级：都相同时，服务器端优先
  return 'remote';
}
```

### 5.3 冲突处理流程

**push 阶段：**
- 服务器对每条推送的记录检查是否存在更新的版本
- 若服务器版本更新 → 服务器返回冲突标记，客户端保留本地版本但标记为"被覆盖"
- 若客户端版本更新 → 服务器接受更新

**pull 阶段：**
- 客户端对每条拉取的记录执行 LWW 合并
- 与导入流程相同的逻辑：本地不存在 → INSERT，本地较旧 → UPDATE，本地较新 → SKIP

### 5.4 sync_version 递增规则

- 每次本地写入操作（INSERT/UPDATE/DELETE）时 `sync_version += 1`
- 同步成功后不重置 sync_version，继续累加
- sync_version 仅用于打破 updated_at 相同的平局，不作为主要同步依据

---

## 6. 离线队列与重试机制

### 6.1 离线队列结构

```typescript
interface SyncQueue {
  pendingSync: boolean;         // 是否有待执行的同步
  lastAttemptAt: number | null; // 上次尝试时间
  retryCount: number;           // 当前重试次数（0-5）
  nextRetryAt: number | null;   // 下次重试时间
}
```

### 6.2 重试时间表（指数退避）

| 重试次数 | 等待时间 | 累计等待 |
|----------|----------|----------|
| 1 | 30 秒 | 30 秒 |
| 2 | 1 分钟 | 1 分 30 秒 |
| 3 | 2 分钟 | 3 分 30 秒 |
| 4 | 5 分钟 | 8 分 30 秒 |
| 5 | 10 分钟 | 18 分 30 秒 |

- 5 次重试后停止自动重试，等待用户手动触发
- 每次重试时重新查询本地变更（可能积累新的变更）
- 手动触发始终可用，重置 retryCount 为 0

### 6.3 触发条件汇总

| 触发方式 | 条件 | 行为 |
|----------|------|------|
| 自动触发 | 数据变更后 30 秒无新变更 | 执行 sync，重置 retryCount |
| 手动触发 | 用户点击"立即同步" | 执行 sync，重置 retryCount |
| 重试触发 | 到达 nextRetryAt 时间 | 执行 sync，retryCount++ |
| 启动触发 | APP 启动且 lastSyncAt != null | 启动后 5 秒执行 sync |

### 6.4 APP 启动时的同步行为

- 若 `last_sync_at` 为 null（从未同步过）→ 不自动触发，等待用户在设置中配置同步
- 若 `last_sync_at` 不为 null → 启动后 5 秒自动触发一次同步

---

## 7. 加密 Payload

### 7.1 加密数据结构（预留）

```typescript
interface EncryptedSyncPayload {
  crypto: {
    algorithm: string;    // 如 "AES-256-GCM"
    iv: string;           // 初始化向量（Base64）
    salt: string;         // 密钥派生盐值（Base64）
  };
  ciphertext: string;     // 加密后的 SyncPayload（Base64）
}
```

### 7.2 加密原则

- 同步数据在传输前加密，服务器仅存储加密 blob
- 服务器无法解密数据（零知识架构）
- 加密/解密在主进程执行
- 密钥派生方案由安全设计文档定义

---

## 8. 与 DataAccessPort 的集成

### 8.1 架构关系

```
DataAccessPort（现有抽象层）
├── 桌面实现: IpcDataAccess（当前已实现，通过 IPC 调用主进程 SQLite）
├── 移动端实现: QuickSqliteDataAccess（未来实现）
└── 同步扩展: SyncPort（本次设计）
    ├── push(): 读取本地变更 → 加密 → 发送到服务器
    ├── pull(): 请求服务器变更 → 解密 → LWW 合并到本地 DB
    └── getSyncStatus(): 返回同步状态
```

### 8.2 新增 IPC 通道

| 通道 | 方向 | 参数 | 返回 |
|------|------|------|------|
| `sync:trigger` | renderer → main | `{ force: boolean }` | `SyncResult` |
| `sync:status` | renderer → main | `{}` | `SyncStatus` |
| `sync:enable` | renderer → main | `{ credentials: SyncCredentials }` | `{ success: boolean }` |
| `sync:disable` | renderer → main | `{}` | `{ success: boolean }` |

### 8.3 Preload API 扩展

```typescript
const dataAccess = {
  // ... 现有 API ...

  sync: {
    trigger: (force?: boolean) => ipcRenderer.invoke('sync:trigger', { force }),
    getStatus: () => ipcRenderer.invoke('sync:status'),
    enable: (credentials: SyncCredentials) => ipcRenderer.invoke('sync:enable', { credentials }),
    disable: () => ipcRenderer.invoke('sync:disable'),
  },
};
```

---

## 9. 与其他设计文档的关系

| 文档 | 关系 |
|------|------|
| `frontend-architecture-design.md` | SyncPort 是 DataAccessPort 的同步扩展，遵循相同的端口抽象模式 |
| `data-export-import-design.md` | LWW 合并算法与数据导入的合并算法完全一致 |
| 安全设计（待编写） | 加密 Payload 的具体算法（AES-256-GCM、Argon2id）由安全设计文档定义 |
| `user-data-model-design.md` | 利用现有字段：`last_sync_at`、`sync_version`、`updated_at`、`deleted_flag` |

---

## 10. 实施范围

本设计文档仅定义同步层的接口和协议，不含服务器端实现。实施时需要：

1. 在 `packages/shared/src/services/` 新增 `sync-service.ts`（SyncPort 接口和同步逻辑）
2. 在 `packages/shared/src/types/` 扩展同步相关类型定义
3. 在 `apps/desktop/src/main/` 新增同步 IPC handler
4. 在 `apps/desktop/src/preload/index.ts` 扩展 `sync` API
5. 服务器端实现（未来项目，需选定后端技术后单独设计）

---

## 附录：决策记录

| # | 决策项 | 选择 | 理由 |
|---|--------|------|------|
| 1 | 服务器后端 | 仅设计接口 | MVP 阶段不做同步，锁定协议为未来预留 |
| 2 | 同步策略 | 增量同步 | 基于 updated_at > last_sync_at，减少传输量 |
| 3 | 冲突解决 | LWW + sync_version 三级比较 | updated_at 为主，sync_version 打破平局，服务器优先为最后兜底 |
| 4 | 同步触发 | 自动（防抖 30 秒）+ 手动 | 数据变更后自动同步，用户也可手动触发 |
| 5 | 重试策略 | 指数退避（30s→10m，最多 5 次） | 避免频繁重试耗电，网络恢复后自动重试 |
| 6 | 加密 | 预留 EncryptedSyncPayload 结构 | 零知识架构，具体算法由安全设计文档定义 |
| 7 | 接口设计 | SyncPort 抽象接口 | 不绑定具体服务器技术，桌面/移动端可复用 |
