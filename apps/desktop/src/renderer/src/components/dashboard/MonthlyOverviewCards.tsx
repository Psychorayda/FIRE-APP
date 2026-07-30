// 本月收支卡片 / Monthly overview cards
// 展示 3 张卡：本月收入 / 本月支出 / 本月结余
// 复用 M4 的 TransactionOverview 类型和 formatAmount
// Display 3 cards: monthly income / expense / balance

import { Card } from '../base/Card.js';
import { formatAmount, type TransactionOverview } from '../transactions/transaction-constants.js';
import { useCurrency } from '../../hooks/use-currency.js';

interface MonthlyOverviewCardsProps {
  overview: TransactionOverview;
}

export function MonthlyOverviewCards({ overview }: MonthlyOverviewCardsProps) {
  const currency = useCurrency();
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* 本月收入卡 / Monthly income card */}
      <Card>
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
          <span className="text-sm text-gray-500">本月收入</span>
        </div>
        <div className="text-xl font-semibold text-gray-900">{formatAmount(overview.income, currency)}</div>
      </Card>

      {/* 本月支出卡 / Monthly expense card */}
      <Card>
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
          <span className="text-sm text-gray-500">本月支出</span>
        </div>
        <div className="text-xl font-semibold text-gray-900">{formatAmount(overview.expense, currency)}</div>
      </Card>

      {/* 本月结余卡 / Monthly balance card */}
      <Card>
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-sm text-gray-500">本月结余</span>
        </div>
        <div className={`text-xl font-semibold ${overview.balance < 0 ? 'text-red-600' : 'text-gray-900'}`}>
          {formatAmount(overview.balance, currency)}
        </div>
      </Card>
    </div>
  );
}
