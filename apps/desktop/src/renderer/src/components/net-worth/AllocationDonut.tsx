// 资产配比环形图 / Allocation donut chart
// Recharts PieChart，展示最新月份 4 类资产占比
// Recharts PieChart, showing latest month 4-class asset allocation

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Card } from '../base/Card.js';
import { EmptyState } from '../auxiliary/EmptyState.js';
import { formatYuan } from './net-worth-constants.js';
import { useCurrency } from '../../hooks/use-currency.js';
import type { AllocationData } from './net-worth-constants.js';

interface AllocationDonutProps {
  data: AllocationData;
  loading: boolean;
}

export function AllocationDonut({ data, loading }: AllocationDonutProps) {
  const currency = useCurrency();
  return (
    <Card title="资产配比（最新月份）">
      {loading ? (
        <div className="py-12 text-center text-gray-400">加载中...</div>
      ) : !data.hasData ? (
        <EmptyState title="暂无配比数据" description="继续使用以积累" />
      ) : (
        <div className="relative h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.items}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
              >
                {data.items.map((item, index) => (
                  <Cell key={index} fill={item.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          {/* 中心显示净资产 */}
          {/* Center: net worth */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xs text-gray-500">净资产</span>
            <span className="text-lg font-semibold text-gray-900">{formatYuan(data.netWorth, currency)}</span>
          </div>
        </div>
      )}
    </Card>
  );
}
