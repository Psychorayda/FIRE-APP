// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { DownloadManager } from '../src/main/updater/download-manager.js';
import { MirrorRegistry } from '../src/main/updater/mirror-registry.js';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';

// mock node:https，避免真实网络请求（CI 不可靠）
vi.mock('node:https', () => {
  const mockGet = vi.fn((url: string, _opts: any, callback: (res: any) => void) => {
    // 默认返回错误响应（模拟连接失败）
    const mockRes = new EventEmitter();
    mockRes.statusCode = 500;
    mockRes.resume = vi.fn();
    mockRes.pipe = vi.fn();  // 500 时不应该被调用，但提供以防万一
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

/**
 * 创建 mock 响应流（200/206），含 pipe 方法
 * 数据通过 PassThrough 流写入 writeStream，模拟真实 HTTP 响应行为
 */
function createMockResponse(content: Buffer, statusCode = 200): any {
  const stream = new PassThrough();
  stream.statusCode = statusCode;
  stream.resume = vi.fn();
  setImmediate(() => {
    stream.end(content);
  });
  return stream;
}

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

  it('镜像下载成功且 SHA512 匹配时返回 success', async () => {
    const content = Buffer.from('fake exe content');
    const expectedHash = createHash('sha512').update(content).digest('base64');

    // mock https.get 返回 200 + PassThrough 流（含 pipe 方法）
    vi.mocked(https.get).mockImplementationOnce(((_url: string, _opts: any, callback: (res: any) => void) => {
      const mockRes = createMockResponse(content, 200);
      setImmediate(() => callback(mockRes));
      const mockReq = new EventEmitter();
      mockReq.destroy = vi.fn();
      mockReq.setTimeout = vi.fn();
      return mockReq;
    }) as any);

    const destPath = join(tmpDir, 'app.exe');
    const result = await manager.download(
      'https://github.com/test/repo/releases/download/v1.0/app.exe',
      expectedHash,
      content.length,
      destPath,
    );
    expect(result.success).toBe(true);
    expect(result.mirrorId).toBe('ghproxy');
  }, 10000);

  it('下载成功但 SHA512 不匹配时切下一个镜像', async () => {
    const wrongContent = Buffer.from('wrong content');
    const correctContent = Buffer.from('correct exe content');
    const expectedHash = createHash('sha512').update(correctContent).digest('base64');

    let callCount = 0;
    vi.mocked(https.get).mockImplementation(((_url: string, _opts: any, callback: (res: any) => void) => {
      callCount++;
      const content = callCount === 1 ? wrongContent : correctContent;
      const mockRes = createMockResponse(content, 200);
      setImmediate(() => callback(mockRes));
      const mockReq = new EventEmitter();
      mockReq.destroy = vi.fn();
      mockReq.setTimeout = vi.fn();
      return mockReq;
    }) as any);

    const destPath = join(tmpDir, 'app.exe');
    const result = await manager.download(
      'https://github.com/test/repo/releases/download/v1.0/app.exe',
      expectedHash,
      correctContent.length,
      destPath,
    );
    expect(result.success).toBe(true);
    // 第一个镜像 hash 失败，切到第二个成功
    expect(callCount).toBeGreaterThanOrEqual(2);
  }, 10000);
});
