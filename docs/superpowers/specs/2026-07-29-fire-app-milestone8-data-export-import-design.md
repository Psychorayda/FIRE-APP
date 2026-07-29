# M8 数据导入/导出 + 清空交易设计 / M8 Data Export/Import + Clear Transactions Design

> 版本: 1.0  日期: 2026-07-29  状态: 已批准
> 前置文档: 数据导出/导入设计（2026-07-15）、UI/UX 设计 §3.5、前端架构设计、用户数据模型设计

---

## 1. 目标

补齐设置页 §3.5.4 第 5、6 项交互，实现 FIRE APP 的数据备份、迁移与外部数据导入能力。本里程碑范围聚焦四项：

1. **JSON 全量导出/导入**：7 张表完整备份，LWW 合并导入，支持跨设备迁移
2. **CSV 单表导出**：7 张表任选其一导出为 RFC 4180 兼容 CSV（UTF-8 with BOM），便于 Excel 查看
3. **CSV 交易导入**：预设模板系统覆盖支付宝、微信支付、7 家银行（招行/工行/建行/中行/农商行），支持模板映射 + 关键词推断 + 预览编辑 + 哈希去重
4. **清空所有交易**：软删除交易 + 经常性交易模板 + 账户余额归零（事务原子操作）

**不在范围内**：加密同步层、通用 CSV 字段映射向导、邮件账单自动抓取、其他记账软件格式导入、导入历史规则记忆。

## 2. 架构与数据流

设置页 /SettingsPage 在 M7 用户偏好区和内置分类区之后，追加"数据管理"区，包含 4 个功能块：

```
SettingsPage (M7 已实现)
  │
  └─ 数据管理区（M8 新增）
        │
        ├─ [备份与恢复]
        │     ├─ [导出 JSON 备份] → exportService.buildExportEnvelope → 主进程 fs.writeFile
        │     └─ [导入 JSON 备份] → 主进程 dialog.open → importService.importJsonWithLww
        │
        ├─ [数据导出]
        │     ├─ 表名下拉选择
        │     └─ [导出 CSV] → exportService.buildCsvExport → 主进程 fs.writeFile (含 BOM)
        │
        ├─ [交易导入]
        │     └─ [从 CSV 导入交易] → 进入 <CsvImportWizard/> 5 步向导
        │           ├─ Step 1 选模板（含 detectTemplate 自动检测）
        │           ├─ Step 2 选文件 + 选目标账户
        │           ├─ Step 3 预览编辑（去重标注 + 分类下拉 + 勾选导入）
        │           ├─ Step 4 确认（余额变化预览）
        │           └─ Step 5 完成（成功统计 + 失败列表）
        │
        └─ [危险操作区]
              └─ [清空所有交易] → ClearTransactionsDialog（二次确认 + 输入"确认清空"）
                    → clearService.clearAllTransactions
```

**关键设计原则**：
- Service 层（packages/shared）纯逻辑，不含文件 I/O；文件读写由主进程 IPC handler 承担
- CSV 解码（GBK）在主进程完成，渲染层只处理结构化数据
- 向导状态用组件内 `useState` 管理，不新建 Zustand store（临时流程）

## 3. 文件结构

### 3.1 packages/shared 新增

```
src/services/
  export-service.ts          # JSON 全量导出 + CSV 单表导出（纯逻辑）
  import-service.ts          # JSON LWW 合并 + CSV 交易批量导入（含去重 + 分类解析）
  clear-service.ts           # 清空交易（事务：软删交易+模板+余额归零）
src/import-templates/        # CSV 导入模板系统
  types.ts                   # CsvImportTemplate / ParsedCsvTransaction 接口
  registry.ts                # 模板注册中心（getAllTemplates / getTemplate / detectTemplate）
  placeholder-resolver.ts    # 分类 ID 占位符 → 真实 UUID 解析
  keyword-rules.ts           # 关键词推断规则（共享）
  alipay.ts                  # 支付宝账单模板
  wechat-pay.ts              # 微信支付账单模板
  cmb-debit.ts               # 招行借记卡模板
  icbc-debit.ts              # 工行借记卡模板
  ccb-debit.ts               # 建行借记卡模板
  boc-debit.ts               # 中行借记卡模板
  rcu-debit.ts               # 农商行借记卡模板
tests/services/
  export-service.test.ts
  import-service.test.ts
  clear-service.test.ts
tests/import-templates/
  templates.test.ts
  keyword-rules.test.ts
```

