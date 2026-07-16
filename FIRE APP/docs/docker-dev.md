# Docker 开发环境 / Docker Dev Environment

> 零本地配置的开发环境方案 — clone 后只需 `docker compose up dev`，浏览器即可访问应用 GUI。

## 前置要求 / Prerequisites

| 要求 | 说明 |
|------|------|
| Docker Desktop | Windows / macOS 安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/)；Linux 安装 Docker Engine + docker-compose-plugin |
| 内存分配 | Docker Desktop 至少分配 **4 GB 内存**（Electron 渲染需要较大共享内存） |
| 端口可用 | 6080（noVNC）、5173（Vite）需未被占用 |

> 无需本地安装 Node.js、pnpm、Visual Studio Build Tools 或 electron-rebuild — 全部在容器内完成。

---

## 快速开始 / Quick Start

```bash
git clone <repo-url> fire-app
cd fire-app
docker compose up dev
```

首次启动会自动构建镜像（约 5-10 分钟，含下载基础镜像 + apt 依赖 + pnpm install + electron-rebuild）。构建完成后，浏览器访问：

```
http://localhost:6080
```

即可看到 Electron 应用 GUI（通过 noVNC 在浏览器中渲染）。

---

## 日常开发 / Daily Workflow

### 启动（后台模式）

```bash
docker compose up -d dev
```

### 查看日志

```bash
docker compose logs -f dev
```

日志包含：Xvfb 启动、fluxbox、x11vnc、noVNC、electron-vite dev server 全部输出。

### 停止

```bash
docker compose down
```

### 重启

```bash
docker compose restart dev
```

---

## 端口说明 / Port Reference

| 端口 | 容器内服务 | 用途 |
|------|-----------|------|
| **6080** | noVNC web client | **主入口** — 浏览器访问 GUI |
| 5173 | Vite dev server | HMR 直连（可选，一般通过 noVNC 即可） |
| 5901 | x11vnc server | 传统 VNC 客户端直连（可选） |

---

## 数据持久化 / Data Persistence

SQLite 数据库存储在 Docker 命名卷 `fire-app-data` 中，映射到容器内 `/home/node/.config`（Electron `userData` 路径）。

- 容器停止/重启后数据**不会丢失**
- `docker compose down` 不会删除卷
- 只有 `docker compose down -v` 才会清除数据（谨慎使用）

查看数据卷：

```bash
docker volume inspect fire-app_fire-app-data
```

---

## 热重载 / Hot Reload

源码通过卷挂载（`.:/app`）实时同步到容器内。修改 React 组件后：

- **Renderer 进程**：electron-vite HMR 自动热更新，浏览器 noVNC 画面实时变化
- **Main / Preload 进程**：需手动重启容器 `docker compose restart dev`

`node_modules` 使用独立命名卷 `fire-app-node-modules` 隔离，避免宿主机 node_modules 覆盖容器内编译的原生模块（`.node` 文件）。

---

## 重建镜像 / Rebuild Image

当 `package.json`、`pnpm-lock.yaml` 或 `Dockerfile` 变更时需要重建：

```bash
# 利用缓存重建
docker compose build dev
docker compose up dev

# 完全无缓存重建（解决诡异问题）
docker compose build --no-cache dev
docker compose up dev
```

---

## 运行测试 / Run Tests

容器内可执行所有 pnpm 脚本：

```bash
# shared 包测试
docker compose run --rm dev pnpm test:shared

# desktop renderer 测试
docker compose run --rm dev pnpm test:desktop

# 环境检查
docker compose run --rm dev node scripts/check-env.mjs
```

> `--rm` 表示执行后自动删除临时容器。

---

## 容器内交互 / Interactive Shell

需要调试容器内环境时，可进入 shell：

```bash
docker compose run --rm dev bash
```

容器内可执行：
```bash
ls node_modules/.pnpm/better-sqlite3*/node_modules/better-sqlite3/build/Release/  # 检查原生模块
node -v        # 确认 Node 版本
pnpm -v        # 确认 pnpm 版本
```

---

## 故障排查 / Troubleshooting

### 1. 浏览器无法访问 6080

**检查容器是否运行：**
```bash
docker compose ps
```

**查看启动日志：**
```bash
docker compose logs dev | head -50
```

确认日志中出现 `环境就绪！` 和 `http://localhost:6080`。

### 2. noVNC 页面空白或 Electron 未渲染

**原因：** Xvfb 或 fluxbox 未正常启动。

**解决：** 重启容器
```bash
docker compose restart dev
```

### 3. Electron 崩溃（shm 相关错误）

**原因：** 共享内存不足。

**解决：** `docker-compose.yml` 已设 `shm_size: '2g'`。若仍崩溃，检查 Docker Desktop 内存分配是否 ≥ 4 GB。

### 4. pnpm install 失败（网络问题）

**原因：** 容器内网络受限。

**解决：** 重建时使用国内镜像（`.npmrc` 已配置 npmmirror）。若 Docker 拉取基础镜像慢，配置 Docker Desktop 镜像加速器。

### 5. 端口被占用

```bash
# 查看占用端口的进程
lsof -i :6080   # macOS/Linux
netstat -ano | findstr :6080   # Windows
```

可在 `docker-compose.yml` 中修改宿主机端口映射，如 `"16080:6080"`。

### 6. 数据卷冲突（重建后数据异常）

```bash
# 停止并删除卷（会丢失所有数据！）
docker compose down -v
docker compose up dev
```

---

## 与本地开发的关系 / Relationship with Local Dev

Docker 方案与现有 `pnpm bootstrap` **并存**，不互相冲突：

| 场景 | 推荐方式 |
|------|---------|
| 首次 clone / 新开发者 | **Docker**（零配置） |
| 日常开发 | **Docker**（环境一致） |
| 本地已有可用环境 | `pnpm dev` 亦可 |
| 需要原生调试 / DevTools | 本地 `pnpm dev`（DevTools 体验更好） |
| CI / 自动化测试 | Docker（环境隔离） |

> Docker 环境下 DevTools 可通过 noVNC 内 Electron 菜单打开，但操作体验不如本地直接启动。

---

## 架构说明 / Architecture

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

详细设计见 [Docker 开发环境设计文档](superpowers/specs/2026-07-16-docker-dev-environment-design.md)。
