// 安装运行器 / Install runner
// 调用 NSIS 安装包静默安装（/S）+ 延迟重启应用

import { app } from 'electron';
import { spawn } from 'node:child_process';

const RESTART_DELAY_MS = 3000;  // 给安装程序时间完成覆盖

export class InstallRunner {
  /**
   * 运行安装包并重启应用
   * Run installer and restart app
   *
   * 流程：
   * 1. spawn 安装包（/S 静默模式，detached 脱离父进程）
   * 2. 延迟 3 秒后 relaunch + exit（给安装程序时间覆盖 exe）
   *
   * 用 app.exit(0) 而非 quit()，跳过 before-quit 钩子，
   * 避免数据库关闭与文件覆盖竞争
   */
  run(installerPath: string): void {
    // 1. 启动安装程序
    const child = spawn(installerPath, ['/S'], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();

    // 2. 延迟重启
    setTimeout(() => {
      app.relaunch();
      app.exit(0);
    }, RESTART_DELAY_MS);
  }
}
