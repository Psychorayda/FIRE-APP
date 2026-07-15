# FIRE 计算APP — 安全设计

> **版本**: 1.0
> **日期**: 2026-07-15
> **状态**: 待审核
> **前置文档**: `2026-07-15-fire-app-frontend-architecture-design.md` v1.0, `2026-07-15-fire-app-data-export-import-design.md` v1.0, `2026-07-15-fire-app-sync-layer-design.md` v1.0
> **范围**: 定义 FIRE APP 的加密方案、密钥派生、密码管理流程、零知识架构和 IPC 通道。本设计覆盖同步数据加密和导出文件加密，不含本地 SQLite 加密

---

## 1. 设计目标

1. **传输加密**：同步数据在传输前加密，服务器仅存储加密 blob，实现零知识架构
2. **导出加密**：JSON 导出文件可选加密，防止备份文件泄露财务数据
3. **密码派生**：使用 Argon2id 从用户密码派生加密密钥，密码不落盘
4. **用户可选**：加密功能由用户主动开启，未开启时同步和导出为明文
5. **不可恢复**：密码丢失后加密数据不可恢复，需重置密码 + 重新导入明文备份
6. **本地明文**：本地 SQLite 数据库保持明文，不替换 better-sqlite3，与现有架构兼容

---

## 2. 设计原则

- **密码不落盘**：密码仅用于派生密钥，派生后立即从内存清除
- **密钥不持久化**：加密密钥仅存在于主进程内存，APP 退出时清除
- **零知识架构**：服务器无法解密用户数据，仅存储加密 blob
- **每次加密新 IV**：AES-256-GCM 每次加密生成随机 IV，保证语义安全
- **最小暴露面**：密码通过 IPC 传递到主进程后立即处理，不在渲染进程持久化

---

## 3. 加密架构

```
用户密码
    │
    ▼
Argon2id(password, salt)  →  256-bit Encryption Key
    │                           │
    ▼                           │
SHA-256(key) → key_hash         │
    │                           │
    ▼                           ▼
存储到 users.encryption_key_hash    内存中保持（APP 运行期间）
                                    │
                         ┌──────────┼──────────┐
                         ▼          ▼          ▼
                    同步加密     导出加密    密码验证
                    AES-256-GCM  AES-256-GCM  比对 key_hash
```

### 3.1 加密开关

- `users.encryption_key_hash` 为 `null` → 加密未启用，同步和导出为明文
- `users.encryption_key_hash` 不为 `null` → 加密已启用，同步和导出自动加密

### 3.2 核心组件

| 组件 | 职责 |
|------|------|
| 密钥派生 | Argon2id 从用户密码 + salt 派生 256 位加密密钥 |
| 密钥验证 | SHA-256(key) 存储在 `users.encryption_key_hash`，用于验证密码正确性 |
| 加密引擎 | AES-256-GCM 对称加密，每次加密生成随机 IV |
| 密钥生命周期 | APP 启动时用户输入密码 → 派生密钥 → 保存在主进程内存 → APP 退出时清除 |

---

## 4. 密钥派生与验证

### 4.1 Argon2id 参数

| 参数 | 值 | 说明 |
|------|-----|------|
| hashLength | 32 | 输出 256 位密钥（32 字节） |
| memoryCost | 65536 | 64 MB 内存消耗 |
| timeCost | 3 | 3 次迭代 |
| parallelism | 1 | 单线程（桌面环境） |
| type | argon2id | 混合模式，抗 GPU/ASIC 攻击 |

### 4.2 Salt 生成

- 用户首次设置密码时生成 16 字节随机 salt（`crypto.randomBytes(16)`）
- Salt 以 Base64 存储在本地配置中（不存储在 SQLite 中，避免随数据库泄露）
- Salt 存储路径：`{userData}/fire-app/data/salt`（独立文件）

### 4.3 密钥验证流程

```
用户输入密码
    │
    ▼
Argon2id(password, salt) → key
    │
    ▼
SHA-256(key) → input_hash
    │
    ▼
比较 input_hash === users.encryption_key_hash
    │
    ├── 匹配 → 密钥正确，保持 key 在内存中
    └── 不匹配 → 密码错误，返回错误
```

### 4.4 密钥不落盘原则

- 派生密钥仅存在于主进程内存中
- APP 退出/锁定时密钥从内存清除
- 不写入磁盘、不写入 SQLite、不通过 IPC 传递给渲染进程

---

## 5. 加密操作

### 5.1 AES-256-GCM 参数

| 参数 | 值 | 说明 |
|------|-----|------|
| algorithm | `aes-256-gcm` | 对称加密 + 认证 |
| keyLength | 32 | 256 位密钥 |
| ivLength | 12 | 96 位 IV（GCM 推荐长度） |
| authTagLength | 16 | 128 位认证标签 |

