// 导出当前使用的 DataAccessPort 实例（IPC 实现）
// Export the currently used DataAccessPort instance (IPC implementation)

import { IpcDataAccess } from './ipc-data-access.js';

export const dataAccess: IpcDataAccess = new IpcDataAccess();