### 3.2 apps/desktop 新增

```
src/main/
  import-csv-parser.ts       # 主进程 CSV 文件解析（含 GBK 解码）
  ipc/
    export-import-handlers.ts  # 注册 export/import/dialog/clear IPC 通道
src/preload/index.ts         # 扩展 exportImport + clearTransactions 命名空间
src/renderer/src/
  data/data-access-port.ts   # 添加 exportImport + clearTransactions 接口
  data/ipc-data-access.ts    # 实现
  components/data-management/  # 新目录
    DataManagementPanel.tsx     # 数据管理区容器
    CsvImportWizard.tsx         # 5 步向导容器
    TemplateSelectStep.tsx
    FileAccountSelectStep.tsx
    PreviewEditStep.tsx         # 表格预览 + 分类下拉 + 去重标注
    ConfirmImportStep.tsx
    ImportResultStep.tsx
    ClearTransactionsDialog.tsx
  pages/SettingsPage.tsx     # 修改：集成 DataManagementPanel
tests/
  export-import-handlers.test.ts
  data-management-panel.test.tsx
  csv-import-wizard.test.tsx
  clear-transactions.test.tsx
```

## 4. IPC 通道设计

| 通道 | 方向 | 参数 | 返回 |
|------|------|------|------|
| `export:json` | renderer→main | `{ filePath: string }` | `{ success, recordCount, error? }` |
| `export:csv` | renderer→main | `{ filePath, table }` | `{ success, recordCount, error? }` |
| `import:json` | renderer→main | `{ filePath }` | `ImportResult` |
| `import:parseCsv` | renderer→main | `{ templateId, filePath }` | `ParsedCsvTransaction[]` |
| `import:csvTransactions` | renderer→main | `{ templateId, filePath, accountId, transactions[] }` | `ImportResult` |
| `clear:transactions` | renderer→main | `{ userId }` | `{ success, clearedCount }` |
| `dialog:save` | renderer→main | `{ defaultName, extension }` | `{ canceled, filePath? }` |
| `dialog:open` | renderer→main | `{ extensions[] }` | `{ canceled, filePath? }` |

**设计要点**：
- `import:parseCsv` 单独设计：主进程解析 CSV 返回结构化数据，渲染层在预览页编辑后再调 `import:csvTransactions` 落库。重型解析在主进程，渲染层只做 UI
- 所有文件 I/O 通过 Electron `dialog` API 选择路径，主进程用 `fs` 读写

## 5. Service 层设计

### 5.1 export-service.ts

**职责**：纯逻辑构造导出数据，不涉及文件 I/O

**核心函数**：
- `buildExportEnvelope(db, userId, appVersion): ExportEnvelope` — 查询 7 张表数据构造 JSON 信封
- `serializeExportEnvelope(envelope): string` — 序列化为 JSON 字符串（2 空格缩进）
- `buildCsvExport(db, tableName, userId): { csvContent, recordCount }` — 构造 CSV 字符串（RFC 4180 转义）

**ExportEnvelope 结构**（沿用 2026-07-15 设计）：
```typescript
{
  header: { format: 'fire-app-export', version: '1.0', exported_at, app_version, table_count: 7, record_count, crypto: null },
  data: { users, accounts, categories, transactions, recurring_transactions, net_worth_snapshots, fire_scenarios }
}
```

**CSV 格式约定**：
- 第一行列标题（数据库字段名）
- `NULL` 值导出为空字符串
- 金额导出为原始整数（分），不转换为元
- 时间戳导出为原始数值（毫秒）
- RFC 4180 转义：含逗号/引号/换行的字段用双引号包裹，字段内双引号转义为两个双引号
- 换行符 `\r\n`（Windows 标准，兼容 Excel）
- BOM 由主进程写文件时附加（`\uFEFF` 前缀）

### 5.2 import-service.ts

**职责**：JSON LWW 合并 + CSV 交易批量导入

**核心函数**：
- `importJsonWithLww(db, envelope): ImportResult` — JSON 全量导入
- `importCsvTransactions(db, params): ImportResult` — CSV 交易批量导入（事务）
- `markDuplicateTransactions(db, accountId, transactions): ParsedCsvTransaction[]` — 去重标注
- `resolveCategoryForTransactions(transactions, systemCategories, templateCategoryMapping): ParsedCsvTransaction[]` — 分类解析

