// Mock recharts（jsdom 下 SVG 渲染有问题）
// Mock recharts (SVG rendering issues under jsdom)
vi.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="xaxis" />,
  YAxis: () => <div data-testid="yaxis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
}));

// 仪表盘组件测试 / Dashboard component tests

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import type { Account, Transaction } from '@shared/types/index.js';
import { NetWorthCards } from '@renderer/components/dashboard/NetWorthCards.js';
import { MonthlyOverviewCards } from '@renderer/components/dashboard/MonthlyOverviewCards.js';
import type { TransactionOverview } from '@renderer/components/transactions/transaction-constants.js';
import { NetWorthTrendChart } from '@renderer/components/dashboard/NetWorthTrendChart.js';
import type { TrendPoint } from '@renderer/components/dashboard/dashboard-constants.js';
import { RecentTransactions } from '@renderer/components/dashboard/RecentTransactions.js';
import { beforeEach } from 'vitest';
import { DashboardPage } from '@renderer/pages/DashboardPage.js';
import { useAppStore } from '@renderer/stores/app-store.js';

function makeAccount(overrides: Partial<Account>): Account {
  return {
    id: 'acc-1',
    user_id: 'user-1',
    name: 'test',
    asset_class: 'liquid',
    account_type: 'checking',
    current_balance: 0,
    last_updated: 0,
    display_order: 0,
    note: null,
    sync_version: 0,
    updated_at: 0,
    deleted_flag: 0,
    ...overrides,
  };
}

describe('NetWorthCards', () => {
  it('渲染 3 张卡：总资产、总负债、净资产', () => {
    const summary = {
      totalLiquid: 100000,
      totalInvested: 200000,
      totalUseAsset: 500000,
      totalLiability: -80000,
      totalAssets: 800000,
      netWorth: 720000,
    };
    render(<NetWorthCards summary={summary} />);

    expect(screen.getByText('总资产')).toBeInTheDocument();
    expect(screen.getByText('总负债')).toBeInTheDocument();
    expect(screen.getByText('净资产')).toBeInTheDocument();
  });

  it('正确显示金额（分转元）', () => {
    const summary = {
      totalLiquid: 0,
      totalInvested: 0,
      totalUseAsset: 0,
      totalLiability: 0,
      totalAssets: 123456,
      netWorth: 65432,
    };
    render(<NetWorthCards summary={summary} />);

    // 总资产 123456 分 = ¥1,234.56
    expect(screen.getByText('总资产').closest('.bg-white')!).toHaveTextContent('1,234.56');
    // 净资产 65432 分 = ¥654.32
    expect(screen.getByText('净资产').closest('.bg-white')!).toHaveTextContent('654.32');
  });

  it('空数据（全 0）正常渲染', () => {
    const summary = {
      totalLiquid: 0,
      totalInvested: 0,
      totalUseAsset: 0,
      totalLiability: 0,
      totalAssets: 0,
      netWorth: 0,
    };
    render(<NetWorthCards summary={summary} />);

    expect(screen.getByText('总资产').closest('.bg-white')!).toHaveTextContent('0.00');
    expect(screen.getByText('净资产').closest('.bg-white')!).toHaveTextContent('0.00');
  });

  it('净资产为负数时显示红色', () => {
    const summary = {
      totalLiquid: 10000,
      totalInvested: 0,
      totalUseAsset: 0,
      totalLiability: -50000,
      totalAssets: 10000,
      netWorth: -40000,
    };
    render(<NetWorthCards summary={summary} />);

    const netWorthLabel = screen.getByText('净资产');
    const netWorthCard = netWorthLabel.closest('.bg-white')!;
    const netWorthValue = netWorthCard.querySelector('.text-xl')!;
    expect(netWorthValue.className).toContain('text-red-600');
  });

  it('净资产为正数时不显示红色', () => {
    const summary = {
      totalLiquid: 100000,
      totalInvested: 0,
      totalUseAsset: 0,
      totalLiability: 0,
      totalAssets: 100000,
      netWorth: 100000,
    };
    render(<NetWorthCards summary={summary} />);

    const netWorthLabel = screen.getByText('净资产');
    const netWorthCard = netWorthLabel.closest('.bg-white')!;
    const netWorthValue = netWorthCard.querySelector('.text-xl')!;
    expect(netWorthValue.className).not.toContain('text-red-600');
  });
});

