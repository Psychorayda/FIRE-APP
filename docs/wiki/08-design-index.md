# 08-design-index.md — 设计文档导航

> **最后更新**: 2026-07-15
> **对应代码**: `docs/superpowers/`
> **导航**: [← 返回主页](CODE_WIKI.md) | [上一节](07-tests.md) | [下一节]（无）

---

> ⚠️ **此文件为快照**：本索引记录的设计文档信息以编写时（2026-07-15）为准。
> 最新内容请以 `docs/superpowers/specs/` 和 `plans/` 下的原文档为权威。
> Wiki 全文遵循"代码为权威"原则，本索引仅作导航。

---

## 1. 概述

本文件是 FIRE APP 设计/规划文档的索引。仓库 `docs/superpowers/` 下共有 9 份设计/规划文档：6 份 spec（设计文档）+ 3 份 plan（实施计划）。

**核心原则：Wiki 以代码为权威**。本索引仅作导航与摘要，不复述设计文档的完整内容。当设计文档与代码不一致时，以代码为准，差异集中记录在第 4 节"已知问题清单"中。

- 第 2 节：6 份设计文档（spec）清单与摘要
- 第 3 节：3 份实施计划（plan）清单与摘要
- 第 4 节：已知问题清单（来自设计文档审查报告，含 2 个确认错误）
- 第 5 节：尚未实现的规划（前端代码、加密同步层）

---

## 2. 设计文档清单（6 份 spec）

### 2.1 用户数据模型设计

