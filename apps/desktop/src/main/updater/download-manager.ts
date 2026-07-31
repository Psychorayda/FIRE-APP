// 下载管理器 / Download manager
// 多镜像轮询 + 断点续传 + SHA512 校验
// 用 Node 原生 https（不用 Electron net，避免 Chromium 证书校验问题）

import { createHash } from 'node:crypto';
import { createWriteStream, existsSync, statSync, renameSync, unlinkSync } from 'node:fs';
import https from 'node:https';
import { EventEmitter } from 'node:events';
import type { Mirror, MirrorRegistry } from './mirror-registry.js';

export interface DownloadProgress {
  totalBytes: number;
  downloadedBytes: number;  // 含续传部分
  percent: number;          // 0-100
  bytesPerSecond: number;
  mirrorId: string;
}

export interface DownloadResult {
  success: boolean;
  error?: string;
  mirrorId?: string;
}

const CONNECT_TIMEOUT_MS = 30 * 1000;        // 30s 连接超时
const SPEED_TIMEOUT_MS = 60 * 1000;          // 60s 速度监控窗口
const MIN_SPEED_BYTES_PER_SEC = 10 * 1024;   // 最低 10 KB/s

export class DownloadManager extends EventEmitter {
  private registry: MirrorRegistry;
  private aborted = false;

  constructor(registry: MirrorRegistry) {
    super();
    this.registry = registry;
  }

  /**
   * 主入口：多镜像轮询下载
   * Main entry: multi-mirror polling download
   */
  async download(
    exeUrl: string,
    expectedSha512: string,
    expectedSize: number,
    destPath: string,
  ): Promise<DownloadResult> {
    this.aborted = false;
    const mirrors = this.registry.getDownloadOrder();
    const partialPath = `${destPath}.partial`;

    for (const mirror of mirrors) {
      if (this.aborted) {
        return { success: false, error: '下载已取消' };
      }

      const currentSize = this.getExistingFileSize(partialPath);
      const mirrorUrl = mirror.rewrite(exeUrl);

      try {
        await this.downloadFromMirror(mirrorUrl, partialPath, currentSize, expectedSize, mirror.id);
        // 下载完成，校验 SHA512
        if (await this.verifySha512(partialPath, expectedSha512)) {
          this.registry.markSuccess(mirror.id);
          renameSync(partialPath, destPath);
          return { success: true, mirrorId: mirror.id };
        } else {
          // 校验失败，删除部分文件，切下一个镜像
          this.registry.markFailed(mirror.id);
          try { unlinkSync(partialPath); } catch {}
        }
      } catch (err) {
        this.registry.markFailed(mirror.id);
        // 保留 .partial 文件，下个镜像续传
        continue;
      }
    }

    return { success: false, error: '所有镜像下载失败' };
  }

  /**
   * 从单个镜像下载（含断点续传）
   * Download from single mirror (with resume)
   */
  private downloadFromMirror(
    url: string,
    partialPath: string,
    currentSize: number,
    expectedSize: number,
    mirrorId: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const headers: Record<string, string> = {};
      if (currentSize > 0) {
        headers['Range'] = `bytes=${currentSize}-`;
      }

      const req = https.get(url, { headers }, (res) => {
        // 不支持 Range（返回 200 而非 206）→ 从头下
        if (currentSize > 0 && res.statusCode === 200) {
          currentSize = 0;
        }

        if (res.statusCode !== 200 && res.statusCode !== 206) {
          reject(new Error(`HTTP ${res.statusCode}`));
          res.resume();
          return;
        }

        const writeStream = createWriteStream(partialPath, { flags: currentSize > 0 ? 'a' : 'w' });
        let downloadedInThisSession = 0;
        let lastSpeedCheck = Date.now();
        let lastBytes = currentSize;

        res.on('data', (chunk: Buffer) => {
          downloadedInThisSession += chunk.length;
          const totalDownloaded = currentSize + downloadedInThisSession;
          const percent = expectedSize > 0 ? Math.round((totalDownloaded / expectedSize) * 100) : 0;

          // 速度监控
          const now = Date.now();
          const elapsed = (now - lastSpeedCheck) / 1000;
          if (elapsed >= 1) {
            const bytesPerSec = (totalDownloaded - lastBytes) / elapsed;
            if (elapsed >= SPEED_TIMEOUT_MS / 1000 && bytesPerSec < MIN_SPEED_BYTES_PER_SEC) {
              req.destroy(new Error('速度过慢，切换镜像'));
              return;
            }
            lastBytes = totalDownloaded;
            lastSpeedCheck = now;
          }

          this.emit('progress', {
            totalBytes: expectedSize,
            downloadedBytes: totalDownloaded,
            percent,
            bytesPerSecond: 0,  // 简化，实际由上面计算
            mirrorId,
          } satisfies DownloadProgress);
        });

        res.pipe(writeStream);

        writeStream.on('finish', () => {
          resolve();
        });

        writeStream.on('error', (err) => {
          reject(err);
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.setTimeout(CONNECT_TIMEOUT_MS, () => {
        req.destroy(new Error('连接超时'));
      });
    });
  }

  /**
   * 校验文件 SHA512
   * Verify file SHA512
   */
  async verifySha512(filePath: string, expectedHash: string): Promise<boolean> {
    if (!existsSync(filePath)) return false;
    const { readFile } = await import('node:fs/promises');
    try {
      const buf = await readFile(filePath);
      const hash = createHash('sha512').update(buf).digest('base64');
      return hash === expectedHash;
    } catch {
      return false;
    }
  }

  /**
   * 获取已存在文件大小（用于断点续传）
   * Get existing file size (for resume)
   */
  getExistingFileSize(filePath: string): number {
    if (!existsSync(filePath)) return 0;
    return statSync(filePath).size;
  }

  /**
   * 中止下载（保留已下部分）
   * Abort download (keep partial file)
   */
  abort(): void {
    this.aborted = true;
  }
}
