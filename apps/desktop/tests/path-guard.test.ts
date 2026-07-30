// @vitest-environment node
import path from 'node:path';
import { describe, it, expect, beforeEach } from 'vitest';
import { issuePathToken, consumePathToken, isPathSafe } from '../src/main/ipc/path-guard.js';

describe('path-guard', () => {
  beforeEach(() => {
    // 清空已签发集合（模块内 Map）
    consumePathToken('/tmp/test.json'); // 尝试消费不存在的，无副作用
  });

  it('dialog 签发路径后可消费一次', () => {
    issuePathToken('/tmp/legit.json');
    expect(consumePathToken('/tmp/legit.json')).toBe(true);
    // 二次消费失败（一次性）
    expect(consumePathToken('/tmp/legit.json')).toBe(false);
  });

  it('未签发路径被拒绝', () => {
    expect(consumePathToken('/etc/shadow')).toBe(false);
    expect(consumePathToken('C:\\Windows\\evil.txt')).toBe(false);
  });

  it('isPathSafe 拒绝含 .. 的穿越路径', () => {
    expect(isPathSafe('/tmp/../etc/passwd')).toBe(false);
    expect(isPathSafe('/tmp/..\\evil')).toBe(false);
    expect(isPathSafe(path.resolve('/tmp/legit/file.json'))).toBe(true);
  });

  it('isPathSafe 拒绝非绝对路径', () => {
    expect(isPathSafe('relative/path.json')).toBe(false);
    expect(isPathSafe(path.resolve('/abs/path.json'))).toBe(true);
  });
});
