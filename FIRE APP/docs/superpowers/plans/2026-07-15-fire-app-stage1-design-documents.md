# FIRE 计算APP 阶段 1 设计文档编写 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 编写阶段 1 的三份设计文档（前端架构设计、UI/UX 设计、应用初始化设计），为桌面 MVP 开发提供完整的设计基础。

**Architecture:** 按依赖顺序逐份编写：① 前端架构设计先行 → ② UI/UX 设计 + ③ 应用初始化设计跟进。每份文档经历"研究分析 → 撰写草稿 → 自审检查 → 用户审核 → 提交"的完整流程。研究阶段需阅读现有代码和文档，确保设计与已实现的数据模型层无缝衔接。

**Tech Stack:** 设计文档（Markdown），参考技术栈：Electron + React + TypeScript + better-sqlite3

**Spec:** `docs/superpowers/specs/2026-07-15-fire-app-missing-design-documents-plan.md`

---

## 文件结构

本计划产出的文件：

```
docs/superpowers/specs/
├── 2026-07-15-fire-app-missing-design-documents-plan.md  (已有，规划文档)
├── 2026-07-15-fire-app-frontend-architecture-design.md   (Task 1 产出)
├── 2026-07-15-fire-app-ui-ux-design.md                   (Task 2 产出)
└── 2026-07-15-fire-app-initialization-design.md           (Task 3 产出)
```

需参考的现有文件：

```
fire-app/src/
├── types/index.ts              # 7张表的TypeScript接口定义
├── db/connection.ts            # SQLite连接管理（需了解主进程适配）
├── db/schema.ts                # 7张表DDL + 索引
├── models/*.ts                 # 7张表CRUD操作
├── services/*.ts               # 交易事务/经常性引擎/快照/FIRE计算
└── utils/*.ts                  # money/time/sync工具
```

---

## Task 1: 前端架构设计文档

**Files:**
- Create: `docs/superpowers/specs/2026-07-15-fire-app-frontend-architecture-design.md`
- Read: `fire-app/src/db/connection.ts`, `fire-app/src/types/index.ts`, `fire-app/src/services/transaction-service.ts`, `fire-app/package.json`

- [ ] **Step 1: 研究现有代码架构**

阅读以下文件，记录关键发现：

1. `fire-app/src/db/connection.ts` — 了解当前 SQLite 连接管理方式，确认是否使用同步 API（better-sqlite3 是同步的），评估迁移到 Electron IPC 桥的影响
2. `fire-app/src/types/index.ts` — 记录所有 TypeScript 接口，确认前端架构需复用的类型
3. `fire-app/src/services/transaction-service.ts` — 了解服务层是否直接依赖 `Database` 类型，评估解耦难度
4. `fire-app/package.json` — 记录当前依赖版本

研究产出：一份"现有代码与 Electron 架构的适配分析"笔记，包含：
- 当前同步 API 调用清单（哪些 service 方法是同步的）
- 需要改为异步 IPC 调用的方法清单
- `Database` 类型耦合点清单

- [ ] **Step 2: 研究 Electron + React 最佳实践（2026年）**

搜索以下主题，收集技术选型依据：

1. "Electron Vite React 2026 best practices" — 确认构建工具选型
2. "Electron IPC bridge best practices TypeScript" — 确认数据访问层设计
3. "Electron monorepo shared logic React Native" — 确认跨平台共享层架构
4. "Zustand vs Redux Toolkit 2026 Electron" — 确认状态管理方案

研究产出：技术选型对比表，每个选型列出 2-3 个候选方案和推荐理由。

- [ ] **Step 3: 撰写前端架构设计文档草稿**

创建 `docs/superpowers/specs/2026-07-15-fire-app-frontend-architecture-design.md`，按以下结构撰写：

