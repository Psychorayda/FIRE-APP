// IPC handler 注册总入口 / IPC handler registration entry
// 主进程注册 ipcMain.handle 通道，供渲染进程通过 IPC 调用数据层

import { getDatabase } from './db-manager.js';
import { registerDbHandlers } from './ipc/db-handlers.js';
import { registerUserHandlers } from './ipc/user-handlers.js';
import { registerAccountHandlers } from './ipc/account-handlers.js';
import { registerCategoryHandlers } from './ipc/category-handlers.js';
import { registerTransactionHandlers } from './ipc/transaction-handlers.js';
import { registerRecurringHandlers } from './ipc/recurring-handlers.js';
import { registerScenarioHandlers } from './ipc/scenario-handlers.js';
import { registerSnapshotHandlers } from './ipc/snapshot-handlers.js';
import { registerFireCalcHandlers } from './ipc/fire-calc-handlers.js';

/**
 * 注册所有 IPC handler / Register all IPC handlers
 */
export function registerIpcHandlers(): void {
  const db = getDatabase();

  registerDbHandlers(db);
  registerUserHandlers(db);
  registerAccountHandlers(db);
  registerCategoryHandlers(db);
  registerTransactionHandlers(db);
  registerRecurringHandlers(db);
  registerScenarioHandlers(db);
  registerSnapshotHandlers(db);
  registerFireCalcHandlers(db);

  console.log('[IPC] 已注册 36 个 IPC handler');
}
