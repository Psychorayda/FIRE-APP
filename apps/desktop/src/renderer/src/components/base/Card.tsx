// 卡片组件 / Card component

import type { ReactNode } from 'react';

interface CardProps {
  title?: string;
  extra?: ReactNode;
  children: ReactNode;
  padding?: boolean;
}

export function Card({ title, extra, children, padding = true }: CardProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {(title || extra) && (
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          {title && <h3 className="text-base font-semibold text-gray-900">{title}</h3>}
          {extra}
        </div>
      )}
      <div className={padding ? 'p-6' : ''}>{children}</div>
    </div>
  );
}