```markdown
# FIRE 计算APP — 前端架构设计

> 版本: 1.0
> 日期: 2026-07-15
> 状态: 待审核
> 前置文档: 用户数据模型设计文档 v1.0, 缺失设计文档规划 v1.0

## 1. 设计概述
### 1.1 目标
### 1.2 设计原则
### 1.3 架构总览（ASCII 图）

## 2. 技术栈选型
### 2.1 Electron 主进程/渲染进程划分
### 2.2 React 版本与构建工具
### 2.3 CSS 方案
### 2.4 选型决策记录表

## 3. 目录结构
### 3.1 Monorepo 结构设计
### 3.2 共享逻辑层（packages/shared）
### 3.3 桌面应用层（apps/desktop）
### 3.4 现有代码迁移映射表

## 4. 数据访问层
### 4.1 IPC 桥架构
### 4.2 DataAccessPort 接口定义
### 4.3 IPC 通道定义规范
### 4.4 数据序列化策略
### 4.5 错误传播机制

## 5. 状态管理
### 5.1 状态管理方案选型
### 5.2 全局状态结构
### 5.3 数据流：服务层 → 状态 → UI
### 5.4 交易写入后的状态刷新机制

## 6. 路由设计
### 6.1 页面路由结构
### 6.2 单窗口策略
### 6.3 路由守卫（首次启动引导）

## 7. 现有代码复用方案
### 7.1 可直接复用的模块清单
### 7.2 需要调整的模块清单
### 7.3 需要新增的模块清单

## 8. 预留扩展点
### 8.1 DataAccessPort 抽象层
### 8.2 移动端适配预留
### 8.3 同步层预留接口

## 附录：决策记录
```

每个章节需包含具体的技术选型结论和设计细节，不可留 TBD。关键设计（如 IPC 通道定义、DataAccessPort 接口）需包含伪代码或接口定义。

- [ ] **Step 4: 自审检查**

对照以下清单检查草稿：

1. **占位符扫描**: 搜索 "TBD"、"TODO"、"待定"、"后续补充" — 全部替换为具体内容
2. **一致性检查**: 目录结构中的路径是否与"现有代码迁移映射表"一致；DataAccessPort 接口定义是否与 IPC 通道定义对应
3. **覆盖度检查**: 对照规划文档 4.1 节的 7 个章节，确认每个章节都有实质内容
4. **可实施性检查**: 选型结论是否明确（不能是"A 或 B 都可以"），是否有具体的接口定义

修正所有发现的问题。

- [ ] **Step 5: 提交文档**

```bash
cd "d:\Admin\OneDrive\Apps\FIRE APP"
git add docs/superpowers/specs/2026-07-15-fire-app-frontend-architecture-design.md
git commit -m "docs: 添加前端架构设计文档"
```

- [ ] **Step 6: 用户审核**

向用户展示文档摘要，请用户审核。等待用户反馈：
- 若用户要求修改 → 修改后重新自审（Step 4）并重新提交
- 若用户确认通过 → 进入 Task 2

---

## Task 2: UI/UX 设计文档

**Files:**
- Create: `docs/superpowers/specs/2026-07-15-fire-app-ui-ux-design.md`
- Read: `docs/superpowers/specs/2026-07-15-fire-app-frontend-architecture-design.md`（Task 1 产出）, `fire-app/src/types/index.ts`, `fire-app/src/services/fire-calc.ts`

**前置条件:** Task 1 完成且用户审核通过

- [ ] **Step 1: 研究前端架构决策**

阅读 Task 1 产出的前端架构设计文档，记录：
- 已确定的 CSS 方案（影响组件系统设计方式）
- 已确定的状态管理方案（影响数据流设计）
- 已确定的图表库选型（影响图表设计章节）
- 页面路由结构（影响导航架构设计）

- [ ] **Step 2: 研究 FIRE/财务类 APP 的 UI 设计参考**

搜索以下主题，收集设计参考：

1. "FIRE calculator app UI design 2026" — FIRE 计算器的 UI 模式参考
2. "personal finance app desktop UI design" — 桌面记账应用的布局参考
3. "financial dashboard chart design React" — 金融图表设计最佳实践
4. "Chinese finance app color scheme" — 中文理财应用的色彩方案

研究产出：设计参考收集表，列出 3-5 个参考应用及其可借鉴的设计点。

- [ ] **Step 3: 研究现有数据模型与 FIRE 计算引擎**

阅读以下文件，确保 UI 设计与数据模型对齐：

1. `fire-app/src/types/index.ts` — 确认每个页面需要展示的实体字段
2. `fire-app/src/services/fire-calc.ts` — 确认 FIRE 计算器的输入参数和输出结果结构
3. 用户数据模型设计文档 3.4 节 — 确认内置分类清单（影响交易记录页的分类选择器设计）

研究产出：页面-数据映射表，每个页面对应哪些实体和字段。

- [ ] **Step 4: 撰写 UI/UX 设计文档草稿**

创建 `docs/superpowers/specs/2026-07-15-fire-app-ui-ux-design.md`，按以下结构撰写：

