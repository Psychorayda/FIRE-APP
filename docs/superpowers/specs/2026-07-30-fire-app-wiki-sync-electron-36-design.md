# FIRE-APP Wiki 同步：Electron 36 升级 设计 + 实施计划

> **日期**：2026-07-30
> **状态**：已批准（brainstorming + writing-plans 合并为一步）
> **前置**：PR #1 已 squash 合并到 main（commit ca3a71a），Electron 31→36 升级完成
> **范围约束**：仅 Wiki 文档版本号同步 + 08-design-index 索引更新，无代码改动

---

## 1. 目标

Electron 31→36 升级已合并到 main，Wiki 各分节中存在过期的版本号引用。本任务同步 Wiki 到代码实际状态。

## 2. 改动清单（4 个 Wiki 文件，约 15 处）

### 2.1 [CODE_WIKI.md](file:///workspace/docs/wiki/CODE_WIKI.md)

| 行 | 旧 | 新 |
|---|---|---|
| L73 | `vitest ^2.0.0` | `vitest ^3.0.0` |

### 2.2 [01-overview.md](file:///workspace/docs/wiki/01-overview.md)

| 行 | 旧 | 新 |
|---|---|---|
| L100 | `Node.js \| >=20.0.0 <22.0.0` | `Node.js \| >=22.0.0 <24.0.0` |
| L111 | `@types/node \| ^20.14.0` | `@types/node \| ^22.14.0` |
| L113 | `vitest \| ^2.0.0` | `vitest \| ^3.0.0` |
| L119 | `electron \| ^31.0.0` | `electron \| ^36.0.0` |
| L120 | `electron-vite \| ^2.0.0` | `electron-vite \| ^3.0.0` |
| L121 | `electron-builder \| ^25` | `electron-builder \| ^26` |
| L132 | `vitest \| ^2.0.0` | `vitest \| ^3.0.0` |
| L144 | `测试使用 vitest 2.0` | `测试使用 vitest 3.0` |
| L449 | `electron-vite 2` | `electron-vite 3` |

**不改 L57**（§2.2 前端架构设计"选定技术栈：Electron 31"）——这是 2026-07-15 设计文档的历史决策记录，版本升级在 §5.2 体现。

### 2.3 [07-tests.md](file:///workspace/docs/wiki/07-tests.md)

| 行 | 旧 | 新 |
|---|---|---|
| L11 | `vitest 2.0` | `vitest 3.0` |

### 2.4 [08-design-index.md](file:///workspace/docs/wiki/08-design-index.md)

| 位置 | 改动 |
|---|---|
| L17 | `31 份 spec + 19 份 plan` → `32 份 spec + 20 份 plan` |
| L21 | `31 份设计文档` → `32 份` |
| L22 | `19 份实施计划` → `20 份` |
| L24 | `第 5 节：尚未实现的规划（加密同步层、Electron 31→36 升级）` → `第 5 节：尚未实现的规划（加密同步层）` |
| §2 标题 L28 | `## 2. 设计文档清单（31 份 spec）` → `（32 份 spec）` |
| §2.31 后 | 追加 §2.32 Electron 36 升级设计条目 |
| §3 标题 L274 | `## 3. 实现计划清单（19 份 plan）` → `（20 份 plan）` |
| §3.19 后 | 追加 §3.20 Electron 36 升级实施计划条目 |
| L447 | `本节仅标注尚未实现的两项：加密同步层与 Electron 31→36 升级` → `本节仅标注尚未实现的一项：加密同步层` |
| §5.2 L458-462 | 标题改"已实现"，状态表改 ✅ 已实现 |

## 3. 不在范围

- 不更新设计文档（spec/plan）本身
- 不改动 09-desktop-main.md / 10-renderer.md（无版本号引用）
- 不改动 §2.2 L57 历史决策记录
- 不改动 L400 M9 plan 描述（"Electron 31→36 升级单列后续"是历史记录）

## 4. 验证

```bash
grep -rE "vitest.*2\.0|electron.*31\.0|electron-vite.*2\.0|electron-builder.*\^25|jsdom.*25\.0|>=20\.0\.0 <22" docs/wiki/
```
预期：无残留（除 §2.2 L57 历史记录和 L400 M9 plan 历史描述）。
