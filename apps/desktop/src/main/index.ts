// Electron 主进程入口 / Electron main process entry

import { app, BrowserWindow, shell, session } from 'electron';
import { join } from 'path';
import { mkdirSync, existsSync, appendFileSync } from 'fs';
import { initDatabase, closeAppDatabase } from './db-manager.js';
import { registerIpcHandlers } from './ipc-handlers.js';
import { UpdateManager } from './update-manager.js';
import { registerUpdateHandlers } from './ipc/update-handlers.js';

let mainWindow: BrowserWindow | null = null;
let updateManager: UpdateManager | null = null;

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
      sandbox: true,
    },
  });

  // 初始化自动更新管理器（需要 mainWindow 引用）
  // Initialize auto-update manager (needs mainWindow reference)
  updateManager = new UpdateManager(mainWindow);
  registerUpdateHandlers(updateManager);

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });

  // 拦截 window.open，转系统浏览器打开外链
  // Intercept window.open, delegate external links to system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // 阻止渲染端导航到外部协议（非 dev 模式）
  // Prevent renderer navigation to external protocols (non-dev mode)
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!app.isPackaged && url.startsWith(process.env['ELECTRON_RENDERER_URL'] ?? '__invalid__')) {
      return; // dev 模式下允许 vite HMR 导航
    }
    event.preventDefault();
  });

  // 开发模式加载 dev server，生产模式加载打包文件
  // Dev mode loads dev server, production loads packaged file
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
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

  // 3. 注入 CSP 响应头（生产模式，比 index.html meta 更严格）
  // Inject CSP response headers (production mode, stricter than index.html meta)
  if (app.isPackaged) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': ["default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'"],
        },
      });
    });
  }

  // 4. 创建窗口
  createWindow();
  debugLog('Main window created');

  // 5. 启动自动更新检查（延迟 10s + 24h 轮询）
  // Start auto-update checking (10s delay + 24h polling)
  updateManager?.start();

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
  updateManager?.destroy();
});
