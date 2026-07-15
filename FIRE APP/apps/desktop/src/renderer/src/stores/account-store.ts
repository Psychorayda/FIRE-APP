// 账户状态管理 / Account state management

import { create } from 'zustand';
import type { Account } from '@shared/types/index.js';
import type { CreateAccountInput } from '@shared/models/account.js';
import { dataAccess } from '../data/data-access.js';

interface AccountStore {
  accounts: Account[];
  loading: boolean;
  error: string | null;

  fetchAccounts: (userId: string) => Promise<void>;
  createAccount: (input: CreateAccountInput, userId: string) => Promise<void>;
  softDeleteAccount: (id: string, userId: string) => Promise<void>;
  clear: () => void;
}

export const useAccountStore = create<AccountStore>((set) => ({
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

  createAccount: async (input, userId) => {
    set({ loading: true, error: null });
    try {
      await dataAccess.createAccount(input);
      const accounts = await dataAccess.getAccounts(userId);
      set({ accounts, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  softDeleteAccount: async (id, userId) => {
    set({ loading: true, error: null });
    try {
      await dataAccess.softDeleteAccount(id);
      const accounts = await dataAccess.getAccounts(userId);
      set({ accounts, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  clear: () => set({ accounts: [], error: null, loading: false }),
}));