**JSON LWW 合并算法**：
1. 文件级校验：format === 'fire-app-export'、version === '1.0'、crypto === null、table_count === 7
2. 按外键依赖顺序处理：users → categories → accounts → recurring_transactions → transactions → net_worth_snapshots → fire_scenarios
3. 跨用户导入：所有记录的 user_id 替换为本地 userId（本地优先单用户设计）
4. 每条记录查现有：不存在 INSERT；存在且 `record.updated_at > existing.updated_at` UPDATE；否则 SKIP
5. 单事务执行，任一失败回滚

**ImportResult 接口**：
```typescript
{
  success: boolean;
  inserted: number;   // 新增记录数
  updated: number;    // LWW 覆盖更新数
  skipped: number;    // 跳过数（LWW 未覆盖 + 校验失败 + 重复）
  errors: string[];   // 校验错误详情
}
```

**CSV 批量导入流程**：
1. 接收预览页编辑后的 `ParsedCsvTransaction[]`
2. 跳过 `isDuplicate=true` 且用户未勾选覆盖的项
3. 事务内：插入交易记录 + 更新账户余额（income: +amount，expense: -amount）
4. 中途失败整批回滚

**分类解析优先级**（每笔交易的 finalCategoryId）：
1. 模板映射命中（categoryMapping）→ 解析占位符为真实 ID
2. 关键词推断命中（inferCategory）→ 解析占位符为真实 ID
3. 默认：支出 → "其他支出"，收入 → "其他收入"，转账 → null

**去重哈希算法**：
```
dedupHash = `${transactionDate}|${amount}|${summary}|${counterparty}`
```
本地账户现有交易构造哈希集合，CSV 交易命中即标记 `isDuplicate=true`。

### 5.3 clear-service.ts

**职责**：清空所有交易记录（事务原子操作）

**核心函数**：
- `clearAllTransactions(db, userId): ClearResult`

**ClearResult 接口**：
```typescript
{
  success: boolean;
  clearedTransactionCount: number;
  clearedRecurringCount: number;
  resetAccountCount: number;
  error?: string;
}
```

**清空范围**（单事务）：
1. 软删除所有 `transactions`（`deleted_flag = 1`，含 initial_balance 交易）
2. 软删除所有 `recurring_transactions`（`deleted_flag = 1`）
3. 重置所有 `accounts.current_balance = 0`
4. 不清空 `net_worth_snapshots`（下次启动时由快照服务重新生成）

## 6. CSV 导入模板系统

### 6.1 核心接口

```typescript
interface CsvImportTemplate {
  id: string;                    // 模板唯一 ID（如 'alipay'）
  displayName: string;           // 显示名称
  description: string;           // 适用场景描述
  fileSignatures: string[];      // 文件特征（用于 detectTemplate 自动识别）
  encoding: 'utf-8' | 'gbk';    // CSV 编码
  headerLineCount: number;       // 表头前行数（部分银行含多行元信息）
  columnMapping: ColumnMapping;  // 列名/索引 → 标准字段
  categoryMapping: Record<string, string>;  // CSV 分类文本 → 占位符
  amountConvention: 'positive_is_income' | 'positive_is_expense' | 'signed';
  parseHook?: (rawRows: string[][]) => ParsedCsvTransaction[];  // 自定义解析
}

interface ParsedCsvTransaction {
  tempId: string;
  transactionDate: number;       // 毫秒时间戳
  amount: number;                // 分（正收入/负支出/0 转账）
  transactionType: 'income' | 'expense' | 'transfer';
  summary: string;
  counterparty?: string;
  productDescription?: string;
  mappedCategoryId?: string;     // 模板映射（占位符）
  inferredCategoryId?: string;   // 关键词推断（占位符）
  finalCategoryId: string;       // 最终分类 ID（由 import-service 填充）
  dedupHash: string;
  isDuplicate: boolean;          // 由 import-service 回填
  sourceLine: number;
}
```

### 6.2 模板清单

