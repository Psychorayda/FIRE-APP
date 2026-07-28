// 交易概览卡片 / Transaction overview cards
// 展示 3 张卡：收入（含 initial_balance）/ 支出 / 结余
// Display 3 cards: income (incl. initial_balance) / expense / balance

import type { Transaction } from '@shared/types/index.js';
import { Card } from '../base/Card.js';
import { computeOverview, formatAmount } from './transaction-constants.js';

interface TransactionOverviewCardsProps {
  transactions: Transaction[];
}

export function TransactionOverviewCards({ transactions }: TransactionOverviewCardsProps) {
  const overview = computeOverview(transactions);

  return (
    <div className="grid grid-cols-3 gap-4">
      {/* 收入卡 / Income card */}
      <Card>
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
          <span className="text-sm text-gray-500">收入</span>
        </div>
        <div className="text-xl font-semibold text-gray-900">{formatAmount(overview.income)}</div>
      </Card>

      {/* 支出卡 / Expense card */}
      <Card>
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
          <span className="text-sm text-gray-500">支出</span>
        </div>
        <div className="text-xl font-semibold text-gray-900">{formatAmount(overview.expense)}</div>
      </Card>

      {/* 结余卡 / Balance card */}
      <Card>
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-sm text-gray-500">结余</span>
        </div>
        <div className={`text-xl font-semibold ${overview.balance < 0 ? 'text-red-600' : 'text-gray-900'}`}>
          {formatAmount(overview.balance)}
        </div>
      </Card>
    </div>
  );
}
