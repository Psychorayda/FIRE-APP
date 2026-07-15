// 净资产快照状态管理 / Net worth snapshot state management

import { create } from 'zustand';
import type { NetWorthSnapshot } from '@shared/types/index.js';
import { dataAccess } from '../data/data-access.js';

interface SnapshotStore {
  snapshots: NetWorthSnapshot[];
  loading: boolean;
  error: string | null;

  fetchSnapshots: (userId: string) => Promise<void>;
  generateMonthly: (userId: string) => Promise<NetWorthSnapshot | null>;
  clear: () => void;
}

export const useSnapshotStore = create<SnapshotStore>((set) => ({
  snapshots: [],
  loading: false,
  error: null,

  fetchSnapshots: async (userId) => {
    set({ loading: true, error: null });
    try {
      const snapshots = await dataAccess.getSnapshots(userId);
      set({ snapshots, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  generateMonthly: async (userId) => {
    set({ loading: true, error: null });
    try {
      const snapshot = await dataAccess.generateMonthlySnapshot(userId);
      const snapshots = await dataAccess.getSnapshots(userId);
      set({ snapshots, loading: false });
      return snapshot;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      return null;
    }
  },

  clear: () => set({ snapshots: [], error: null, loading: false }),
}));
