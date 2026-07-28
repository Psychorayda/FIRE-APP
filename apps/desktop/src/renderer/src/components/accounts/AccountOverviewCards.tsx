// 账户概览卡片 / Account overview cards
// 展示 4 张分类卡 + 1 张净资产卡，数据从 accounts 数组前端聚合

import type { Account, AssetClass } from '@shared/types/index.js';
import { Card } from '../base/Card.js';
import { ASSET_CLASS_CONFIG, formatBalance, computeOverview } from './account-constants.js';

interface AccountOverviewCardsProps {
  accounts: Account[];
}

const ORDER: AssetClass[] = ['liquid', 'invested', 'use_asset', 'liability'];

export function AccountOverviewCards({ accounts }: AccountOverviewCardsProps) {
  const overview = computeOverview(accounts);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        {ORDER.map((cls) => {
          const config = ASSET_CLASS_CONFIG[cls];
          return (
            <Card key={cls}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`inline-block w-2 h-2 rounded-full ${config.dotClass}`} />
                <span className="text-sm text-gray-500">{config.label}</span>
              </div>
              <div className="text-xl font-semibold text-gray-900">{formatBalance(overview[cls])}</div>
              <div className="text-xs text-gray-400 mt-1">{overview.counts[cls]} 个账户</div>
            </Card>
          );
        })}
      </div>
      <Card>
        <div className="flex items-center justify-between">
          <span className="text-base font-medium text-gray-700">净资产</span>
          <span className={`text-2xl font-bold ${overview.net_worth < 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {formatBalance(overview.net_worth)}
          </span>
        </div>
      </Card>
    </div>
  );
}