### 5.2 加密流程

```typescript
function encrypt(data: Buffer, key: Buffer): EncryptedData {
  const iv = crypto.randomBytes(12);      // 每次生成随机 IV
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    crypto: {
      algorithm: 'AES-256-GCM',
      iv: iv.toString('base64'),
      salt: null,  // salt 在加密操作中不传递，仅在密钥派生时使用
    },
    ciphertext: ciphertext.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}
```

### 5.3 解密流程

```typescript
function decrypt(encrypted: EncryptedData, key: Buffer): Buffer {
  const iv = Buffer.from(encrypted.crypto.iv, 'base64');
  const authTag = Buffer.from(encrypted.authTag, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const data = Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, 'base64')),
    decipher.final()
  ]);
  return data;
}
```

### 5.4 应用到导出文件

JSON 导出时，若加密已启用：
1. 序列化 `data` 部分为 JSON 字符串
2. 加密 JSON 字符串
3. `header.crypto` 填充加密信息（algorithm、iv、authTag）
4. `data` 替换为 `ciphertext`（Base64 字符串）

加密后的导出文件结构：
```json
{
  "header": {
    "format": "fire-app-export",
    "version": "1.0",
    "exported_at": 1721000000000,
    "app_version": "0.1.0",
    "table_count": 7,
    "record_count": 1523,
    "crypto": {
      "algorithm": "AES-256-GCM",
      "iv": "base64-encoded-iv",
      "authTag": "base64-encoded-auth-tag"
    }
  },
  "data": "base64-encoded-ciphertext"
}
```

### 5.5 应用到同步数据

同步 push 时，若加密已启用：
1. 序列化 `SyncPayload` 为 JSON
2. 加密为 `EncryptedSyncPayload`（与同步层设计一致）
3. 发送到服务器

### 5.6 IV 唯一性保证

- 每次加密使用 `crypto.randomBytes(12)` 生成新 IV
- AES-GCM 要求同一密钥下 IV 不重复
- 96 位 IV 随机生成，重复概率可忽略（2^48 次加密后才有 50% 冲突概率）

---

## 6. 密码管理流程

### 6.1 设置密码（首次启用加密）

1. 用户在设置页输入密码 + 确认密码
2. 生成 16 字节随机 salt，保存到 `{userData}/fire-app/data/salt`
3. `Argon2id(password, salt)` → 256 位密钥
4. `SHA-256(key)` → key_hash
5. 将 key_hash 存入 `users.encryption_key_hash`
6. 密钥保存在主进程内存中
7. 此后同步和导出自动加密

### 6.2 验证密码（APP 启动时）

1. 检查 `users.encryption_key_hash` 是否为 null
2. 若不为 null → 提示用户输入密码
3. 读取 salt 文件
4. `Argon2id(password, salt)` → key
5. `SHA-256(key)` → input_hash
6. 比对 input_hash 与 `users.encryption_key_hash`
7. 匹配 → 密钥保持内存；不匹配 → 返回错误，允许重试

### 6.3 修改密码

1. 验证旧密码（同 6.2 流程）
2. 生成新 salt，覆盖 salt 文件
3. `Argon2id(newPassword, newSalt)` → 新密钥
4. `SHA-256(newKey)` → 新 key_hash
5. 更新 `users.encryption_key_hash`
6. 旧密钥从内存清除，新密钥保持
7. **注意**：已加密的旧数据（服务器上的同步 blob）无法用新密钥解密。修改密码后需重新全量同步

### 6.4 重置密码（密码丢失）

1. 用户无法提供旧密码
2. 生成新 salt + 新密钥
3. 更新 `users.encryption_key_hash`
4. 旧加密数据永久无法解密
5. 用户需从明文备份重新导入数据（如果有）

### 6.5 关闭加密

1. 验证当前密码
2. 将 `users.encryption_key_hash` 设为 null
3. 删除 salt 文件
4. 清除内存中的密钥
5. 此后同步和导出恢复明文

---

## 7. IPC 通道设计

### 7.1 通道列表

| 通道 | 方向 | 参数 | 返回 |
|------|------|------|------|
| `security:setPassword` | renderer → main | `{ password: string }` | `{ success: boolean, error?: string }` |
| `security:verifyPassword` | renderer → main | `{ password: string }` | `{ success: boolean, error?: string }` |
| `security:changePassword` | renderer → main | `{ oldPassword: string, newPassword: string }` | `{ success: boolean, error?: string }` |
| `security:resetPassword` | renderer → main | `{ newPassword: string }` | `{ success: boolean }` |
| `security:disableEncryption` | renderer → main | `{ password: string }` | `{ success: boolean, error?: string }` |
| `security:getStatus` | renderer → main | `{}` | `{ encryptionEnabled: boolean, isUnlocked: boolean }` |

