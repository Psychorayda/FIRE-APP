// 交易状态管理 / Transaction state management
// 写操作后自动刷新交易列表 + 联动刷新账户列表

import { create } from 'zustand';
import type { Transaction } from '@shared/types/index.js';
import type { CreateTransactionInput, EditTransactionInput } from '@shared/services/transaction-service.js';
import { dataAccess } from '../data/data-access.js';
import { useAccountStore } from './account-store.js';

interface TransactionStore {
  transactions: Transaction[];
  loading: boolean;
  error: string | null;

  fetchTransactions: (userId: string) => Promise<void>;
  createTransaction: (input: CreateTransactionInput, userId: string) => Promise<void>;
  editTransaction: (id: string, input: EditTransactionInput, userId: string) => Promise<void>;
  deleteTransaction: (id: string, userId: string) => Promise<void>;
  clear: () => void;
}

export const useTransactionStore = create<TransactionStore>((set) => ({
  transactions: [],
  loading: false,
  error: null,

  fetchTransactions: async (userId) => {
    set({ loading: true, error: null });
    try {
      const transactions = await dataAccess.getTransactionsByUser(userId);
      set({ transactions, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  createTransaction: async (input, userId) => {
    set({ loading: true, error: null });
    try {
      await dataAccess.createTransaction(input);
      const transactions = await dataAccess.getTransactionsByUser(userId);
      set({ transactions, loading: false });
      // 联动刷新账户列表（交易影响余额）
      useAccountStore.getState().fetchAccounts(userId);
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  editTransaction: async (id, input, userId) => {
    set({ loading: true, error: null });
    try {
      await dataAccess.editTransaction(id, input);
      const transactions = await dataAccess.getTransactionsByUser(userId);
      set({ transactions, loading: false });
      useAccountStore.getState().fetchAccounts(userId);
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  deleteTransaction: async (id, userId) => {
    set({ loading: true, error: null });
    try {
      await dataAccess.deleteTransaction(id);
      const transactions = await dataAccess.getTransactionsByUser(userId);
      set({ transactions, loading: false });
      useAccountStore.getState().fetchAccounts(userId);
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  clear: () => set({ transactions: [], error: null, loading: false }),
}));
