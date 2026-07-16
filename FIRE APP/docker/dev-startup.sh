#!/bin/bash
# FIRE App 容器启动脚本 / Container startup script
# 启动 Xvfb + fluxbox + VNC + noVNC + electron-vite dev
# Starts Xvfb + fluxbox + VNC + noVNC + electron-vite dev

set -e

echo "=== FIRE App 开发环境启动 / Dev environment starting ==="

# 启动 Xvfb 虚拟显示 / Start Xvfb virtual display
echo "[1/5] 启动 Xvfb 虚拟显示 :99..."
Xvfb :99 -screen 0 1280x800x24 &
sleep 1

# 启动窗口管理器 / Start window manager
echo "[2/5] 启动 fluxbox 窗口管理器..."
fluxbox &

# 启动 VNC server / Start VNC server
echo "[3/5] 启动 x11vnc server (端口 5901)..."
x11vnc -display :99 -forever -nopw -rfbport 5901 -bg -o /tmp/x11vnc.log

# 启动 noVNC web client / Start noVNC web client
echo "[4/5] 启动 noVNC web client (端口 6080)..."
websockify --web /usr/share/novnc 6080 localhost:5901 -D

# 启动 electron-vite dev / Start electron-vite dev
echo "[5/5] 启动 electron-vite dev..."
echo ""
echo "=== 环境就绪！/ Environment ready! ==="
echo "浏览器访问 / Open in browser: http://localhost:6080"
echo "VNC 直连 / Direct VNC: localhost:5901"
echo "================================="
echo ""

cd /app
pnpm dev
