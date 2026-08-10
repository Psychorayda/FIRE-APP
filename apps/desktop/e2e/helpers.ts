// E2E 测试辅助工具 / E2E test helpers
// exe 下载/启动/清理

import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { existsSync, mkdirSync, rmSync, readFileSync, createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import https from 'node:https';

// 最新 release 的 portable exe 下载地址（更新版本号即可切换）
const RELEASE_TAG = 'v0.1.1-dev.74';
const PORTABLE_EXE_NAME = 'FIRE-App-0.1.1-dev.74-x64.exe';
const DOWNLOAD_URL = `https://github.com/Psychorayda/FIRE-APP/releases/download/${RELEASE_TAG}/${PORTABLE_EXE_NAME}`;

// 缓存目录（避免每次测试都重新下载 ~90MB）
const CACHE_DIR = join(__dirname, '..', '.cache');

/**
 * 获取 exe 路径 / Get exe path
 * 优先读环境变量 FIRE_APP_EXE_PATH，否则从 GitHub Releases 下载到缓存目录
 */
export async function ensureExePath(): Promise<string> {
  const envPath = process.env['FIRE_APP_EXE_PATH'];
  if (envPath && existsSync(envPath)) {
    console.log(`[E2E] 使用环境变量指定的 exe: ${envPath}`);
    return envPath;
  }

  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
  const cachedPath = join(CACHE_DIR, PORTABLE_EXE_NAME);
  if (existsSync(cachedPath)) {
    console.log(`[E2E] 使用缓存 exe: ${cachedPath}`);
    return cachedPath;
  }

  console.log(`[E2E] 下载 exe: ${DOWNLOAD_URL}（首次约 90MB，请耐心等待）`);
  await downloadFile(DOWNLOAD_URL, cachedPath);
  console.log(`[E2E] 下载完成: ${cachedPath}`);
  return cachedPath;
}

/**
 * 下载文件（手动跟随重定向，GitHub Releases 会重定向到 CDN）
 * Download file with manual redirect following (GitHub Releases redirects to CDN)
 */
function downloadFile(url: string, destPath: string, maxRedirects = 5): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      // 处理重定向（3xx）
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        if (maxRedirects <= 0) {
          reject(new Error('重定向次数过多'));
          res.resume();
          return;
        }
        res.resume();
        downloadFile(res.headers.location, destPath, maxRedirects - 1).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`下载失败 HTTP ${res.statusCode}：${url}`));
        res.resume();
        return;
      }
      const file = createWriteStream(destPath);
      res.pipe(file);
      file.on('finish', () => {
        file.close(() => resolve());
      });
      file.on('error', (err) => {
        try { rmSync(destPath, { force: true }); } catch {}
        reject(err);
      });
    });
    req.on('error', (err) => {
      try { rmSync(destPath, { force: true }); } catch {}
      reject(err);
    });
    req.setTimeout(180_000, () => {
      req.destroy(new Error('下载超时（180s）'));
    });
  });
}

/**
 * 获取测试 userData 目录路径 / Get test userData path
 * 返回 %APPDATA%\fire-app（与主进程 fixUserDataPath 一致）
 */
export function getUserDataDir(): string {
  // Windows: %APPDATA% = process.env.APPDATA 或 homedir/AppData/Roaming
  const appData = process.env['APPDATA'] || join(homedir(), 'AppData', 'Roaming');
  return join(appData, 'fire-app');
}

/**
 * 清理测试 userData / Clean test userData
 * 删除 data 子目录（DB + WAL/SHM）和诊断日志
 * 仅适合干净测试环境，会删除真实数据
 */
export function cleanUserData(): void {
  const userDataDir = getUserDataDir();
  const dataDir = join(userDataDir, 'data');
  const debugLog = join(userDataDir, 'fire-app-debug.log');
  const legacyDir = join(userDataDir, 'fire-app'); // 旧双层路径残留

  if (existsSync(dataDir)) {
    console.log(`[E2E] 清理 data 目录: ${dataDir}`);
    rmSync(dataDir, { recursive: true, force: true });
  }
  if (existsSync(debugLog)) {
    rmSync(debugLog, { force: true });
  }
  if (existsSync(legacyDir)) {
    console.log(`[E2E] 清理旧双层路径残留: ${legacyDir}`);
    rmSync(legacyDir, { recursive: true, force: true });
  }
}

/**
 * 启动 Electron 应用 / Launch Electron app
 * 等待首个窗口就绪，返回 { electronApp, page }
 */
export async function launchApp(exePath: string): Promise<{ electronApp: ElectronApplication; page: Page }> {
  console.log(`[E2E] 启动 exe: ${exePath}`);
  const electronApp = await electron.launch({
    executablePath: exePath,
    timeout: 45_000, // exe 启动超时
  });

  // 等待首个窗口
  const page = await electronApp.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  console.log(`[E2E] 应用已启动，当前 URL: ${page.url()}`);
  return { electronApp, page };
}

/**
 * 完成 Onboarding 5 步流程（复用逻辑）/ Complete Onboarding 5 steps
 * 在指定 page 上执行完整的 Onboarding 操作
 */
export async function completeOnboarding(page: Page, displayName = 'E2E测试用户'): Promise<void> {
  // 等待 Onboarding 页面加载
  await page.waitForURL(/#\/onboarding/, { timeout: 30_000 });

  // Step 1: 欢迎页 → 点击"开始使用"
  await page.getByText('开始使用', { exact: true }).click();

  // Step 2: 输入显示名称
  await page.getByPlaceholder('例如：张三').fill(displayName);
  await page.getByText('下一步', { exact: true }).click();

  // Step 3: 选择市场（默认中国市场已选中，直接下一步）
  await page.getByText('下一步', { exact: true }).click();

  // Step 4: 确认利率偏好（保持默认，直接下一步）
  await page.getByText('下一步', { exact: true }).click();

  // Step 5: 确认完成 → 点击"完成创建"
  await page.getByText('完成创建', { exact: true }).click();

  // 等待跳转到主页（URL 变为 #/）
  await page.waitForURL(/#\/$/, { timeout: 30_000 });
}

/**
 * 读取诊断日志（用于失败时调试）/ Read debug log for debugging on failure
 */
export function readDebugLog(): string {
  const logPath = join(getUserDataDir(), 'fire-app-debug.log');
  if (!existsSync(logPath)) return '(无诊断日志)';
  try {
    return readFileSync(logPath, 'utf8');
  } catch {
    return '(读取日志失败)';
  }
}
