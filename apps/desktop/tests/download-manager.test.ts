// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { DownloadManager } from '../src/main/updater/download-manager.js';
import { MirrorRegistry } from '../src/main/updater/mirror-registry.js';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';

// mock node:https，避免真实网络请求（CI 不可靠）
// 默认返回 HTTP 500，模拟所有镜像失败
vi.mock('node:https', () => {
  const mockGet = vi.fn((_url: string, _opts: any, callback: (res: any) => void) => {
    const mockRes = new EventEmitter();
    mockRes.statusCode = 500;
    mockRes.resume = vi.fn();
    mockRes.pipe = vi.fn();
    setImmediate(() => {
      callback(mockRes);
      mockRes.emit('end');
    });
    const mockReq = new EventEmitter();
    mockReq.destroy = vi.fn();
    mockReq.setTimeout = vi.fn();
    return mockReq;
  });
  return { default: { get: mockGet }, get: mockGet };
});

import https from 'node:https';

describe('DownloadManager', () => {
  let registry: MirrorRegistry;
  let manager: DownloadManager;
  let tmpDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new MirrorRegistry();
    manager = new DownloadManager(registry);
    tmpDir = mkdtempSync(join(tmpdir(), 'fire-test-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('verifySha512', () => {
    it('SHA512 匹配时返回 true', async () => {
      const filePath = join(tmpDir, 'test.bin');
      const content = Buffer.from('hello world');
      writeFileSync(filePath, content);
      const expectedHash = createHash('sha512').update(content).digest('base64');
      expect(await manager.verifySha512(filePath, expectedHash)).toBe(true);
    });

    it('SHA512 不匹配时返回 false', async () => {
      const filePath = join(tmpDir, 'test.bin');
      writeFileSync(filePath, Buffer.from('hello world'));
      expect(await manager.verifySha512(filePath, 'wronghash')).toBe(false);
    });

    it('文件不存在时返回 false', async () => {
      expect(await manager.verifySha512(join(tmpDir, 'no-exist.bin'), 'anyhash')).toBe(false);
    });
  });

  describe('getExistingFileSize', () => {
    it('文件存在时返回字节数', () => {
      const filePath = join(tmpDir, 'partial.bin');
      writeFileSync(filePath, Buffer.alloc(1024));
      expect(manager.getExistingFileSize(filePath)).toBe(1024);
    });

    it('文件不存在时返回 0', () => {
      expect(manager.getExistingFileSize(join(tmpDir, 'no-exist.bin'))).toBe(0);
    });
  });
});

describe('DownloadManager - 多镜像轮询', () => {
  let registry: MirrorRegistry;
  let manager: DownloadManager;
  let tmpDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new MirrorRegistry();
    manager = new DownloadManager(registry);
    tmpDir = mkdtempSync(join(tmpdir(), 'fire-test-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('所有镜像都失败时返回 failure', async () => {
    // mock https.get 默认返回 500（在 vi.mock 中设置）
    const destPath = join(tmpDir, 'app.exe');
    const result = await manager.download(
      'https://github.com/test/repo/releases/download/v1.0/app.exe',
      'fakehash',
      1024,
      destPath,
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe('所有镜像下载失败');
    // 应该尝试了所有镜像（3 个）
    expect(https.get).toHaveBeenCalledTimes(3);
  }, 10000);

  it('诊断事件在镜像失败时触发', async () => {
    const mirrorErrorEvents: any[] = [];
    manager.on('mirror-error', (e: any) => mirrorErrorEvents.push(e));

    const destPath = join(tmpDir, 'app.exe');
    await manager.download(
      'https://github.com/test/repo/releases/download/v1.0/app.exe',
      'fakehash',
      1024,
      destPath,
    );

    // 3 个镜像都失败，应触发 3 次 mirror-error 事件
    expect(mirrorErrorEvents).toHaveLength(3);
    expect(mirrorErrorEvents[0]).toHaveProperty('mirrorId');
    expect(mirrorErrorEvents[0]).toHaveProperty('error');
  }, 10000);
});
