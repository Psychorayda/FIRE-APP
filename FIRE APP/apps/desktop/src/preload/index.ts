// Preload 脚本 / Preload script
// 通过 contextBridge 将 IPC 调用安全地暴露给渲染进程

import { contextBridge, ipcRenderer } from 'electron';

// 暴露给渲染进程的数据访问 API
const dataAccess = {
  // 初始化 / Init
  initDatabase: () => ipcRenderer.invoke('db:init'),

  // 用户 / User
  user: {
    getFirst: () => ipcRenderer.invoke('db:user:getFirst'),
    create: (input: unknown) => ipcRenderer.invoke('db:user:create', input),
  },

  // 分类 / Category
  category: {
    seed: (userId: string) => ipcRenderer.invoke('db:category:seed', userId),
  },

  // 账户 / Account
  account: {
    list: (userId: string) => ipcRenderer.invoke('db:account:list', userId),
  },
};

// 将 dataAccess 挂载到 window 上
contextBridge.exposeInMainWorld('dataAccess', dataAccess);

// 类型声明：告诉 TypeScript window.dataAccess 存在
export type DataAccess = typeof dataAccess;
