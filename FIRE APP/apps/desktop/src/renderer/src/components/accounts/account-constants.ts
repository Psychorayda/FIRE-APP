// 账户相关常量与格式化函数 / Account constants and formatting helpers

import type { Account, AssetClass, AccountType } from '@shared/types/index.js';
import { centsToYuan } from '@shared/utils/money.js';

/** 资产分类配置：标签、色点类名、标签类名（raw Tailwind） */
export const ASSET_CLASS_CONFIG: Record<AssetClass, { label: string; dotClass: string; tagClass: string }> = {
  liquid: { label: '流动资产', dotClass: 'bg-blue-500', tagClass: 'bg-blue-100 text-blue-700' },
  invested: { label: '投资资产', dotClass: 'bg-purple-500', tagClass: 'bg-purple-100 text-purple-700' },
  use_asset: { label: '使用资产', dotClass: 'bg-orange-500', tagClass: 'bg-orange-100 text-orange-700' },
  liability: { label: '负债', dotClass: 'bg-red-500', tagClass: 'bg-red-100 text-red-700' },
};

/** 账户类型中文名映射 */
export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: '活期存款',
  savings: '储蓄账户',
  cash: '现金',
  investment: '投资账户',
  retirement: '退休账户',
  fund: '基金',
  real_estate: '房产',
  vehicle: '车辆',
  credit_card: '信用卡',
  loan: '贷款',
  mortgage: '房贷',
};

/** 资产分类选项（供 Select 组件使用） */
export const ASSET_CLASS_OPTIONS = (Object.keys(ASSET_CLASS_CONFIG) as AssetClass[]).map((cls) => ({
  label: ASSET_CLASS_CONFIG[cls].label,
  value: cls,
}));

/** 账户类型选项（供 Select 组件使用） */
export const ACCOUNT_TYPE_OPTIONS = (Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[]).map((t) => ({
  label: ACCOUNT_TYPE_LABELS[t],
  value: t,
}));

/** 分转元并格式化为人民币货币字符串（负数自然显示为 -¥） */
export function formatBalance(cents: number): string {
  const yuan = centsToYuan(cents);
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
  }).format(yuan);
}

/** 资产概览聚合结果 */
export interface AccountOverview {
  liquid: number;
  invested: number;
  use_asset: number;
  liability: number;
  net_worth: number;
  counts: { liquid: number; invested: number; use_asset: number; liability: number };
}

/** 从 accounts 数组前端计算资产概览（无 IPC 往返） */
export function computeOverview(accounts: Account[]): AccountOverview {
  const result: AccountOverview = {
    liquid: 0, invested: 0, use_asset: 0, liability: 0, net_worth: 0,
    counts: { liquid: 0, invested: 0, use_asset: 0, liability: 0 },
  };
  for (const acc of accounts) {
    result[acc.asset_class] += acc.current_balance;
    result.counts[acc.asset_class]++;
    result.net_worth += acc.current_balance;
  }
  return result;
}
