# 08-design-index.md — 设计文档导航

> **最后更新**: 2026-07-30
> **对应代码**: `docs/superpowers/`
> **导航**: [← 返回主页](CODE_WIKI.md) | [上一节](07-tests.md) | [下一节]（无）

---

> ⚠️ **此文件为快照**：本索引记录的设计文档信息以 2026-07-30 全量重同步（Wiki v2.0）为准，覆盖 M1–M9 全部里程碑 + 非里程碑文档。
> 最新内容请以 `docs/superpowers/specs/` 和 `plans/` 下的原文档为权威。
> Wiki 全文遵循"代码为权威"原则，本索引仅作导航。

---

## 1. 概述

本文件是 FIRE APP 设计/规划文档的索引。仓库 `docs/superpowers/` 下共有 54 份设计/规划文档：33 份 spec（设计文档）+ 21 份 plan（实施计划），覆盖 M1–M9 全部里程碑及非里程碑文档（环境搭建 / Code Wiki / 安全 / 同步层 / CI / Docker / 验证流程 / Electron 36 升级 / 自动更新等）。

**核心原则：Wiki 以代码为权威**。本索引仅作导航与摘要，不复述设计文档的完整内容。当设计文档与代码不一致时，以代码为准，差异集中记录在第 4 节"已知问题清单"中。

- 第 2 节：33 份设计文档（spec）清单与摘要（按日期排序，覆盖 M2–M9 里程碑与非里程碑文档）
- 第 3 节：21 份实施计划（plan）清单与摘要（按日期排序）
- 第 4 节：已知问题清单（来自设计文档审查报告，含 2 个确认错误）
- 第 5 节：尚未实现的规划（加密同步层）

---

## 2. 设计文档清单（32 份 spec）

### 2.1 用户数据模型设计

