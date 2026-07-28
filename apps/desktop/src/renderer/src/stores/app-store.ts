// 应用全局状态管理 / App global state management
// 承载当前用户、初始化标志、全局加载/错误

import { create } from 'zustand';
import type { User } from '@shared/types/index.js';
import { dataAccess } from '../data/data-access.js';

interface AppStore {
  currentUser: User | null;
  initialized: boolean;
  loading: boolean;
  error: string | null;

  initialize: () => Promise<void>;
  completeOnboarding: (user: User) => void;
  setCurrentUser: (user: User | null) => void;
  clearError: () => void;
}

export const useAppStore = create<AppStore>((set) => ({
  currentUser: null,
  initialized: false,
  loading: false,
  error: null,

  initialize: async () => {
    set({ loading: true, error: null });
    try {
      const user = await dataAccess.getFirstUser();
      if (user) {
        set({ currentUser: user, initialized: true, loading: false });
      } else {
        set({ initialized: false, loading: false });
      }
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  completeOnboarding: (user) => {
    set({ currentUser: user, initialized: true, error: null });
  },

  setCurrentUser: (user) => set({ currentUser: user }),

  clearError: () => set({ error: null }),
}));
