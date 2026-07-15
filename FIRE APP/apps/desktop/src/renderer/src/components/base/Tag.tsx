// 标签组件 / Tag component

import type { ReactNode } from 'react';

interface TagProps {
  color: 'blue' | 'green' | 'red' | 'amber' | 'gray';
  children: ReactNode;
}

const COLOR_CLASSES: Record<TagProps['color'], string> = {
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  gray: 'bg-gray-50 text-gray-700 border-gray-200',
};

export function Tag({ color, children }: TagProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${COLOR_CLASSES[color]}`}>
      {children}
    </span>
  );
}
