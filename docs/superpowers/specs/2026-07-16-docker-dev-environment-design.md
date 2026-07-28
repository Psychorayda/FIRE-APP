# Docker 开发环境设计文档 / Docker Dev Environment Design

> **日期 / Date:** 2026-07-16
> **状态 / Status:** 设计已批准，待写实施计划 / Design approved, pending implementation plan
> **背景 / Context:** 解决 better-sqlite3 原生模块编译 + Electron 二进制下载的环境痛点

---

## 1. 概述 / Overview

将 FIRE App 的开发环境 Docker 化，开发者 clone 后只需 `docker compose up dev`，容器内提供完整的 Electron + better-sqlite3 + Xvfb 虚拟显示 + noVNC web 访问，浏览器打开 `http://localhost:6080` 即可看到应用 GUI。

### 1.1 目标 / Goals

- 零本地环境配置（无需 Node/pnpm/electron-rebuild）
- 容器内 better-sqlite3 针对 Electron ABI 预编译
- 浏览器直接访问 GUI（noVNC）
- 源码挂载热重载
- 数据持久化（sqlite 跨重启保留）

### 1.2 非目标 / Non-Goals

- 不做生产打包（electron-builder 打包另议）
- 不做 CI/CD 流水线
- 不替换现有 `pnpm bootstrap` 方案（并存，Docker 为主）
- 不做多平台镜像（仅 Linux 容器，macOS/Windows 通过 Docker Desktop 运行）

---

## 2. 架构设计 / Architecture

### 2.1 整体架构

```
开发者机器
├── docker compose up dev
│   └── fire-app-dev 容器
│       ├── Node 20.18.0 + pnpm 9
│       ├── Xvfb（虚拟显示 :99，1280x800x24）
│       ├── fluxbox（轻量窗口管理器）
│       ├── x11vnc（VNC server，端口 5901）
│       ├── noVNC（web VNC client，端口 6080）
│       ├── electron-vite dev（端口 5173）
│       ├── better-sqlite3（容器内编译，ABI 匹配）
│       └── 数据卷：/home/node/.config（持久化 sqlite）
└── 浏览器访问 http://localhost:6080 → VNC → 容器内 Electron GUI
```

### 2.2 技术选型

| 组件 | 选择 | 理由 |
|------|------|------|
| 基础镜像 | `node:20.18.0-bookworm` | Debian 12 稳定，含 apt 源，Electron Linux 依赖齐全 |
| 显示服务器 | Xvfb `:99` | Electron CI 标准方案，轻量 |
| 窗口管理 | fluxbox | Electron 需要窗口管理器才能正确渲染 |
| VNC server | x11vnc | 连接 Xvfb 显示到 VNC 协议 |
| GUI 远程访问 | noVNC（web VNC client） | 浏览器直接访问，无需装 VNC 客户端 |
| 数据持久化 | Docker volume `fire-app-data` | 挂载到 `/home/node/.config`（Electron userData 路径） |
| 热重载 | 源码挂载 + electron-vite HMR | 代码变更实时生效 |
| 原生模块 | 容器内 electron-rebuild | 构建时编译，运行时直接用 |

### 2.3 端口映射

| 端口 | 容器内服务 | 用途 |
|------|-----------|------|
| 6080 | noVNC web client | 浏览器访问 GUI（主入口） |
| 5173 | Vite dev server | HMR（可选直连） |
| 5901 | VNC server | 传统 VNC 客户端（可选） |

---

## 3. 文件清单 / File Inventory

### 3.1 新建文件（5 个）

| 文件 | 职责 |
|------|------|
| `Dockerfile` | 构建开发镜像（Node + 系统依赖 + Xvfb + noVNC） |
| `docker-compose.yml` | 编排 dev 服务（端口 + 卷 + 命令） |
| `.dockerignore` | 排除 node_modules、out、release、.git 等 |
| `docker/dev-startup.sh` | 容器启动脚本（Xvfb + fluxbox + VNC + noVNC + dev server） |
| `docs/docker-dev.md` | Docker 开发环境使用文档 |

### 3.2 修改文件（1 个）

| 文件 | 修改内容 |
|------|---------|
| `README.md` | 追加 Docker 开发环境快速开始章节 |

---

## 4. Dockerfile

```dockerfile
FROM node:20.18.0-bookworm

# 系统依赖：Electron Linux 运行所需 + Xvfb + VNC + 窗口管理器
# System deps: Electron Linux runtime + Xvfb + VNC + window manager
RUN apt-get update && apt-get install -y \
    xvfb \
    x11vnc \
    fluxbox \
    novnc \
    websockify \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libgtk-3-0 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# 工作目录
WORKDIR /app

# 先复制 package 文件利用 Docker 缓存
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc .nvmrc ./
COPY apps/desktop/package.json apps/desktop/
COPY packages/shared/package.json packages/shared/

# 安装依赖（含 better-sqlite3 编译）
# Install deps (including better-sqlite3 compilation)
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @fire-app/desktop rebuild

# 启动脚本
COPY docker/dev-startup.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/dev-startup.sh

EXPOSE 6080 5173 5901

CMD ["/usr/local/bin/dev-startup.sh"]
```

