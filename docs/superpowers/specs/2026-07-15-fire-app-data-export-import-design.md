# FIRE 计算APP — 数据导出/导入设计

> **版本**: 1.0
> **日期**: 2026-07-15
> **状态**: 待审核
> **前置文档**: `2026-07-12-fire-app-user-data-model-design.md` v1.0, `2026-07-15-fire-app-frontend-architecture-design.md` v1.0
> **范围**: 定义 FIRE APP 的数据导出和导入功能，包括文件格式、导入合并策略、冲突处理、IPC 通道和错误处理

---

## 1. 设计目标

1. **全量备份**：JSON 格式导出全部 7 张表数据，作为完整数据备份
2. **单表查看**：CSV 格式导出单张表，便于在 Excel 中查看和分析
3. **数据迁移**：JSON 导入支持跨设备数据迁移，使用 LWW 自动合并
4. **加密预留**：JSON 导出格式预留加密接口，当前版本为明文，加密实现由安全设计文档定义
5. **完整保留**：导出包含软删除记录（`deleted_flag=1`），确保备份完整性

---

## 2. 数据范围

导出/导入覆盖以下 7 张表（与 `packages/shared/src/db/schema.ts` 中 `TABLE_NAMES` 一致）：

| 表名 | 用途 | 外键依赖 |
|------|------|----------|
| `users` | 用户档案 | 无 |
| `categories` | 分类（含种子数据） | users |
| `accounts` | 账户 | users |
| `recurring_transactions` | 经常性交易 | users, accounts |
| `transactions` | 交易记录 | users, accounts, categories, recurring_transactions |
| `net_worth_snapshots` | 净资产快照 | users |
| `fire_scenarios` | FIRE 计算场景 | users |

每条记录包含所有字段，含 `sync_version`、`updated_at`、`deleted_flag`。

---

## 3. JSON 导出格式

### 3.1 信封结构

```json
{
  "header": {
    "format": "fire-app-export",
    "version": "1.0",
    "exported_at": 1721000000000,
    "app_version": "0.1.0",
    "table_count": 7,
    "record_count": 1523,
    "crypto": null
  },
  "data": {
    "users": [],
    "accounts": [],
    "categories": [],
    "transactions": [],
    "recurring_transactions": [],
    "net_worth_snapshots": [],
    "fire_scenarios": []
  }
}
```

### 3.2 header 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `format` | string | 固定标识 `"fire-app-export"`，导入时首先校验 |
| `version` | string | 导出格式版本号，当前 `"1.0"` |
| `exported_at` | number | 导出时间戳（毫秒） |
| `app_version` | string | 导出时的 APP 版本号 |
| `table_count` | number | 包含的表数量（校验完整性） |
| `record_count` | number | 所有表记录总数（校验完整性） |
| `crypto` | object\|null | 加密信息占位，当前为 `null`。安全设计文档定义加密后此字段填充算法、IV、salt 等 |

### 3.3 data 字段说明

- 7 个键对应 7 张表，值为对象数组
- 每条记录包含该表的所有字段（含 `deleted_flag`、`sync_version`、`updated_at`）
- 字段名和类型与 SQLite schema 完全一致，无转换
- `NULL` 值在 JSON 中为 `null`

### 3.4 示例

```json
{
  "header": {
    "format": "fire-app-export",
    "version": "1.0",
    "exported_at": 1721000000000,
    "app_version": "0.1.0",
    "table_count": 7,
    "record_count": 3,
    "crypto": null
  },
  "data": {
    "users": [
      {
        "id": "uuid-xxx",
        "display_name": "张三",
        "base_currency": "CNY",
        "is_china_market": 1,
        "default_withdrawal_rate": 350,
        "default_expected_return": 700,
        "default_inflation_rate": 300,
        "encryption_key_hash": null,
        "last_sync_at": null,
        "sync_version": 0,
        "updated_at": 1721000000000,
        "deleted_flag": 0
      }
    ],
    "accounts": [
      {
        "id": "uuid-yyy",
        "user_id": "uuid-xxx",
        "name": "招商银行储蓄卡",
        "asset_class": "liquid",
        "account_type": "checking",
        "current_balance": 500000,
        "last_updated": 1721000000000,
        "display_order": 0,
        "note": null,
        "sync_version": 0,
        "updated_at": 1721000000000,
        "deleted_flag": 0
      }
    ],
    "categories": [
      {
        "id": "uuid-zzz",
        "user_id": "uuid-xxx",
        "parent_id": null,
        "name": "工资收入",
        "type": "income",
        "icon": null,
        "color": null,
        "linked_fire_concept": null,
        "display_order": 0,
        "is_system": 1,
        "sync_version": 0,
        "updated_at": 1721000000000,
        "deleted_flag": 0
      }
    ],
    "transactions": [],
    "recurring_transactions": [],
    "net_worth_snapshots": [],
    "fire_scenarios": []
  }
}
```

---

## 4. CSV 导出格式

### 4.1 用途

单表导出，便于在 Excel 中查看数据。不支持 CSV 导入。

### 4.2 文件结构

