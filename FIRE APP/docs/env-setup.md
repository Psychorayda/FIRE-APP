# 手动安装与环境问题排查

> 当 `pnpm setup` 失败时的 fallback 文档。记录 M3 验证时的 9 类环境问题与完整解决方案。

## 目录

1. [OneDrive 问题](#onedrive-问题)
2. [Node 版本不匹配（ABI 错误）](#node-版本不匹配abi-错误)
3. [pnpm install 慢](#pnpm-install-慢)
4. [better-sqlite3 编译失败](#better-sqlite3-编译失败)
5. [nvm install 下载失败](#nvm-install-下载失败)
6. [SSL 证书错误](#ssl-证书错误)
7. [electron 下载卡住](#electron-下载卡住)
8. [electron-rebuild EPERM 失败](#electron-rebuild-eperm-失败)
9. [cmd vs PowerShell 语法错误](#cmd-vs-powershell-语法错误)

---

## OneDrive 问题

**症状**：项目在 OneDrive 目录下，`pnpm install` 慢、文件锁定、electron-rebuild 报 EPERM。

**根因**：OneDrive 同步 node_modules 的几万个小文件，导致文件锁定和同步延迟。

**解决方案**：移动项目到非 OneDrive 目录：

```cmd
:: Windows cmd
robocopy "D:\Admin\OneDrive\...\FIRE APP" "D:\Projects\FIRE-APP" /E /MT:8 /R:1 /W:1
cd /d D:\Projects\FIRE-APP
rmdir /s /q node_modules
pnpm install
```

或暂停 OneDrive 同步：任务栏右键 OneDrive → 暂停同步 → 2 小时。

---

## Node 版本不匹配（ABI 错误）

**症状**：启动报错 `NODE_MODULE_VERSION 115 vs 125` 或 `different Node.js version`。

**根因**：better-sqlite3 为系统 Node 编译，但 Electron 31 内置不同的 Node ABI。

**解决方案**：

1. 确认用 Node 20 LTS（项目 `.nvmrc` 已指定）：
```cmd
nvm use 20.18.0
node -v
:: 应显示 v20.18.0
```

2. 为 Electron 重新编译原生模块：
```cmd
pnpm --filter @fire-app/desktop rebuild
```

3. 如果还报错，清理重装：
```cmd
rmdir /s /q node_modules
del pnpm-lock.yaml
pnpm install
pnpm --filter @fire-app/desktop rebuild
```

---

## pnpm install 慢

**症状**：`pnpm install` 卡住 10+ 分钟，或 electron/better-sqlite3 postinstall 不动。

**根因**：electron + better-sqlite3 从 GitHub 下载二进制，国内网络慢。

**解决方案**：项目 `.npmrc` 已配置 npmmirror 镜像。若仍慢，手动设置环境变量：

```cmd
:: Windows cmd
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
set npm_config_better_sqlite3_binary_host_mirror=https://npmmirror.com/mirrors/better-sqlite3
pnpm install
```

```powershell
# PowerShell
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
pnpm install
```

---

## better-sqlite3 编译失败

**症状**：`gyp ERR! not ok` 或 `Could not find any Visual Studio installation`。

**根因**：Node 22/24 无 better-sqlite3 预编译包，回退源码编译但缺 VS C++ 工具链。

**解决方案 A（推荐）**：降级到 Node 20 LTS（有预编译包，无需编译）：
```cmd
nvm install 20.18.0
nvm use 20.18.0
rmdir /s /q node_modules
pnpm install
```

**解决方案 B**：安装 VS Build Tools（管理员 PowerShell）：
```powershell
curl -o vs-buildtools.exe https://aka.ms/vs/17/release/vs_BuildTools.exe
vs-buildtools.exe --quiet --wait --norestart --nocache `
  --add Microsoft.VisualStudio.Workload.VCTools
```

---

## nvm install 下载失败

**症状**：`nvm install 20.18.0` 报 `connection attempt failed` 或下载超时。

**根因**：nodejs.org 国内访问慢。

**解决方案**：配置 nvm 镜像源：
```cmd
nvm node_mirror https://npmmirror.com/mirrors/node/
nvm npm_mirror https://npmmirror.com/mirrors/npm/
nvm install 20.18.0
nvm use 20.18.0
```

或手动下载：访问 https://npmmirror.com/mirrors/node/v20.18.0/，下载 `node-v20.18.0-win-x64.zip`，解压到 nvm 的 node 目录（如 `C:\Users\<用户>\AppData\Roaming\nvm\v20.18.0`），然后 `nvm use 20.18.0`。

---

## SSL 证书错误

**症状**：`prebuild-install warn install unable to verify the first certificate`。

**根因**：npmmirror 证书链问题。

**解决方案**：项目 `.npmrc` 已配置 `strict-ssl=false`。若仍报错，手动设置：
```cmd
set npm_config_strict_ssl=false
pnpm install
```

---

## electron 下载卡住

**症状**：`pnpm install` 卡在 `electron postinstall` 长时间无响应。

**根因**：electron 二进制 ~100MB，下载慢。

**解决方案 A**：确认 ELECTRON_MIRROR 生效（项目 `.npmrc` 已配置）：
```cmd
echo %ELECTRON_MIRROR%
:: 若为空，手动设置
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
```

**解决方案 B**：手动下载 electron 二进制放到缓存：
1. 浏览器访问 https://npmmirror.com/mirrors/electron/31.7.7/
2. 下载 `electron-v31.7.7-win32-x64.zip`
3. 放到缓存目录：
```cmd
mkdir "%LOCALAPPDATA%\electron\Cache\31.7.7" 2>nul
move "%USERPROFILE%\Downloads\electron-v31.7.7-win32-x64.zip" "%LOCALAPPDATA%\electron\Cache\31.7.7\"
```
4. 重新跑 electron install：
```cmd
cd node_modules\.pnpm\electron@31.7.7\node_modules\electron
node install.js
```

---

## electron-rebuild EPERM 失败

**症状**：`EPERM: operation not permitted, rmdir '...build'`。

**根因**：文件被进程锁定，或 pnpm 的 `.ignored_shared` 符号链接结构。

**解决方案**：

1. 杀掉所有 electron 进程：
```cmd
taskkill /F /IM electron.exe 2>nul
taskkill /F /IM node.exe 2>nul
```

2. 删除被锁定的 build 目录：
```cmd
rd /s /q "\\?\D:\Projects\FIRE-APP\apps\desktop\node_modules\@fire-app\.ignored_shared\node_modules\better-sqlite3\build" 2>nul
```

3. 清理重装：
```cmd
rmdir /s /q node_modules
del pnpm-lock.yaml
pnpm install
pnpm --filter @fire-app/desktop rebuild
```

---

## cmd vs PowerShell 语法错误

**症状**：`$env:ELECTRON_MIRROR=...` 报"文件名、目录名或卷标语法不正确"。

**根因**：`$env:` 是 PowerShell 语法，cmd 用 `set`。

**解决方案**：确认你的 shell：

| Shell | 设置环境变量 |
|---|---|
| cmd | `set ELECTRON_MIRROR=https://...` |
| PowerShell | `$env:ELECTRON_MIRROR="https://..."` |
| bash/zsh | `export ELECTRON_MIRROR="https://..."` |

判断当前 shell：在窗口输入 `echo %COMSPEC%`，显示路径是 cmd，报错是 PowerShell。

---

## 仍无法解决？

运行环境诊断：
```cmd
pnpm check-env
```

把输出贴给开发者，或查阅 [M3 验证文档](docs/superpowers/specs/2026-07-15-fire-app-milestone3-verification.md#111-环境搭建过程关键经验) 的 §11.1 环境搭建过程记录。
