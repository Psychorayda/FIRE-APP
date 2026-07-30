// 自动更新 IPC handlers / Auto-update IPC handlers
// 注册 update:* 通道，供渲染进程通过 IPC 调用 UpdateManager

import { ipcMain } from 'electron';
import type { UpdateManager } from '../update-manager.js';

let updateManager: UpdateManager | null = null;

/**
 * 注册自动更新 IPC handlers
 * Register auto-update IPC handlers
 * @param manager UpdateManager 实例 / UpdateManager instance
 */
export function registerUpdateHandlers(manager: UpdateManager): void {
  updateManager = manager;

  // 检查更新 / Check for updates
  ipcMain.handle('update:check', async () => {
    return await manager.checkForUpdates();
  });

  // 下载更新 / Download update
  ipcMain.handle('update:download', async () => {
    await manager.downloadUpdate();
  });

  // 安装更新（应用退出）/ Install update (app quits)
  ipcMain.handle('update:install', async () => {
    await manager.installUpdate();
  });

  // 跳过版本 / Skip version
  ipcMain.handle('update:skipVersion', async (_event, version: string) => {
    await manager.skipVersion(version);
  });

  // 获取当前状态 / Get current status
  ipcMain.handle('update:getStatus', () => {
    return manager.getStatus();
  });

  console.log('[IPC] 已注册 update handlers');
}