| 模板 ID | 显示名 | 编码 | 表头行数 | 特征 |
|---------|--------|------|---------|------|
| alipay | 支付宝账单 | gbk | 24 | 前 24 行元信息，第 24 行表头 |
| wechat-pay | 微信支付账单 | gbk | 16 | 前 16 行元信息 |
| cmb-debit | 招商银行借记卡 | gbk | 1 | 单行表头 |
| icbc-debit | 工商银行借记卡 | gbk | 1 | 单行表头 |
| ccb-debit | 建设银行借记卡 | gbk | 1 | 单行表头 |
| boc-debit | 中国银行借记卡 | gbk | 1 | 单行表头 |
| rcu-debit | 农村商业银行借记卡 | utf-8 | 1 | 单行表头 |

### 6.3 关键词推断规则

按分类组织关键词库，当模板的 categoryMapping 未命中时，按摘要 + 商品说明做关键词匹配：

```typescript
const KEYWORD_RULES: KeywordRule[] = [
  { categoryId: '__CATEGORY_FOOD__', keywords: ['餐厅', '餐饮', '饿了么', '美团', '外卖', '肯德基', '麦当劳', '星巴克', '超市', '便利店'] },
  { categoryId: '__CATEGORY_TRANSPORT__', keywords: ['滴滴', '出租', '地铁', '公交', '高铁', '火车', '机票', '加油', '停车', 'ETC'] },
  { categoryId: '__CATEGORY_HOUSING__', keywords: ['房租', '物业', '水电', '燃气', '宽带'] },
  { categoryId: '__CATEGORY_SHOPPING__', keywords: ['淘宝', '京东', '拼多多', '天猫', '苏宁', '购物', '商品'] },
  { categoryId: '__CATEGORY_ENTERTAINMENT__', keywords: ['电影', '游戏', 'KTV', '演唱会', '会员', '腾讯视频', '爱奇艺'] },
  { categoryId: '__CATEGORY_MEDICAL__', keywords: ['医院', '药店', '诊所', '挂号', '医药'] },
  { categoryId: '__CATEGORY_INSURANCE__', keywords: ['保险', '保费', '寿险', '医疗险'] },
  { categoryId: '__CATEGORY_PERSONAL_CARE__', keywords: ['理发', '美容', '化妆品', '健身'] },
  { categoryId: '__CATEGORY_EDUCATION__', keywords: ['学费', '培训', '课程', '书店', '教育'] },
  { categoryId: '__CATEGORY_SALARY__', keywords: ['工资', '薪资', '月薪', '代发'] },
  { categoryId: '__CATEGORY_INVESTMENT_INCOME__', keywords: ['分红', '利息', '收益', '股息', '基金赎回'] },
];
```

### 6.4 分类 ID 占位符解析

种子分类的 UUID 在 seedCategories 时动态生成，无法在模板中硬编码。采用占位符方案：

- 模板和关键词规则中使用占位符（如 `__CATEGORY_FOOD__`）
- 运行时通过 `resolveCategoryPlaceholder(placeholder, systemCategories)` 将占位符映射为真实 UUID
- 占位符到分类名的映射表硬编码在 `placeholder-resolver.ts`（如 `__CATEGORY_FOOD__` → '食品'）
- 查询本地 `is_system=1` 的分类，按 name 匹配拿到真实 ID

### 6.5 模板注册中心

```typescript
getAllTemplates(): CsvImportTemplate[]  // 返回所有 7 个模板
getTemplate(id: string): CsvImportTemplate | undefined  // 按 ID 查找
detectTemplate(fileHeadContent: string): string | null  // 基于 fileSignatures 自动识别
```

## 7. 主进程 CSV 解析

文件：`apps/desktop/src/main/import-csv-parser.ts`

**职责**：主进程读取 CSV 文件，解码（支持 GBK），解析为二维数组，调用模板 parseHook 返回 `ParsedCsvTransaction[]`

**依赖**：`iconv-lite`（新增到 apps/desktop dependencies，用于 GBK 解码）

**流程**：
1. `fs.readFileSync(filePath)` 读取 Buffer
2. `iconv.decode(buffer, template.encoding)` 解码为字符串
3. `parseCsvContent(content)` 解析为二维数组（处理引号转义、换行转义）
4. 调用 `template.parseHook(rawRows)` 或默认列映射解析
5. 返回 `ParsedCsvTransaction[]`

## 8. UI 层设计

### 8.1 数据管理区布局

在 SettingsPage 底部追加"数据管理"区，4 个功能块：

