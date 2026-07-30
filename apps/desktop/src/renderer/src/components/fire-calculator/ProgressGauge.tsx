// 环形进度仪表盘 / Radial progress gauge
// Recharts RadialBarChart，中心显示百分比，底部标注当前值→FIRE Number
// Recharts RadialBarChart, center shows percent, bottom shows current→FIRE Number

import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import { Card } from '../base/Card.js';
import { formatFireAmount, formatProgress } from './fire-calc-constants.js';
import { useCurrency } from '../../hooks/use-currency.js';

interface ProgressGaugeProps {
  progress: number;       // 0-100
  fireNumber: number;     // 分
  currentValue: number;   // 分
}

export function ProgressGauge({ progress, fireNumber, currentValue }: ProgressGaugeProps) {
  const currency = useCurrency();
  const data = [{ name: 'progress', value: progress, fill: '#3b82f6' }];
  const clamped = Math.min(100, Math.max(0, progress));

  return (
    <Card title="进度">
      <div className="relative h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            innerRadius="70%"
            outerRadius="100%"
            data={data}
            startAngle={90}
            endAngle={-270}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar background dataKey="value" cornerRadius={10} />
          </RadialBarChart>
        </ResponsiveContainer>
        {/* 中心百分比 */}
        {/* Center percent */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-semibold text-gray-900">{formatProgress(clamped)}</span>
        </div>
      </div>
      <div className="mt-2 text-center text-xs text-gray-500">
        {formatFireAmount(currentValue, currency)} → {formatFireAmount(fireNumber, currency)}
      </div>
    </Card>
  );
}
