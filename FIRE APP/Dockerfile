# FIRE App 开发环境 Dockerfile / Dev environment Dockerfile
# 包含 Node 20 + pnpm + Electron 依赖 + Xvfb + VNC + noVNC
# Includes Node 20 + pnpm + Electron deps + Xvfb + VNC + noVNC

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

# 工作目录 / Working directory
WORKDIR /app

# 先复制 package 文件利用 Docker 缓存
# Copy package files first to leverage Docker cache
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc .nvmrc ./
COPY apps/desktop/package.json apps/desktop/
COPY packages/shared/package.json packages/shared/

# 安装依赖（含 better-sqlite3 编译）
# Install deps (including better-sqlite3 compilation)
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @fire-app/desktop rebuild

# 启动脚本 / Startup script
COPY docker/dev-startup.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/dev-startup.sh

EXPOSE 6080 5173 5901

CMD ["/usr/local/bin/dev-startup.sh"]