1. **备份与恢复**：导出 JSON 备份 / 导入 JSON 备份
2. **数据导出**：表名下拉 + 导出 CSV 按钮
3. **交易导入**：从 CSV 导入交易按钮（触发向导）
4. **危险操作区**（红色边框警示）：清空所有交易记录按钮

### 8.2 CSV 导入向导（5 步状态机）

**Step 1 选模板**：
- 模板卡片列表（7 个模板）
- 用户选文件后调 `detectTemplate` 高亮推荐模板
- 用户也可手动选 → 下一步

**Step 2 选文件 + 选账户**：
- 文件选择按钮 → 主进程 `dialog:open` → 返回路径
- 目标账户下拉（必选，从 account-store 加载）
- 下一步触发 `import:parseCsv` → 返回 `ParsedCsvTransaction[]`

**Step 3 预览编辑**（核心步骤）：
- 顶部统计条：总数 / 新增 / 重复（重复数标红）
- 表格列：日期 | 摘要 | 金额 | 类型 | 分类（下拉可改） | 重复（标记） | 导入（勾选）
- 默认勾选所有非重复项，重复项默认不勾选
- 分类列下拉：系统分类 + 自定义分类，默认值由 `resolveCategoryForTransactions` 填充
- 全选/反选/仅选重复的快捷操作

**Step 4 确认**：
- 汇总：将导入 X 条，跳过 Y 条重复
- 账户余额变化预览：当前 ¥A → 导入后 ¥B
- 确认导入 → 调 `import:csvTransactions` → Toast 结果

**Step 5 完成**：
- 成功：插入 N 条，跳过 M 条
- 失败列表（如有）
- 完成按钮关闭向导，刷新交易数据

### 8.3 清空交易对话框

危险操作，需二次确认：
- 第一层：ConfirmDialog 提示"将软删除所有交易、经常性交易模板并归零账户余额，此操作不可恢复"
- 第二层：输入"确认清空"文字按钮才点亮确认按钮
- 执行后 Toast 显示清空统计（N 条交易、M 个模板、K 个账户余额归零）

### 8.4 组件清单

| 组件 | 职责 |
|------|------|
| `DataManagementPanel` | 数据管理区容器，含 4 个功能块 |
| `CsvImportWizard` | CSV 导入向导容器，管理 5 步状态机 |
| `TemplateSelectStep` | Step 1 模板选择 |
| `FileAccountSelectStep` | Step 2 文件+账户选择 |
| `PreviewEditStep` | Step 3 预览编辑（最复杂） |
| `ConfirmImportStep` | Step 4 确认 |
| `ImportResultStep` | Step 5 完成 |
| `ClearTransactionsDialog` | 清空交易二次确认对话框 |

### 8.5 状态管理

- **不新建 Zustand store**：导入流程是临时性的，向导关闭后状态无需保留
- 数据管理区的操作结果通过 toast 反馈，不需全局状态
- 向导状态用 `useState` 在 `CsvImportWizard` 内管理
- 仅扩展 app-store：清空交易后需触发交易列表和账户余额刷新（复用已有机制）

### 8.6 错误处理策略

| 场景 | 处理 |
|------|------|
| CSV 文件读取失败 | Toast 错误，停留在 Step 2 |
| CSV 解析失败（格式不对） | Toast 显示具体行号错误，允许换文件 |
| JSON 文件格式错误 | Toast 错误，关闭导入流程 |
| 导入过程中部分失败 | Step 5 显示失败列表，成功的部分已落库 |
| 清空交易失败 | Toast 错误，事务已回滚，数据无变化 |

## 9. 测试策略

### 9.1 测试分层

| 层 | 测试文件 | 覆盖范围 |
|----|---------|---------|
| Service 单元测试（shared） | `export-service.test.ts` | JSON 信封构造、CSV 序列化、列转义、空数据处理 |
| | `import-service.test.ts` | JSON LWW 合并三态、跨用户 user_id 归一、信封校验、CSV 批量导入、去重标注、分类解析优先级 |
| | `clear-service.test.ts` | 清空交易事务性、软删交易+模板、余额归零、失败回滚 |
| 模板测试（shared） | `templates.test.ts` | 各模板 parseHook 正确解析、文件特征签名匹配、占位符解析 |
| | `keyword-rules.test.ts` | 关键词推断命中率、未命中返回 undefined、多关键词优先级 |
| IPC handler 测试（desktop） | `export-import-handlers.test.ts` | IPC 通道注册、文件读写、dialog 调用、错误返回 |
| 组件测试（desktop） | `data-management-panel.test.tsx` | 4 个功能块渲染、按钮点击触发对应流程 |
| | `csv-import-wizard.test.tsx` | 5 步向导状态机流转、Step 3 表格交互、勾选/分类修改 |
| | `clear-transactions.test.tsx` | 二次确认对话框、输入"确认清空"才能提交 |