- 每次导出生成一个 CSV 文件，对应一张表
- 第一行为列标题（使用数据库字段名）
- 数据行按字段顺序排列
- `NULL` 值导出为空字符串
- 整数时间戳导出为原始数值（毫秒时间戳）
- 金额导出为原始整数（分），不转换为元

### 4.3 可导出的表

7 张表均可单独导出为 CSV：`users`、`accounts`、`categories`、`transactions`、`recurring_transactions`、`net_worth_snapshots`、`fire_scenarios`。

### 4.4 编码与转义

- **编码**：UTF-8 with BOM（确保 Excel 正确识别中文）
- **转义规则**：遵循 RFC 4180
  - 含逗号、引号、换行的字段用双引号包裹
  - 字段内的双引号转义为两个双引号
- **换行符**：`\r\n`（Windows 标准，兼容 Excel）

---

## 5. 导入流程

### 5.1 前置条件

- 仅支持 JSON 文件导入，不支持 CSV 导入
- 导入前显示确认弹窗，提示"导入将合并数据，不会删除现有记录"

### 5.2 导入步骤

**Step 1 — 文件校验：**
- 解析 JSON，检查 `header.format === "fire-app-export"`
- 检查 `header.version` 是否为支持的版本（当前仅 `"1.0"`）
- 检查 `header.crypto` 是否为 `null`（加密文件需先解密，当前版本不支持）
- 检查 `data` 对象包含的表是否均为已知表名（7 张表之一）
- 任一校验失败 → 中止导入，返回错误

**Step 2 — 数据校验：**
- 逐表逐记录校验必填字段是否存在（如 `id`、`user_id`）
- 校验枚举值合法性（如 `asset_class` 必须为 `liquid|invested|use_asset|liability`）
- 校验外键引用完整性（如 `account_id` 引用的 account 是否在导入数据或现有数据中存在）
- 校验失败时记录错误，跳过该记录，继续处理其他记录

**Step 3 — LWW 合并：**
- 按外键依赖顺序处理：users → categories → accounts → recurring_transactions → transactions → net_worth_snapshots → fire_scenarios
- 对每条记录，查询数据库中同 `id` 的现有记录
- 若不存在 → INSERT 新记录
- 若存在 → 比较 `updated_at`，导入数据的 `updated_at` 严格大于现有记录时 UPDATE，否则跳过
- 合并在单个事务中执行，全部成功才提交，事务执行失败则回滚

**Step 4 — 结果报告：**
```typescript
interface ImportResult {
  success: boolean;
  inserted: number;   // 新增记录数
  updated: number;    // 更新记录数（LWW 覆盖）
  skipped: number;    // 跳过记录数（LWW 未覆盖 + 校验失败）
  errors: string[];   // 校验错误详情
}
```

### 5.3 LWW 合并算法

```typescript
function mergeRecord(db: Database, table: string, record: Record): MergeAction {
  const existing = db.prepare(`SELECT updated_at FROM ${table} WHERE id = ?`).get(record.id);

  if (!existing) {
    // 新记录 → INSERT
    return { action: 'insert', record };
  }

  if (record.updated_at > existing.updated_at) {
    // 导入数据更新 → UPDATE
    return { action: 'update', record };
  }

  // 现有数据更新或相同 → SKIP
  return { action: 'skip', record };
}
```

### 5.4 导入顺序（外键依赖）

```
1. users              （无外键依赖）
2. categories          （→ users）
3. accounts            （→ users）
4. recurring_transactions （→ users, accounts）
5. transactions        （→ users, accounts, categories, recurring_transactions）
6. net_worth_snapshots （→ users）
7. fire_scenarios      （→ users）
```

---

## 6. 文件命名与存储位置

### 6.1 JSON 全量导出

**文件命名：** `fire-app-export-YYYYMMDD-HHmmss.json`

示例：`fire-app-export-20260715-143052.json`

### 6.2 CSV 单表导出

**文件命名：** `fire-app-{table}-YYYYMMDD-HHmmss.csv`

示例：`fire-app-transactions-20260715-143052.csv`

### 6.3 文件选择对话框

**导出：**
- 使用 Electron `dialog.showSaveDialog()`
- 默认目录：用户桌面（`app.getPath('desktop')`）
- 默认文件名按上述规则自动填充
- JSON 导出过滤器：`{ name: 'JSON 文件', extensions: ['json'] }`
- CSV 导出过滤器：`{ name: 'CSV 文件', extensions: ['csv'] }`

**导入：**
- 使用 Electron `dialog.showOpenDialog()`
- 过滤器：`{ name: 'JSON 文件', extensions: ['json'] }`
- `properties: ['openFile']`（单文件选择）

---

## 7. IPC 通道设计

### 7.1 通道列表

