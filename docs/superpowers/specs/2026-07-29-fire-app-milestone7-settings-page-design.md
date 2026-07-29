# M7 设置页设计 / M7 Settings Page Design

> 版本: 1.0  日期: 2026-07-29  状态: 已批准
> 前置文档: UI/UX 设计文档 §3.5、前端架构设计文档、用户数据模型设计文档

---

## 1. 目标

实现 UI/UX spec §3.5 规划的设置页，补齐最后一个核心页面。本里程碑范围聚焦两项：

1. **用户偏好编辑**：6 字段表单（display_name / base_currency 只读 / is_china_market / 3 个默认利率），保存到 User 表并同步全局 currentUser
2. **内置分类展示与重置**：展示 18 个系统分类（11 支出 + 7 收入），支持重置（软删除旧系统分类 + 重新 seed，保留自定义分类）

**不在范围内**：数据导出（CSV）、清空交易——留待独立的数据导入导出里程碑。

## 2. 架构与数据流

单页 + 上下两区，复刻 M4/M5/M6 容器模式：

```
SettingsPage (容器)
  │
  ├─ useEffect → dataAccess.getUser(userId) 加载用户
  ├─ useEffect → dataAccess.getCategories(userId) 加载分类
  │
  ├─ 用户偏好区（表单）
  │     ├─ 6 字段：display_name / base_currency(只读) / is_china_market / 3 个利率
  │     ├─ 中国市场切换 → 联动默认提现率（350↔400），用户可手动覆盖
  │     ├─ 保存 → 校验 → dataAccess.updateUser → app-store.setCurrentUser（同步全局）
  │     └─ 重置 → 恢复表单到上次保存值
  │
  └─ 内置分类区
        ├─ 展示支出分类(11) + 收入分类(7) 列表
        └─ 重置 → 确认对话框 → dataAccess.resetSystemCategories → 重新加载 + Toast
```

## 3. 数据层改动

### 3.1 新增 service 函数

文件：`packages/shared/src/services/category-service.ts`（新建）

```typescript
import type { Database as DatabaseType } from 'better-sqlite3';
import { seedCategories } from '../models/category.js';
import { nowMs } from '../utils/time.js';

/**
 * 重置系统分类：事务内软删除现有系统分类 + 重新 seed 18 个内置分类
 * 自定义分类（is_system=0）保留不动
 */
export function resetSystemCategories(db: DatabaseType, userId: string): void {
  db.transaction(() => {
    db.prepare(
      'UPDATE categories SET deleted_flag = 1, updated_at = ? WHERE user_id = ? AND is_system = 1'
    ).run(nowMs(), userId);
    seedCategories(db, userId);
  })();
}
```

### 3.2 IPC handler 追加

文件：`apps/desktop/src/main/ipc/category-handlers.ts`

```typescript
import { resetSystemCategories } from '@shared/services/category-service.js';
// ...
registerHandler('db:category:resetSystem', (_db, userId: string) => resetSystemCategories(_db, userId), db);
```

### 3.3 preload + dataAccess + dataAccessPort 各追加一行

- `preload/index.ts`：`resetSystem: (userId: string) => ipcRenderer.invoke('db:category:resetSystem', userId)`
- `data-access-port.ts`：`resetSystemCategories(userId: string): Promise<void>;`
- `ipc-data-access.ts`：`resetSystemCategories(userId) { return window.dataAccess.category.resetSystem(userId); }`

## 4. SettingsPage 组件

文件：`apps/desktop/src/renderer/src/pages/SettingsPage.tsx`（新建）

### 4.1 用户偏好区

- 受控表单，本地 `formData` state（初始化自 `app-store.currentUser`）
- **display_name**：文本输入，校验 1-30 字符
- **base_currency**：只读展示（MVP 仅支持 CNY）
- **is_china_market**：开关，切换时联动提现率（中国 350 / 全球 400），用户可手动覆盖
- **3 个利率字段**：百分比显示，基点存储（复用 M6 转换逻辑：`basisPointsToPercent` / `percentToBasisPoints`）
- **保存按钮**：校验通过 → `dataAccess.updateUser` → `app-store.setCurrentUser` → Toast 成功
- **重置按钮**：恢复表单到上次保存值
- **只读信息**：最后同步时间（last_sync_at 格式化）、同步版本号

### 4.2 内置分类区

- `dataAccess.getCategories(userId)` 加载分类，过滤 `is_system === 1`
- 两个列表：支出分类（11）、收入分类（7），只读展示名称
- **重置按钮**：弹出确认对话框 → `dataAccess.resetSystemCategories` → 重新加载分类 → Toast 成功

## 5. 路由与导航

修改 2 文件：

- `router/index.tsx`：新增 `{ path: '/settings', element: <SettingsPage /> }`
- `Sidebar.tsx`：NAV_ITEMS 末尾追加设置项（齿轮图标）

## 6. 测试策略

### 6.1 service 测试（shared）

文件：`packages/shared/tests/services/category-service.test.ts`（新建）

- `resetSystemCategories`：软删除旧系统分类、保留自定义分类、重新 seed 18 个
- 事务性：验证操作原子性

### 6.2 组件测试（desktop）

文件：`apps/desktop/tests/settings-components.test.tsx`（新建）

- 表单 6 字段渲染正确
- 中国市场开关切换联动提现率
- 保存触发 `updateUser` + `setCurrentUser`
- 重置按钮恢复表单
- 校验错误提示
- 内置分类列表渲染（支出 11 + 收入 7）
- 重置分类确认对话框流程

### 6.3 集成测试

- 加载用户 → 编辑偏好 → 保存 → 全局 currentUser 更新
- 重置分类 → 列表刷新

## 7. 验证清单

套用验证流程优化 spec 的模板：

### 自动验证（CI 覆盖）

| 编号 | 检查点 | 实现位置 |
|------|--------|---------|
| S-1 | 设置页路由可访问 | 路由配置 + 导航测试 |
| S-2 | 6 字段表单渲染正确 | 组件测试 |
| S-3 | 中国市场联动提现率 | 组件测试 |
| S-4 | 保存触发 updateUser | 集成测试 |
| S-5 | 保存后全局 currentUser 更新 | 集成测试 |
| S-6 | 内置分类列表渲染 | 组件测试 |
| S-7 | 重置分类事务正确 | service 测试 |
| S-8 | 重置后列表刷新 | 集成测试 |
| S-9 | 校验错误提示 | 组件测试 |
| S-10 | 单元测试全通过 | CI `pnpm test:all` |
| S-11 | tsc 零错误 | CI 构建 |
| S-12 | 构建成功 | CI `electron-builder` |

### 手动验证（GUI）

| 编号 | 检查点 | 步骤 |
|------|--------|------|
| S-13 | 视觉布局正常 | 打开设置页，检查间距/对齐/响应式 |

## 8. 实施顺序

1. Task 1: category-service.ts + 测试（TDD）
2. Task 2: IPC + preload + dataAccess + dataAccessPort 扩展
3. Task 3: SettingsPage 组件 + 测试
4. Task 4: 路由 + 侧边栏导航
5. Task 5: 全量测试 + tsc + 构建验证
6. Task 6: 推送 + CI 验证
