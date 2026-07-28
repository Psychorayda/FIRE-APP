// 净资产趋势图 / Net worth trend chart
// Recharts 折线图，展示近 6 个月净资产变化
// Recharts line chart, showing net worth over last 6 months

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Card } from '../base/Card.js';
import { EmptyState } from '../auxiliary/EmptyState.js';
import type { TrendPoint } from './dashboard-constants.js';

interface NetWorthTrendChartProps {
  data: TrendPoint[];
  loading: boolean;
}

export function NetWorthTrendChart({ data, loading }: NetWorthTrendChartProps) {
  return (
    <Card title="净资产趋势（近 6 个月）">
      {loading ? (
        <div className="py-12 text-center text-gray-400">加载中...</div>
      ) : data.length === 0 ? (
        <EmptyState
          title="暂无趋势数据"
          description="继续使用以积累"
        />
      ) : data.length === 1 ? (
        <EmptyState
          title="仅 1 个月数据"
          description="需至少 2 个月显示趋势"
        />
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#9ca3af" />
              <YAxis hide />
              <Tooltip
                formatter={(value: number) => [`¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`, '净资产']}
                labelFormatter={(label) => `月份: ${label}`}
              />
              <Line
                type="monotone"
                dataKey="netWorth"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
