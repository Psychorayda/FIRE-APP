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