---

## 5. docker-compose.yml

```yaml
services:
  dev:
    build: .
    ports:
      - "6080:6080"  # noVNC web client
      - "5173:5173"  # Vite dev server (可选直连)
    volumes:
      - .:/app                    # 源码挂载（热重载）
      - fire-app-data:/home/node/.config  # 数据持久化（sqlite）
      - fire-app-node-modules:/app/node_modules  # 隔离 node_modules
    environment:
      - DISPLAY=:99
      - NODE_ENV=development
    shm_size: '2g'  # Electron 需要较大共享内存

volumes:
  fire-app-data:
  fire-app-node-modules:
```

**关键设计决策：**

| 决策 | 选择 | 理由 |
|------|------|------|
| 源码挂载 | 是（`.:/app`） | 热重载，代码变更实时生效 |
| node_modules 隔离 | 命名卷 `fire-app-node-modules` | 避免宿主机 node_modules 覆盖容器内编译的 .node |
| 数据持久化 | 命名卷 `fire-app-data` | sqlite 数据库跨容器重启保留 |
| shm_size | 2g | Electron 渲染需要较大共享内存，默认 64m 会崩溃 |
| noVNC 密码 | 无（`-nopw`） | 开发环境便利性优先 |

---

## 6. docker/dev-startup.sh

```bash
#!/bin/bash
set -e

# 启动 Xvfb 虚拟显示 / Start Xvfb virtual display
Xvfb :99 -screen 0 1280x800x24 &
sleep 1

# 启动窗口管理器 / Start window manager
fluxbox &

# 启动 VNC server / Start VNC server
x11vnc -display :99 -forever -nopw -rfbport 5901 &

# 启动 noVNC web client / Start noVNC web client
websockify --web /usr/share/novnc 6080 localhost:5901 &

# 启动 electron-vite dev / Start electron-vite dev
cd /app
pnpm dev
```

---

## 7. 使用流程 / Usage

### 7.1 首次启动（新开发者）

```bash
git clone <repo-url> fire-app
cd fire-app
docker compose up dev
```

浏览器访问 `http://localhost:6080`。

### 7.2 日常开发

```bash
# 启动（后台）
docker compose up -d dev

# 查看日志
docker compose logs -f dev

# 停止
docker compose down
```

### 7.3 重建镜像

```bash
docker compose build --no-cache dev
docker compose up dev
```

### 7.4 与现有脚本的关系

| 现有方式 | Docker 方式 | 并存策略 |
|---------|-----------|---------|
| `pnpm bootstrap` | `docker compose up dev` | Docker 为主，保留 pnpm bootstrap 给非 Docker 用户 |
| `pnpm dev` | 容器内自动执行 | Docker 用户无需手动 |
| `pnpm test:shared` | `docker compose run dev pnpm test:shared` | 可选 |
| `pnpm test:desktop` | `docker compose run dev pnpm test:desktop` | 可选 |

---

## 8. 测试策略 / Testing

Docker 开发环境是基础设施，不需要单元测试。验证方式为手动验收：

### 8.1 验收标准

| # | 验收项 | 通过标准 |
|---|--------|---------|
| D-1 | 镜像构建 | `docker compose build` 成功，无错误 |
| D-2 | 容器启动 | `docker compose up dev` 启动，日志显示 Xvfb + VNC + dev server 就绪 |
| D-3 | GUI 访问 | 浏览器 `http://localhost:6080` 显示 Electron 窗口 |
| D-4 | 应用功能 | GUI 内可导航到账户页和交易页，数据正常显示 |
| D-5 | 数据持久化 | 重启容器后 sqlite 数据仍在 |
| D-6 | 热重载 | 修改 React 组件源码后 GUI 实时更新 |

---

## 9. 已知风险 / Known Risks

| 风险 | 影响 | 缓解 |
|------|------|------|
| noVNC 鼠标键盘延迟 | 开发体验略差 | 可选直连 VNC 客户端（端口 5901） |
| shm_size 不足导致 Electron 崩溃 | 渲染崩溃 | 已设 2g，足够 |
| 国内 Docker 镜像源拉取慢 | 构建慢 | Dockerfile 内 pnpm 用 npmmirror |
| Xvfb 分辨率固定 1280x800 | 窗口无法最大化 | 可通过环境变量调整 |
| macOS/Windows Docker Desktop 资源占用 | 机器卡顿 | 文档提示分配足够内存（4g+） |

---

## 附录 A：调研依据 / Research Basis

- better-sqlite3 仅在 `packages/shared/src/db/connection.ts` 一处 import，业务代码统一通过 `createDatabase(path)` 工厂
- Electron API 使用极克制（仅 app/BrowserWindow/ipcMain/contextBridge/ipcRenderer），无 dialog/Tray/Menu 等系统级 GUI 依赖
- 数据库路径基于 `app.getPath('userData')`，Linux 下为 `~/.config/<AppName>`
- `electron-vite dev` 在 Linux 无显示时会失败，需 Xvfb
- 项目无现有 Docker 基础设施，从零搭建
