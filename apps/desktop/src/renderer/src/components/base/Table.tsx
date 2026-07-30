// 表格组件 / Table component
// 支持虚拟化滚动：行数超过阈值时仅渲染可见 + overscan 行
// Supports virtualized scrolling: only visible + overscan rows rendered above threshold

import { useRef } from 'react';
import type { ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

export interface TableColumn<T> {
  key: string;
  title: string;
  render?: (record: T) => ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  loading?: boolean;
  emptyText?: string;
  onRowClick?: (record: T) => void;
}

// 虚拟化启用阈值：行数超过此值才启用虚拟滚动
// 小数据直接渲染全部行，避免测试/小列表场景下的复杂度（getByText 可正常命中）
// Virtualization threshold: only enable virtual scroll when rows exceed this count.
// Small datasets render all rows directly so tests/small lists work with getByText.
const VIRTUALIZE_THRESHOLD = 20;
// 行高估算（px）/ Estimated row height (px)
const ROW_HEIGHT = 48;
// overscan 行数 / overscan row count
const OVERSCAN = 10;

export function Table<T extends { id?: string }>({ columns, data, loading, emptyText = '暂无数据', onRowClick }: TableProps<T>) {
  const alignClass = (align?: string) => {
    switch (align) {
      case 'center': return 'text-center';
      case 'right': return 'text-right';
      default: return 'text-left';
    }
  };

  const parentRef = useRef<HTMLDivElement>(null);
  // 仅在有数据且非 loading、行数超过阈值时启用虚拟化
  // Enable virtualization only when not loading and rows exceed threshold
  const enableVirtual = !loading && data.length > VIRTUALIZE_THRESHOLD;
  const virtualizer = useVirtualizer({
    count: enableVirtual ? data.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  });

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400">
        加载中...
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400">
        {emptyText}
      </div>
    );
  }

  // 非虚拟化路径：直接渲染全部行（小数据 / 测试场景）
  // Non-virtualized path: render all rows directly (small data / tests)
  if (!enableVirtual) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-4 py-3 text-sm font-medium text-gray-600 ${alignClass(col.align)}`}
                    style={col.width ? { width: col.width } : undefined}
                  >
                    {col.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((record, index) => (
                <tr
                  key={record.id ?? index}
                  onClick={() => onRowClick?.(record)}
                  className={`border-b border-gray-100 last:border-0 ${onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`px-4 py-3 text-sm text-gray-900 ${alignClass(col.align)}`}>
                      {col.render ? col.render(record) : (record as Record<string, unknown>)[col.key] as ReactNode}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // 虚拟化路径：只渲染可见 + overscan 行 / Virtualized path: render only visible + overscan rows
  const virtualItems = virtualizer.getVirtualItems();
  return (
    <div ref={parentRef} className="bg-white rounded-lg border border-gray-200 overflow-auto" style={{ maxHeight: '600px' }}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-sm font-medium text-gray-600 ${alignClass(col.align)}`}
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
            {virtualItems.map((virtualItem) => {
              const record = data[virtualItem.index];
              return (
                <tr
                  key={record.id ?? virtualItem.index}
                  onClick={() => onRowClick?.(record)}
                  style={{
                    position: 'absolute',
                    top: 0,
                    transform: `translateY(${virtualItem.start}px)`,
                    height: `${virtualItem.size}px`,
                    width: '100%',
                  }}
                  className={`border-b border-gray-100 ${onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`px-4 py-3 text-sm text-gray-900 ${alignClass(col.align)}`}>
                      {col.render ? col.render(record) : (record as Record<string, unknown>)[col.key] as ReactNode}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
