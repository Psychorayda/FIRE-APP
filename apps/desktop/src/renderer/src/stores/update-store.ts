// 自动更新状态管理 / Auto-update state management
// 订阅 main 进程的 update:status-changed 事件，暴露状态 + 操作方法

import { create } from 'zustand';

// 更新状态阶段（与 main 进程 UpdatePhase 对齐）
export type UpdatePhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

interface UpdateStatus {
  phase: UpdatePhase;
  currentVersion: string;
  latestVersion?: string;
  releaseNotes?: string;
  downloadProgress?: number;
  error?: string;
  skippedVersions: string[];
}

interface UpdateStoreState extends UpdateStatus {
  dialogOpen: boolean;

  checkForUpdates: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
  skipVersion: (version: string) => Promise<void>;
  closeDialog: () => void;
  openDialog: () => void;
  syncStatus: () => Promise<void>;
}

// 初始状态 / Initial state
const initialState: UpdateStatus & { dialogOpen: boolean } = {
  phase: 'idle',
  currentVersion: '0.0.0',
  latestVersion: undefined,
  releaseNotes: undefined,
  downloadProgress: undefined,
  error: undefined,
  skippedVersions: [],
  dialogOpen: false,
};

export const useUpdateStore = create<UpdateStoreState>((set, get) => ({
  ...initialState,

  checkForUpdates: async () => {
    try {
      const status = await window.update.check();
      // phase=available 且版本未跳过 → 自动弹窗
      const shouldOpenDialog =
        status.phase === 'available' &&
        status.latestVersion !== undefined &&
        !status.skippedVersions.includes(status.latestVersion);
      // phase=not-available 或 error → 手动检查时弹窗显示结果
      const shouldOpenForResult =
        status.phase === 'not-available' || status.phase === 'error';
      set({
        ...status,
        dialogOpen: shouldOpenDialog || shouldOpenForResult,
      });
    } catch {
      set({ phase: 'error', error: '检查更新失败', dialogOpen: true });
    }
  },

  downloadUpdate: async () => {
    await window.update.download();
  },

  installUpdate: async () => {
    await window.update.install();
  },

  skipVersion: async (version) => {
    await window.update.skipVersion(version);
    set({ phase: 'idle', dialogOpen: false });
  },

  closeDialog: () => set({ dialogOpen: false }),
  openDialog: () => set({ dialogOpen: true }),

  syncStatus: async () => {
    try {
      const status = await window.update.getStatus();
      set(status);
    } catch {
      // 状态拉取失败静默处理
    }
    // 订阅 main 进程推送的状态变更
    window.update.onStatusChanged((status: unknown) => {
      const s = status as UpdateStatus;
      // phase=available 且版本未跳过 → 自动弹窗
      const shouldOpenDialog =
        s.phase === 'available' &&
        s.latestVersion !== undefined &&
        !s.skippedVersions.includes(s.latestVersion);
      set({
        ...s,
        dialogOpen: shouldOpenDialog || get().dialogOpen,
      });
    });
  },
}));
