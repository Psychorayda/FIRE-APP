import { vi } from 'vitest';

// Mock recharts（jsdom 下 SVG 渲染有问题）
// Mock recharts (SVG rendering issues under jsdom)
vi.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="xaxis" />,
  YAxis: () => <div data-testid="yaxis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div data-testid="cell" />,
}));

// 净资产趋势页组件测试 / Net worth page component tests

import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TrendChart } from '@renderer/components/net-worth/TrendChart.js';
import type { TrendPoint, TimeRangeKey, MetricKey } from '@renderer/components/net-worth/net-worth-constants.js';
import { AllocationDonut } from '@renderer/components/net-worth/AllocationDonut.js';
import type { AllocationData } from '@renderer/components/net-worth/net-worth-constants.js';
import { AllocationDetail } from '@renderer/components/net-worth/AllocationDetail.js';
import { NetWorthPage } from '@renderer/pages/NetWorthPage.js';
import { useAppStore } from '@renderer/stores/app-store.js';
import type { NetWorthSnapshot } from '@shared/types/index.js';

describe('TrendChart', () => {
  const defaultProps = {
    data: [] as TrendPoint[],
    metric: 'netWorth' as MetricKey,
    timeRange: '6m' as TimeRangeKey,
    loading: false,
    onMetricChange: vi.fn(),
    onTimeRangeChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('空数据显示空状态提示', () => {
    render(<TrendChart {...defaultProps} />);
    expect(screen.getByText('暂无趋势数据')).toBeInTheDocument();
  });

  it('仅 1 个月数据显示提示', () => {
    const data = [{ month: '2026-01', value: 1000, snapshotDate: 0 }];
    render(<TrendChart {...defaultProps} data={data} />);
    expect(screen.getByText('仅 1 个月数据，需至少 2 个月显示趋势')).toBeInTheDocument();
  });

  it('2 个及以上数据点渲染图表', () => {
    const data = [
      { month: '2026-01', value: 1000, snapshotDate: 0 },
      { month: '2026-02', value: 2000, snapshotDate: 0 },
    ];
    render(<TrendChart {...defaultProps} data={data} />);
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  it('loading 显示加载中', () => {
    render(<TrendChart {...defaultProps} loading={true} />);
    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  it('渲染 4 个时间范围按钮', () => {
    render(<TrendChart {...defaultProps} />);
    expect(screen.getByText('近3月')).toBeInTheDocument();
    expect(screen.getByText('近6月')).toBeInTheDocument();
    expect(screen.getByText('近1年')).toBeInTheDocument();
    expect(screen.getByText('全部')).toBeInTheDocument();
  });

  it('点击时间范围按钮触发 onTimeRangeChange', () => {
    render(<TrendChart {...defaultProps} />);
    fireEvent.click(screen.getByText('近3月'));
    expect(defaultProps.onTimeRangeChange).toHaveBeenCalledWith('3m');
  });

  it('渲染 4 个指标单选项', () => {
    render(<TrendChart {...defaultProps} />);
    expect(screen.getByText('净资产')).toBeInTheDocument();
    expect(screen.getByText('流动')).toBeInTheDocument();
    expect(screen.getByText('投资')).toBeInTheDocument();
    expect(screen.getByText('负债')).toBeInTheDocument();
  });

  it('点击指标单选项触发 onMetricChange', () => {
    render(<TrendChart {...defaultProps} />);
    fireEvent.click(screen.getByText('流动'));
    expect(defaultProps.onMetricChange).toHaveBeenCalledWith('liquid');
  });
});

describe('AllocationDonut', () => {
  const emptyData: AllocationData = { items: [], netWorth: 0, totalAssets: 0, hasData: false };

  const validData: AllocationData = {
    items: [
      { name: '流动资产', value: 1000, color: '#3B82F6', percent: 25 },
      { name: '投资资产', value: 2000, color: '#8B5CF6', percent: 50 },
      { name: '使用资产', value: 1000, color: '#F59E0B', percent: 25 },
      { name: '负债', value: -500, color: '#EF4444', percent: -12.5 },
    ],
    netWorth: 3500,
    totalAssets: 4000,
    hasData: true,
  };

  it('空数据显示空状态提示', () => {
    render(<AllocationDonut data={emptyData} loading={false} />);
    expect(screen.getByText('暂无配比数据')).toBeInTheDocument();
  });

  it('loading 显示加载中', () => {
    render(<AllocationDonut data={emptyData} loading={true} />);
    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  it('有数据时渲染饼图', () => {
    render(<AllocationDonut data={validData} loading={false} />);
    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
  });

  it('有数据时显示净资产中心值', () => {
    render(<AllocationDonut data={validData} loading={false} />);
    expect(screen.getByText('¥3,500.00')).toBeInTheDocument();
  });

  it('渲染标题"资产配比（最新月份）"', () => {
    render(<AllocationDonut data={validData} loading={false} />);
    expect(screen.getByText('资产配比（最新月份）')).toBeInTheDocument();
  });
});

describe('AllocationDetail', () => {
  const emptyData: AllocationData = { items: [], netWorth: 0, totalAssets: 0, hasData: false };

  const validData: AllocationData = {
    items: [
      { name: '流动资产', value: 1000, color: '#3B82F6', percent: 25 },
      { name: '投资资产', value: 2000, color: '#8B5CF6', percent: 50 },
      { name: '使用资产', value: 1000, color: '#F59E0B', percent: 25 },
      { name: '负债', value: -500, color: '#EF4444', percent: -12.5 },
    ],
    netWorth: 3500,
    totalAssets: 4000,
    hasData: true,
  };

  it('空数据显示空状态提示', () => {
    render(<AllocationDetail data={emptyData} />);
    expect(screen.getByText('暂无明细数据')).toBeInTheDocument();
  });

  it('有数据时显示 4 类资产', () => {
    render(<AllocationDetail data={validData} />);
    expect(screen.getByText('流动资产')).toBeInTheDocument();
    expect(screen.getByText('投资资产')).toBeInTheDocument();
    expect(screen.getByText('使用资产')).toBeInTheDocument();
    expect(screen.getByText('负债')).toBeInTheDocument();
  });

  it('显示金额', () => {
    render(<AllocationDetail data={validData} />);
    // 流动资产与使用资产均为 1000 元，命中 2 处
    expect(screen.getAllByText('¥1,000.00')).toHaveLength(2);
    expect(screen.getByText('¥2,000.00')).toBeInTheDocument();
    // Intl zh-CN CNY 负数格式为 -¥500.00（负号在 ¥ 前）
    expect(screen.getByText('-¥500.00')).toBeInTheDocument();
  });

  it('显示百分比', () => {
    render(<AllocationDetail data={validData} />);
    // 流动资产与使用资产均为 25%，命中 2 处
    expect(screen.getAllByText('25.0%')).toHaveLength(2);
    expect(screen.getByText('50.0%')).toBeInTheDocument();
    expect(screen.getByText('-12.5%')).toBeInTheDocument();
  });

  it('显示净资产合计', () => {
    render(<AllocationDetail data={validData} />);
    expect(screen.getByText('净资产')).toBeInTheDocument();
    expect(screen.getByText('¥3,500.00')).toBeInTheDocument();
  });

  it('渲染标题"明细"', () => {
    render(<AllocationDetail data={validData} />);
    expect(screen.getByText('明细')).toBeInTheDocument();
  });
});

function makeSnapshotForPage(overrides: Partial<NetWorthSnapshot>): NetWorthSnapshot {
  return {
    id: 's1',
    user_id: 'user-1',
    snapshot_date: 0,
    snapshot_year_month: '2026-01',
    total_liquid: 0,
    total_invested: 0,
    total_use_asset: 0,
    total_liability: 0,
    net_worth: 0,
    sync_version: 0,
    updated_at: 0,
    deleted_flag: 0,
    ...overrides,
  };
}

describe('NetWorthPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({ currentUser: { id: 'user-1', display_name: '测试用户' } as any });
  });

  it('渲染页头"净资产趋势"', async () => {
    (window.dataAccess.snapshot.list as any).mockResolvedValue([]);
    render(<NetWorthPage />);
    expect(screen.getByText('净资产趋势')).toBeInTheDocument();
  });

  it('加载中显示加载状态', () => {
    (window.dataAccess.snapshot.list as any).mockReturnValue(new Promise(() => {}));
    render(<NetWorthPage />);
    // 加载中时趋势图和配比图都显示加载中（至少 1 个）
    expect(screen.getAllByText('加载中...').length).toBeGreaterThanOrEqual(1);
  });

  it('数据加载完成后渲染所有模块', async () => {
    const snapshots = [
      makeSnapshotForPage({ id: 's1', snapshot_year_month: '2026-01', net_worth: 100000, total_liquid: 50000 }),
      makeSnapshotForPage({ id: 's2', snapshot_year_month: '2026-02', net_worth: 200000, total_liquid: 80000 }),
    ];
    (window.dataAccess.snapshot.list as any).mockResolvedValue(snapshots);
    render(<NetWorthPage />);
    // 等待数据加载完成，趋势图渲染
    expect(await screen.findByTestId('line-chart')).toBeInTheDocument();
    // 配比图渲染
    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
    // 明细显示
    expect(screen.getByText('流动资产')).toBeInTheDocument();
  });

  it('数据加载失败显示错误提示', async () => {
    (window.dataAccess.snapshot.list as any).mockRejectedValue(new Error('网络错误'));
    render(<NetWorthPage />);
    expect(await screen.findByText('数据加载失败，请重试')).toBeInTheDocument();
  });

  it('空数据显示各模块空状态', async () => {
    (window.dataAccess.snapshot.list as any).mockResolvedValue([]);
    render(<NetWorthPage />);
    // 等待加载完成，空状态出现
    expect(await screen.findByText('暂无趋势数据')).toBeInTheDocument();
    // 配比图空状态
    expect(screen.getByText('暂无配比数据')).toBeInTheDocument();
    // 明细空状态
    expect(screen.getByText('暂无明细数据')).toBeInTheDocument();
  });
});
