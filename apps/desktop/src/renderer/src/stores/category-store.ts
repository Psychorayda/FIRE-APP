// 分类状态管理 / Category state management
// 带 自动 seed 兜底：首次 fetch 为空时自动 seed 后重新 fetch
// With auto-seed fallback: auto-seed on first empty fetch then re-fetch

import { create } from 'zustand';
import type { Category } from '@shared/types/index.js';
import { dataAccess } from '../data/data-access.js';

interface CategoryStore {
  categories: Category[];
  loading: boolean;
  error: string | null;
  fetchCategories: (userId: string) => Promise<void>;
  clear: () => void;
}

// 模块级 Promise 缓存：防止并发 fetch 时重复 seed
// Module-level Promise cache: prevent duplicate seed on concurrent fetch
let seedInProgress: Promise<void> | null = null;

export const useCategoryStore = create<CategoryStore>((set) => ({
  categories: [],
  loading: false,
  error: null,

  fetchCategories: async (userId) => {
    set({ loading: true, error: null });
    try {
      const list = await dataAccess.getCategories(userId);
      if (list.length === 0) {
        // 首次为空 → 自动 seed
        // First fetch empty → auto-seed
        if (!seedInProgress) {
          seedInProgress = dataAccess.seedCategories(userId)
            .finally(() => { seedInProgress = null; });
        }
        await seedInProgress;
        // seed 完成后重新 fetch
        // Re-fetch after seed completes
        const reList = await dataAccess.getCategories(userId);
        set({ categories: reList, loading: false });
        return;
      }
      set({ categories: list, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  clear: () => set({ categories: [], error: null, loading: false }),
}));
