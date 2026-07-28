// 图表容器组件 / Chart container component

import type { ReactNode } from 'react';

interface ChartContainerProps {
  loading?: boolean;
  empty?: boolean;
  error?: string | null;
  height?: number;
  children: ReactNode;
  emptyText?: string;
}

export function ChartContainer({ loading, empty, error, height = 300, children, emptyText = '暂无数据' }: ChartContainerProps) {
  const containerStyle = { height: `${height}px` };

  if (loading) {
    return (
      <div className="flex items-center justify-center bg-white rounded-lg border border-gray-200" style={containerStyle}>
        <span className="text-gray-400 text-sm">加载中...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center bg-white rounded-lg border border-red-200" style={containerStyle}>
        <span className="text-red-500 text-sm">{error}</span>
      </div>
    );
  }

  if (empty) {
    return (
      <div className="flex items-center justify-center bg-white rounded-lg border border-gray-200" style={containerStyle}>
        <span className="text-gray-400 text-sm">{emptyText}</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4" style={containerStyle}>
      {children}
    </div>
  );
}
