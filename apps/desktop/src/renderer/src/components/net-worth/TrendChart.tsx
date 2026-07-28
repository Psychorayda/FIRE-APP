// 趋势折线图 / Trend line chart
// Recharts 折线图，支持 4 指标切换 × 4 时间范围切换
// Recharts line chart, supports 4 metrics × 4 time ranges

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Card } from '../base/Card.js';
import { EmptyState } from '../auxiliary/EmptyState.js';
import { TIME_RANGE_CONFIG, METRIC_CONFIG } from './net-worth-constants.js';
import type { TrendPoint, TimeRangeKey, MetricKey } from './net-worth-constants.js';

interface TrendChartProps {
  data: TrendPoint[];
  metric: MetricKey;
  timeRange: TimeRangeKey;
  loading: boolean;
  onMetricChange: (m: MetricKey) => void;
  onTimeRangeChange: (r: TimeRangeKey) => void;
}

export function TrendChart({ data, metric, timeRange, loading, onMetricChange, onTimeRangeChange }: TrendChartProps) {
  const activeMetric = METRIC_CONFIG.find(c => c.key === metric)!;

  return (
    <Card>
      {/* 控件行：时间范围 + 指标 */}
      {/* Controls: time range + metric */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1">
          {TIME_RANGE_CONFIG.map(c => (
            <button
              key={c.key}
              onClick={() => onTimeRangeChange(c.key)}
              className={`px-3 py-1 text-sm rounded ${
                timeRange === c.key
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex gap-3">
          {METRIC_CONFIG.map(c => (
            <label key={c.key} className="flex items-center gap-1 text-sm text-gray-600 cursor-pointer">
              <input
                type="radio"
                name="metric"
                checked={metric === c.key}
                onChange={() => onMetricChange(c.key)}
                className="form-radio"
              />
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: c.color }}
              />
              {c.label}
            </label>
          ))}
        </div>
      </div>

      {/* 图表区域 */}
      {/* Chart area */}
      {loading ? (
        <div className="py-12 text-center text-gray-400">加载中...</div>
      ) : data.length === 0 ? (
        <EmptyState title="暂无趋势数据" description="继续使用以积累" />
      ) : data.length === 1 ? (
        <EmptyState title="仅 1 个月数据，需至少 2 个月显示趋势" />
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#9ca3af" />
              <YAxis hide />
              <Tooltip
                formatter={(value: number) => [`¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`, activeMetric.label]}
                labelFormatter={(label) => `月份: ${label}`}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={activeMetric.color}
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
