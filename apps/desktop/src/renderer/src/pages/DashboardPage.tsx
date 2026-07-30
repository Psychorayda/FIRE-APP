// 仪表盘页 / Dashboard page
// 信息聚合中心：净资产 3 卡 + 本月收支 3 卡 + 净资产趋势图 + 近期交易表
// Aggregation hub: net worth cards + monthly overview + trend chart + recent transactions
// 数据来自 SQL 聚合查询（recent + monthlyOverview），不再前端全量计算
// Data sourced from SQL aggregation queries (recent + monthlyOverview), no frontend full-scan

import { useEffect, useMemo, useState } from 'react';
import type { Account, Transaction, NetWorthSnapshot } from '@shared/types/index.js';
import type { MonthlyOverview } from '@shared/models/transaction-queries.js';
import { useAppStore } from '../stores/app-store.js';
import { dataAccess } from '../data/data-access.js';
import type { TransactionOverview } from '../components/transactions/transaction-constants.js';
import {
  computeNetWorthSummary,
  formatTrendData,
} from '../components/dashboard/dashboard-constants.js';
import { NetWorthCards } from '../components/dashboard/NetWorthCards.js';
import { MonthlyOverviewCards } from '../components/dashboard/MonthlyOverviewCards.js';
import { NetWorthTrendChart } from '../components/dashboard/NetWorthTrendChart.js';
import { RecentTransactions } from '../components/dashboard/RecentTransactions.js';

// 当前月份 YYYY-MM（本地时区）/ Current month YYYY-MM (local timezone)
function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// SQL 聚合结果 → TransactionOverview（补 balance 字段）
// SQL aggregation result → TransactionOverview (fill balance field)
function toOverview(m: MonthlyOverview): TransactionOverview {
  return { ...m, balance: m.income - m.expense };
}

export function DashboardPage() {
  const currentUser = useAppStore((s) => s.currentUser);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [snapshots, setSnapshots] = useState<NetWorthSnapshot[]>([]);
  const [monthlyOverview, setMonthlyOverview] = useState<TransactionOverview>({
    income: 0, expense: 0, transfer: 0, balance: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 拉数据 + 自动生成当月快照 / Fetch data + auto-generate monthly snapshot
  useEffect(() => {
    if (!currentUser?.id) return;
    const userId = currentUser.id;

    Promise.all([
      dataAccess.getAccounts(userId),
      dataAccess.getRecentTransactions(userId, 10),
      dataAccess.getSnapshots(userId),
      dataAccess.getMonthlyOverview(userId, currentYearMonth()),
    ])
      .then(([accs, recent, snaps, overview]) => {
        setAccounts(accs);
        setRecentTransactions(recent);
        setSnapshots(snaps);
        setMonthlyOverview(toOverview(overview));
      })
      .catch(() => setError('数据加载失败，请重试'))
      .finally(() => setLoading(false));

    // 快照生成不阻塞主流程，静默失败 / Snapshot generation doesn't block, silent fail
    dataAccess.generateMonthlySnapshot(userId)
      .then((newSnapshot) => {
        if (newSnapshot) {
          // 新生成了快照，刷新列表 / New snapshot generated, refresh list
          dataAccess.getSnapshots(userId).then(setSnapshots).catch(() => {});
        }
      })
      .catch(() => {});
  }, [currentUser]);

  // 派生数据 / Derived data
  const netWorthSummary = useMemo(() => computeNetWorthSummary(accounts), [accounts]);
  const trendData = useMemo(() => formatTrendData(snapshots), [snapshots]);

  return (
    <div className="p-8 space-y-6">
      {/* 页头 / Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">仪表盘</h1>
        {currentUser && (
          <span className="text-sm text-gray-500">欢迎回来，{currentUser.display_name}</span>
        )}
      </div>

      {/* 错误提示 / Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* 净资产 3 卡 / Net worth cards */}
      <NetWorthCards summary={netWorthSummary} />

      {/* 本月收支 3 卡 / Monthly overview cards */}
      <MonthlyOverviewCards overview={monthlyOverview} />

      {/* 净资产趋势图 / Net worth trend chart */}
      <NetWorthTrendChart data={trendData} loading={loading} />

      {/* 近期交易 / Recent transactions */}
      <RecentTransactions transactions={recentTransactions} accounts={accounts} />
    </div>
  );
}
