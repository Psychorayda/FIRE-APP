// src/utils/sync.ts
import { nowMs } from './time.js';

export interface SyncMeta {
  updated_at: number;
  sync_version: number;
  deleted_flag: number;
}

/**
 * 创建初始同步元数据（新记录）
 */
export function createSyncMeta(): SyncMeta {
  return {
    updated_at: nowMs(),
    sync_version: 0,
    deleted_flag: 0,
  };
}

/**
 * 更新记录时递增同步版本号并刷新时间戳
 */
export function bumpSyncVersion(current: SyncMeta): SyncMeta {
  return {
    updated_at: nowMs(),
    sync_version: current.sync_version + 1,
    deleted_flag: current.deleted_flag,
  };
}

/**
 * LWW 冲突解决：判断远程记录是否应该覆盖本地
 * 规则：remote.updated_at >= local.updated_at 时远程胜
 */
export function shouldRemoteWin(local: SyncMeta, remote: SyncMeta): boolean {
  return remote.updated_at >= local.updated_at;
}
