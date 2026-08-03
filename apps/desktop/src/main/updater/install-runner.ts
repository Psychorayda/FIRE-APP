// 安装运行器 / Install runner
// 通过批处理脚本实现"先退出 → 后安装 → 再重启"的标准模式
// 解决直接 spawn NSIS 时 exe 被锁定导致安装失败的问题

import { app } from 'electron';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

export class InstallRunner {
  /**
   * 运行安装包并重启应用
   * Run installer and restart app
   *
   * 流程：
   * 1. 写临时 .bat 脚本到 %TEMP%
   *    - 等 2 秒确保应用完全退出（释放 exe 文件锁）
   *    - 静默执行 NSIS 安装包（/S）
   *    - 等 1 秒确保安装完成
   *    - 重启应用
   *    - 自删脚本
   * 2. spawn .bat（detached，脱离父进程）
   * 3. app.quit()（走 before-quit 钩子，正确关闭数据库）
   *
   * 关键改进 vs 旧方案：
   * - 用 app.quit() 而非 app.exit(0) → 走 before-quit → closeAppDatabase() 正确执行
   * - 批处理独立运行，应用退出后 NSIS 才开始 → exe 不被锁定
   * - 安装完成后批处理自动重启应用
   */
  run(installerPath: string): void {
    // 1. 获取应用 exe 路径（重启用）
    const appPath = app.getPath('exe');
    // 2. 临时批处理脚本路径
    const batPath = join(app.getPath('temp'), 'fire-app-update-installer.bat');

    // 3. 批处理脚本内容
    //    %~1 = installerPath, %~2 = appPath（用参数传，避免路径转义问题）
    const batContent = `@echo off
chcp 65001 >nul
echo [fire-app-updater] Waiting for app to exit...
timeout /t 2 /nobreak >nul
echo [fire-app-updater] Running installer: %~1
start /wait "" "%~1" /S
echo [fire-app-updater] Installer finished.
timeout /t 1 /nobreak >nul
echo [fire-app-updater] Restarting app: %~2
start "" "%~2"
echo [fire-app-updater] Done. Cleaning up.
del "%~f0"
`;

    writeFileSync(batPath, batContent, 'utf8');

    // 4. spawn 批处理（detached，shell 模式，参数用引号包裹处理空格）
    const child = spawn('cmd.exe', ['/c', batPath, installerPath, appPath], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.unref();

    // 5. 退出应用（走 before-quit 钩子，确保数据库正确关闭）
    app.quit();
  }
}
