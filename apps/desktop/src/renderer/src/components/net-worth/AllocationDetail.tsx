// 配比明细列表 / Allocation detail list
// 展示 4 类资产金额+百分比，底部净资产合计
// Shows 4-class asset amount+percent, net worth total at bottom

import { Card } from '../base/Card.js';
import { EmptyState } from '../auxiliary/EmptyState.js';
import { formatYuan } from './net-worth-constants.js';
import type { AllocationData } from './net-worth-constants.js';

interface AllocationDetailProps {
  data: AllocationData;
}

export function AllocationDetail({ data }: AllocationDetailProps) {
  return (
    <Card title="明细">
      {!data.hasData ? (
        <EmptyState title="暂无明细数据" description="继续使用以积累" />
      ) : (
        <div className="space-y-3">
          {/* 4 类资产明细 */}
          {/* 4-class asset details */}
          {data.items.map(item => (
            <div key={item.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm text-gray-700">{item.name}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-900">{formatYuan(item.value)}</span>
                <span className="text-sm text-gray-500 w-16 text-right">{item.percent.toFixed(1)}%</span>
              </div>
            </div>
          ))}

          {/* 分隔线 */}
          {/* Divider */}
          <div className="border-t border-gray-200 my-2" />

          {/* 净资产合计 */}
          {/* Net worth total */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-900">净资产</span>
            <span className={`text-sm font-semibold ${data.netWorth < 0 ? 'text-red-600' : 'text-gray-900'}`}>
              {formatYuan(data.netWorth)}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}