- **路径**：[specs/2026-07-12-fire-app-user-data-model-design.md](file:///workspace/docs/superpowers/specs/2026-07-12-fire-app-user-data-model-design.md)
- **日期 / 版本 / 状态**：2026-07-12 / v1.0 / 待审核
- **范围**：用户数据模型（7 张核心表），不含 UI 设计、API 设计、计算引擎实现
- **关键贡献**：
  - 定义 4 层领域架构（用户层 / 财务追踪层 / 快照层 / FIRE 投影层）
  - 采用 UUID v4 主键，支持离线创建与同步无冲突
  - 统一同步元数据字段（updated_at / sync_version / deleted_flag），支持记录级 LWW 冲突解决
  - 金额用 INTEGER 存储"分"、利率用 INTEGER 存储基点，规避浮点误差
  - 定义 18 个种子分类（11 支出 + 7 收入），其中 5 个关联 FIRE 概念
- **与代码的对应关系**：
  - [schema.ts](file:///workspace/packages/shared/src/db/schema.ts) 实现 7 张表 DDL + 9 个索引
  - [types/index.ts](file:///workspace/packages/shared/src/types/index.ts) 实现 5 个枚举别名 + 7 个实体接口
  - [models/](file:///workspace/packages/shared/src/models/) 7 个文件对应 7 张表的 CRUD
- **已知问题**：第 925 行（决策记录 #17）AccountType 枚举数写"10 种"，正确为 11 种（详见 4.2）

### 2.2 前端架构设计

- **路径**：[specs/2026-07-15-fire-app-frontend-architecture-design.md](file:///workspace/docs/superpowers/specs/2026-07-15-fire-app-frontend-architecture-design.md)
- **日期 / 版本 / 状态**：2026-07-15 / v1.0 / 待审核
- **范围**：Electron + React 桌面 MVP 的前端架构设计
- **关键贡献**：
  - 定义进程隔离模型：DB 操作仅在主进程，渲染进程通过 IPC 桥间接调用
  - 设计 `DataAccessPort` 抽象接口，桌面走 IPC、移动端走 react-native-quick-sqlite
  - 抽取纯逻辑代码到 `packages/shared`，为 React Native 移动端扩展预留
  - 定义 IPC 通道清单（如 `db:init`、`db:user:getFirst`、`db:category:seed`）
  - 选定技术栈：Electron 31 + React 19 + Tailwind CSS 4 + Zustand 5
- **与代码的对应关系**：✅ 已实现（`apps/desktop/`：main 主进程 + preload + renderer，数据层位于 `packages/shared`）
- **已知问题**：无

### 2.3 UI/UX 设计

- **路径**：[specs/2026-07-15-fire-app-ui-ux-design.md](file:///workspace/docs/superpowers/specs/2026-07-15-fire-app-ui-ux-design.md)
- **日期 / 版本 / 状态**：2026-07-15 / v1.0 / 待审核
- **范围**：桌面应用界面设计、交互流程、组件规范
- **关键贡献**：
  - 定义三大设计理念（专业感 / 数据驱动 / 简洁克制）与目标用户画像
  - 建立色彩体系（主色专业蓝、辅色翠绿），对齐 Tailwind CSS v4 默认色板并通过 WCAG 2.1 AA 校验
  - 规划 6 个核心页面路由（账户管理 / 交易记录 / 净资产趋势 / FIRE 计算器等）
  - 定义"概览 → 明细 → 操作"三段式信息架构
  - 规定负债负数符号约定与净资产公式（与数据模型文档一致）
- **与代码的对应关系**：✅ 已实现（`apps/desktop/src/renderer/`：6 个核心页面 + 组件库 + Zustand store）
- **已知问题**：无

### 2.4 应用初始化设计

- **路径**：[specs/2026-07-15-fire-app-initialization-design.md](file:///workspace/docs/superpowers/specs/2026-07-15-fire-app-initialization-design.md)
- **日期 / 版本 / 状态**：2026-07-15 / v1.0 / 待审核
- **范围**：应用启动流程、数据库初始化、用户引导、迁移机制
- **关键贡献**：
  - 定义完整初始化序列：Electron ready → 创建数据目录 → 打开 DB → 初始化 schema → 判断首次启动
  - 首次启动判断基于数据（查询 users 表）而非文件存在性
  - 设计首次启动向导：用户档案创建 + seedCategories 调用
  - 定义基于 `PRAGMA user_version` 的 schema 版本管理与迁移事务化
  - 规划后续启动的补生成任务（经常性交易 + 月度快照）
- **与代码的对应关系**：
  - [connection.ts](file:///workspace/packages/shared/src/db/connection.ts) 的 `createDatabase` / `closeDatabase`
  - [schema.ts](file:///workspace/packages/shared/src/db/schema.ts) 的 `initSchema`
  - [category.ts](file:///workspace/packages/shared/src/models/category.ts) 的 `seedCategories`
  - [recurring-service.ts](file:///workspace/packages/shared/src/services/recurring-service.ts) 的 `processRecurringTransactions`
  - [snapshot-service.ts](file:///workspace/packages/shared/src/services/snapshot-service.ts) 的 `generateMonthlySnapshot`
- **已知问题**：无

### 2.5 缺失设计文档规划

- **路径**：[specs/2026-07-15-fire-app-missing-design-documents-plan.md](file:///workspace/docs/superpowers/specs/2026-07-15-fire-app-missing-design-documents-plan.md)
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

- **路径**：[specs/2026-07-15-fire-app-design-documents-review.md](file:///workspace/docs/superpowers/specs/2026-07-15-fire-app-design-documents-review.md)
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

### 2.7 数据导出/导入设计（初版）

- **路径**：[specs/2026-07-15-fire-app-data-export-import-design.md](file:///workspace/docs/superpowers/specs/2026-07-15-fire-app-data-export-import-design.md)
- **日期 / 版本 / 状态**：2026-07-15 / v1.0 / 待审核
- **范围 + 关键贡献**：定义 7 张表的 JSON 全量导出（含软删除记录）+ CSV 单表导出 + JSON 跨设备 LWW 合并导入；预留加密接口（当前明文），导出表清单与 schema.ts `TABLE_NAMES` 对齐。后被 M8（§2.29）实施落地。

### 2.8 同步层详细设计

- **路径**：[specs/2026-07-15-fire-app-sync-layer-design.md](file:///workspace/docs/superpowers/specs/2026-07-15-fire-app-sync-layer-design.md)
- **日期 / 版本 / 状态**：2026-07-15 / v1.0 / 待审核
- **范围 + 关键贡献**：定义 `SyncPort` 抽象接口、增量同步协议（仅同步 `updated_at > last_sync_at`）、LWW + sync_version 三级冲突解决、离线队列与指数退避重试；仅定义接口与协议，不含服务器端实现，跨平台复用（桌面/移动）。

### 2.9 安全设计

- **路径**：[specs/2026-07-15-fire-app-security-design.md](file:///workspace/docs/superpowers/specs/2026-07-15-fire-app-security-design.md)
- **日期 / 版本 / 状态**：2026-07-15 / v1.0 / 待审核
- **范围 + 关键贡献**：覆盖同步数据与导出文件加密（不含本地 SQLite 加密）；Argon2id 派生密钥、AES-256-GCM 每次新 IV、零知识架构、密码不落盘；与 better-sqlite3 现有架构兼容，加密由用户主动开启。

### 2.10 Code Wiki 设计文档

- **路径**：[specs/2026-07-15-fire-app-code-wiki-design.md](file:///workspace/docs/superpowers/specs/2026-07-15-fire-app-code-wiki-design.md)
- **日期 / 版本 / 状态**：2026-07-15 / v1.0 / 待 spec review
- **范围 + 关键贡献**：规划为仓库生成结构化 Code Wiki（代码结构镜像 + 导航层）；覆盖所有 `.ts` 文件，2 次点击内可达任意源文件，源码引用用 `file:///` 可点击链接，跨切关注点（金额=分 / 利率=基点 / LWW / 软删除）集中说明。

### 2.11 已知问题与潜在风险分析

- **路径**：[specs/2026-07-15-fire-app-known-issues-analysis.md](file:///workspace/docs/superpowers/specs/2026-07-15-fire-app-known-issues-analysis.md)
- **日期 / 状态**：2026-07-15 / 已完成（分析报告）
- **范围 + 关键贡献**：Task 8 验证中发现 6 个环境/配置问题（pnpm 未装 / onlyBuiltDependencies 弃用 / minimumReleaseAge 拦截 / Electron 下载 / better-sqlite3 ABI 不匹配 / preload sandbox）的根因与修复；分析 2 项潜在风险（createDatabase 默认相对路径误用）并给出预防方案。

### 2.12 Task 8 端到端验证操作步骤设计

- **路径**：[specs/2026-07-15-fire-app-task8-verification-design.md](file:///workspace/docs/superpowers/specs/2026-07-15-fire-app-task8-verification-design.md)
- **日期 / 状态**：2026-07-15 / 已完成
- **范围 + 关键贡献**：为 M1 Task 8 提供可操作验证步骤（8 阶段：前置准备 → 启动开发 → 首次/后续启动 → DB 文件 → 种子分类 → 日志 → 提交）；每步含命令、预期结果、通过标准、故障排查。

### 2.13 验证后修复与文档更新设计

- **路径**：[specs/2026-07-15-fire-app-post-verification-fixes-design.md](file:///workspace/docs/superpowers/specs/2026-07-15-fire-app-post-verification-fixes-design.md)
- **日期 / 状态**：2026-07-15 / 已完成
- **范围 + 关键贡献**：将 Task 8 验证中 6 个问题的修复固化为项目配置（.npmrc 镜像 / @electron/rebuild postinstall / sandbox: false）；同步设计文档与代码对齐，创建 README，分析潜在类似问题。

### 2.14 环境搭建自动化设计文档

- **路径**：[specs/2026-07-15-env-setup-automation-design.md](file:///workspace/docs/superpowers/specs/2026-07-15-env-setup-automation-design.md)
- **日期 / 状态**：2026-07-15 / 已完成
- **范围 + 关键贡献**：M3 验证暴露 9 类环境问题（OneDrive 同步 / Node 版本 / SSL 证书 / Electron 下载 / ABI 不匹配 / 文件锁定等）；将搭建降为 "clone → pnpm setup → dev" 三步，配置文件 + check-env.mjs + setup.mjs + preinstall 钩子。

### 2.15 里程碑 2：核心基础设施设计

- **路径**：[specs/2026-07-15-fire-app-milestone2-design.md](file:///workspace/docs/superpowers/specs/2026-07-15-fire-app-milestone2-design.md)
- **日期 / 版本 / 状态**：2026-07-15 / v1.0 / 待审核
- **范围 + 关键贡献**：在 M1 架构骨架上交付核心基础设施——36 个 IPC 通道全量实现、5 个 Zustand Store（app/account/transaction/snapshot/scenario）、createHashRouter + RequireInit 守卫、14 个基础组件（3 布局 + 9 基础 + 2 辅助）、5 步 Onboarding 向导。

### 2.16 里程碑 3：账户管理页设计

- **路径**：[specs/2026-07-15-fire-app-milestone3-design.md](file:///workspace/docs/superpowers/specs/2026-07-15-fire-app-milestone3-design.md)
- **日期 / 版本 / 状态**：2026-07-15 / v1.0 / 待审核
- **范围 + 关键贡献**：实现账户 CRUD + 5 张资产概览卡片（流动/投资/使用/负债/净资产，前端从 accounts 数组实时计算）；新增 `db:account:update` IPC 通道（第 37 个）；复用 M2 全部基础组件，不新建基础组件。

### 2.17 里程碑 3 验证计划

- **路径**：[specs/2026-07-15-fire-app-milestone3-verification.md](file:///workspace/docs/superpowers/specs/2026-07-15-fire-app-milestone3-verification.md)
- **日期 / 状态**：2026-07-15 / 已批准，待执行
- **范围 + 关键贡献**：对 M3 全部 10 个产出文件做静态代码审查 + 纯函数 TDD 单测补强；覆盖运行时状态管理（error/loading 残留）与数据精度/UX 风险等自动化验证盲区。

### 2.18 M4 交易管理设计文档

- **路径**：[specs/2026-07-16-fire-app-milestone4-transaction-management-design.md](file:///workspace/docs/superpowers/specs/2026-07-16-fire-app-milestone4-transaction-management-design.md)
- **日期 / 状态**：2026-07-16 / 设计已批准
- **范围 + 关键贡献**：交易完整 CRUD（软删除 + 余额反向冲销）+ 4 种类型（income/expense/transfer/initial_balance）+ 多维度筛选 + 汇总概览；新增 useCategoryStore 自动 seed 兜底；从零搭建 renderer 测试基础设施（vitest + jsdom + @testing-library/react）。

### 2.19 里程碑 4 验证计划

- **路径**：[specs/2026-07-16-fire-app-milestone4-verification.md](file:///workspace/docs/superpowers/specs/2026-07-16-fire-app-milestone4-verification.md)
- **日期 / 状态**：2026-07-16 / 待执行
- **范围 + 关键贡献**：5 项手动 GUI 交互验证（启动加载 / 真实新增交易 / 编辑删除 / 视觉检查 / 筛选排序）；覆盖真实 sqlite + IPC 集成、余额联动、视觉流畅性等自动化测试盲区。

### 2.20 Docker 开发环境设计文档

- **路径**：[specs/2026-07-16-docker-dev-environment-design.md](file:///workspace/docs/superpowers/specs/2026-07-16-docker-dev-environment-design.md)
- **日期 / 状态**：2026-07-16 / 设计已批准（后被 CI 方案撤销）
- **范围 + 关键贡献**：开发环境 Docker 化——容器内 Electron + better-sqlite3（针对 Electron ABI 预编译）+ Xvfb 虚拟显示 + noVNC web 访问（localhost:6080）；源码挂载热重载，数据持久化。注：公司电脑无法装 Docker Desktop，此方案被 §2.21 CI 方案替代。

### 2.21 CI 打包与发布方案设计

- **路径**：[specs/2026-07-16-ci-build-release-design.md](file:///workspace/docs/superpowers/specs/2026-07-16-ci-build-release-design.md)
- **日期 / 状态**：2026-07-16 / 设计已批准
- **范围 + 关键贡献**：GitHub Actions CI 在 windows-latest 自动 install → test → build → electron-builder 打包，产出 `.exe` 安装包上传 Artifacts/Releases；测试作为打包前置门禁；撤销 Docker 方案。

### 2.22 仪表盘升级设计文档

- **路径**：[specs/2026-07-28-fire-app-dashboard-upgrade-design.md](file:///workspace/docs/superpowers/specs/2026-07-28-fire-app-dashboard-upgrade-design.md)
- **日期 / 状态**：2026-07-28 / 待实施
- **范围 + 关键贡献**：将占位 DashboardPage 升级为信息聚合中心——净资产 3 卡 + 本月收支 3 卡 + 净资产趋势图 + 近期交易表；纯前端工作，无新增 IPC handler，复用现有 DataAccessPort 聚合 + renderer 派生；新增 Recharts 依赖。

### 2.23 仪表盘升级验证计划

- **路径**：[specs/2026-07-28-fire-app-dashboard-upgrade-verification.md](file:///workspace/docs/superpowers/specs/2026-07-28-fire-app-dashboard-upgrade-verification.md)
- **日期 / 状态**：2026-07-28 / 已完成
- **范围 + 关键贡献**：5 项手动 GUI 验证（启动+onboarding+空状态 / 净资产卡 / 收支卡+近期交易 / 趋势图+视觉 / M4 回归）；确认打包版 git reset + 路径迁移无文件缺失。

### 2.24 M5 净资产趋势页设计文档

- **路径**：[specs/2026-07-28-fire-app-milestone5-net-worth-trend-design.md](file:///workspace/docs/superpowers/specs/2026-07-28-fire-app-milestone5-net-worth-trend-design.md)
- **日期 / 状态**：2026-07-28 / 设计已批准
- **范围 + 关键贡献**：替换占位 NetWorthPage——趋势折线图（4 指标×4 时间范围：净资产/流动/投资/负债 × 近3月/6月/1年/全部）+ 资产配比环形图 + 配比明细列表；复用 Recharts 2.x（LineChart + PieChart），数据层 snapshot 已就位。

### 2.25 M6 FIRE 计算器设计

- **路径**：[specs/2026-07-28-fire-app-milestone6-fire-calculator-design.md](file:///workspace/docs/superpowers/specs/2026-07-28-fire-app-milestone6-fire-calculator-design.md)
- **日期 / 版本 / 状态**：2026-07-28 / v1.0 / 待审核
- **范围 + 关键贡献**：升级占位 FireCalculatorPage——多场景管理（侧边栏列表）+ 14 字段参数表单（debounce 500ms 自动保存）+ 实时投影重算（复用 runProjection）+ 4 结果卡 + 环形进度仪表盘 + 面积图投影 + 首次进入介绍页。

### 2.26 M6 加固收尾设计

- **路径**：[specs/2026-07-29-m6-hardening-design.md](file:///workspace/docs/superpowers/specs/2026-07-29-m6-hardening-design.md)
- **日期 / 版本 / 状态**：2026-07-29 / v1.0 / 已批准
- **范围 + 关键贡献**：M6 功能实现后的加固收尾 4 项——修复 createDatabase 默认相对路径风险（改为必填参数）、扩展 vitest 集成测试填补 E2E 缺口、全量同步 Wiki 文档对齐 monorepo、优化验证流程建立分类标准与模板。

### 2.27 验证流程优化

- **路径**：[specs/2026-07-29-verification-flow-optimization.md](file:///workspace/docs/superpowers/specs/2026-07-29-verification-flow-optimization.md)
- **日期 / 版本 / 状态**：2026-07-29 / v1.0 / 已批准
- **范围 + 关键贡献**：建立自动/手动验证分类标准——可单测/tsc/静态逻辑/grep 判定的归为自动验证（CI/CLI），真实窗口渲染/视觉布局/主观感受/跨进程交互归为手动验证；供未来里程碑复用，减少手动验证工作量。

### 2.28 M7 设置页设计

- **路径**：[specs/2026-07-29-fire-app-milestone7-settings-page-design.md](file:///workspace/docs/superpowers/specs/2026-07-29-fire-app-milestone7-settings-page-design.md)
- **日期 / 版本 / 状态**：2026-07-29 / v1.0 / 已批准
- **范围 + 关键贡献**：补齐最后一个核心页面——用户偏好编辑（6 字段：display_name / base_currency 只读 / is_china_market / 3 个默认利率）+ 内置分类展示与重置（18 系统分类软删除 + 重新 seed，保留自定义）；中国市场切换联动默认提现率（350↔400）。

### 2.29 M8 数据导入/导出 + 清空交易设计

- **路径**：[specs/2026-07-29-fire-app-milestone8-data-export-import-design.md](file:///workspace/docs/superpowers/specs/2026-07-29-fire-app-milestone8-data-export-import-design.md)
- **日期 / 版本 / 状态**：2026-07-29 / v1.0 / 已批准
- **范围 + 关键贡献**：补齐设置页数据管理区——JSON 全量导出/导入（7 表 LWW 合并）、CSV 单表导出（RFC 4180 + UTF-8 BOM）、CSV 交易导入（支付宝/微信/7 家银行预设模板 + 关键词推断 + 预览编辑 + 哈希去重）、清空所有交易（软删除 + 余额归零事务）。

### 2.30 FIRE-APP M9 加固里程碑设计

- **路径**：[specs/2026-07-29-fire-app-milestone9-hardening-design.md](file:///workspace/docs/superpowers/specs/2026-07-29-fire-app-milestone9-hardening-design.md)
- **日期 / 状态**：2026-07-29 / 已批准，待写实施计划
- **范围 + 关键贡献**：M1–M8 功能完成后对现有代码做四维度加固扫描（性能/数据一致性/UX/安全），共约 122 项 findings（6 Critical / 33 High / 57 Medium / 30 Low）；方案 B 维度切片，每维度迷你 sprint 含"扫描→修复→验证"闭环；可破坏性变更（0.1.0 dev 阶段）。

### 2.31 M9 收尾：死代码清理 + Code Wiki 重同步设计

- **路径**：[specs/2026-07-30-fire-app-post-m9-cleanup-and-wiki-resync-design.md](file:///workspace/docs/superpowers/specs/2026-07-30-fire-app-post-m9-cleanup-and-wiki-resync-design.md)
- **日期 / 状态**：2026-07-30 / 已批准，待写实施计划
- **范围 + 关键贡献**：M9 加固完成后的收尾——Phase 1 清理 shared + desktop 死代码（如 P3 移除 getTransactionsByUser 调用链后遗留的 model 函数及测试）；Phase 2 全量重同步 Code Wiki 到 M9 后状态并新增 2 个 desktop 分节，版本 v1.1→v2.0。本文件即驱动当前 Wiki 重同步任务的源 spec。

### 2.32 Electron 31→36 升级设计

- **路径**：[specs/2026-07-30-fire-app-electron-36-upgrade-design.md](file:///workspace/docs/superpowers/specs/2026-07-30-fire-app-electron-36-upgrade-design.md)
- **日期 / 状态**：2026-07-30 / 已批准，已实现
- **范围 + 关键贡献**：分层渐进升级（方案 B）——Phase 1 宿主 Node 20→22 LTS + check-env.mjs 动态化消除硬编码版本号；Phase 2 Electron 31→36（Chromium 136 / Node 22.14）+ @electron/rebuild 3.7 + @types/node 22，better-sqlite3 保持 11.x 保守升；Phase 3 构建工具联动（electron-vite 2→3 / vite 5→6 / vitest 2→3 / electron-builder 25→26）。main/preload 零改动（Electron 32-36 breaking 审计确认已显式启用 sandbox/contextIsolation）。PR #1 squash 合并到 main。

### 2.33 自动更新（electron-updater + GitHub Releases）设计

- **路径**：[specs/2026-07-30-fire-app-auto-update-design.md](file:///workspace/docs/superpowers/specs/2026-07-30-fire-app-auto-update-design.md)
- **日期 / 状态**：2026-07-30 / 已批准，已实现
- **范围 + 关键贡献**：为打包后的 FIRE App 添加应用内自动更新能力。三层架构——Main 层 `UpdateManager` 封装 electron-updater 6.x 的 autoUpdater（启动延迟 10s 检查 + 24h 定时轮询 + 跳过版本持久化到本地 JSON），通过 `update:*` IPC 通道同步状态给 Renderer 层 `useUpdateStore`（Zustand），驱动 `UpdateDialog`（模态对话框，9 个 phase 状态机）+ `UpdateSection`（设置页更新区）。关键决策：不签名（dev 阶段，用户手动信任 SmartScreen）/ 单渠道 latest / 预发布版本号 `0.0.0-dev.yyyyMMdd.run_number` / NSIS 安装程序退出后启动。CI 每次 push 到 main 通过 electron-builder `--publish always` 自动上传 GitHub Releases。仅 Windows 桌面端。

---

## 3. 实现计划清单（21 份 plan）

### 3.1 数据模型实施计划

- **路径**：[plans/2026-07-13-fire-app-data-model-implementation.md](file:///workspace/docs/superpowers/plans/2026-07-13-fire-app-data-model-implementation.md)
- **日期 / 状态**：2026-07-13 / 已完成
- **范围**：数据模型层代码实现（7 张表 schema + CRUD + 服务层 + 工具层 + 测试）
- **关键任务**：
  - 创建数据库 schema（7 张表 DDL + 9 个索引）
  - 实现 7 个 models（user / account / category / transaction / recurring / scenario / snapshot）
  - 实现 4 个 services（fire-calc / transaction-service / recurring-service / snapshot-service）
  - 实现 3 个 utils（money / sync / time）
  - 编写 13 个测试文件（12 单元 + 1 集成）

### 3.2 桌面 MVP 里程碑 1：架构验证切片

- **路径**：[plans/2026-07-15-fire-app-desktop-mvp-milestone1.md](file:///workspace/docs/superpowers/plans/2026-07-15-fire-app-desktop-mvp-milestone1.md)
- **日期 / 状态**：2026-07-15 / 已完成（monorepo 已建立，桌面端已落地）
- **范围**：搭建 Electron 桌面应用骨架，验证主进程 + IPC 桥 + React 渲染进程的端到端数据通路
- **关键任务**：
  - 建立 pnpm workspace monorepo（`packages/shared` + `apps/desktop`）
  - 将现有 TypeScript 数据层代码零改动迁移到 `packages/shared`
  - 搭建 Electron 主进程（持有 better-sqlite3 + IPC handler）
  - 搭建 React 19 渲染层 + Zustand 状态管理 + DataAccessPort 接口
  - 实现"启动 → 初始化 DB → 读取用户 → 显示用户名"端到端验证

### 3.3 阶段 1 设计文档编写计划

- **路径**：[plans/2026-07-15-fire-app-stage1-design-documents.md](file:///workspace/docs/superpowers/plans/2026-07-15-fire-app-stage1-design-documents.md)
- **日期 / 状态**：2026-07-15 / 已完成（已产出 3 份 spec）
- **范围**：编写阶段 1 的三份设计文档（前端架构 + UI/UX + 应用初始化）
- **关键任务**：
  - 编写前端架构设计文档（先行，定义进程模型与 IPC 通道）
  - 编写 UI/UX 设计文档（跟进，定义页面与交互）
  - 编写应用初始化设计文档（跟进，定义启动序列）
  - 每份文档经历"研究分析 → 撰写草稿 → 自审检查 → 用户审核 → 提交"流程
  - 确保设计与已实现的数据模型层无缝衔接

### 3.4 Code Wiki 实施计划

- **路径**：[plans/2026-07-15-fire-app-code-wiki-implementation.md](file:///workspace/docs/superpowers/plans/2026-07-15-fire-app-code-wiki-implementation.md)
- **日期 / 状态**：2026-07-15 / 已完成（Wiki v1.0）
- **范围 + 关键贡献**：按依赖顺序逐份编写 9 份 Wiki 文档（1 主页 + 8 子文件）——基础设施 → 类型模型 → 业务服务 → 测试文档索引 → 总览主页；统一文件头 / 源码链接 / Mermaid 图规范。

### 3.5 Task 8 端到端验证执行计划

- **路径**：[plans/2026-07-15-fire-app-task8-verification-execution.md](file:///workspace/docs/superpowers/plans/2026-07-15-fire-app-task8-verification-execution.md)
- **日期 / 状态**：2026-07-15 / 已完成
- **范围 + 关键贡献**：Windows 环境执行 M1 Task 8 端到端验证，8 阶段顺序执行（前置准备 → 启动 → 首次/后续启动 → DB 文件 → 种子分类 → 日志 → 提交）；验证 Electron 从启动到数据持久化的完整数据通路。

### 3.6 验证后修复与文档更新实施计划

- **路径**：[plans/2026-07-15-fire-app-post-verification-fixes.md](file:///workspace/docs/superpowers/plans/2026-07-15-fire-app-post-verification-fixes.md)
- **日期 / 状态**：2026-07-15 / 已完成
- **范围 + 关键贡献**：将 6 个问题修复固化为项目配置——4 个独立提交（配置修复 / 文档对齐 / README / 验证文档更新）；新建 .npmrc + @electron/rebuild 脚本 + postinstall，同步设计文档 sandbox 与 preload 路径。

### 3.7 环境搭建自动化实施计划

- **路径**：[plans/2026-07-15-env-setup-automation-implementation.md](file:///workspace/docs/superpowers/plans/2026-07-15-env-setup-automation-implementation.md)
- **日期 / 状态**：2026-07-15 / 已完成
- **范围 + 关键贡献**：配置文件层（.nvmrc + .npmrc 增强 + engines）+ check-env.mjs 检测脚本 + setup.mjs 一键安装 + preinstall 钩子自动检测；Node.js ESM 跨 shell 兼容（cmd/PowerShell/bash）。

### 3.8 里程碑 2：核心基础设施实施计划

- **路径**：[plans/2026-07-15-fire-app-milestone2-implementation.md](file:///workspace/docs/superpowers/plans/2026-07-15-fire-app-milestone2-implementation.md)
- **日期 / 状态**：2026-07-15 / 已完成
- **范围 + 关键贡献**：交付 36 个 IPC 通道（按实体拆分 handler 文件 + registerHandler 错误包装）+ 5 个 Zustand Store + createHashRouter + 14 组件库 + Onboarding 向导；tech stack Electron 31 + electron-vite 2 + React 19 + Tailwind 4。

### 3.9 里程碑 3：账户管理页实施计划

- **路径**：[plans/2026-07-15-fire-app-milestone3-implementation.md](file:///workspace/docs/superpowers/plans/2026-07-15-fire-app-milestone3-implementation.md)
- **日期 / 状态**：2026-07-15 / 已完成
- **范围 + 关键贡献**：TDD 新增 updateAccount model + EditAccountInput，沿 IPC 链贯通编辑能力；前端按 components/accounts/ 功能域拆分 4 个新文件（account-constants + AccountOverviewCards + AccountListTable + AccountFormModal），复用 M2 基础组件。

### 3.10 M4 交易管理实施计划

- **路径**：[plans/2026-07-16-fire-app-milestone4-transaction-management.md](file:///workspace/docs/superpowers/plans/2026-07-16-fire-app-milestone4-transaction-management.md)
- **日期 / 状态**：2026-07-16 / 已完成
- **范围 + 关键贡献**：复刻 M3 accounts 4 件套模式 + 独立筛选组件（useState + useMemo 派生）；新增 useCategoryStore 自动 seed 兜底；从零搭建 renderer 测试基础设施（vitest + jsdom + @testing-library/react 16 + jest-dom 6）。

### 3.11 CI 打包与发布实施计划

- **路径**：[plans/2026-07-16-ci-build-release.md](file:///workspace/docs/superpowers/plans/2026-07-16-ci-build-release.md)
- **日期 / 状态**：2026-07-16 / 已完成
- **范围 + 关键贡献**：纯加法新增 electron-builder 25 配置 + GitHub Actions workflow（windows-latest: install → test → build → 打包）；删除 Docker 相关文件；产出 `.exe` 上传 Artifacts/Releases，下载双击运行无需本地环境。

### 3.12 仪表盘升级实施计划

- **路径**：[plans/2026-07-28-fire-app-dashboard-upgrade.md](file:///workspace/docs/superpowers/plans/2026-07-28-fire-app-dashboard-upgrade.md)
- **日期 / 状态**：2026-07-28 / 已完成
- **范围 + 关键贡献**：DashboardPage 容器并行拉取 accounts/transactions/snapshots + useMemo 派生；4 个纯展示子组件（NetWorthCards + MonthlyOverviewCards + NetWorthTrendChart + RecentTransactions）+ dashboard-constants 纯函数；新增 Recharts 2.x。

### 3.13 Dashboard 升级验证实施计划

- **路径**：[plans/2026-07-28-fire-app-dashboard-upgrade-verification.md](file:///workspace/docs/superpowers/plans/2026-07-28-fire-app-dashboard-upgrade-verification.md)
- **日期 / 状态**：2026-07-28 / 已完成
- **范围 + 关键贡献**：对 dashboard 升级 + M4 回归做打包 exe 真实环境验证；5 个验证项 H-1~H-5 顺序执行，选项式对话逐项收集结果，发现 bug 实时修复；产出验证结果汇总表。

### 3.14 M5 净资产趋势页实施计划

- **路径**：[plans/2026-07-28-fire-app-milestone5-net-worth-trend.md](file:///workspace/docs/superpowers/plans/2026-07-28-fire-app-milestone5-net-worth-trend.md)
- **日期 / 状态**：2026-07-28 / 已完成
- **范围 + 关键贡献**：复刻 M4 模式——容器 NetWorthPage + 3 子组件（TrendChart + AllocationDonut + AllocationDetail）+ net-worth-constants 纯函数模块 + snapshot-store；TDD 流程，纯函数先行。

### 3.15 M6 FIRE 计算器实施计划

- **路径**：[plans/2026-07-28-fire-app-milestone6-fire-calculator.md](file:///workspace/docs/superpowers/plans/2026-07-28-fire-app-milestone6-fire-calculator.md)
- **日期 / 状态**：2026-07-28 / 已完成
- **范围 + 关键贡献**：扩展 scenario-store（currentScenarioId + projectionResult + runProjection）+ debounce 500ms 持久化 + 立即乐观重算；数据层已就位，只动 UI 层；spec §8.4 的 Playwright E2E 降级为集成测试覆盖。

### 3.16 M7 设置页实施计划

- **路径**：[plans/2026-07-29-m7-settings-page.md](file:///workspace/docs/superpowers/plans/2026-07-29-m7-settings-page.md)
- **日期 / 状态**：2026-07-29 / 已完成
- **范围 + 关键贡献**：数据层新增 resetSystemCategories service（事务：软删除系统分类 + 重新 seed）；SettingsPage 受控表单 + 分类列表，保存同步全局 currentUser；补 /settings 路由 + 导航项。

### 3.17 M8 数据导入/导出 + 清空交易实施计划

- **路径**：[plans/2026-07-29-fire-app-milestone8-data-export-import.md](file:///workspace/docs/superpowers/plans/2026-07-29-fire-app-milestone8-data-export-import.md)
- **日期 / 状态**：2026-07-29 / 已完成
- **范围 + 关键贡献**：Service 层纯逻辑（export/import/clear）+ 主进程文件 I/O + GBK 解码（iconv-lite 新增）；7 套 CSV 模板（alipay/wechat-pay/cmb/icbc/ccb/boc/rcu）+ placeholder-resolver + keyword-rules；渲染层 5 步向导 useState 管理。

### 3.18 M9 加固里程碑实施计划

- **路径**：[plans/2026-07-29-fire-app-milestone9-hardening.md](file:///workspace/docs/superpowers/plans/2026-07-29-fire-app-milestone9-hardening.md)
- **日期 / 状态**：2026-07-29 / 已完成（21 commits 已推送，CI 全绿）
- **范围 + 关键贡献**：按共享文件依赖锁定 Sprint 顺序 S→D→P→U——S 安全（列白名单 + 路径校验 + IPC zod 校验 + 导出脱敏）、D 数据一致性（clear 同步 + recurring 原子幂等 + CHECK 约束）、P 性能（partial index + 服务端分页 + 虚拟化 + 路由懒加载）、U UX（Error Boundary + try/catch + 响应式）；新增 zod + @tanstack/react-virtual；修复 6 Critical + 33 High（Electron 31→36 升级单列后续）。

### 3.19 M9 收尾：死代码清理 + Wiki 重同步实施计划

- **路径**：[plans/2026-07-30-fire-app-post-m9-cleanup-and-wiki-resync.md](file:///workspace/docs/superpowers/plans/2026-07-30-fire-app-post-m9-cleanup-and-wiki-resync.md)
- **日期 / 状态**：2026-07-30 / 进行中
- **范围 + 关键贡献**：方案 A 先清理后重同步——Phase 1 Grep 逐符号扫描未使用导出，保守保留不确定项；Phase 2 按分节逐文件核对代码差距，8 个旧分节更新 + 2 个新分节（09-desktop-main / 10-renderer），Glob 枚举防漏；本计划驱动当前 Wiki v2.0 重同步任务。

### 3.20 Electron 31→36 升级实施计划

- **路径**：[plans/2026-07-30-fire-app-electron-36-upgrade.md](file:///workspace/docs/superpowers/plans/2026-07-30-fire-app-electron-36-upgrade.md)
- **日期 / 状态**：2026-07-30 / 已实现
- **范围 + 关键贡献**：10 个 Task 分 3 Phase——P1（Task 1-3）宿主 Node 22 + check-env.mjs 动态化 + CI；P2（Task 4-6）Electron 36 + better-sqlite3 + @electron/rebuild + breaking 审计；P3（Task 7-9）vite+electron-vite / vitest+jsdom / electron-builder；Task 10 完整 E2E + PR。Subagent-Driven 执行，3 次 CI 全绿（P1 2m59s / P2 3m33s / P3 3m28s），PR #1 squash 合并。

### 3.21 自动更新实施计划

- **路径**：[plans/2026-07-30-fire-app-auto-update.md](file:///workspace/docs/superpowers/plans/2026-07-30-fire-app-auto-update.md)
- **日期 / 状态**：2026-07-30 / 已实现
- **范围 + 关键贡献**：10 个 Task 串联落地自动更新——Task 1 加 electron-updater 依赖 + electron-builder publish 配置；Task 2-3 主进程 `UpdateManager`（封装 autoUpdater + 启动延迟检查 + 24h 轮询 + 跳过版本持久化）+ `update-handlers.ts`（5 个 IPC handler）；Task 4 preload 暴露 `update` API + `UpdateApi` 类型；Task 5 `useUpdateStore`（Zustand，订阅 main 状态变更）；Task 6-7 `UpdateDialog`（9 phase 状态机模态框）+ `UpdateSection`（设置页更新区）；Task 8 集成到 App.tsx + SettingsPage；Task 9 CI 自动生成预发布版本号 + `--publish always`；Task 10 测试套件（update-store 10 用例 + update-dialog 9 用例 + update-section 用例）。Subagent-Driven 执行，PR #2 待合并。

---

## 4. 已知问题清单（历史记录）

以下问题曾在 [设计文档审查报告](file:///workspace/docs/superpowers/specs/2026-07-15-fire-app-design-documents-review.md) 第 2 节"确认的错误"中记录。**经 Wiki 编写时（2026-07-15）复核，两处错误均已在源文档中修正**，本节仅作历史记录保留。

### 4.1 种子分类数量错误（已修正）

| 维度 | 内容 |
|------|------|
| **位置** | `2026-07-15-fire-app-missing-design-documents-plan.md` 第 155 行 |
| **历史错误** | 曾写"17 个内置分类" |
| **正确值** | **18 个**（11 支出 + 7 收入） |
| **当前状态** | ✅ 已修正 — 源文档第 155 行现显示"18 个内置分类" |
| **代码权威** | [category.ts](file:///workspace/packages/shared/src/models/category.ts) `SEED_CATEGORIES` 数组有 18 条记录 |

### 4.2 AccountType 枚举数量错误（已修正）

| 维度 | 内容 |
|------|------|
| **位置** | `2026-07-12-fire-app-user-data-model-design.md` 第 925 行（决策记录 #17） |
| **历史错误** | 曾写"10 种完整枚举" |
| **正确值** | **11 种**（checking / savings / cash / investment / retirement / fund / real_estate / vehicle / credit_card / loan / mortgage） |
| **当前状态** | ✅ 已修正 — 源文档第 925 行现显示"11 种完整枚举" |
| **代码权威** | [types/index.ts](file:///workspace/packages/shared/src/types/index.ts) `AccountType` 类型有 11 个值 |

### 4.3 修正原则

**Wiki 全文以代码为权威**：

- 以代码 [category.ts](file:///workspace/packages/shared/src/models/category.ts) 的 `SEED_CATEGORIES` 数组（**18 条**）为权威 — Wiki 描述为 18 个种子分类
- 以代码 [types/index.ts](file:///workspace/packages/shared/src/types/index.ts) 的 `AccountType` 类型（**11 个值**）为权威 — Wiki 描述为 11 种账户类型
- 设计文档现已与代码一致，无需逐处修改
- 未来若发现新的文档-代码差异，应在本节追加条目

---

## 5. 尚未实现的规划

前端代码已随桌面 MVP 全量落地（M1–M8，详见 §2/§3 各里程碑条目），Wiki 02-06 文件描述数据层、前端代码位于 `apps/desktop`。本节仅标注尚未实现的一项：加密同步层。

### 5.1 加密同步层（仍规划中）

| 规划内容 | 设计文档 | 状态 |
|----------|----------|------|
| 加密密钥管理 | 安全设计（users.encryption_key_hash 字段） | 未实现 |
| LWW 同步引擎 | 同步层详细设计（sync_version + shouldRemoteWin） | 未实现（[sync.ts](file:///workspace/packages/shared/src/utils/sync.ts) 仅提供冲突判断原语，无完整引擎） |
| 跨设备同步 | 缺失设计文档规划（阶段 3） | 未实现 |
| 数据导出/备份 | 数据导出/导入设计 + M8 设计 | ✅ 已实现（M8 里程碑落地：JSON 全量导出/导入 + CSV 单表导出 + CSV 交易导入） |

### 5.2 Electron 31→36 升级（已实现）

| 规划内容 | 设计文档 | 状态 |
|----------|----------|------|
| Electron 主框架升级 31→36 | [Electron 36 升级设计](file:///workspace/docs/superpowers/specs/2026-07-30-fire-app-electron-36-upgrade-design.md)（§2.32）+ [实施计划](file:///workspace/docs/superpowers/plans/2026-07-30-fire-app-electron-36-upgrade.md)（§3.20） | ✅ 已实现（PR #1 squash 合并到 main，2026-07-30。分层渐进升级：Node 22 + Electron 36 + better-sqlite3 11.x rebuild + 全套构建工具联动。main/preload 零改动，3 次 CI 全绿） |

### 5.3 自动更新（已实现）

| 规划内容 | 设计文档 | 状态 |
|----------|----------|------|
| 应用内自动检查 + 下载 + 安装 | [自动更新设计](file:///workspace/docs/superpowers/specs/2026-07-30-fire-app-auto-update-design.md)（§2.33）+ [实施计划](file:///workspace/docs/superpowers/plans/2026-07-30-fire-app-auto-update.md)（§3.21） | ✅ 已实现（PR #2 待合并，2026-07-30。三层架构：Main `UpdateManager` 封装 electron-updater 6.x + Renderer `useUpdateStore` + `UpdateDialog`/`UpdateSection`。启动延迟 10s 检查 + 24h 轮询 + 跳过版本持久化。CI 自动生成 `0.0.0-dev.yyyyMMdd.run_number` 预发布版本号并上传 GitHub Releases。仅 Windows，不签名 dev 阶段） |

---

> **导航**：[← 返回主页](CODE_WIKI.md) | [上一节](07-tests.md) | [下一节]（无）
