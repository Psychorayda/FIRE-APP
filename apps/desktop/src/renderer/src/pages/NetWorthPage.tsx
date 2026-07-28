// 净资产趋势页 / Net worth trend page
// 趋势折线图（4 指标×4 时间范围）+ 资产配比环形图 + 配比明细列表
// Trend line chart (4 metrics × 4 ranges) + allocation donut + detail list

import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../stores/app-store.js';
import { useSnapshotStore } from '../stores/snapshot-store.js';
import {
  filterByTimeRange,
  formatTrendForMetric,
  getAllocationData,
} from '../components/net-worth/net-worth-constants.js';
import type { TimeRangeKey, MetricKey } from '../components/net-worth/net-worth-constants.js';
import { TrendChart } from '../components/net-worth/TrendChart.js';
import { AllocationDonut } from '../components/net-worth/AllocationDonut.js';
import { AllocationDetail } from '../components/net-worth/AllocationDetail.js';

export function NetWorthPage() {
  const currentUser = useAppStore((s) => s.currentUser);
  const { snapshots, loading, error, fetchSnapshots } = useSnapshotStore();

  const [timeRange, setTimeRange] = useState<TimeRangeKey>('6m');
  const [metric, setMetric] = useState<MetricKey>('netWorth');

  useEffect(() => {
    if (currentUser) fetchSnapshots(currentUser.id);
  }, [currentUser]);

  const filteredSnapshots = useMemo(
    () => filterByTimeRange(snapshots, timeRange),
    [snapshots, timeRange]
  );
  const trendData = useMemo(
    () => formatTrendForMetric(filteredSnapshots, metric),
    [filteredSnapshots, metric]
  );
  const allocationData = useMemo(
    () => getAllocationData(snapshots),
    [snapshots]
  );

  return (
    <div className="p-8 space-y-6">
      {/* 页头 */}
      <h1 className="text-2xl font-bold text-gray-900">净资产趋势</h1>

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          数据加载失败，请重试
        </div>
      )}

      {/* 趋势折线图 */}
      <TrendChart
        data={trendData}
        metric={metric}
        timeRange={timeRange}
        loading={loading}
        onMetricChange={setMetric}
        onTimeRangeChange={setTimeRange}
      />

      {/* 资产配比 + 明细（grid 2 列） */}
      <div className="grid grid-cols-2 gap-4">
        <AllocationDonut data={allocationData} loading={loading} />
        <AllocationDetail data={allocationData} />
      </div>
    </div>
  );
}
