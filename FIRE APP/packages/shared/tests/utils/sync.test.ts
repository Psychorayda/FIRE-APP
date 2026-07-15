// tests/utils/sync.test.ts
import { describe, it, expect } from 'vitest';
import { createSyncMeta, shouldRemoteWin, bumpSyncVersion } from '../../src/utils/sync.js';

describe('sync utils', () => {
  it('createSyncMeta: 返回初始同步元数据', () => {
    const meta = createSyncMeta();
    expect(meta.sync_version).toBe(0);
    expect(meta.deleted_flag).toBe(0);
    expect(meta.updated_at).toBeGreaterThan(0);
  });

  it('bumpSyncVersion: 版本号+1并更新时间戳', async () => {
    const before = createSyncMeta();
    // 确保时间戳不同
    await new Promise(r => setTimeout(r, 10));
    const after = bumpSyncVersion(before);
    expect(after.sync_version).toBe(before.sync_version + 1);
    expect(after.updated_at).toBeGreaterThanOrEqual(before.updated_at);
  });

  it('shouldRemoteWin: 远程更新时间更晚 → true', () => {
    const local = { updated_at: 1000, sync_version: 1, deleted_flag: 0 };
    const remote = { updated_at: 2000, sync_version: 2, deleted_flag: 0 };
    expect(shouldRemoteWin(local, remote)).toBe(true);
  });

  it('shouldRemoteWin: 本地更新时间更晚 → false', () => {
    const local = { updated_at: 2000, sync_version: 2, deleted_flag: 0 };
    const remote = { updated_at: 1000, sync_version: 1, deleted_flag: 0 };
    expect(shouldRemoteWin(local, remote)).toBe(false);
  });

  it('shouldRemoteWin: 时间相同 → 远程胜（避免死锁）', () => {
    const local = { updated_at: 1000, sync_version: 1, deleted_flag: 0 };
    const remote = { updated_at: 1000, sync_version: 2, deleted_flag: 0 };
    expect(shouldRemoteWin(local, remote)).toBe(true);
  });
});
