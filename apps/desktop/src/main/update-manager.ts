// 自动更新管理器 / Auto-update manager
// 封装 electron-updater 的 autoUpdater，提供统一的 check/download/install/skipVersion API

import { app, BrowserWindow } from 'electron';
import { autoUpdater, UpdateInfo } from 'electron-updater';
import { join } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';

// 更新状态阶段 / Update status phase
export type UpdatePhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

// 更新状态（通过 IPC 同步给 renderer）/ Update status (synced to renderer via IPC)
export interface UpdateStatus {
  phase: UpdatePhase;
  currentVersion: string;
  latestVersion?: string;
  releaseNotes?: string;
  downloadProgress?: number;        // 0-100
  error?: string;
  skippedVersions: string[];
}

// 跳过版本持久化文件结构 / Skipped versions persistence file structure
interface UpdateStateFile {
  skippedVersions: string[];
}

const STATE_FILE = 'update-state.json';
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;  // 24h
const STARTUP_DELAY_MS = 10 * 1000;              // 10s

/**
 * 自动更新管理器 / Auto-update manager
 * 封装 electron-updater，提供状态同步 + 跳过版本持久化 + 定时轮询
 */
export class UpdateManager {
  private mainWindow: BrowserWindow | null;
  private status: UpdateStatus;
  private pollTimer: NodeJS.Timeout | null = null;
  private startupTimer: NodeJS.Timeout | null = null;
  private stateFilePath: string;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
    this.stateFilePath = join(app.getPath('userData'), STATE_FILE);

    this.status = {
      phase: 'idle',
      currentVersion: app.getVersion(),
      skippedVersions: this.loadSkippedVersions(),
    };

    // autoUpdater 配置 / autoUpdater configuration
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.allowDowngrade = false;
    autoUpdater.allowPrerelease = true;

    this.registerAutoUpdaterEvents();
  }

  /**
   * 启动更新检查（启动延迟 + 定时轮询）
   * Start update checking (startup delay + periodic polling)
   */
  start(): void {
    // 启动后 10s 检查一次（避免与 DB 初始化抢资源）
    this.startupTimer = setTimeout(() => {
      this.checkForUpdates().catch(() => {
        // 启动检查失败静默处理，不弹窗
      });
    }, STARTUP_DELAY_MS);

    // 每 24h 轮询一次
    this.pollTimer = setInterval(() => {
      this.checkForUpdates().catch(() => {
        // 轮询失败静默处理
      });
    }, CHECK_INTERVAL_MS);
  }

  /**
   * 手动检查更新 / Manually check for updates
   */
  async checkForUpdates(): Promise<UpdateStatus> {
    try {
      this.updateStatus({ phase: 'checking', error: undefined });
      await autoUpdater.checkForUpdates();
      return this.status;
    } catch (err) {
      this.updateStatus({
        phase: 'error',
        error: '检查更新失败，请检查网络连接',
      });
      return this.status;
    }
  }

  /**
   * 下载更新 / Download update
   */
  async downloadUpdate(): Promise<void> {
    try {
      await autoUpdater.downloadUpdate();
    } catch (err) {
      this.updateStatus({
        phase: 'error',
        error: '下载更新失败，请检查网络连接',
      });
    }
  }

  /**
   * 安装更新（退出应用并启动安装程序）
   * Install update (quit app and launch installer)
   */
  async installUpdate(): Promise<void> {
    await autoUpdater.quitAndInstall(false, true);
  }

  /**
   * 跳过指定版本（不再提示直到更高版本发布）
   * Skip a specific version (no more prompts until a higher version is released)
   */
  async skipVersion(version: string): Promise<void> {
    if (!this.status.skippedVersions.includes(version)) {
      this.status.skippedVersions.push(version);
      this.saveSkippedVersions();
      this.updateStatus({ phase: 'idle' });
    }
  }

  /**
   * 获取当前状态 / Get current status
   */
  getStatus(): UpdateStatus {
    return { ...this.status };
  }

  /**
   * 销毁（清理定时器和监听）
   * Destroy (cleanup timers and listeners)
   */
  destroy(): void {
    if (this.startupTimer) {
      clearTimeout(this.startupTimer);
      this.startupTimer = null;
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    autoUpdater.removeAllListeners();
    this.mainWindow = null;
  }

  // ===== 私有方法 / Private methods =====

  private registerAutoUpdaterEvents(): void {
    autoUpdater.on('checking-for-update', () => {
      this.updateStatus({ phase: 'checking' });
    });

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      // 检查是否在跳过列表中 / Check if version is in skip list
      if (this.status.skippedVersions.includes(info.version)) {
        // 静默跳过，不推送事件给 renderer
        this.updateStatus({ phase: 'idle' });
        return;
      }
      this.updateStatus({
        phase: 'available',
        latestVersion: info.version,
        releaseNotes: typeof info.releaseNotes === 'string'
          ? info.releaseNotes
          : Array.isArray(info.releaseNotes)
            ? info.releaseNotes.map(n => typeof n === 'string' ? n : n.note).join('\n')
            : undefined,
      });
    });

    autoUpdater.on('update-not-available', () => {
      this.updateStatus({ phase: 'not-available' });
    });

    autoUpdater.on('download-progress', (progress) => {
      this.updateStatus({
        phase: 'downloading',
        downloadProgress: Math.round(progress.percent),
      });
    });

    autoUpdater.on('update-downloaded', () => {
      this.updateStatus({
        phase: 'downloaded',
        downloadProgress: 100,
      });
    });

    autoUpdater.on('error', (_err) => {
      this.updateStatus({
        phase: 'error',
        error: '更新检查失败，请检查网络连接',
      });
    });
  }

  private updateStatus(patch: Partial<UpdateStatus>): void {
    this.status = { ...this.status, ...patch };
    this.notifyRenderer();
  }

  private notifyRenderer(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('update:status-changed', this.getStatus());
    }
  }

  private loadSkippedVersions(): string[] {
    try {
      if (!existsSync(this.stateFilePath)) {
        return [];
      }
      const data = JSON.parse(readFileSync(this.stateFilePath, 'utf-8')) as UpdateStateFile;
      return Array.isArray(data.skippedVersions) ? data.skippedVersions : [];
    } catch {
      // 文件损坏时回退到空列表 / Fallback to empty list on file corruption
      return [];
    }
  }

  private saveSkippedVersions(): void {
    try {
      const dir = app.getPath('userData');
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      const data: UpdateStateFile = {
        skippedVersions: this.status.skippedVersions,
      };
      writeFileSync(this.stateFilePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch {
      // 持久化失败不阻塞主流程 / Persistence failure does not block main flow
    }
  }
}
