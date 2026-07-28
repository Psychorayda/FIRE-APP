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
