// Preload 脚本 / Preload script
// 通过 contextBridge 将 IPC 调用安全地暴露给渲染进程

import { contextBridge, ipcRenderer } from 'electron';

// 暴露给渲染进程的数据访问 API
const dataAccess = {
  // 数据库管理 / Database
  initDatabase: () => ipcRenderer.invoke('db:init'),
  closeDatabase: () => ipcRenderer.invoke('db:close'),
  // 降级重建通知（main → renderer 单向推送）
  // Corrupted-recovered notification (main → renderer one-way push)
  onCorruptedRecovered: (callback: (info: { backupPath: string; timestamp: number }) => void) => {
    const handler = (_event: unknown, payload: string) => {
      try {
        callback(JSON.parse(payload));
      } catch {
        // payload 解析失败忽略
      }
    };
    ipcRenderer.on('db:corrupted-recovered', handler);
    return () => ipcRenderer.removeListener('db:corrupted-recovered', handler);
  },

  // 用户 / User
  user: {
    create: (input: unknown) => ipcRenderer.invoke('db:user:create', input),
    get: (id: string) => ipcRenderer.invoke('db:user:get', id),
    update: (id: string, input: unknown) => ipcRenderer.invoke('db:user:update', id, input),
    getFirst: () => ipcRenderer.invoke('db:user:getFirst'),
  },

  // 账户 / Account
  account: {
    create: (input: unknown) => ipcRenderer.invoke('db:account:create', input),
    get: (id: string) => ipcRenderer.invoke('db:account:get', id),
    list: (userId: string) => ipcRenderer.invoke('db:account:list', userId),
    update: (id: string, input: unknown) => ipcRenderer.invoke('db:account:update', id, input),
    updateBalance: (id: string, newBalance: number) => ipcRenderer.invoke('db:account:updateBalance', id, newBalance),
    investableBalance: (userId: string) => ipcRenderer.invoke('db:account:investableBalance', userId),
    netWorth: (userId: string) => ipcRenderer.invoke('db:account:netWorth', userId),
    hasTransactions: (accountId: string) => ipcRenderer.invoke('db:account:hasTransactions', accountId),
    softDelete: (id: string) => ipcRenderer.invoke('db:account:softDelete', id),
  },

  // 分类 / Category
  category: {
    create: (input: unknown) => ipcRenderer.invoke('db:category:create', input),
    get: (id: string) => ipcRenderer.invoke('db:category:get', id),
    list: (userId: string, type?: string) => ipcRenderer.invoke('db:category:list', userId, type),
    seed: (userId: string) => ipcRenderer.invoke('db:category:seed', userId),
    resetSystem: (userId: string) => ipcRenderer.invoke('db:category:resetSystem', userId),
  },

  // 交易 / Transaction
  tx: {
    get: (id: string) => ipcRenderer.invoke('db:tx:get', id),
    getById: (id: string) => ipcRenderer.invoke('db:tx:getById', id),
    // 分页查询：筛选/排序下推到 SQL / Paginated query: filters/order pushed to SQL
    page: (userId: string, params: unknown) => ipcRenderer.invoke('db:tx:page', userId, params),
    recent: (userId: string, limit: number) => ipcRenderer.invoke('db:tx:recent', userId, limit),
    monthlyOverview: (userId: string, yearMonth: string) => ipcRenderer.invoke('db:tx:monthlyOverview', userId, yearMonth),
    create: (input: unknown) => ipcRenderer.invoke('db:tx:create', input),
    edit: (id: string, input: unknown) => ipcRenderer.invoke('db:tx:edit', id, input),
    delete: (id: string) => ipcRenderer.invoke('db:tx:delete', id),
  },

  // 经常性交易 / Recurring
  recurring: {
    create: (input: unknown) => ipcRenderer.invoke('db:recurring:create', input),
    listActive: (userId: string) => ipcRenderer.invoke('db:recurring:listActive', userId),
    update: (id: string, updates: unknown) => ipcRenderer.invoke('db:recurring:update', id, updates),
    process: (userId: string) => ipcRenderer.invoke('db:recurring:process', userId),
  },

  // 场景 / Scenario
  scenario: {
    create: (input: unknown) => ipcRenderer.invoke('db:scenario:create', input),
    get: (id: string) => ipcRenderer.invoke('db:scenario:get', id),
    list: (userId: string) => ipcRenderer.invoke('db:scenario:list', userId),
    update: (id: string, updates: unknown) => ipcRenderer.invoke('db:scenario:update', id, updates),
  },

  // 快照 / Snapshot
  snapshot: {
    list: (userId: string) => ipcRenderer.invoke('db:snapshot:list', userId),
    getByMonth: (userId: string, yearMonth: string) => ipcRenderer.invoke('db:snapshot:getByMonth', userId, yearMonth),
    generateMonthly: (userId: string) => ipcRenderer.invoke('db:snapshot:generateMonthly', userId),
  },

  // FIRE 计算 / FireCalc
  fireCalc: {
    runProjection: (scenario: unknown) => ipcRenderer.invoke('db:fireCalc:runProjection', scenario),
  },

  // 导出/导入/清空 / Export/Import/Clear
  exportImport: {
    exportJson: (filePath: string) => ipcRenderer.invoke('export:json', filePath),
    exportCsv: (filePath: string, table: string) => ipcRenderer.invoke('export:csv', filePath, table),
    importJson: (filePath: string) => ipcRenderer.invoke('import:json', filePath),
    parseCsv: (templateId: string, filePath: string) => ipcRenderer.invoke('import:parseCsv', templateId, filePath),
    importCsvTransactions: (params: unknown) => ipcRenderer.invoke('import:csvTransactions', params),
    markDuplicates: (accountId: string, transactions: unknown) => ipcRenderer.invoke('import:markDuplicates', accountId, transactions),
    detectTemplate: (filePath: string) => ipcRenderer.invoke('import:detectTemplate', filePath),
    clearTransactions: () => ipcRenderer.invoke('clear:transactions'),
    showSaveDialog: (defaultName: string, extension: 'json' | 'csv') =>
      ipcRenderer.invoke('dialog:save', { defaultName, extension }),
    showOpenDialog: (extensions: string[]) =>
      ipcRenderer.invoke('dialog:open', { extensions }),
  },
};

// 暴露给渲染进程的自动更新 API / Auto-update API exposed to renderer
const update = {
  check: () => ipcRenderer.invoke('update:check'),
  download: () => ipcRenderer.invoke('update:download'),
  install: () => ipcRenderer.invoke('update:install'),
  skipVersion: (version: string) => ipcRenderer.invoke('update:skipVersion', version),
  getStatus: () => ipcRenderer.invoke('update:getStatus'),
  onStatusChanged: (callback: (status: unknown) => void) => {
    const handler = (_event: unknown, status: unknown) => callback(status);
    ipcRenderer.on('update:status-changed', handler);
    // 返回取消订阅函数 / Return unsubscribe function
    return () => ipcRenderer.removeListener('update:status-changed', handler);
  },
};

// 将 dataAccess 挂载到 window 上
contextBridge.exposeInMainWorld('dataAccess', dataAccess);
contextBridge.exposeInMainWorld('update', update);

// 类型声明：告诉 TypeScript window.dataAccess 存在
export type DataAccess = typeof dataAccess;
export type UpdateApi = typeof update;
