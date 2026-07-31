// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createHash } from 'node:crypto';
import { DownloadManager } from '../src/main/updater/download-manager.js';
import { MirrorRegistry } from '../src/main/updater/mirror-registry.js';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';

describe('DownloadManager', () => {
  let registry: MirrorRegistry;
  let manager: DownloadManager;
  let tmpDir: string;

  beforeEach(() => {
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
    registry = new MirrorRegistry();
    manager = new DownloadManager(registry);
    tmpDir = mkdtempSync(join(tmpdir(), 'fire-test-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('所有镜像都失败时返回 failure', async () => {
    // 用必然失败的 URL（端口 1 通常无服务，连接被拒绝）
    const destPath = join(tmpDir, 'app.exe');
    const result = await manager.download(
      'https://127.0.0.1:1/test/app.exe',
      'fakehash',
      1024,
      destPath,
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe('所有镜像下载失败');
  }, 30000); // 30s 超时，因为要尝试 3 个镜像
});
