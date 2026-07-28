# 已知问题与潜在风险分析

> **触发事件：** Task 8 端到端验证中发现 6 个环境/配置问题
> **目的：** 记录已修复问题，分析潜在类似风险，给出预防方案

---

## 1. 已修复问题（6 项）

| 编号 | 问题 | 严重程度 | 根因 | 修复方式 | 状态 |
|------|------|----------|------|----------|------|
| 1 | pnpm 未安装 | 中 | 开发环境未预装 pnpm | README 环境要求 + 安装命令 | 已修复 |
| 2 | pnpm.onlyBuiltDependencies 弃用 | 中 | pnpm 11 不再读取 package.json 的 pnpm 字段 | 迁移到 pnpm-workspace.yaml | 已修复 |
| 3 | minimumReleaseAge 拦截 | 中 | pnpm 11 供应链安全策略 | pnpm-workspace.yaml 添加 minimumReleaseAge: 0 | 已修复 |
| 4 | Electron 二进制未下载 | 高 | install scripts 被拦截 + 默认源慢 | .npmrc 镜像源 + postinstall rebuild | 已修复 |
| 5 | better-sqlite3 ABI 不匹配 | 高 | 原生模块针对系统 Node.js 编译，非 Electron | postinstall 自动 electron-rebuild | 已修复 |
| 6 | preload 脚本未加载 | 高 | Electron 31 默认 sandbox: true | sandbox: false + 文档说明 | 已修复 |

---

## 2. 潜在问题分析（2 项）

### 2.1 createDatabase 默认相对路径误用

**严重程度：** 低

**位置：** `packages/shared/src/db/connection.ts`

**当前代码：**
```typescript
export function createDatabase(path: string = 'data/fire-app.db'): DatabaseType {
```

**风险：** 默认值为相对路径 `'data/fire-app.db'`。桌面端 `db-manager.ts` 始终传入绝对路径，默认值未被使用。但若其他入口（如测试或脚本）误用默认值，会在当前工作目录创建数据库文件，可能导致数据丢失或路径混乱。

**预防方案：** 建议移除默认值，改为必填参数，或改为抛出错误：
```typescript
export function createDatabase(path: string): DatabaseType {
  if (!path) throw new Error('数据库路径不能为空');
```

**状态：** 建议（暂未修改）

### 2.2 文档与代码不一致

**严重程度：** 中

**根因：** 设计文档在代码实现前编写，实现过程中做了调整（sandbox、preload 路径、API 命名），但未回溯更新文档。

**已修复项：**
- sandbox: true → false（3 份设计文档）
- preload/index.js → index.mjs（3 份设计文档）
- window.api → window.dataAccess（1 份设计文档）

**预防方案：** 建立文档 review 流程——每次代码合并前，检查相关设计文档是否需要同步更新。

**状态：** 本次修复完成

---

## 3. 预防措施清单

| 措施 | 对应问题 | 实施状态 |
|------|----------|----------|
| .npmrc 镜像源配置 | #4 Electron 下载 | 已实施 |
| postinstall 自动 rebuild | #5 ABI 不匹配 | 已实施 |
| pnpm-workspace.yaml 配置 | #2 #3 pnpm 策略 | 已实施 |
| sandbox: false + 文档说明 | #6 preload 加载 | 已实施 |
| README 故障排查章节 | #1 所有问题 | 已实施 |
| 设计文档对齐 | 文档不一致 | 已实施 |
| createDatabase 默认值移除 | #2.1 相对路径 | 建议中 |
| 文档 review 流程 | #2.2 文档不一致 | 建议中 |
