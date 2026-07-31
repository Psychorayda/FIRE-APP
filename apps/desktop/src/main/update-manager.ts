// 自动更新管理器 / Auto-update manager
// 封装 electron-updater 的 autoUpdater，提供统一的 check/download/install/skipVersion API

import { app, BrowserWindow } from 'electron';
import electronUpdater from 'electron-updater';
import type { UpdateInfo } from 'electron-updater';
import { join } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync, unlinkSync } from 'fs';
import { MirrorRegistry } from './updater/mirror-registry.js';
import { DownloadManager } from './updater/download-manager.js';
import { InstallRunner } from './updater/install-runner.js';
import type { DownloadProgress } from './updater/download-manager.js';

// electron-updater 是 CommonJS 模块，打包后 ESM 加载器不支持命名导入
// 需用默认导入 + 解构（dev 模式下 bundler 自动处理，打包后需显式写）
const { autoUpdater } = electronUpdater;

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
  downloadMirror?: string;          // 当前下载镜像 id
  retryCount?: number;              // 已重试次数
}

// 跳过版本持久化文件结构 / Skipped versions persistence file structure
interface UpdateStateFile {
  skippedVersions: string[];
}

const STATE_FILE = 'update-state.json';
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;  // 24h
const STARTUP_DELAY_MS = 10 * 1000;              // 10s

// GitHub 仓库信息（用于拼接 release 下载 URL）
const GITHUB_OWNER = 'Psychorayda';
const GITHUB_REPO = 'FIRE-APP';

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
  private mirrorRegistry: MirrorRegistry;
  private downloadManager: DownloadManager;
  private installRunner: InstallRunner;
  private updateInfo: { exeUrl: string; sha512: string; size: number } | null = null;
  private downloadedInstallerPath: string | null = null;

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

    this.mirrorRegistry = new MirrorRegistry();
    this.downloadManager = new DownloadManager(this.mirrorRegistry);
    this.installRunner = new InstallRunner();

    // 监听下载进度
    this.downloadManager.on('progress', (p: DownloadProgress) => {
      this.updateStatus({
        phase: 'downloading',
        downloadProgress: p.percent,
        downloadMirror: p.mirrorId,
      });
    });

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
      const rawErr = err instanceof Error ? err.message : String(err);
      this.debugLog(`checkForUpdates failed: ${rawErr}`);
      this.updateStatus({
        phase: 'error',
        error: `检查失败：${rawErr}`,
      });
      return this.status;
    }
  }

  /**
   * 下载更新（多镜像轮询 + 断点续传）
   * Download update (multi-mirror polling + resumable)
   */
  async downloadUpdate(): Promise<void> {
    if (!this.updateInfo) {
      this.updateStatus({
        phase: 'error',
        error: '下载失败：无可用更新信息，请先检查更新',
      });
      return;
    }

    const { exeUrl, sha512, size } = this.updateInfo;
    const version = this.status.latestVersion!;
    const cacheDir = join(app.getPath('userData'), 'update-cache');
    if (!existsSync(cacheDir)) {
      mkdirSync(cacheDir, { recursive: true });
    }
    const destPath = join(cacheDir, `FIRE-App-Setup-${version}.exe`);

    try {
      const result = await this.downloadManager.download(exeUrl, sha512, size, destPath);
      if (result.success) {
        this.downloadedInstallerPath = destPath;
        this.updateStatus({
          phase: 'downloaded',
          downloadProgress: 100,
        });
      } else {
        this.debugLog(`downloadUpdate failed: ${result.error}`);
        this.updateStatus({
          phase: 'error',
          error: `下载失败：${result.error}`,
        });
      }
    } catch (err) {
      const rawErr = err instanceof Error ? err.message : String(err);
      this.debugLog(`downloadUpdate exception: ${rawErr}`);
      this.updateStatus({
        phase: 'error',
        error: `下载失败：${rawErr}`,
      });
    }
  }

  /**
   * 安装更新（NSIS 静默安装 + 重启）
   * Install update (NSIS silent install + restart)
   */
  async installUpdate(): Promise<void> {
    if (!this.downloadedInstallerPath || !existsSync(this.downloadedInstallerPath)) {
      this.updateStatus({
        phase: 'error',
        error: `安装失败：安装包不存在，请手动运行：${this.downloadedInstallerPath ?? '(未知路径)'}`,
      });
      return;
    }

    try {
      this.installRunner.run(this.downloadedInstallerPath);
    } catch (err) {
      const rawErr = err instanceof Error ? err.message : String(err);
      this.debugLog(`installUpdate failed: ${rawErr}`);
      this.updateStatus({
        phase: 'error',
        error: `安装失败，请手动运行安装包：${this.downloadedInstallerPath}`,
      });
    }
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
    this.downloadManager.removeAllListeners();
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
      // 缓存下载元数据（electron-updater 的 UpdateInfo.files[0]）
      const file = info.files?.[0];
      if (file) {
        // file.url 是相对路径，需拼接 release base URL
        const releaseBaseUrl = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/v${info.version}`;
        this.updateInfo = {
          exeUrl: `${releaseBaseUrl}/${file.url}`,
          sha512: file.sha512,
          // file.size 在类型中是可选（size?: number），缺省时回退 0
          // （DownloadManager 对 expectedSize=0 时跳过百分比计算，下载仍可进行）
          size: file.size ?? 0,
        };
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
      // 记录原始错误便于诊断（autoUpdater error 事件携带详细信息）
      const rawErr = _err instanceof Error ? _err.message : String(_err);
      this.debugLog(`autoUpdater error event: ${rawErr}`);
      this.updateStatus({
        phase: 'error',
        error: `更新错误：${rawErr}`,
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

  /**
   * 写诊断日志到 userData/fire-app-debug.log（与主进程共用同一文件）
   * Write diagnostic log to userData/fire-app-debug.log (shared with main process)
   */
  private debugLog(message: string): void {
    try {
      const logPath = join(app.getPath('userData'), 'fire-app-debug.log');
      const line = `[${new Date().toISOString()}] [update] ${message}\n`;
      appendFileSync(logPath, line, 'utf8');
    } catch {
      // 日志写入失败不阻塞主流程
    }
  }
}
