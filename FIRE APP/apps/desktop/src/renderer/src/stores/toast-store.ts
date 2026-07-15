// Toast 通知状态管理 / Toast notification state management

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration: number;
}

interface ToastStore {
  toasts: ToastItem[];
  show: (type: ToastItem['type'], message: string, duration?: number) => void;
  showSuccess: (message: string, duration?: number) => void;
  showError: (message: string, duration?: number) => void;
  showWarning: (message: string, duration?: number) => void;
  showInfo: (message: string, duration?: number) => void;
  remove: (id: string) => void;
  clear: () => void;
}

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],

  show: (type, message, duration = 3000) => {
    const id = uuidv4();
    set((state) => ({ toasts: [...state.toasts, { id, type, message, duration }] }));
    if (duration > 0) {
      setTimeout(() => {
        get().remove(id);
      }, duration);
    }
  },

  showSuccess: (message, duration) => get().show('success', message, duration),
  showError: (message, duration) => get().show('error', message, duration),
  showWarning: (message, duration) => get().show('warning', message, duration),
  showInfo: (message, duration) => get().show('info', message, duration),

  remove: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));