### 9.2 关键测试场景

**import-service 核心场景**：
1. LWW 合并：新记录 INSERT、updated_at 更大 UPDATE、updated_at 更小 SKIP
2. 跨用户导入：导入数据的 user_id 被替换为本地 userId
3. CSV 去重：本地已有相同哈希的交易标记 isDuplicate=true
4. 分类解析优先级：模板映射命中 > 关键词推断命中 > 默认其他
5. CSV 批量导入事务性：中途失败整批回滚，余额不更新

**clear-service 核心场景**：
1. 清空后 transactions.deleted_flag 全为 1
2. 清空后 recurring_transactions.deleted_flag 全为 1
3. 清空后 accounts.current_balance 全为 0
4. 清空操作是事务，模拟失败时数据无变化

**CSV 向导核心场景**：
1. Step 1 → Step 2 → Step 3 → Step 4 → Step 5 状态流转
2. Step 3 重复项默认不勾选，手动勾选可覆盖
3. Step 3 分类下拉修改后，提交时使用修改后的分类
4. Step 4 余额变化预览正确计算
5. Step 5 成功后关闭向导并刷新数据

## 10. 验证清单

### 10.1 自动验证（CI 覆盖）

| 编号 | 检查点 | 实现位置 |
|------|--------|---------|
| D-1 | JSON 导出信封格式正确 | export-service 单元测试 |
| D-2 | CSV 单表导出含 BOM + RFC 4180 转义 | export-service 单元测试 |
| D-3 | JSON 导入 LWW 合并三态 | import-service 单元测试 |
| D-4 | JSON 导入跨用户 user_id 归一 | import-service 单元测试 |
| D-5 | JSON 导入信封校验（format/version/crypto） | import-service 单元测试 |
| D-6 | CSV 解析：7 个模板各正确解析 | templates 单元测试 |
| D-7 | CSV 去重哈希计算正确 | import-service 单元测试 |
| D-8 | CSV 分类解析优先级（模板>关键词>默认） | import-service 单元测试 |
| D-9 | CSV 批量导入事务性（失败回滚） | import-service 单元测试 |
| D-10 | 清空交易软删 + 余额归零 | clear-service 单元测试 |
| D-11 | 清空交易事务性（失败回滚） | clear-service 单元测试 |
| D-12 | 关键词推断命中率 | keyword-rules 单元测试 |
| D-13 | 数据管理区 4 功能块渲染 | 组件测试 |
| D-14 | CSV 向导 5 步流转 | 组件测试 |
| D-15 | CSV 向导 Step 3 重复标注 + 勾选 | 组件测试 |
| D-16 | 清空交易二次确认（输入文字） | 组件测试 |
| D-17 | IPC 通道注册完整 | handler 测试 |
| D-18 | 单元测试全通过 | CI `pnpm test:all` |
| D-19 | tsc 零错误 | CI 构建 |
| D-20 | 构建成功 | CI `electron-builder` |

### 10.2 手动验证（GUI）

| 编号 | 检查点 | 步骤 |
|------|--------|------|
| D-21 | 导出 JSON 文件可在另一空库导入恢复 | 导出→清库→导入→核对数据 |
| D-22 | 支付宝真实账单 CSV 可正确导入 | 用模拟脱敏样本测试端到端 |
| D-23 | 微信支付真实账单 CSV 可正确导入 | 用模拟脱敏样本测试端到端 |
| D-24 | 招行真实流水 CSV 可正确导入 | 用模拟脱敏样本测试端到端 |
| D-25 | 重复导入同一 CSV 时重复项被标注 | 二次导入相同文件 |
| D-26 | 清空交易后账户余额归零、交易列表为空 | 执行清空→检查各页面 |

