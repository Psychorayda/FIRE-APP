// IPC handler 注册 / IPC handler registration
// 主进程注册 ipcMain.handle 通道，供渲染进程通过 IPC 调用数据层

import { ipcMain } from 'electron';
import { getDatabase } from './db-manager.js';
import { getFirstUser, createUser } from '@shared/models/user.js';
import { seedCategories } from '@shared/models/category.js';
import { getAccounts } from '@shared/models/account.js';
import type { CreateUserInput } from '@shared/models/user.js';

/**
 * 注册所有 IPC handler / Register all IPC handlers
 */
export function registerIpcHandlers(): void {
  const db = getDatabase();

  // --- 用户相关 / User ---

  // 获取第一个用户（启动检查）
  ipcMain.handle('db:user:getFirst', () => {
    return getFirstUser(db);
  });

  // 创建用户
  ipcMain.handle('db:user:create', (_event, input: CreateUserInput) => {
    return createUser(db, input);
  });

  // --- 分类相关 / Category ---

  // 创建种子分类
  ipcMain.handle('db:category:seed', (_event, userId: string) => {
    seedCategories(db, userId);
  });

  // --- 账户相关 / Account ---

  // 获取用户所有账户
  ipcMain.handle('db:account:list', (_event, userId: string) => {
    return getAccounts(db, userId);
  });

  // --- 初始化 / Init ---

  // 数据库初始化确认（幂等，主进程已初始化，此处仅返回确认）
  ipcMain.handle('db:init', () => {
    return;
  });
}