```markdown
# FIRE 计算APP — UI/UX 设计

> 版本: 1.0
> 日期: 2026-07-15
> 状态: 待审核
> 前置文档: 前端架构设计文档 v1.0, 用户数据模型设计文档 v1.0

## 1. 设计原则
### 1.1 设计理念
### 1.2 色彩体系（主色/辅色/语义色，含色值表）
### 1.3 字体规范（中文字体、字号层级表）
### 1.4 间距系统（4px/8px 网格）
### 1.5 响应式断点

## 2. 导航架构
### 2.1 侧边栏导航结构（含图标方案）
### 2.2 页面层级关系图
### 2.3 导航状态管理

## 3. 页面设计
### 3.1 账户管理页
### 3.2 交易记录页
### 3.3 净资产趋势页
### 3.4 FIRE 计算器页
### 3.5 设置页

## 4. 交互流程
### 4.1 新增交易流程
### 4.2 账户创建流程
### 4.3 FIRE 场景配置流程
### 4.4 交易编辑/删除流程

## 5. 图表设计
### 5.1 净资产趋势图
### 5.2 资产配比图
### 5.3 FIRE 投影图
### 5.4 进度仪表盘
### 5.5 图表库选型结论

## 6. 组件系统
### 6.1 基础组件清单
### 6.2 组件 Props 接口规范
### 6.3 组件命名约定

## 7. 空状态与错误处理
### 7.1 首次使用引导
### 7.2 空数据占位
### 7.3 错误提示规范

## 附录：页面-数据映射表
```

每个页面设计需包含：页面布局描述（ASCII 线框图）、展示字段清单、关键交互说明。色彩体系需给出具体 hex 色值。组件 Props 需给出 TypeScript 接口定义。

- [ ] **Step 5: 自审检查**

对照以下清单检查草稿：

1. **占位符扫描**: 搜索 "TBD"、"TODO"、"待定" — 全部替换为具体内容
2. **架构一致性**: 色彩体系和字体规范是否与 Task 1 确定的 CSS 方案兼容；图表库是否与 Task 1 选型一致
3. **数据对齐检查**: 每个页面展示的字段是否与 `types/index.ts` 中的接口定义对应；FIRE 计算器的参数是否与 `fire-calc.ts` 的输入一致
4. **覆盖度检查**: 对照规划文档 4.2 节的 7 个章节，确认每个章节都有实质内容
5. **完整性检查**: 5 个页面是否每个都有布局描述和字段清单；4 个交互流程是否每个都有步骤说明

修正所有发现的问题。

- [ ] **Step 6: 提交文档**

```bash
cd "d:\Admin\OneDrive\Apps\FIRE APP"
git add docs/superpowers/specs/2026-07-15-fire-app-ui-ux-design.md
git commit -m "docs: 添加UI/UX设计文档"
```

- [ ] **Step 7: 用户审核**

向用户展示文档摘要，请用户审核。等待用户反馈：
- 若用户要求修改 → 修改后重新自审（Step 5）并重新提交
- 若用户确认通过 → 进入 Task 3

---

## Task 3: 应用初始化设计文档

**Files:**
- Create: `docs/superpowers/specs/2026-07-15-fire-app-initialization-design.md`
- Read: `docs/superpowers/specs/2026-07-15-fire-app-frontend-architecture-design.md`（Task 1 产出）, `fire-app/src/db/connection.ts`, `fire-app/src/db/schema.ts`, `fire-app/src/models/category.ts`, `fire-app/src/services/recurring-service.ts`, `fire-app/src/services/snapshot-service.ts`

**前置条件:** Task 1 完成且用户审核通过（Task 3 可与 Task 2 并行）

- [ ] **Step 1: 研究现有数据库与初始化逻辑**

阅读以下文件，记录关键发现：

1. `fire-app/src/db/connection.ts` — 了解当前数据库连接创建方式，确认文件路径参数
2. `fire-app/src/db/schema.ts` — 了解 `initSchema` 函数签名和调用方式
3. `fire-app/src/models/category.ts` — 了解分类创建方法，确认种子数据创建的 API
4. `fire-app/src/services/recurring-service.ts` — 了解经常性交易补生成的触发逻辑
5. `fire-app/src/services/snapshot-service.ts` — 了解月度快照生成的触发逻辑

研究产出：
- 现有初始化相关函数签名清单
- 需要在 Electron 主进程中调用的初始化函数清单
- 经常性交易补生成和快照生成的调用时机分析

- [ ] **Step 2: 研究 Electron 应用初始化最佳实践**

