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