| 通道 | 方向 | 参数 | 返回 |
|------|------|------|------|
| `export:json` | renderer → main | `{ filePath: string }` | `{ success: boolean, recordCount: number, error?: string }` |
| `export:csv` | renderer → main | `{ filePath: string, table: string }` | `{ success: boolean, recordCount: number, error?: string }` |
| `import:json` | renderer → main | `{ filePath: string }` | `ImportResult` |
| `dialog:save` | renderer → main | `{ defaultName: string, extension: 'json'\|'csv' }` | `{ canceled: boolean, filePath: string\|null }` |
| `dialog:open` | renderer → main | `{ extensions: string[] }` | `{ canceled: boolean, filePath: string\|null }` |

### 7.2 Preload API 扩展

在 `window.dataAccess` 中新增 `exportImport` 命名空间：

```typescript
const dataAccess = {
  // ... 现有 API ...

  // 导出/导入
  exportImport: {
    exportJson: (filePath: string) => ipcRenderer.invoke('export:json', { filePath }),
    exportCsv: (filePath: string, table: string) => ipcRenderer.invoke('export:csv', { filePath, table }),
    importJson: (filePath: string) => ipcRenderer.invoke('import:json', { filePath }),
    showSaveDialog: (defaultName: string, extension: 'json'|'csv') =>
      ipcRenderer.invoke('dialog:save', { defaultName, extension }),
    showOpenDialog: () => ipcRenderer.invoke('dialog:open', { extensions: ['json'] }),
  },
};
```

---

## 8. 错误处理

### 8.1 错误分类

| 错误类型 | 处理方式 | 用户提示 |
|----------|----------|----------|
| 文件不存在/不可读 | 中止导入，返回错误 | "文件不存在或无法读取" |
| JSON 解析失败 | 中止导入，返回错误 | "文件格式无效，不是合法的 JSON" |
| header.format 不匹配 | 中止导入，返回错误 | "文件不是 FIRE APP 导出文件" |
| header.version 不支持 | 中止导入，返回错误 | "导出文件版本 {x} 不被支持，当前支持版本 1.0" |
| header.crypto 非 null | 中止导入，返回错误 | "加密文件暂不支持导入" |
| 字段缺失/类型错误 | 记录错误，跳过该记录，继续处理其他 | 导入完成后在结果中显示错误列表 |
| 枚举值非法 | 同上 | 同上 |
| 外键引用不存在 | 同上 | 同上 |
| 事务执行失败 | 回滚整个导入，返回错误 | "导入失败，数据已回滚到导入前状态" |

### 8.2 边界情况

| 情况 | 处理方式 |
|------|----------|
| 空数据库导入 | 正常处理，全部为 INSERT |
| 空文件导入（data 所有表为空数组） | 正常处理，0 条记录变更 |
| 重复导入同一文件 | LWW 合并，第二次全部 skipped（updated_at 相同则跳过） |
| 跨用户数据导入 | 允许导入。确认弹窗提示"导入文件包含 {n} 个用户的数据" |
| 大文件导入 | 主进程同步执行（better-sqlite3 同步），事务批量处理。预期 < 10MB |

---

## 9. 与其他设计文档的关系

| 文档 | 关系 |
|------|------|
| `user-data-model-design.md` | 导出/导入的数据来源：7 张表的 schema 和类型定义 |
| `frontend-architecture-design.md` | IPC 通道设计遵循现有的 `ipcMain.handle` + `contextBridge` 模式 |
| `initialization-design.md` | 导入流程在应用启动后任意时间触发，不参与启动序列 |
| 安全设计（待编写） | `header.crypto` 字段的加密/解密实现由安全设计文档定义 |
| 同步层设计（待编写） | LWW 合并策略与同步层的冲突解决策略保持一致 |

---

## 10. 实施范围

本设计文档仅定义导出/导入的数据格式和逻辑设计，不含 UI 设计（按钮位置、交互流程由 UI/UX 设计文档覆盖）。实施时需要：

1. 在 `packages/shared/src/services/` 新增 `export-service.ts` 和 `import-service.ts`
2. 在 `apps/desktop/src/main/` 新增导出/导入 IPC handler 注册
3. 在 `apps/desktop/src/preload/index.ts` 扩展 `exportImport` API
4. 渲染进程设置页中添加导出/导入入口（UI 实现由里程碑 7 覆盖）

---

## 附录：决策记录

| # | 决策项 | 选择 | 理由 |
|---|--------|------|------|
| 1 | 导出格式 | JSON + CSV | JSON 用于全量备份/导入，CSV 用于 Excel 查看 |
| 2 | 导出范围 | JSON 全量 + CSV 单表 | JSON 保留完整数据关系，CSV 简化查看 |
| 3 | 导入格式 | 仅 JSON | CSV 缺少类型信息和外键关系，导入风险高 |
| 4 | 冲突策略 | LWW 自动合并 | 与同步层设计一致，基于 updated_at 字段 |
| 5 | 软删除记录 | 包含在导出中 | 确保备份完整性，导入时按 LWW 合并 |
| 6 | 加密 | 预留接口（header.crypto） | 当前版本明文，加密实现由安全设计文档定义 |
| 7 | 文件格式 | JSON 信封结构 | 携带元数据（版本/时间/加密占位），支持未来格式升级 |
| 8 | CSV 编码 | UTF-8 with BOM | 确保 Excel 正确识别中文 |
