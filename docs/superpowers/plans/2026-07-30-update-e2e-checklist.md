# 自动更新加速 E2E 验证清单

## 前置条件
- Windows 机器已安装 dev.54（或更早版本，含自研下载器代码）
- 已 push 代码触发 CI 生成 dev.55+（含自研下载器）

## 验证步骤

### 1. 检查更新
- [ ] 启动应用，等待 10 秒
- [ ] UpdateDialog 弹出，显示新版本号
- [ ] 版本号 > 当前版本（dev.55 > dev.54）

### 2. 下载更新
- [ ] 点击"现在下载"
- [ ] 进度条开始走动
- [ ] 下载速度明显快于之前（ghproxy 镜像加速）
- [ ] 下载过程中观察日志（`%APPDATA%\fire-app\fire-app-debug.log`）无 error

### 3. 镜像切换（可选验证）
- [ ] 如 ghproxy 不可用，自动切到 gh-proxy 或 github
- [ ] 进度条不回退（断点续传生效）
- [ ] UI 不弹"切换镜像"提示（透明切换）

### 4. 下载完成
- [ ] 进度条走到 100%
- [ ] 弹窗变为"下载完成，立即安装"

### 5. 安装重启
- [ ] 点击"立即安装"
- [ ] 应用退出
- [ ] 3 秒后应用自动重启
- [ ] 重启后版本号变为 dev.55+

### 6. 数据保留
- [ ] 不需要重新 onboarding
- [ ] 主页数据正常显示
- [ ] 设置页可正常访问

### 7. 不再弹更新
- [ ] 重启后 10 秒内不弹 UpdateDialog
- [ ] 手动检查更新返回 not-available

## 失败排查
- 日志位置：`%APPDATA%\fire-app\fire-app-debug.log`
- 缓存位置：`%APPDATA%\fire-app\update-cache\`
- 如安装失败，手动运行 `update-cache\FIRE-App-Setup-{version}.exe`
