// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { MirrorRegistry } from '../src/main/updater/mirror-registry.js';

describe('MirrorRegistry', () => {
  let registry: MirrorRegistry;

  beforeEach(() => {
    registry = new MirrorRegistry();
  });

  it('getDownloadOrder 返回所有镜像，ghproxy 优先', () => {
    const order = registry.getDownloadOrder();
    expect(order).toHaveLength(3);
    expect(order[0].id).toBe('ghproxy');
    expect(order[1].id).toBe('gh-proxy');
    expect(order[2].id).toBe('github');
  });

  it('ghproxy 改写：在 GitHub URL 前加代理前缀', () => {
    const order = registry.getDownloadOrder();
    const ghproxy = order.find(m => m.id === 'ghproxy')!;
    const original = 'https://github.com/owner/repo/releases/download/v1.0/app.exe';
    expect(ghproxy.rewrite(original)).toBe('https://ghproxy.com/https://github.com/owner/repo/releases/download/v1.0/app.exe');
  });

  it('gh-proxy 改写：用 gh-proxy.com 前缀', () => {
    const order = registry.getDownloadOrder();
    const ghProxy = order.find(m => m.id === 'gh-proxy')!;
    const original = 'https://github.com/owner/repo/releases/download/v1.0/app.exe';
    expect(ghProxy.rewrite(original)).toBe('https://gh-proxy.com/https://github.com/owner/repo/releases/download/v1.0/app.exe');
  });

  it('github 镜像不改写 URL', () => {
    const order = registry.getDownloadOrder();
    const github = order.find(m => m.id === 'github')!;
    const original = 'https://github.com/owner/repo/releases/download/v1.0/app.exe';
    expect(github.rewrite(original)).toBe(original);
  });
});