搜索以下主题：

1. "Electron app initialization best practices 2026" — Electron 启动流程最佳实践
2. "SQLite schema migration PRAGMA user_version" — SQLite 迁移方案
3. "Electron userData directory structure best practices" — 数据目录组织方式
4. "electron-store vs sqlite for app preferences" — 配置存储方案对比

研究产出：方案对比表，每个决策点列出候选方案和推荐理由。

- [ ] **Step 3: 撰写应用初始化设计文档草稿**

创建 `docs/superpowers/specs/2026-07-15-fire-app-initialization-design.md`，按以下结构撰写：

```markdown
# FIRE 计算APP — 应用初始化设计

> 版本: 1.0
> 日期: 2026-07-15
> 状态: 待审核
> 前置文档: 前端架构设计文档 v1.0, 用户数据模型设计文档 v1.0

## 1. 设计概述
### 1.1 目标
### 1.2 设计原则
### 1.3 初始化流程总览

## 2. 数据目录约定
### 2.1 目录结构
### 2.2 各文件路径规范
### 2.3 目录自动创建逻辑

## 3. 首次启动流程
### 3.1 首次启动判断逻辑
### 3.2 数据库创建与 Schema 初始化
### 3.3 用户档案创建向导
### 3.4 种子数据创建

## 4. 种子数据策略
### 4.1 内置标准分类清单（17个）
### 4.2 创建时机与幂等性保证
### 4.3 种子数据与用户自定义数据的关系

## 5. 后续启动流程
### 5.1 数据库连接恢复
### 5.2 经常性交易补生成检查
### 5.3 月度快照生成检查
### 5.4 后台任务调度策略

## 6. 数据库迁移
### 6.1 版本管理方案
### 6.2 迁移脚本组织结构
### 6.3 迁移执行流程
### 6.4 迁移失败回滚策略

## 7. 配置管理
### 7.1 配置存储方案选型
### 7.2 配置项清单
### 7.3 窗口状态记忆
### 7.4 主题偏好管理

## 8. 启动序列
### 8.1 完整启动时序图
### 8.2 首次启动时序
### 8.3 后续启动时序
### 8.4 启动失败处理

## 附录：决策记录
```

每个章节需包含具体方案结论。启动序列需用 ASCII 时序图展示主进程和渲染进程的交互。种子数据清单需与用户数据模型设计文档 3.4 节的 17 个内置分类完全对应。

- [ ] **Step 4: 自审检查**

对照以下清单检查草稿：

1. **占位符扫描**: 搜索 "TBD"、"TODO"、"待定" — 全部替换为具体内容
2. **架构一致性**: 主进程/渲染进程职责划分是否与 Task 1 前端架构设计文档一致；数据库连接管理是否与架构文档的 IPC 桥设计对应
3. **数据模型对齐**: 种子数据的 17 个分类是否与用户数据模型设计文档 3.4 节完全一致（逐条核对名称、type、linked_fire_concept）；schema 初始化是否引用现有的 `initSchema` 函数
4. **覆盖度检查**: 对照规划文档 4.3 节的 6 个章节，确认每个章节都有实质内容
5. **时序图完整性**: 首次启动和后续启动的时序图是否都包含主进程和渲染进程的交互；是否包含经常性交易补生成和快照生成的触发点

修正所有发现的问题。

- [ ] **Step 5: 提交文档**

```bash
cd "d:\Admin\OneDrive\Apps\FIRE APP"
git add docs/superpowers/specs/2026-07-15-fire-app-initialization-design.md
git commit -m "docs: 添加应用初始化设计文档"
```

- [ ] **Step 6: 用户审核**

向用户展示文档摘要，请用户审核。等待用户反馈：
- 若用户要求修改 → 修改后重新自审（Step 4）并重新提交
- 若用户确认通过 → 阶段 1 三份文档全部完成

---

## 完成标准

阶段 1 三份文档全部完成的标志：

| 检查项 | 标准 |
|--------|------|
| 文档数量 | 3 份文档全部创建并通过用户审核 |
| 文档路径 | 均在 `docs/superpowers/specs/` 目录下 |
| Git 提交 | 每份文档均有独立 commit |
| 自审通过 | 每份文档均通过占位符扫描、一致性检查、覆盖度检查 |
| 用户审核 | 每份文档均获用户明确确认 |
| 阶段过渡 | 满足规划文档 7.2 节"阶段 1 → 桌面 MVP 开发"的过渡条件 |