### 7.2 Preload API 扩展

```typescript
const dataAccess = {
  // ... 现有 API ...

  security: {
    setPassword: (password: string) => ipcRenderer.invoke('security:setPassword', { password }),
    verifyPassword: (password: string) => ipcRenderer.invoke('security:verifyPassword', { password }),
    changePassword: (oldPassword: string, newPassword: string) =>
      ipcRenderer.invoke('security:changePassword', { oldPassword, newPassword }),
    resetPassword: (newPassword: string) => ipcRenderer.invoke('security:resetPassword', { newPassword }),
    disableEncryption: (password: string) => ipcRenderer.invoke('security:disableEncryption', { password }),
    getStatus: () => ipcRenderer.invoke('security:getStatus'),
  },
};
```

---

## 8. 零知识架构

### 8.1 数据可见性矩阵

| 组件 | 可见数据 | 不可见数据 |
|------|----------|------------|
| 渲染进程 | 加密状态（是否启用/解锁） | 密钥、密码 |
| 主进程内存 | 密钥（APP 运行期间） | 密码（仅派生时短暂存在） |
| SQLite 数据库 | key_hash、明文数据 | 密钥、密码 |
| 同步服务器 | 加密 blob | 明文数据、密钥、密码 |
| 导出文件 | 加密后的 ciphertext | 明文数据、密钥 |

### 8.2 安全保证

- **传输安全**：同步数据加密后传输，即使服务器被攻破也无法解密
- **备份安全**：加密的导出文件即使泄露，无密码也无法解密
- **内存安全**：密钥仅在主进程内存，`contextIsolation: true` 保证渲染进程无法访问
- **密码安全**：密码仅用于 Argon2id 派生，派生后从内存清除，不持久化

### 8.3 密码通过 IPC 的安全性

- 密码通过 `ipcRenderer.invoke` 传递到主进程
- `contextIsolation: true` 保证渲染进程的 JavaScript 上下文与 preload 隔离
- 渲染进程无法截获其他 IPC 消息
- 密码到达主进程后立即用于 Argon2id 派生，派生后密码变量被覆盖

---

## 9. 与其他设计文档的关系

| 文档 | 关系 |
|------|------|
| `data-export-import-design.md` | `header.crypto` 字段的加密实现由本文档定义 |
| `sync-layer-design.md` | `EncryptedSyncPayload` 的加密算法和密钥管理由本文档定义 |
| `user-data-model-design.md` | 利用现有字段 `users.encryption_key_hash` |
| `frontend-architecture-design.md` | IPC 通道遵循现有 `ipcMain.handle` + `contextBridge` 模式 |

---

## 10. 实施范围

本设计文档定义加密方案和接口。实施时需要：

1. 在 `packages/shared/src/services/` 新增 `crypto-service.ts`（加密/解密/密钥派生）
2. 在 `apps/desktop/src/main/` 新增 `security-manager.ts`（密钥生命周期管理）+ 安全 IPC handler
3. 在 `apps/desktop/src/preload/index.ts` 扩展 `security` API
4. 修改导出服务：加密启用时自动加密导出数据
5. 修改同步服务：加密启用时自动加密同步 payload
6. 渲染进程设置页添加加密管理 UI（UI 实现由里程碑 7 覆盖）

---

## 附录：决策记录

| # | 决策项 | 选择 | 理由 |
|---|--------|------|------|
| 1 | 加密范围 | 仅传输 + 导出加密 | 本地 DB 保持明文，与现有架构兼容 |
| 2 | 密钥来源 | 用户密码 → Argon2id 派生 | 用户无需管理密钥，密码即密钥 |
| 3 | 密码恢复 | 不可恢复，重置 + 导入 | 零知识架构下密码丢失即数据丢失，符合安全优先原则 |
| 4 | 加密启用 | 用户可选开启 | 不强制所有用户加密，灵活性高 |
| 5 | 加密算法 | AES-256-GCM | 工业标准，提供加密 + 认证 |
| 6 | 密钥派生 | Argon2id（64MB, 3 次迭代） | 抗 GPU/ASIC 攻击，OWASP 推荐 |
| 7 | Salt 存储 | 独立文件（不存 SQLite） | 避免 salt 随数据库泄露 |
| 8 | 密钥生命周期 | 仅内存，退出清除 | 密钥不落盘，最大化安全性 |
| 9 | 修改密码 | 需重新全量同步 | 新密钥无法解密旧 blob，需重新推送 |