- **路径**：[specs/2026-07-12-fire-app-user-data-model-design.md](file:///workspace/FIRE%20APP/docs/superpowers/specs/2026-07-12-fire-app-user-data-model-design.md)
- **日期 / 版本 / 状态**：2026-07-12 / v1.0 / 待审核
- **范围**：用户数据模型（7 张核心表），不含 UI 设计、API 设计、计算引擎实现
- **关键贡献**：
  - 定义 4 层领域架构（用户层 / 财务追踪层 / 快照层 / FIRE 投影层）
  - 采用 UUID v4 主键，支持离线创建与同步无冲突
  - 统一同步元数据字段（updated_at / sync_version / deleted_flag），支持记录级 LWW 冲突解决
  - 金额用 INTEGER 存储"分"、利率用 INTEGER 存储基点，规避浮点误差
  - 定义 18 个种子分类（11 支出 + 7 收入），其中 5 个关联 FIRE 概念
- **与代码的对应关系**：
  - [schema.ts](file:///workspace/FIRE%20APP/fire-app/src/db/schema.ts) 实现 7 张表 DDL + 9 个索引
  - [types/index.ts](file:///workspace/FIRE%20APP/fire-app/src/types/index.ts) 实现 5 个枚举别名 + 7 个实体接口
  - [models/](file:///workspace/FIRE%20APP/fire-app/src/models/) 7 个文件对应 7 张表的 CRUD
- **已知问题**：第 925 行（决策记录 #17）AccountType 枚举数写"10 种"，正确为 11 种（详见 4.2）

### 2.2 前端架构设计

- **路径**：[specs/2026-07-15-fire-app-frontend-architecture-design.md](file:///workspace/FIRE%20APP/docs/superpowers/specs/2026-07-15-fire-app-frontend-architecture-design.md)
- **日期 / 版本 / 状态**：2026-07-15 / v1.0 / 待审核
- **范围**：Electron + React 桌面 MVP 的前端架构设计
- **关键贡献**：
  - 定义进程隔离模型：DB 操作仅在主进程，渲染进程通过 IPC 桥间接调用
  - 设计 `DataAccessPort` 抽象接口，桌面走 IPC、移动端走 react-native-quick-sqlite
  - 抽取纯逻辑代码到 `packages/shared`，为 React Native 移动端扩展预留
  - 定义 IPC 通道清单（如 `db:init`、`db:user:getFirst`、`db:category:seed`）
  - 选定技术栈：Electron 31 + React 19 + Tailwind CSS 4 + Zustand 5
- **与代码的对应关系**：尚未实现（前端代码未落地，仅现有数据层代码可零改动迁移）
- **已知问题**：无

### 2.3 UI/UX 设计

- **路径**：[specs/2026-07-15-fire-app-ui-ux-design.md](file:///workspace/FIRE%20APP/docs/superpowers/specs/2026-07-15-fire-app-ui-ux-design.md)
- **日期 / 版本 / 状态**：2026-07-15 / v1.0 / 待审核
- **范围**：桌面应用界面设计、交互流程、组件规范
- **关键贡献**：
  - 定义三大设计理念（专业感 / 数据驱动 / 简洁克制）与目标用户画像
  - 建立色彩体系（主色专业蓝、辅色翠绿），对齐 Tailwind CSS v4 默认色板并通过 WCAG 2.1 AA 校验
  - 规划 6 个核心页面路由（账户管理 / 交易记录 / 净资产趋势 / FIRE 计算器等）
  - 定义"概览 → 明细 → 操作"三段式信息架构
  - 规定负债负数符号约定与净资产公式（与数据模型文档一致）
- **与代码的对应关系**：尚未实现（前端代码未落地）
- **已知问题**：无

### 2.4 应用初始化设计

- **路径**：[specs/2026-07-15-fire-app-initialization-design.md](file:///workspace/FIRE%20APP/docs/superpowers/specs/2026-07-15-fire-app-initialization-design.md)
- **日期 / 版本 / 状态**：2026-07-15 / v1.0 / 待审核
- **范围**：应用启动流程、数据库初始化、用户引导、迁移机制
- **关键贡献**：
  - 定义完整初始化序列：Electron ready → 创建数据目录 → 打开 DB → 初始化 schema → 判断首次启动
  - 首次启动判断基于数据（查询 users 表）而非文件存在性
  - 设计首次启动向导：用户档案创建 + seedCategories 调用
  - 定义基于 `PRAGMA user_version` 的 schema 版本管理与迁移事务化
  - 规划后续启动的补生成任务（经常性交易 + 月度快照）
- **与代码的对应关系**：
  - [connection.ts](file:///workspace/FIRE%20APP/fire-app/src/db/connection.ts) 的 `createDatabase` / `closeDatabase`
  - [schema.ts](file:///workspace/FIRE%20APP/fire-app/src/db/schema.ts) 的 `initSchema`
  - [category.ts](file:///workspace/FIRE%20APP/fire-app/src/models/category.ts) 的 `seedCategories`
  - [recurring-service.ts](file:///workspace/FIRE%20APP/fire-app/src/services/recurring-service.ts) 的 `processRecurringTransactions`
  - [snapshot-service.ts](file:///workspace/FIRE%20APP/fire-app/src/services/snapshot-service.ts) 的 `generateMonthlySnapshot`
- **已知问题**：无

### 2.5 缺失设计文档规划

- **路径**：[specs/2026-07-15-fire-app-missing-design-documents-plan.md](file:///workspace/FIRE%20APP/docs/superpowers/specs/2026-07-15-fire-app-missing-design-documents-plan.md)
- **日期 / 版本 / 状态**：2026-07-15 / v1.0 / 待审核
- **范围**：识别设计空白，制定三阶段分批设计计划
- **关键贡献**：
  - 识别从数据层到完整 APP 之间的设计空白
  - 划分三个阶段：阶段 1 桌面 MVP → 阶段 2 跨平台 + 安全 → 阶段 3 同步与加密
  - 确定技术路径决策：Electron + React Native，共享 TypeScript 逻辑层
  - 明确 MVP 范围：账户管理 + 交易记录 + 净资产趋势 + FIRE 计算器
  - 确定同步层与本地安全延后到阶段 2/3
- **与代码的对应关系**：本规划驱动了阶段 1 三份设计文档（前端架构 / UI/UX / 初始化）的编写
- **已知问题**：第 155 行种子分类数写"17 个"，正确为 18 个（详见 4.1）

### 2.6 设计文档全面复盘分析报告

- **路径**：[specs/2026-07-15-fire-app-design-documents-review.md](file:///workspace/FIRE%20APP/docs/superpowers/specs/2026-07-15-fire-app-design-documents-review.md)
- **日期 / 版本 / 状态**：2026-07-15 / v1.0 / 已完成（审查报告）
- **范围**：跨文档一致性检查、文档与代码对齐验证、缺失内容识别
- **关键贡献**：
  - 完成 17 项跨文档一致性验证（函数签名、IPC 通道、种子分类清单、负债符号、净资产公式等均一致）
  - 识别并确认 2 个错误（种子分类数 17→18、AccountType 枚举数 10→11）
  - 识别若干不一致项（如初始化文档 import 路径风格不统一）
  - 验证文档与代码对齐：`createDatabase` / `initSchema` / `seedCategories` 等签名一致
  - 为 Wiki 08-design-index 的已知问题清单提供权威来源
- **与代码的对应关系**：本文件是 Wiki 第 4 节"已知问题清单"的直接来源
- **已知问题**：无（本文件即审查报告本身）

---

## 3. 实现计划清单（3 份 plan）

### 3.1 数据模型实施计划

- **路径**：[plans/2026-07-13-fire-app-data-model-implementation.md](file:///workspace/FIRE%20APP/docs/superpowers/plans/2026-07-13-fire-app-data-model-implementation.md)
- **日期 / 状态**：2026-07-13 / 已完成
- **范围**：数据模型层代码实现（7 张表 schema + CRUD + 服务层 + 工具层 + 测试）
- **关键任务**：
  - 创建数据库 schema（7 张表 DDL + 9 个索引）
  - 实现 7 个 models（user / account / category / transaction / recurring / scenario / snapshot）
  - 实现 4 个 services（fire-calc / transaction-service / recurring-service / snapshot-service）
  - 实现 3 个 utils（money / sync / time）
  - 编写 13 个测试文件（12 单元 + 1 集成）

### 3.2 桌面 MVP 里程碑 1：架构验证切片

- **路径**：[plans/2026-07-15-fire-app-desktop-mvp-milestone1.md](file:///workspace/FIRE%20APP/docs/superpowers/plans/2026-07-15-fire-app-desktop-mvp-milestone1.md)
- **日期 / 状态**：2026-07-15 / 规划中（前端代码尚未落地）
- **范围**：搭建 Electron 桌面应用骨架，验证主进程 + IPC 桥 + React 渲染进程的端到端数据通路
- **关键任务**：
  - 建立 pnpm workspace monorepo（`packages/shared` + `apps/desktop`）
  - 将现有 TypeScript 数据层代码零改动迁移到 `packages/shared`
  - 搭建 Electron 主进程（持有 better-sqlite3 + IPC handler）
  - 搭建 React 19 渲染层 + Zustand 状态管理 + DataAccessPort 接口
  - 实现"启动 → 初始化 DB → 读取用户 → 显示用户名"端到端验证

### 3.3 阶段 1 设计文档编写计划

- **路径**：[plans/2026-07-15-fire-app-stage1-design-documents.md](file:///workspace/FIRE%20APP/docs/superpowers/plans/2026-07-15-fire-app-stage1-design-documents.md)
- **日期 / 状态**：2026-07-15 / 已完成（已产出 3 份 spec）
- **范围**：编写阶段 1 的三份设计文档（前端架构 + UI/UX + 应用初始化）
- **关键任务**：
  - 编写前端架构设计文档（先行，定义进程模型与 IPC 通道）
  - 编写 UI/UX 设计文档（跟进，定义页面与交互）
  - 编写应用初始化设计文档（跟进，定义启动序列）
  - 每份文档经历"研究分析 → 撰写草稿 → 自审检查 → 用户审核 → 提交"流程
  - 确保设计与已实现的数据模型层无缝衔接

---

## 4. 已知问题清单（历史记录）

以下问题曾在 [设计文档审查报告](file:///workspace/FIRE%20APP/docs/superpowers/specs/2026-07-15-fire-app-design-documents-review.md) 第 2 节"确认的错误"中记录。**经 Wiki 编写时（2026-07-15）复核，两处错误均已在源文档中修正**，本节仅作历史记录保留。

### 4.1 种子分类数量错误（已修正）

| 维度 | 内容 |
|------|------|
| **位置** | `2026-07-15-fire-app-missing-design-documents-plan.md` 第 155 行 |
| **历史错误** | 曾写"17 个内置分类" |
| **正确值** | **18 个**（11 支出 + 7 收入） |
| **当前状态** | ✅ 已修正 — 源文档第 155 行现显示"18 个内置分类" |
| **代码权威** | [category.ts](file:///workspace/FIRE%20APP/fire-app/src/models/category.ts) `SEED_CATEGORIES` 数组有 18 条记录 |

### 4.2 AccountType 枚举数量错误（已修正）

| 维度 | 内容 |
|------|------|
| **位置** | `2026-07-12-fire-app-user-data-model-design.md` 第 925 行（决策记录 #17） |
| **历史错误** | 曾写"10 种完整枚举" |
| **正确值** | **11 种**（checking / savings / cash / investment / retirement / fund / real_estate / vehicle / credit_card / loan / mortgage） |
| **当前状态** | ✅ 已修正 — 源文档第 925 行现显示"11 种完整枚举" |
| **代码权威** | [types/index.ts](file:///workspace/FIRE%20APP/fire-app/src/types/index.ts) `AccountType` 类型有 11 个值 |

### 4.3 修正原则

**Wiki 全文以代码为权威**：

- 以代码 [category.ts](file:///workspace/FIRE%20APP/fire-app/src/models/category.ts) 的 `SEED_CATEGORIES` 数组（**18 条**）为权威 — Wiki 描述为 18 个种子分类
- 以代码 [types/index.ts](file:///workspace/FIRE%20APP/fire-app/src/types/index.ts) 的 `AccountType` 类型（**11 个值**）为权威 — Wiki 描述为 11 种账户类型
- 设计文档现已与代码一致，无需逐处修改
- 未来若发现新的文档-代码差异，应在本节追加条目

---

## 5. 尚未实现的规划

以下内容在设计文档中已规划，但代码尚未落地。Wiki 02-06 文件中**不**描述这些内容，仅在此处统一标注。

### 5.1 前端代码

| 规划内容 | 设计文档 | 状态 |
|----------|----------|------|
| Electron 主进程 | 前端架构设计 | 未实现 |
| React 渲染层 | 前端架构设计 + UI/UX 设计 | 未实现 |
| IPC 通道（`db:init` 等） | 前端架构设计 + 初始化设计 | 未实现 |
| DataAccessPort 抽象层 | 前端架构设计 | 未实现 |
| Zustand 状态管理 | 前端架构设计 | 未实现 |
| 路由（6 个核心页面） | 前端架构设计 + UI/UX 设计 | 未实现 |
| 用户引导流程（首次启动向导） | 初始化设计 | 未实现 |
| pnpm workspace monorepo 结构 | 桌面 MVP 里程碑 1 | 未实现 |

### 5.2 加密同步层

| 规划内容 | 设计文档 | 状态 |
|----------|----------|------|
| 加密密钥管理 | 数据模型设计（users.encryption_key_hash 字段） | 未实现 |
| LWW 同步引擎 | 数据模型设计（sync_version + shouldRemoteWin） | 未实现（[sync.ts](file:///workspace/FIRE%20APP/fire-app/src/utils/sync.ts) 仅提供冲突判断原语，无完整引擎） |
| 跨设备同步 | 缺失设计文档规划（阶段 3） | 未实现 |
| 数据导出/备份 | 缺失设计文档规划（MVP 阶段手动导出） | 未实现 |

---

> **导航**：[← 返回主页](CODE_WIKI.md) | [上一节](07-tests.md) | [下一节]（无）
