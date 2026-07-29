# M6 加固收尾设计 / M6 Hardening Design

> 版本: 1.0  日期: 2026-07-29  状态: 已批准
> 前置文档: M6 FIRE 计算器设计（2026-07-28）、已知问题分析（2026-07-15）

---

## 1. 目标

M6 FIRE 计算器功能已实现并修复两个持久化 bug（固定 userData 路径、手动保存场景），CI 通过。本阶段做加固收尾，提升质量基线，包含 4 项：

1. 清理已知问题：`createDatabase` 默认路径风险
2. 扩展 vitest 集成测试：填补 M6 spec 8.4 的 E2E 缺口
3. 全量同步 wiki 文档：对齐 monorepo 结构
4. 优化验证流程：建立自动/手动验证分类标准与模板

## 2. 执行顺序（方案 A）

修复 → 测试 → 文档 → 流程。先改代码，再补测试验证代码正确性，文档反映最终状态，最后产出验证流程模板。

## 3. 第 1 项：createDatabase 默认路径修复

### 3.1 问题

`packages/shared/src/db/connection.ts` 的 `createDatabase` 默认参数为相对路径 `'data/fire-app.db'`。`db-manager.ts` 始终传绝对路径，测试传 `:memory:`，默认值未被使用。但若其他入口误用默认值，会在当前工作目录创建数据库文件，导致数据丢失或路径混乱。

### 3.2 修复

移除默认值，改为必填参数，空值抛错：

```typescript
export function createDatabase(path: string): DatabaseType {
  if (!path) throw new Error('数据库路径不能为空');
  // ... 其余不变
}
```

### 3.3 影响

- `db-manager.ts`：始终传绝对路径，无影响
- 测试：传 `:memory:`，无影响
- 新增测试：`createDatabase('')` 抛错

## 4. 第 2 项：扩展 vitest 集成测试

### 4.1 缺口分析

M6 spec 8.4 定义 3 个 E2E 场景，现有 44 个测试已覆盖大部分，剩余 3 个缺口：

| 缺口 | spec 8.4 场景 | 现有覆盖 | 需补 |
|------|--------------|---------|------|
| 校验恢复 | 校验失败→阻止保存→修正后恢复 | 仅"阻止保存" | 补"修正后恢复保存" |
| 保存联动投影 | 场景创建→参数编辑→投影重算 | 仅"切换场景触发投影" | 补"保存触发 update+runProjection+结果更新" |
| auto_sync 联动 | auto_sync 开关切换 | 仅表单层 toggle | 补页面级"开启→getInvestableBalance 被调用" |

### 4.2 实现策略

不引入 Playwright，复用现有 `window.dataAccess` mock 与 recharts mock。在 `fire-calc-components.test.tsx` 的 `FireCalculatorPage 集成` describe 块内新增 3 个测试用例。

## 5. 第 3 项：全量同步 wiki 文档

### 5.1 路径映射

| 旧路径 | 新路径 |
|--------|--------|
| `fire-app/src/db\|models\|services\|types\|utils/` | `packages/shared/src/...` |
| `fire-app/tests/` | `packages/shared/tests/` + `apps/desktop/tests/` |
| `fire-app/package.json` | 根 + workspace package.json |

### 5.2 内容更新

- 状态表（01-overview §1.5）：前端代码 `⏳ 规划中` → `✅ 已实现`；新增 Electron 层（main/preload/renderer）
- 目录结构（§5）：改为 monorepo 布局
- 9 文件全部路径与状态对齐：CODE_WIKI.md、01-08

### 5.3 M6 spec

不回改正文，仅在末尾追加"实现差异"备注（debounce→手动保存、onFieldChange→onSave），保持 spec 作为历史设计记录。

## 6. 第 4 项：优化验证流程

### 6.1 产出

`docs/superpowers/specs/2026-07-29-verification-flow-optimization.md`

### 6.2 内容

1. 分类标准：能通过单元/集成测试断言、tsc/构建验证、静态代码逻辑确定的 → 自动验证；涉及真实 Electron 窗口渲染、视觉布局、用户主观感受的 → 手动
2. M6 验证清单重审：FC-1~FC-18 逐项标注 自动/手动，附自动验证实现位置
3. 可复用模板：供未来里程碑套用

## 7. 验收标准

| 编号 | 检查点 | 验证方式 |
|------|--------|---------|
| H-1 | createDatabase 空值抛错 | 单元测试 |
| H-2 | 新增 3 个集成测试通过 | CLI |
| H-3 | 全量测试通过（desktop + shared） | CLI |
| H-4 | tsc 零错误 | CLI |
| H-5 | 构建成功 | CLI |
| H-6 | wiki 9 文件路径全部对齐 | grep 验证 |
| H-7 | 验证流程文档产出 | 文件存在 |
| H-8 | CI 构建成功 | CI |

## 8. 实施顺序

1. Task 1: createDatabase 修复 + 测试
2. Task 2: 扩展 vitest 集成测试（3 用例）
3. Task 3: 全量同步 wiki（9 文件）+ M6 spec 实现差异备注
4. Task 4: 产出验证流程文档
5. Task 5: 全量测试 + tsc + 构建验证
6. Task 6: 推送 + CI 验证
