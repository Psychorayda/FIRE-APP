// 账户状态管理 / Account state management
// 写操作后局部更新 store（upsert/remove），不再全量重拉
// Local upsert/remove after writes — no full refetch

import { create } from 'zustand';
import type { Account } from '@shared/types/index.js';
import type { CreateAccountInput, EditAccountInput } from '@shared/models/account.js';
import { dataAccess } from '../data/data-access.js';

interface AccountStore {
  accounts: Account[];
  loading: boolean;
  error: string | null;

  fetchAccounts: (userId: string) => Promise<void>;
  createAccount: (input: CreateAccountInput, userId: string) => Promise<void>;
  updateAccount: (id: string, input: EditAccountInput, userId: string) => Promise<void>;
  softDeleteAccount: (id: string, userId: string) => Promise<void>;
  // 局部更新辅助 / Local update helpers
  upsertLocal: (account: Account) => void;
  removeLocal: (id: string) => void;
  clear: () => void;
}

export const useAccountStore = create<AccountStore>((set, get) => ({
  accounts: [],
  loading: false,
  error: null,

  fetchAccounts: async (userId) => {
    set({ loading: true, error: null });
    try {
      const accounts = await dataAccess.getAccounts(userId);
      set({ accounts, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  createAccount: async (input, _userId) => {
    set({ loading: true, error: null });
    try {
      const account = await dataAccess.createAccount(input);
      // 局部更新：新账户追加到列表尾部
      // Local update: append new account
      get().upsertLocal(account);
      set({ loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  updateAccount: async (id, input, _userId) => {
    set({ loading: true, error: null });
    try {
      const account = await dataAccess.updateAccount(id, input);
      // 局部更新：替换对应记录
      // Local update: replace matching record
      get().upsertLocal(account);
      set({ loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  softDeleteAccount: async (id, _userId) => {
    set({ loading: true, error: null });
    try {
      await dataAccess.softDeleteAccount(id);
      // 局部更新：移除对应记录
      // Local update: remove matching record
      get().removeLocal(id);
      set({ loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  upsertLocal: (account) => set((s) => {
    const idx = s.accounts.findIndex((a) => a.id === account.id);
    const accounts = idx >= 0
      ? s.accounts.map((a) => (a.id === account.id ? account : a))
      : [...s.accounts, account];
    return { accounts };
  }),

  removeLocal: (id) => set((s) => ({
    accounts: s.accounts.filter((a) => a.id !== id),
  })),

  clear: () => set({ accounts: [], error: null, loading: false }),
}));
