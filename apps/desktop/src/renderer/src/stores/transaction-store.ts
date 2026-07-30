// 交易状态管理 / Transaction state management
// 写操作后局部更新 store（upsert/remove），不再全量重拉
// Local upsert/remove after writes — no full refetch
// 交易影响账户余额，写操作后联动刷新账户列表

import { create } from 'zustand';
import type { Transaction } from '@shared/types/index.js';
import type { CreateTransactionInput, EditTransactionInput } from '@shared/services/transaction-service.js';
import type { TransactionPageParams } from '@shared/models/transaction-queries.js';
import { dataAccess } from '../data/data-access.js';
import { useAccountStore } from './account-store.js';

interface TransactionStore {
  // 当前页交易列表 + 总数（服务端分页）
  // Current page items + total count (server-side pagination)
  pagedTransactions: Transaction[];
  total: number;
  // 近期交易（仪表盘用，独立分页通道）
  // Recent transactions (for dashboard, independent paging channel)
  recentTransactions: Transaction[];
  loading: boolean;
  error: string | null;

  fetchTransactionPage: (userId: string, params: TransactionPageParams) => Promise<void>;
  fetchRecentTransactions: (userId: string, limit: number) => Promise<void>;
  createTransaction: (userId: string, input: CreateTransactionInput) => Promise<void>;
  editTransaction: (userId: string, id: string, input: EditTransactionInput) => Promise<void>;
  deleteTransaction: (userId: string, id: string) => Promise<void>;
  // 局部更新辅助 / Local update helpers
  upsertLocal: (tx: Transaction) => void;
  removeLocal: (id: string) => void;
  clear: () => void;
}

export const useTransactionStore = create<TransactionStore>((set, get) => ({
  pagedTransactions: [],
  total: 0,
  recentTransactions: [],
  loading: false,
  error: null,

  fetchTransactionPage: async (userId, params) => {
    set({ loading: true, error: null });
    try {
      const { items, total } = await dataAccess.getTransactionsPage(userId, params);
      set({ pagedTransactions: items, total, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  fetchRecentTransactions: async (userId, limit) => {
    set({ loading: true, error: null });
    try {
      const recent = await dataAccess.getRecentTransactions(userId, limit);
      set({ recentTransactions: recent, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  createTransaction: async (userId, input) => {
    set({ loading: true, error: null });
    try {
      const tx = await dataAccess.createTransaction(input);
      // 局部更新：新交易插入列表头部 + 总数 +1
      // Local update: unshift new tx + increment total
      get().upsertLocal(tx);
      set((s) => ({ total: s.total + 1, loading: false }));
      // 联动刷新账户列表（交易影响余额）
      // Refresh accounts (transaction affects balances)
      useAccountStore.getState().fetchAccounts(userId);
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  editTransaction: async (userId, id, input) => {
    set({ loading: true, error: null });
    try {
      const tx = await dataAccess.editTransaction(id, input);
      // 局部更新：替换对应记录
      // Local update: replace matching record
      get().upsertLocal(tx);
      set({ loading: false });
      useAccountStore.getState().fetchAccounts(userId);
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  deleteTransaction: async (userId, id) => {
    set({ loading: true, error: null });
    try {
      await dataAccess.deleteTransaction(id);
      // 局部更新：移除记录 + 总数 -1
      // Local update: remove record + decrement total
      get().removeLocal(id);
      set((s) => ({ total: Math.max(0, s.total - 1), loading: false }));
      useAccountStore.getState().fetchAccounts(userId);
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  upsertLocal: (tx) => set((s) => {
    // pagedTransactions: 替换已存在 or 插入头部
    // pagedTransactions: replace existing or unshift
    const existingIdx = s.pagedTransactions.findIndex((t) => t.id === tx.id);
    const pagedTransactions = existingIdx >= 0
      ? s.pagedTransactions.map((t) => (t.id === tx.id ? tx : t))
      : [tx, ...s.pagedTransactions];
    // recentTransactions: 同样 upsert（仪表盘近期列表）
    // recentTransactions: same upsert (dashboard recent list)
    const recentIdx = s.recentTransactions.findIndex((t) => t.id === tx.id);
    const recentTransactions = recentIdx >= 0
      ? s.recentTransactions.map((t) => (t.id === tx.id ? tx : t))
      : [tx, ...s.recentTransactions];
    return { pagedTransactions, recentTransactions };
  }),

  removeLocal: (id) => set((s) => ({
    pagedTransactions: s.pagedTransactions.filter((t) => t.id !== id),
    recentTransactions: s.recentTransactions.filter((t) => t.id !== id),
  })),

  clear: () => set({
    pagedTransactions: [],
    total: 0,
    recentTransactions: [],
    error: null,
    loading: false,
  }),
}));
