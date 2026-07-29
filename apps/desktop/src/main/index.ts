// Electron 主进程入口 / Electron main process entry

import { app, BrowserWindow } from 'electron';
import { join } from 'path';
import { mkdirSync, existsSync, appendFileSync } from 'fs';
import { initDatabase, closeAppDatabase } from './db-manager.js';
import { registerIpcHandlers } from './ipc-handlers.js';

let mainWindow: BrowserWindow | null = null;

/**
 * 固定 userData 路径，避免 portable exe 每次解压到不同临时目录导致数据库路径变化
 * Fix userData path to prevent portable exe extracting to different temp dirs each run,
 * which would change the database file path and lose data.
 */
function fixUserDataPath(): void {
  const fixedUserData = join(app.getPath('appData'), 'fire-app');
  if (!existsSync(fixedUserData)) {
    mkdirSync(fixedUserData, { recursive: true });
  }
  app.setPath('userData', fixedUserData);
}

/**
 * 写诊断日志到 userData/fire-app-debug.log
 * Write diagnostic log to userData/fire-app-debug.log
 */
function debugLog(message: string): void {
  const logPath = join(app.getPath('userData'), 'fire-app-debug.log');
  const line = `[${new Date().toISOString()}] ${message}\n`;
  try {
    appendFileSync(logPath, line, 'utf8');
  } catch {
    // 日志写入失败不阻塞主流程
    // Log write failure does not block main flow
  }
}

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
      sandbox: false,
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
  // 0. 固定 userData 路径（必须在 initDatabase 之前，因为数据库路径依赖 userData）
  // Fix userData path (must run before initDatabase since DB path depends on userData)
  fixUserDataPath();
  debugLog(`UserData path fixed to: ${app.getPath('userData')}`);

  // 1. 初始化数据库
  initDatabase();
  debugLog('Database initialized');

  // 2. 注册 IPC handlers
  registerIpcHandlers();
  debugLog('IPC handlers registered');

  // 3. 创建窗口
  createWindow();
  debugLog('Main window created');

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  debugLog('window-all-closed: closing database');
  closeAppDatabase();
  debugLog('window-all-closed: database closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 兜底：before-quit 确保数据库关闭（window-all-closed 未触发时）
// Fallback: before-quit ensures DB close (when window-all-closed doesn't fire)
app.on('before-quit', () => {
  debugLog('before-quit: closing database');
  closeAppDatabase();
  debugLog('before-quit: database closed');
});