**验证流程优化**：D-1 至 D-20 由 CI 覆盖，无需手动；D-21 至 D-26 需手动，因涉及真实文件和跨流程核对。模拟脱敏样本由开发阶段生成（贴合各来源真实格式）。

## 11. 实施顺序

```
Task 1: export-service + 测试 (TDD)
   ↓ (ExportEnvelope 类型被 import-service 依赖)
Task 2: import-service (JSON 部分) + 测试
   ↓ (ParsedCsvTransaction 依赖模板类型)
Task 3: import-templates 系统（types + 7 模板 + registry + keyword-rules）+ 测试
   ↓ (import-service CSV 部分依赖模板)
Task 4: import-service (CSV 部分) + 测试补全
   ↓ (clear-service 独立)
Task 5: clear-service + 测试
   ↓ (Service 层全部就绪)
Task 6: IPC handlers + preload + dataAccess 扩展
   ↓ (渲染层可调用)
Task 7: DataManagementPanel + 清空对话框 + 测试
   ↓
Task 8: CsvImportWizard 5 步组件 + 测试
   ↓
Task 9: SettingsPage 集成数据管理区 + 模拟数据生成
   ↓
Task 10: 全量测试 + tsc + 构建验证
   ↓
Task 11: 推送 + CI 验证
```

**任务粒度说明**：
- Task 1-5（shared 层）：纯逻辑，TDD，每个 task 独立可测可提交
- Task 6（IPC 层）：薄桥接层，一次性完成所有通道注册
- Task 7-9（渲染层）：组件开发，Task 8 最复杂（CSV 向导 5 步）
- Task 10-11：收尾验证

## 12. 关键技术决策

| 决策项 | 选择 | 理由 |
|--------|------|------|
| GBK 编码处理 | `iconv-lite` 库 | 支付宝/微信默认 GBK，Node.js 原生仅支持 UTF-8 |
| 模板架构 | TypeScript 模块化 | 类型安全、IDE 提示、易扩展 |
| 分类 ID 占位符 | `__CATEGORY_XXX__` 运行时解析 | 种子分类 UUID 动态生成，无法硬编码 |
| CSV 解析位置 | 主进程 | 文件 I/O + GBK 解码在主进程，渲染层只做 UI |
| 向导状态管理 | 组件内 useState | 临时流程，无需全局 store |
| 去重策略 | 哈希（日期+金额+摘要+对方） | 平衡准确性和性能 |
| 清空交易范围 | 交易+模板+余额归零 | 不含快照（下次启动自动重生成） |
| JSON 导入模式 | 仅 LWW 合并 | 原设计已足够，YAGNI |
| 账户关联方式 | 选择单个目标账户 | 简单可靠，用户需预先建账户 |

## 13. 新增依赖

| 包 | 位置 | 用途 |
|----|------|------|
| `iconv-lite` | apps/desktop dependencies | GBK 文件解码（支付宝/微信账单） |

## 14. 风险点

1. **支付宝/微信 CSV 格式变动**：模板基于当前导出格式，若平台更新导出格式需更新模板。缓解：fileSignatures 自动检测 + parseHook 集中处理
2. **7 家银行 CSV 格式差异**：每家银行流水格式不同，需逐个调研真实样本。缓解：本期用模拟数据验证，真实样本验证留待手动验证阶段
3. **大文件导入性能**：万级交易批量插入可能卡顿。缓解：better-sqlite3 同步 API + 单事务批量插入，预期 < 10MB 无问题

## 15. 不在范围内（明确排除）

- 加密同步层（留待独立里程碑）
- 通用 CSV 字段映射向导（YAGNI，预设模板已覆盖主要来源）
- 邮件账单自动抓取（门槛高，覆盖有限）
- 其他记账软件格式导入（如随手记/MoneyWiz，留待后续）
- 导入历史规则记忆（YAGNI，预设模板已固定）

## 附录：与原设计文档的关系

本 spec 基于 2026-07-15 数据导出/导入设计文档，并在此基础上扩展：
- **沿用**：JSON 信封格式、LWW 合并算法、CSV 单表导出格式、文件命名规则、IPC 通道命名
- **扩展**：新增 CSV 交易导入（预设模板系统、关键词推断、去重、预览编辑向导）
- **调整**：将原设计中"清空交易"明确范围（交易+模板+余额归零，不含快照）
- **调整**：导入 JSON 跨用户场景明确处理（user_id 归一为本地 userId）
