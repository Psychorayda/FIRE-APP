// 净资产卡片 / Net worth cards
// 展示 3 张卡：总资产 / 总负债 / 净资产
// Display 3 cards: total assets / total liability / net worth

import { Card } from '../base/Card.js';
import { formatAmount } from '../transactions/transaction-constants.js';
import type { NetWorthSummary } from './dashboard-constants.js';

interface NetWorthCardsProps {
  summary: NetWorthSummary;
}

export function NetWorthCards({ summary }: NetWorthCardsProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {/* 总资产卡 / Total assets card */}
      <Card>
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-sm text-gray-500">总资产</span>
        </div>
        <div className="text-xl font-semibold text-gray-900">{formatAmount(summary.totalAssets)}</div>
      </Card>

      {/* 总负债卡 / Total liability card */}
      <Card>
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
          <span className="text-sm text-gray-500">总负债</span>
        </div>
        <div className="text-xl font-semibold text-gray-900">{formatAmount(summary.totalLiability)}</div>
      </Card>

      {/* 净资产卡 / Net worth card */}
      <Card>
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
          <span className="text-sm text-gray-500">净资产</span>
        </div>
        <div className={`text-xl font-semibold ${summary.netWorth < 0 ? 'text-red-600' : 'text-gray-900'}`}>
          {formatAmount(summary.netWorth)}
        </div>
      </Card>
    </div>
  );
}