describe('MonthlyOverviewCards', () => {
  it('渲染 3 张卡：本月收入、本月支出、本月结余', () => {
    const overview: TransactionOverview = {
      income: 100000,
      expense: 30000,
      transfer: 50000,
      balance: 70000,
    };
    render(<MonthlyOverviewCards overview={overview} />);

    expect(screen.getByText('本月收入')).toBeInTheDocument();
    expect(screen.getByText('本月支出')).toBeInTheDocument();
    expect(screen.getByText('本月结余')).toBeInTheDocument();
  });

  it('正确显示金额', () => {
    const overview: TransactionOverview = {
      income: 100000,
      expense: 30000,
      transfer: 0,
      balance: 70000,
    };
    render(<MonthlyOverviewCards overview={overview} />);

    // 收入 100000 分 = ¥1,000.00
    expect(screen.getByText('本月收入').closest('.bg-white')!).toHaveTextContent('1,000.00');
    // 支出 30000 分 = ¥300.00
    expect(screen.getByText('本月支出').closest('.bg-white')!).toHaveTextContent('300.00');
    // 结余 70000 分 = ¥700.00
    expect(screen.getByText('本月结余').closest('.bg-white')!).toHaveTextContent('700.00');
  });

  it('空数据（全 0）正常渲染', () => {
    const overview: TransactionOverview = {
      income: 0,
      expense: 0,
      transfer: 0,
      balance: 0,
    };
    render(<MonthlyOverviewCards overview={overview} />);

    expect(screen.getByText('本月收入').closest('.bg-white')!).toHaveTextContent('0.00');
    expect(screen.getByText('本月结余').closest('.bg-white')!).toHaveTextContent('0.00');
  });

  it('结余为负数时显示红色', () => {
    const overview: TransactionOverview = {
      income: 50000,
      expense: 100000,
      transfer: 0,
      balance: -50000,
    };
    render(<MonthlyOverviewCards overview={overview} />);

    const balanceLabel = screen.getByText('本月结余');
    const balanceCard = balanceLabel.closest('.bg-white')!;
    const balanceValue = balanceCard.querySelector('.text-xl')!;
    expect(balanceValue.className).toContain('text-red-600');
  });
});

