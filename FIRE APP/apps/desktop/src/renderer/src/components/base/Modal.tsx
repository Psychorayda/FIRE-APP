// 模态弹窗组件 / Modal component

import type { ReactNode } from 'react';
import { useEffect } from 'react';

interface ModalProps {
  open: boolean;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  width?: number;
}

export function Modal({ open, title, children, footer, onClose, width = 480 }: ModalProps) {
  useEffect(() => {
    if (open) {
      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black opacity-40" onClick={onClose} />
      <div
        className="relative bg-white rounded-lg shadow-lg"
        style={{ width: `${width}px` }}
      >
        {title && (
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          </div>
        )}
        <div className="px-6 py-4">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
