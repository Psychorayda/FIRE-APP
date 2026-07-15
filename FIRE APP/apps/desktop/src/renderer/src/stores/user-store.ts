// 用户状态管理 / User state management
// 使用 Zustand 管理用户状态，通过 IPC 调用数据层

import { create } from 'zustand';
import type { User } from '@shared/types/index.js';

interface UserStore {
  // 状态 / State
  user: User | null;
  loading: boolean;
  error: string | null;

  // 操作 / Actions
  fetchUser: () => Promise<void>;
  createUser: (input: {
    display_name: string;
    is_china_market?: number;
    default_withdrawal_rate?: number;
    default_expected_return?: number;
    default_inflation_rate?: number;
  }) => Promise<void>;
  clear: () => void;
}

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  loading: false,
  error: null,

  fetchUser: async () => {
    set({ loading: true, error: null });
    try {
      const user = await window.dataAccess.user.getFirst();
      set({ user, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  createUser: async (input) => {
    set({ loading: true, error: null });
    try {
      const user = await window.dataAccess.user.create(input);
      // 创建用户后立即创建种子分类
      await window.dataAccess.category.seed(user.id);
      set({ user, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  clear: () => set({ user: null, error: null, loading: false }),
}));
