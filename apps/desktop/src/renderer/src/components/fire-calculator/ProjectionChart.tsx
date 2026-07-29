// 投影面积图 / Projection area chart
// Recharts AreaChart，展示余额随年龄变化，含 FIRE Number 参考线
// Recharts AreaChart, balance over age, with FIRE Number reference line

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { MonthlyProjectionPoint } from '@shared/services/fire-calc.js';
import { Card } from '../base/Card.js';
import { EmptyState } from '../auxiliary/EmptyState.js';
import { formatProjectionForChart, formatFireAmount } from './fire-calc-constants.js';

interface ProjectionChartProps {
  data: MonthlyProjectionPoint[];
  fireNumber: number; // 分
  loading: boolean;
}

export function ProjectionChart({ data, fireNumber, loading }: ProjectionChartProps) {
  const chartData = formatProjectionForChart(data, fireNumber);
  const fireNumberYuan = fireNumber / 100;

  return (
    <Card title="投影">
      {loading ? (
        <div className="py-12 text-center text-gray-400">加载中...</div>
      ) : chartData.length === 0 ? (
        <EmptyState title="暂无投影数据" />
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
              <defs>
                <linearGradient id="colorAccumulation" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="colorRetirement" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <XAxis dataKey="age" tick={{ fontSize: 12 }} stroke="#9ca3af" />
              <YAxis hide />
              <Tooltip
                formatter={(value: number) => [formatFireAmount(value * 100), '余额']}
                labelFormatter={(label) => `年龄: ${label}`}
              />
              <ReferenceLine y={fireNumberYuan} stroke="#EF4444" strokeDasharray="5 5" />
              <Area
                type="monotone"
                dataKey="balance"
                stroke="#10B981"
                strokeWidth={2}
                fill="url(#colorAccumulation)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
