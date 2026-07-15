// Toast 通知组件 / Toast notification component

import { useToastStore } from '../../stores/toast-store.js';
import type { ToastItem } from '../../stores/toast-store.js';

const TYPE_CLASSES: Record<ToastItem['type'], string> = {
  success: 'bg-emerald-600 text-white',
  error: 'bg-red-500 text-white',
  warning: 'bg-amber-500 text-white',
  info: 'bg-blue-600 text-white',
};

const TYPE_ICONS: Record<ToastItem['type'], string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

export function Toast() {
  const toasts = useToastStore((s) => s.toasts);
  const remove = useToastStore((s) => s.remove);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-2 px-4 py-3 rounded-md shadow-lg min-w-64 ${TYPE_CLASSES[toast.type]}`}
        >
          <span className="font-bold">{TYPE_ICONS[toast.type]}</span>
          <span className="text-sm flex-1">{toast.message}</span>
          <button
            onClick={() => remove(toast.id)}
            className="text-white opacity-70 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
