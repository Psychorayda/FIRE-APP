// Electron 主进程入口 / Electron main process entry

import { app, BrowserWindow } from 'electron';
import { join } from 'path';
import { initDatabase, closeAppDatabase } from './db-manager.js';
import { registerIpcHandlers } from './ipc-handlers.js';

let mainWindow: BrowserWindow | null = null;

/**
 * 创建主窗口 / Create main window
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });

  // 开发模式加载 dev server，生产模式加载打包文件
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  // 1. 初始化数据库
  initDatabase();

  // 2. 注册 IPC handlers
  registerIpcHandlers();

  // 3. 创建窗口
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  closeAppDatabase();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
