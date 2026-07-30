// 投影结果卡片 / Projection result cards
// 4 张卡：FIRE Number / 调整后 / 当前进度 / 退休时资产
// 4 cards: FIRE Number / adjusted / progress / retirement portfolio

import type { ProjectionResult } from '@shared/services/fire-calc.js';
import { formatFireAmount, formatProgress } from './fire-calc-constants.js';
import { Card } from '../base/Card.js';
import { useCurrency } from '../../hooks/use-currency.js';

interface ResultCardsProps {
  result: ProjectionResult | null;
  loading: boolean;
}

interface CardConfig {
  label: string;
  value: string;
  dotClass: string;
}

function buildCards(result: ProjectionResult | null, loading: boolean, currency: string): CardConfig[] {
  if (loading) {
    return [
      { label: 'FIRE Number', value: '加载中...', dotClass: 'bg-blue-500' },
      { label: '调整后 FIRE Number', value: '加载中...', dotClass: 'bg-indigo-500' },
      { label: '当前进度', value: '加载中...', dotClass: 'bg-green-500' },
      { label: '退休时资产', value: '加载中...', dotClass: 'bg-purple-500' },
    ];
  }
  if (!result) {
    return [
      { label: 'FIRE Number', value: '暂无数据', dotClass: 'bg-blue-500' },
      { label: '调整后 FIRE Number', value: '暂无数据', dotClass: 'bg-indigo-500' },
      { label: '当前进度', value: '暂无数据', dotClass: 'bg-green-500' },
      { label: '退休时资产', value: '暂无数据', dotClass: 'bg-purple-500' },
    ];
  }
  return [
    { label: 'FIRE Number', value: formatFireAmount(result.fire_number, currency), dotClass: 'bg-blue-500' },
    { label: '调整后 FIRE Number', value: formatFireAmount(result.adjusted_fire_number, currency), dotClass: 'bg-indigo-500' },
    { label: '当前进度', value: formatProgress(result.progress), dotClass: 'bg-green-500' },
    { label: '退休时资产', value: formatFireAmount(result.retirement_portfolio, currency), dotClass: 'bg-purple-500' },
  ];
}

export function ResultCards({ result, loading }: ResultCardsProps) {
  const currency = useCurrency();
  const cards = buildCards(result, loading, currency);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <div className="flex items-center gap-2 mb-2">
            <span className={`inline-block w-2 h-2 rounded-full ${c.dotClass}`} />
            <span className="text-sm text-gray-500">{c.label}</span>
          </div>
          <div className="text-lg font-semibold text-gray-900">{c.value}</div>
        </Card>
      ))}
    </div>
  );
}