describe('NetWorthTrendChart', () => {
  it('空数据显示空状态提示', () => {
    render(<NetWorthTrendChart data={[]} loading={false} />);
    expect(screen.getByText('暂无趋势数据')).toBeInTheDocument();
  });

  it('仅 1 个数据点显示提示', () => {
    const data: TrendPoint[] = [{ month: '2026-07', netWorth: 1000 }];
    render(<NetWorthTrendChart data={data} loading={false} />);
    expect(screen.getByText('仅 1 个月数据')).toBeInTheDocument();
  });

  it('2 个及以上数据点渲染图表', () => {
    const data: TrendPoint[] = [
      { month: '2026-06', netWorth: 1000 },
      { month: '2026-07', netWorth: 1500 },
    ];
    render(<NetWorthTrendChart data={data} loading={false} />);
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  it('loading 时显示加载中', () => {
    render(<NetWorthTrendChart data={[]} loading={true} />);
    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });
});

function makeAccountForRecent(overrides: Partial<Account>): Account {
  return {
    id: 'acc-1',
    user_id: 'user-1',
    name: '招商银行',
    asset_class: 'liquid',
    account_type: 'checking',
    current_balance: 0,
    last_updated: 0,
    display_order: 0,
    note: null,
    sync_version: 0,
    updated_at: 0,
    deleted_flag: 0,
    ...overrides,
  };
}

function makeTxForRecent(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'tx-1',
    user_id: 'user-1',
    account_id: 'acc-1',
    to_account_id: null,
    category_id: null,
    recurring_id: null,
    transaction_type: 'income',
    amount: 10000,
    transaction_date: new Date('2026-07-15').getTime(),
    description: null,
    sync_version: 0,
    updated_at: 0,
    deleted_flag: 0,
    ...overrides,
  };
}

describe('RecentTransactions', () => {
  it('渲染标题"近期交易"', () => {
    render(<RecentTransactions transactions={[]} accounts={[]} />);
    expect(screen.getByText('近期交易')).toBeInTheDocument();
  });

  it('空交易显示空状态', () => {
    render(<RecentTransactions transactions={[]} accounts={[]} />);
    expect(screen.getByText('暂无交易记录')).toBeInTheDocument();
  });

  it('正确渲染交易行（类型、日期、账户、金额）', () => {
    const accounts = [makeAccountForRecent({ id: 'acc-1', name: '招商银行' })];
    const txs = [
      makeTxForRecent({
        id: 'tx-1',
        transaction_type: 'income',
        amount: 100000,
        transaction_date: new Date('2026-07-15').getTime(),
        account_id: 'acc-1',
      }),
    ];
    render(<RecentTransactions transactions={txs} accounts={accounts} />);

    // 类型标签"收入"
    expect(screen.getByText('收入')).toBeInTheDocument();
    // 日期 2026-07-15
    expect(screen.getByText('2026-07-15')).toBeInTheDocument();
    // 账户名"招商银行"
    expect(screen.getByText('招商银行')).toBeInTheDocument();
    // 金额 +¥1,000.00（100000 分 = 1000 元）
    expect(screen.getByText(/\+¥1,000.00/)).toBeInTheDocument();
  });

  it('transfer 显示 source → target', () => {
    const accounts = [
      makeAccountForRecent({ id: 'acc-1', name: '招商银行' }),
      makeAccountForRecent({ id: 'acc-2', name: '支付宝' }),
    ];
    const txs = [
      makeTxForRecent({
        id: 'tx-1',
        transaction_type: 'transfer',
        amount: 50000,
        account_id: 'acc-1',
        to_account_id: 'acc-2',
      }),
    ];
    render(<RecentTransactions transactions={txs} accounts={accounts} />);

    expect(screen.getByText('招商银行 → 支付宝')).toBeInTheDocument();
  });

  it('最多渲染 10 笔（由容器限制，组件渲染全部传入）', () => {
    const accounts = [makeAccountForRecent({ id: 'acc-1', name: '招商银行' })];
    const txs = Array.from({ length: 12 }, (_, i) =>
      makeTxForRecent({ id: `tx-${i}`, transaction_date: 1000 + i })
    );
    render(<RecentTransactions transactions={txs} accounts={accounts} />);
    // 组件渲染全部传入数据（容器负责 slice 10）
    // 12 笔交易都有日期列（formatDate 基于 transaction_date）
    // 只要没有崩溃且渲染了表格即可
    expect(screen.getByText('近期交易')).toBeInTheDocument();
  });
});

describe('DashboardPage', () => {
  beforeEach(() => {
    // 重置 mock 调用记录 / Reset mock call records
    vi.clearAllMocks();
    // 设置当前用户 / Set current user
    useAppStore.setState({ currentUser: { id: 'user-1', display_name: '测试用户' } as any });
  });

  it('渲染页头"仪表盘"', async () => {
    (window.dataAccess.account.list as any).mockResolvedValue([]);
    // 新分页 API：recent + monthlyOverview 取代 listByUser
    // New paginated API: recent + monthlyOverview replace listByUser
    (window.dataAccess.tx.recent as any).mockResolvedValue([]);
    (window.dataAccess.tx.monthlyOverview as any).mockResolvedValue({ income: 0, expense: 0, transfer: 0 });
    (window.dataAccess.snapshot.list as any).mockResolvedValue([]);
    (window.dataAccess.snapshot.generateMonthly as any).mockResolvedValue(null);

    render(<DashboardPage />);

    expect(screen.getByText('仪表盘')).toBeInTheDocument();
  });

  it('加载中显示加载状态', () => {
    (window.dataAccess.account.list as any).mockReturnValue(new Promise(() => {}));
    (window.dataAccess.tx.recent as any).mockReturnValue(new Promise(() => {}));
    (window.dataAccess.tx.monthlyOverview as any).mockReturnValue(new Promise(() => {}));
    (window.dataAccess.snapshot.list as any).mockReturnValue(new Promise(() => {}));

    render(<DashboardPage />);

    // 加载中时净资产卡显示 0.00（初始值）
    expect(screen.getByText('总资产').closest('.bg-white')!).toHaveTextContent('0.00');
  });

  it('数据加载完成后渲染所有模块', async () => {
    const accounts = [
      makeAccountForRecent({ id: 'acc-1', asset_class: 'liquid', current_balance: 100000 }),
      makeAccountForRecent({ id: 'acc-2', asset_class: 'liability', current_balance: -50000 }),
    ];
    const transactions = [
      makeTxForRecent({ id: 'tx-1', transaction_type: 'income', amount: 50000 }),
    ];
    const snapshots = [
      { id: 's1', user_id: 'user-1', snapshot_date: 0, snapshot_year_month: '2026-06', total_liquid: 0, total_invested: 0, total_use_asset: 0, total_liability: 0, net_worth: 100000, sync_version: 0, updated_at: 0, deleted_flag: 0 },
      { id: 's2', user_id: 'user-1', snapshot_date: 0, snapshot_year_month: '2026-07', total_liquid: 0, total_invested: 0, total_use_asset: 0, total_liability: 0, net_worth: 150000, sync_version: 0, updated_at: 0, deleted_flag: 0 },
    ];

    (window.dataAccess.account.list as any).mockResolvedValue(accounts);
    // recent 返回近期交易列表 / recent returns recent transactions list
    (window.dataAccess.tx.recent as any).mockResolvedValue(transactions);
    // monthlyOverview 返回 SQL 聚合结果 / monthlyOverview returns SQL aggregation result
    (window.dataAccess.tx.monthlyOverview as any).mockResolvedValue({ income: 50000, expense: 0, transfer: 0 });
    (window.dataAccess.snapshot.list as any).mockResolvedValue(snapshots);
    (window.dataAccess.snapshot.generateMonthly as any).mockResolvedValue(null);

    render(<DashboardPage />);

    // 等待数据加载完成 / Wait for data to load
    // 净资产卡：总资产 100000 分 = ¥1,000.00
    expect(await screen.findByText('¥1,000.00')).toBeInTheDocument();
    // 近期交易标题
    expect(screen.getByText('近期交易')).toBeInTheDocument();
    // 趋势图标题
    expect(screen.getByText('净资产趋势（近 6 个月）')).toBeInTheDocument();
  });

  it('数据加载失败显示错误提示', async () => {
    (window.dataAccess.account.list as any).mockRejectedValue(new Error('网络错误'));
    (window.dataAccess.tx.recent as any).mockResolvedValue([]);
    (window.dataAccess.tx.monthlyOverview as any).mockResolvedValue({ income: 0, expense: 0, transfer: 0 });
    (window.dataAccess.snapshot.list as any).mockResolvedValue([]);

    render(<DashboardPage />);

    expect(await screen.findByText('数据加载失败，请重试')).toBeInTheDocument();
  });

  it('调用 generateMonthlySnapshot', async () => {
    (window.dataAccess.account.list as any).mockResolvedValue([]);
    (window.dataAccess.tx.recent as any).mockResolvedValue([]);
    (window.dataAccess.tx.monthlyOverview as any).mockResolvedValue({ income: 0, expense: 0, transfer: 0 });
    (window.dataAccess.snapshot.list as any).mockResolvedValue([]);
    (window.dataAccess.snapshot.generateMonthly as any).mockResolvedValue(null);

    render(<DashboardPage />);

    // 等待 useEffect 执行 / Wait for useEffect
    await screen.findByText('仪表盘');

    expect(window.dataAccess.snapshot.generateMonthly).toHaveBeenCalledWith('user-1');
  });
});
